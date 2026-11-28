/// <reference types="vite/client" />
// Cloud sync (Supabase). A complete no-op unless VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set at build time.
//
// Each cycle: push unsynced `db.outbox` rows in order to the matching RPC in supabase/schema.sql, then pull every table
// changed since the last pull (updated_at) into Dexie. Realtime on stock_levels and work_orders makes other devices
// update within a second or two.
//
// Wire it in with one line in src/app/App.tsx (or main.tsx):   import { startSync } from '@/data/sync'; startSync();
import { db } from './db';
import type { OutboxRow } from './db';

// ---------------------------------------------------------------------------------------------------------------
// Outbox action -> RPC mapping (pure, unit tested)

export interface RpcCall {
  fn: string;
  args: Record<string, unknown>;
}

type Payload = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Catalogue actions that become a generic upsert_row call, with the cloud table they write. */
const UPSERT_TABLE: Record<string, string> = {
  upsert_customer: 'customers',
  save_customer: 'customers',
  upsert_bike: 'customer_bikes',
  save_bike: 'customer_bikes',
  update_settings: 'settings',
  upsert_staff: 'staff',
  upsert_service: 'services',
  create_supplier: 'suppliers',
  update_supplier: 'suppliers',
  save_supplier_product: 'supplier_products',
  update_product: 'products',
};

/**
 * Turn one outbox row into the RPC call that replays it on the server.
 * `idem` is the row's stable client-generated uuid; `clientAt` is when the action happened on the device.
 * Returns null for an action this build does not know.
 */
export function toRpc(action: string, payload: unknown, idem: string, clientAt: string): RpcCall | null {
  const p = (payload ?? {}) as Payload;
  const base = { p_idem: idem };
  const table = UPSERT_TABLE[action];
  if (table) return { fn: 'upsert_row', args: { ...base, p_table: table, p_row: p } };
  switch (action) {
    case 'record_sale': {
      const movements: Payload[] = p.movements ?? [];
      return {
        fn: 'record_sale',
        args: { ...base, p_sale: p.sale, p_movements: movements, p_location: movements[0]?.from ?? 'STORE', p_client_at: clientAt },
      };
    }
    case 'transfer_stock':
      return { fn: 'transfer_stock', args: { ...base, p_movements: p.movements ?? [], p_client_at: clientAt } };
    case 'adjust_stock':
      return { fn: 'adjust_stock', args: { ...base, p_movements: p.movements ?? [], p_client_at: clientAt } };
    case 'update_level':
      return { fn: 'update_level', args: { ...base, p_level: p } };
    case 'create_product':
      return { fn: 'create_products', args: { ...base, p_products: [p.product], p_levels: [], p_movements: p.movements ?? [], p_client_at: clientAt } };
    case 'import_products':
      return {
        fn: 'create_products',
        args: { ...base, p_products: p.products ?? [], p_levels: p.levels ?? [], p_movements: p.movements ?? [], p_client_at: clientAt },
      };
    case 'create_po':
      return { fn: 'create_po', args: { ...base, p_po: p } };
    case 'set_po_status':
      return { fn: 'set_po_status', args: { ...base, p_id: p.id, p_status: p.status } };
    case 'receive_po':
      return { fn: 'receive_po', args: { ...base, p_po_id: p.po?.id, p_movements: p.movements ?? [], p_client_at: clientAt } };
    case 'save_estimate':
      return { fn: 'save_estimate', args: { ...base, p_est: p } };
    case 'approve_estimate_to_job':
      return { fn: 'approve_estimate_to_job', args: { ...base, p_wo: p.wo, p_client_at: clientAt } };
    case 'create_job':
      return { fn: 'create_job', args: { ...base, p_wo: p, p_client_at: clientAt } };
    case 'reschedule_job':
      return {
        fn: 'reschedule_job',
        args: { ...base, p_id: p.id, p_mechanic_id: p.mechanicId ?? null, p_bay: p.bay, p_start: p.start, p_end: p.end },
      };
    case 'set_job_status':
      return { fn: 'set_job_status', args: { ...base, p_id: p.id, p_to: p.to, p_client_at: clientAt } };
    case 'toggle_timer':
      return { fn: 'toggle_timer', args: { ...base, p_id: p.id, p_client_at: clientAt } };
    case 'add_job_part':
      return { fn: 'add_job_part', args: { ...base, p_id: p.id, p_product_id: p.productId, p_qty: p.qty } };
    case 'update_job': {
      const { id, ...patch } = p;
      return { fn: 'update_job', args: { ...base, p_id: id, p_patch: patch } };
    }
    case 'complete_repair_billing':
      return { fn: 'complete_repair_billing', args: { ...base, p_sale: p.sale, p_movements: p.movements ?? [], p_client_at: clientAt } };
    case 'log_notification':
      return { fn: 'log_notification', args: { ...base, p_row: p } };
    case 'open_shift':
      return { fn: 'open_shift', args: { ...base, p_row: p } };
    case 'close_shift':
      return { fn: 'close_shift', args: { ...base, p_id: p.id, p_counted: p.countedCash, p_client_at: clientAt } };
    case 'delete_supplier_product':
      return { fn: 'delete_row', args: { ...base, p_table: 'supplier_products', p_id: p.id } };
    default:
      return null;
  }
}

/** Network trouble, server outage or an expired login: keep the row and try again later. Anything else is a business rejection. */
export function isTransientError(error: { message?: string; code?: string } | null, status = 0): boolean {
  if (!error) return false;
  if (status === 0 || status === 401 || status === 408 || status === 429 || status >= 500) return true;
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|timed? ?out|jwt expired/i.test(error.message ?? '');
}

// ---------------------------------------------------------------------------------------------------------------
// Push

/** The slice of the Supabase client the push loop needs. Lets tests pass a fake. */
export interface RpcClient {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string; code?: string } | null; status: number }>;
}

type StampedRow = OutboxRow & { idem?: string };

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

/** Every outbox row gets one uuid, saved before the first send and reused on every retry, so the server can drop duplicates. */
async function stampIdem(row: StampedRow): Promise<string> {
  if (row.idem) return row.idem;
  const idem = newId();
  await db.outbox.update(row.id!, { idem } as Partial<OutboxRow>);
  row.idem = idem;
  return idem;
}

export const pendingRows = () => db.outbox.filter((r) => r.syncedAt === null && !r.error).sortBy('id');

export interface PushResult {
  pushed: number;
  failed: number;
  /** true when the loop stopped early because the network or login is down */
  stopped: boolean;
  error?: string;
}

/** Send unsynced rows oldest first. Stops on a transient error (order is kept); a rejected row is parked with its error and the rest continue. */
export async function pushOutbox(client: RpcClient): Promise<PushResult> {
  const result: PushResult = { pushed: 0, failed: 0, stopped: false };
  for (const row of (await pendingRows()) as StampedRow[]) {
    const idem = await stampIdem(row);
    const call = toRpc(row.action, row.payload, idem, row.createdAt);
    if (!call) {
      await db.outbox.update(row.id!, { error: `Unknown action: ${row.action}` });
      result.failed++;
      continue;
    }
    let res: Awaited<ReturnType<RpcClient['rpc']>>;
    try {
      res = await client.rpc(call.fn, call.args);
    } catch (e) {
      result.stopped = true;
      result.error = e instanceof Error ? e.message : String(e);
      return result;
    }
    if (res.error) {
      if (isTransientError(res.error, res.status)) {
        result.stopped = true;
        result.error = res.error.message;
        return result;
      }
      await db.outbox.update(row.id!, { error: res.error.message });
      result.failed++;
      continue;
    }
    await db.outbox.update(row.id!, { syncedAt: new Date().toISOString(), error: null });
    result.pushed++;
  }
  return result;
}

/** Put every parked (rejected) row back in the queue. */
export async function retryFailed(): Promise<number> {
  const rows = await db.outbox.filter((r) => r.syncedAt === null && !!r.error).toArray();
  for (const r of rows) await db.outbox.update(r.id!, { error: null });
  return rows.length;
}

// ---------------------------------------------------------------------------------------------------------------
// Pull

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const DATE_KEYS = new Set([
  'createdAt', 'expectedDate', 'receivedDate', 'scheduledStart', 'scheduledEnd', 'actualStart', 'actualEnd', 'timerSince', 'openedAt', 'closedAt',
]);

const camelKey = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

/** snake_case row from Postgres -> camelCase Dexie row (dates normalised to ISO, updated_at dropped). */
export function camelRow(r: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(r)) {
    if (k === 'updated_at') continue;
    const key = camelKey(k);
    out[key] = DATE_KEYS.has(key) && typeof v === 'string' ? new Date(v).toISOString() : v;
  }
  return out;
}

const byLine = (a: Row, b: Row) => a.line_no - b.line_no;

function jobLines(items: Row[] = []) {
  return [...items].sort(byLine).map((i) => ({
    id: i.id,
    kind: i.kind,
    refId: i.ref_id,
    name: i.name,
    qty: i.qty,
    unitPrice: Number(i.unit_price),
    durationMins: i.duration_mins,
    ...(i.short ? { short: true } : {}),
  }));
}

export interface PullTable {
  remote: string;
  local: 'staff' | 'products' | 'stock' | 'movements' | 'suppliers' | 'supplierProducts' | 'purchaseOrders' | 'customers' | 'bikes' | 'services' | 'estimates' | 'workOrders' | 'sales' | 'shifts' | 'notifications' | 'settings';
  select: string;
  fromRow: (r: Row) => Row;
  order: string; // tie-breaker column for stable paging
}

export const stockFromRow = (r: Row) => ({
  id: `${r.product_id}:${r.location}`,
  productId: r.product_id,
  location: r.location,
  quantity: r.quantity,
  reserved: r.reserved,
  reorderPoint: r.reorder_point,
  bin: r.bin,
});

export const PULL_TABLES: PullTable[] = [
  { remote: 'staff', local: 'staff', select: '*', order: 'id', fromRow: (r) => { const { user_id: _drop, ...rest } = r; return camelRow(rest); } },
  { remote: 'products', local: 'products', select: '*', order: 'id', fromRow: (r) => ({ ...camelRow(r), cost: Number(r.cost), price: Number(r.price) }) },
  { remote: 'stock_levels', local: 'stock', select: '*', order: 'product_id', fromRow: stockFromRow },
  {
    remote: 'stock_movements', local: 'movements', select: '*', order: 'id',
    fromRow: (r) => ({
      id: r.id, productId: r.product_id, from: r.from_location, to: r.to_location, qty: r.qty, reason: r.reason,
      refId: r.ref_id, staffId: r.staff_id, note: r.note, createdAt: new Date(r.created_at).toISOString(),
    }),
  },
  { remote: 'suppliers', local: 'suppliers', select: '*', order: 'id', fromRow: (r) => ({ ...camelRow(r), reliability: Number(r.reliability) }) },
  { remote: 'supplier_products', local: 'supplierProducts', select: '*', order: 'id', fromRow: (r) => ({ ...camelRow(r), unitCost: Number(r.unit_cost) }) },
  {
    remote: 'purchase_orders', local: 'purchaseOrders', select: '*, purchase_order_items(*)', order: 'id',
    fromRow: (r) => {
      const { purchase_order_items: items = [], ...po } = r;
      return {
        ...camelRow(po),
        items: [...items].sort(byLine).map((i: Row) => ({ productId: i.product_id, qty: i.qty, unitCost: Number(i.unit_cost), receivedQty: i.received_qty })),
      };
    },
  },
  { remote: 'customers', local: 'customers', select: '*', order: 'id', fromRow: camelRow },
  { remote: 'customer_bikes', local: 'bikes', select: '*', order: 'id', fromRow: camelRow },
  { remote: 'services', local: 'services', select: '*', order: 'id', fromRow: (r) => ({ ...camelRow(r), laborFee: Number(r.labor_fee) }) },
  {
    remote: 'work_estimates', local: 'estimates', select: '*, work_estimate_items(*)', order: 'id',
    fromRow: (r) => {
      const { work_estimate_items: items = [], ...e } = r;
      return { ...camelRow(e), lines: jobLines(items) };
    },
  },
  {
    remote: 'work_orders', local: 'workOrders', select: '*, work_order_items(*)', order: 'id',
    fromRow: (r) => {
      const { work_order_items: items = [], ...w } = r;
      return { ...camelRow(w), deposit: Number(r.deposit), lines: jobLines(items) };
    },
  },
  {
    remote: 'sales', local: 'sales', select: '*, sale_items(*), payments(*)', order: 'id',
    fromRow: (r) => {
      const { sale_items: items = [], payments = [], ...s } = r;
      return {
        ...camelRow(s),
        subtotal: Number(r.subtotal), discount: Number(r.discount), total: Number(r.total), change: Number(r.change),
        lines: [...items].sort(byLine).map((i: Row) => ({
          productId: i.product_id, name: i.name, qty: i.qty, unitPrice: Number(i.unit_price), serial: i.serial, kind: i.kind,
        })),
        payments: [...payments].sort(byLine).map((p: Row) => ({ method: p.method, amount: Number(p.amount), ref: p.ref })),
      };
    },
  },
  { remote: 'shifts', local: 'shifts', select: '*', order: 'id', fromRow: camelRow },
  { remote: 'notification_logs', local: 'notifications', select: '*', order: 'id', fromRow: camelRow },
  { remote: 'settings', local: 'settings', select: '*', order: 'id', fromRow: camelRow },
];

/** Re-read a few seconds before the last cursor, so a row committed late (or with an equal timestamp) is never missed. */
const OVERLAP_MS = 10_000;
const PAGE = 500;

const cursorKey = (remote: string) => `sync:pull:${remote}`;

async function getCursor(remote: string): Promise<number> {
  return (await db.counters.get(cursorKey(remote)))?.n ?? 0;
}

/** Rows waiting to leave this device. While any exist, incoming server rows must not overwrite local state. */
const hasPending = () => db.outbox.filter((r) => r.syncedAt === null && !r.error).count().then((n) => n > 0);

/** Write server rows into Dexie unless local changes are still waiting to be sent. Returns false if skipped. */
export async function applyRows(t: PullTable, rows: Row[]): Promise<boolean> {
  const table = db[t.local] as unknown as { bulkPut(rows: Row[]): Promise<unknown> };
  return db.transaction('rw', [db[t.local], db.outbox], async () => {
    if (await hasPending()) return false;
    await table.bulkPut(rows.map(t.fromRow));
    return true;
  });
}

// Minimal shape of the query builder used below, so this file does not need the supabase-js types at compile time.
interface QueryClient {
  from(table: string): {
    select(cols: string): {
      gte(col: string, v: string): {
        order(col: string, o: { ascending: boolean }): {
          order(col: string, o: { ascending: boolean }): {
            range(a: number, b: number): PromiseLike<{ data: Row[] | null; error: { message: string } | null; status?: number }>;
          };
        };
      };
    };
  };
}

export async function pullAll(client: QueryClient): Promise<{ rows: number; error?: string; skipped?: boolean }> {
  let total = 0;
  for (const t of PULL_TABLES) {
    let cursor = await getCursor(t.remote);
    let newest = cursor;
    const since = new Date(Math.max(0, cursor - OVERLAP_MS)).toISOString();
    for (let offset = 0; ; offset += PAGE) {
      const { data, error, status } = await client
        .from(t.remote)
        .select(t.select)
        .gte('updated_at', since)
        .order('updated_at', { ascending: true })
        .order(t.order, { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (error) return { rows: total, error: `${t.remote}: ${error.message}${status ? ` (${status})` : ''}` };
      const rows = data ?? [];
      if (rows.length) {
        if (!(await applyRows(t, rows))) return { rows: total, skipped: true };
        total += rows.length;
        for (const r of rows) newest = Math.max(newest, new Date(r.updated_at).getTime());
      }
      if (rows.length < PAGE) break;
    }
    if (newest > cursor) {
      cursor = newest;
      await db.counters.put({ id: cursorKey(t.remote), n: cursor });
    }
  }
  return { rows: total };
}

// ---------------------------------------------------------------------------------------------------------------
// Engine

export interface SyncStatus {
  /** false when the build has no Supabase keys: nothing syncs and the app is purely local */
  enabled: boolean;
  /** rows waiting to be sent */
  pending: number;
  /** rows the server rejected (see retryFailed) */
  failed: number;
  lastSyncedAt: string | null;
  /** the last request reached the server */
  connected: boolean;
  /** the realtime channel is live */
  realtime: boolean;
  signedIn: boolean;
  error: string | null;
}

const env = import.meta.env as Record<string, string | undefined>;
export const syncEnabled = () => !!(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY);

const state = { lastSyncedAt: null as string | null, connected: false, realtime: false, signedIn: false, error: null as string | null };

export async function syncStatus(): Promise<SyncStatus> {
  const [pending, failed] = await Promise.all([
    db.outbox.filter((r) => r.syncedAt === null && !r.error).count(),
    db.outbox.filter((r) => r.syncedAt === null && !!r.error).count(),
  ]);
  return { enabled: syncEnabled(), pending, failed, ...state };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;
let client: Client | null = null;
let starting: Promise<Client> | null = null;

async function getClient(): Promise<Client> {
  if (client) return client;
  starting ??= import('@supabase/supabase-js').then(({ createClient }) => {
    client = createClient(env.VITE_SUPABASE_URL!, env.VITE_SUPABASE_ANON_KEY!, { auth: { persistSession: true, autoRefreshToken: true } });
    return client;
  });
  return starting;
}

/** Sign this device in. RPCs need a Supabase user whose id is set as staff.user_id. */
export async function signIn(email: string, password: string): Promise<string | null> {
  if (!syncEnabled()) return 'Cloud sync is not set up in this build';
  const c = await getClient();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) return error.message;
  state.signedIn = true;
  void kick();
  return null;
}

export async function signOut(): Promise<void> {
  if (!syncEnabled()) return;
  await (await getClient()).auth.signOut();
  state.signedIn = false;
}

/** One-time: send this device's catalogue and opening stock to an empty cloud (owner only). */
export async function uploadLocalSnapshot(): Promise<string | null> {
  if (!syncEnabled()) return 'Cloud sync is not set up in this build';
  const c = await getClient();
  const data = {
    settings: await db.settings.toArray(), staff: await db.staff.toArray(), suppliers: await db.suppliers.toArray(),
    services: await db.services.toArray(), customers: await db.customers.toArray(), bikes: await db.bikes.toArray(),
    products: await db.products.toArray(), supplierProducts: await db.supplierProducts.toArray(), stock: await db.stock.toArray(),
  };
  const { error } = await c.rpc('bootstrap_import', { p_idem: newId(), p_data: data });
  return error ? error.message : null;
}

let running = false;
let again = false;
let failures = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

/** Run push then pull now (or as soon as the current run ends). */
async function kick(): Promise<void> {
  if (!syncEnabled()) return;
  if (running) {
    again = true;
    return;
  }
  running = true;
  try {
    const c = await getClient();
    const session = (await c.auth.getSession()).data.session;
    state.signedIn = !!session;
    if (!session) {
      state.error = 'Sign in to sync';
      state.connected = false;
      schedule(true);
      return;
    }
    const pushed = await pushOutbox(c as RpcClient);
    if (pushed.stopped) {
      state.connected = false;
      state.error = pushed.error ?? 'Offline';
      schedule(true);
      return;
    }
    const pulled = await pullAll(c as QueryClient);
    if (pulled.error) {
      state.connected = false;
      state.error = pulled.error;
      schedule(true);
      return;
    }
    failures = 0;
    state.connected = true;
    state.error = null;
    state.lastSyncedAt = new Date().toISOString();
    schedule(false);
  } catch (e) {
    state.connected = false;
    state.error = e instanceof Error ? e.message : String(e);
    schedule(true);
  } finally {
    running = false;
    if (again) {
      again = false;
      void kick();
    }
  }
}

/** Next run: 30 s after a good cycle; after a failure back off 2, 4, 8 ... up to 60 s (plus jitter). */
function schedule(failed: boolean) {
  if (timer) clearTimeout(timer);
  failures = failed ? failures + 1 : 0;
  const delay = failed ? Math.min(60_000, 2000 * 2 ** Math.min(failures - 1, 5)) + Math.random() * 1000 : 30_000;
  timer = setTimeout(() => void kick(), delay);
}

let stopFn: (() => void) | null = null;

/**
 * Start background sync. Safe to call more than once. Returns a stop function.
 * Does nothing (and returns a no-op) when the Supabase keys are not set.
 */
export function startSync(): () => void {
  if (!syncEnabled()) return () => {};
  if (stopFn) return stopFn;

  const onOnline = () => void kick();
  const onVisible = () => document.visibilityState === 'visible' && void kick();
  const onNewOutbox = () => void setTimeout(() => void kick(), 300);
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  db.outbox.hook('creating', onNewOutbox);

  let channel: { unsubscribe(): unknown } | null = null;
  let pullSoon: ReturnType<typeof setTimeout> | null = null;
  void getClient().then((c) => {
    const bump = () => {
      if (pullSoon) clearTimeout(pullSoon);
      pullSoon = setTimeout(() => void kick(), 400);
    };
    channel = c
      .channel('bikemoko-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_levels' }, (msg: { new?: Row }) => {
        const t = PULL_TABLES.find((x) => x.remote === 'stock_levels')!;
        if (msg.new && msg.new.product_id) void applyRows(t, [msg.new]);
        bump();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_orders' }, bump)
      .subscribe((status: string) => {
        state.realtime = status === 'SUBSCRIBED';
      });
  });

  void kick();
  stopFn = () => {
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
    db.outbox.hook('creating').unsubscribe(onNewOutbox);
    if (timer) clearTimeout(timer);
    if (pullSoon) clearTimeout(pullSoon);
    void channel?.unsubscribe();
    state.realtime = false;
    stopFn = null;
  };
  return stopFn;
}
