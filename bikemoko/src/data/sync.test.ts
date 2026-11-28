import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTestDb, db } from './db';
import { camelRow, cloudConfigured, isTransientError, PULL_TABLES, pullAll, pushOutbox, retryFailed, startSync, syncEnabled, syncStatus, toRpc, type RpcClient } from './sync';

const IDEM = '11111111-1111-4111-8111-111111111111';
const AT = '2026-03-01T09:00:00.000Z';

describe('toRpc: outbox action to RPC', () => {
  it('maps a sale and takes the location from the ledger rows', () => {
    const sale = { id: 's1' };
    const movements = [{ id: 'm1', from: 'WAREHOUSE' }];
    expect(toRpc('record_sale', { sale, movements }, IDEM, AT)).toEqual({
      fn: 'record_sale',
      args: { p_idem: IDEM, p_sale: sale, p_movements: movements, p_location: 'WAREHOUSE', p_client_at: AT },
    });
    expect(toRpc('record_sale', { sale, movements: [] }, IDEM, AT)!.args.p_location).toBe('STORE');
  });

  it('maps stock actions', () => {
    const movements = [{ id: 'm1' }];
    for (const a of ['transfer_stock', 'adjust_stock']) {
      expect(toRpc(a, { movements }, IDEM, AT)).toEqual({ fn: a, args: { p_idem: IDEM, p_movements: movements, p_client_at: AT } });
    }
    expect(toRpc('update_level', { id: 'p:STORE', bin: 'A1' }, IDEM, AT)).toEqual({ fn: 'update_level', args: { p_idem: IDEM, p_level: { id: 'p:STORE', bin: 'A1' } } });
  });

  it('maps product creation and CSV import to create_products', () => {
    const product = { id: 'p1' };
    expect(toRpc('create_product', { product, movements: [{ id: 'm' }] }, IDEM, AT)).toEqual({
      fn: 'create_products',
      args: { p_idem: IDEM, p_products: [product], p_levels: [], p_movements: [{ id: 'm' }], p_client_at: AT },
    });
    expect(toRpc('import_products', { products: [product], levels: [{ productId: 'p1' }], movements: [] }, IDEM, AT)!.args).toMatchObject({
      p_products: [product],
      p_levels: [{ productId: 'p1' }],
    });
  });

  it('maps purchase orders', () => {
    expect(toRpc('create_po', { id: 'po1' }, IDEM, AT)).toEqual({ fn: 'create_po', args: { p_idem: IDEM, p_po: { id: 'po1' } } });
    expect(toRpc('set_po_status', { id: 'po1', status: 'sent' }, IDEM, AT)!.args).toEqual({ p_idem: IDEM, p_id: 'po1', p_status: 'sent' });
    expect(toRpc('receive_po', { po: { id: 'po1' }, movements: [{ id: 'm' }] }, IDEM, AT)).toEqual({
      fn: 'receive_po',
      args: { p_idem: IDEM, p_po_id: 'po1', p_movements: [{ id: 'm' }], p_client_at: AT },
    });
  });

  it('maps repair actions', () => {
    const wo = { id: 'w1' };
    expect(toRpc('approve_estimate_to_job', { wo }, IDEM, AT)!.args).toEqual({ p_idem: IDEM, p_wo: wo, p_client_at: AT });
    expect(toRpc('create_job', wo, IDEM, AT)!.args).toEqual({ p_idem: IDEM, p_wo: wo, p_client_at: AT });
    expect(toRpc('save_estimate', { id: 'e1' }, IDEM, AT)).toEqual({ fn: 'save_estimate', args: { p_idem: IDEM, p_est: { id: 'e1' } } });
    expect(toRpc('reschedule_job', { id: 'w1', mechanicId: 'm1', bay: 'Bay 1', start: 'a', end: 'b' }, IDEM, AT)!.args).toEqual({
      p_idem: IDEM, p_id: 'w1', p_mechanic_id: 'm1', p_bay: 'Bay 1', p_start: 'a', p_end: 'b',
    });
    expect(toRpc('set_job_status', { id: 'w1', to: 'ready' }, IDEM, AT)).toEqual({
      fn: 'set_job_status',
      args: { p_idem: IDEM, p_id: 'w1', p_to: 'ready', p_client_at: AT },
    });
    expect(toRpc('toggle_timer', { id: 'w1' }, IDEM, AT)!.args).toEqual({ p_idem: IDEM, p_id: 'w1', p_client_at: AT });
    expect(toRpc('add_job_part', { id: 'w1', productId: 'p1', qty: 2 }, IDEM, AT)!.args).toEqual({ p_idem: IDEM, p_id: 'w1', p_product_id: 'p1', p_qty: 2 });
    expect(toRpc('update_job', { id: 'w1', intakeNotes: 'x', deposit: 5 }, IDEM, AT)!.args).toEqual({
      p_idem: IDEM, p_id: 'w1', p_patch: { intakeNotes: 'x', deposit: 5 },
    });
  });

  it('maps billing, notifications and shifts', () => {
    const sale = { id: 's1', workOrderId: 'w1' };
    expect(toRpc('complete_repair_billing', { sale, movements: [] }, IDEM, AT)).toEqual({
      fn: 'complete_repair_billing',
      args: { p_idem: IDEM, p_sale: sale, p_movements: [], p_client_at: AT },
    });
    expect(toRpc('log_notification', { id: 'n1' }, IDEM, AT)!.fn).toBe('log_notification');
    expect(toRpc('open_shift', { id: 'sh1' }, IDEM, AT)!.args).toEqual({ p_idem: IDEM, p_row: { id: 'sh1' } });
    expect(toRpc('close_shift', { id: 'sh1', countedCash: 5000 }, IDEM, AT)!.args).toEqual({ p_idem: IDEM, p_id: 'sh1', p_counted: 5000, p_client_at: AT });
  });

  it('maps catalogue edits to upsert_row and supplier price deletes to delete_row', () => {
    const cases: [string, string][] = [
      ['upsert_customer', 'customers'], ['save_customer', 'customers'], ['upsert_bike', 'customer_bikes'], ['save_bike', 'customer_bikes'],
      ['update_settings', 'settings'], ['upsert_staff', 'staff'], ['upsert_service', 'services'], ['create_supplier', 'suppliers'],
      ['update_supplier', 'suppliers'], ['save_supplier_product', 'supplier_products'], ['update_product', 'products'],
    ];
    for (const [action, table] of cases) {
      expect(toRpc(action, { id: 'x' }, IDEM, AT)).toEqual({ fn: 'upsert_row', args: { p_idem: IDEM, p_table: table, p_row: { id: 'x' } } });
    }
    expect(toRpc('delete_supplier_product', { id: 'sp1' }, IDEM, AT)).toEqual({
      fn: 'delete_row',
      args: { p_idem: IDEM, p_table: 'supplier_products', p_id: 'sp1' },
    });
  });

  it('returns null for an unknown action and always carries the idempotency key', () => {
    expect(toRpc('frobnicate', {}, IDEM, AT)).toBeNull();
    expect(toRpc('toggle_timer', { id: 'w' }, IDEM, AT)!.args.p_idem).toBe(IDEM);
  });
});

describe('isTransientError', () => {
  it('treats network, auth-expiry and server errors as retryable and business errors as final', () => {
    expect(isTransientError({ message: 'TypeError: Failed to fetch' }, 0)).toBe(true);
    expect(isTransientError({ message: 'x' }, 503)).toBe(true);
    expect(isTransientError({ message: 'JWT expired' }, 401)).toBe(true);
    expect(isTransientError({ message: 'Only 1 available in store', code: 'BK001' }, 400)).toBe(false);
    expect(isTransientError({ message: 'Your role (cashier) cannot do this', code: '42501' }, 403)).toBe(false);
    // Auth problems must never park a row
    expect(isTransientError({ message: 'Invalid JWT' }, 401)).toBe(true);
    expect(isTransientError({ message: 'permission denied for table stock_levels', code: '42501' }, 403)).toBe(true);
    expect(isTransientError({ message: 'Your role (not signed in) cannot do this', code: '42501' }, 403)).toBe(true);
    expect(isTransientError({ message: 'JWT expired', code: 'PGRST301' }, 400)).toBe(true);
    expect(isTransientError({ message: 'Load failed' }, 0)).toBe(true);
    expect(isTransientError(null, 0)).toBe(false);
  });
});

describe('pushOutbox', () => {
  beforeEach(() => {
    useTestDb(`sync-${Math.random()}`);
  });

  const add = (action: string, payload: unknown) =>
    db.outbox.add({ action, payload, createdAt: AT, syncedAt: null, error: null });

  it('sends rows in order, marks them synced and reuses the same idempotency key on retry', async () => {
    await add('toggle_timer', { id: 'w1' });
    await add('set_job_status', { id: 'w1', to: 'ready' });
    const seen: { fn: string; idem: string }[] = [];
    let offline = true;
    const client: RpcClient = {
      rpc: async (fn, args) => {
        if (offline) return { data: null, error: { message: 'TypeError: Failed to fetch' }, status: 0 };
        seen.push({ fn, idem: args.p_idem as string });
        return { data: { ok: true }, error: null, status: 200 };
      },
    };
    const first = await pushOutbox(client);
    expect(first.stopped).toBe(true);
    const stamped = (await db.outbox.toArray()).map((r) => (r as { idem?: string }).idem);
    expect(stamped[0]).toBeTruthy();
    expect(stamped[1]).toBeUndefined(); // stopped at the first row, so order is kept

    offline = false;
    const second = await pushOutbox(client);
    expect(second).toMatchObject({ pushed: 2, failed: 0, stopped: false });
    expect(seen.map((s) => s.fn)).toEqual(['toggle_timer', 'set_job_status']);
    expect(seen[0].idem).toBe(stamped[0]);
    expect((await db.outbox.toArray()).every((r) => r.syncedAt)).toBe(true);
  });

  it('parks a rejected row with its error, carries on, and can retry it later', async () => {
    await add('record_sale', { sale: { id: 's1' }, movements: [] });
    await add('toggle_timer', { id: 'w1' });
    await add('mystery', {});
    const client: RpcClient = {
      rpc: async (fn) =>
        fn === 'record_sale'
          ? { data: null, error: { message: 'Only 0 available in store', code: 'BK001' }, status: 400 }
          : { data: { ok: true }, error: null, status: 200 },
    };
    const res = await pushOutbox(client);
    expect(res).toMatchObject({ pushed: 1, failed: 2, stopped: false });
    const rows = await db.outbox.orderBy('id').toArray();
    expect(rows[0].error).toContain('Only 0 available');
    expect(rows[0].syncedAt).toBeNull();
    expect(rows[1].syncedAt).not.toBeNull();
    expect(rows[2].error).toContain('Unknown action');
    expect((await syncStatus()).failed).toBe(2);
    expect(await retryFailed()).toBe(2);
    expect((await syncStatus()).pending).toBe(2);
  });
});

describe('pushOutbox classification and session guard', () => {
  beforeEach(() => {
    useTestDb(`sync-${Math.random()}`);
  });
  const add = (action: string, payload: unknown) => db.outbox.add({ action, payload, createdAt: AT, syncedAt: null, error: null });
  const reply = (status: number, message: string): RpcClient => ({
    rpc: async () => ({ data: null, error: { message }, status }),
  });

  it.each([
    [401, 'JWT expired'],
    [403, 'permission denied for table stock_levels'],
    [403, 'Your role (not signed in) cannot do this'],
    [0, 'TypeError: Failed to fetch'],
    [503, 'Service unavailable'],
  ])('stops and keeps rows unsynced and unparked on %i %s', async (status, message) => {
    await add('toggle_timer', { id: 'w1' });
    await add('set_job_status', { id: 'w1', to: 'ready' });
    const res = await pushOutbox(reply(status, message));
    expect(res).toMatchObject({ pushed: 0, failed: 0, stopped: true });
    const rows = await db.outbox.orderBy('id').toArray();
    expect(rows.every((r) => r.syncedAt === null && !r.error)).toBe(true);
    expect((await syncStatus()).failed).toBe(0);
    expect((await syncStatus()).pending).toBe(2);
  });

  it('parks only a genuine business error and keeps going', async () => {
    await add('record_sale', { sale: { id: 's1' }, movements: [] });
    await add('toggle_timer', { id: 'w1' });
    const client: RpcClient = {
      rpc: async (fn) =>
        fn === 'record_sale'
          ? { data: null, error: { message: 'Only 0 available in store', code: 'BK001' }, status: 400 }
          : { data: { ok: true }, error: null, status: 200 },
    };
    expect(await pushOutbox(client)).toMatchObject({ pushed: 1, failed: 1, stopped: false });
  });

  it('parks a role refusal (signed in, wrong role)', async () => {
    await add('upsert_staff', { id: 'x' });
    expect(await pushOutbox(reply(403, 'Your role (cashier) cannot do this'))).toMatchObject({ failed: 1, stopped: false });
  });

  it('sends nothing without a signed-in session', async () => {
    await add('toggle_timer', { id: 'w1' });
    let calls = 0;
    const client: RpcClient = {
      rpc: async () => {
        calls++;
        return { data: { ok: true }, error: null, status: 200 };
      },
      auth: { getSession: async () => ({ data: { session: null } }) },
    };
    expect(await pushOutbox(client)).toMatchObject({ pushed: 0, stopped: true, error: 'Sign in to sync' });
    expect(calls).toBe(0);
    expect((await syncStatus()).pending).toBe(1);
    client.auth = { getSession: async () => ({ data: { session: { user: {} } } }) };
    expect(await pushOutbox(client)).toMatchObject({ pushed: 1 });
    expect(calls).toBe(1);
  });

  it('pulls nothing without a signed-in session', async () => {
    let queried = false;
    const client = {
      auth: { getSession: async () => ({ data: { session: null } }) },
      from: () => {
        queried = true;
        throw new Error('should not query');
      },
    };
    const res = await pullAll(client as unknown as Parameters<typeof pullAll>[0]);
    expect(res).toEqual({ rows: 0, error: 'Sign in to sync' });
    expect(queried).toBe(false);
  });
});

describe('cloudConfigured', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('is false without keys and true when the URL and key are set', () => {
    expect(cloudConfigured()).toBe(false);
    vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co');
    expect(cloudConfigured()).toBe(false);
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
    expect(cloudConfigured()).toBe(true);
  });
});

describe('sync is a no-op without Supabase keys', () => {
  it('does nothing and reports disabled', async () => {
    expect(syncEnabled()).toBe(false);
    const stop = startSync();
    expect(typeof stop).toBe('function');
    stop();
    expect((await syncStatus()).enabled).toBe(false);
  });
});

describe('pull row mapping', () => {
  const t = (remote: string) => PULL_TABLES.find((x) => x.remote === remote)!;

  it('camelCases keys and normalises dates', () => {
    expect(camelRow({ id: 'a', created_at: '2026-03-01T09:00:00+00:00', updated_at: 'x', is_bundle: true })).toEqual({
      id: 'a', createdAt: '2026-03-01T09:00:00.000Z', isBundle: true,
    });
  });

  it('rebuilds stock ids, movements and nested documents', () => {
    expect(t('stock_levels').fromRow({ product_id: 'p1', location: 'STORE', quantity: 3, reserved: 1, reorder_point: 2, bin: 'A' })).toEqual({
      id: 'p1:STORE', productId: 'p1', location: 'STORE', quantity: 3, reserved: 1, reorderPoint: 2, bin: 'A',
    });
    expect(
      t('stock_movements').fromRow({ id: 'm', product_id: 'p', from_location: 'STORE', to_location: null, qty: 1, reason: 'sale', ref_id: 's', staff_id: null, note: '', created_at: AT }),
    ).toMatchObject({ id: 'm', from: 'STORE', to: null, refId: 's' });
    const po = t('purchase_orders').fromRow({
      id: 'po', po_no: 'PO-1', purchase_order_items: [
        { line_no: 2, product_id: 'b', qty: 1, unit_cost: '5', received_qty: 0 },
        { line_no: 1, product_id: 'a', qty: 2, unit_cost: 7, received_qty: 1 },
      ],
    });
    expect(po.items.map((i: { productId: string }) => i.productId)).toEqual(['a', 'b']);
    const sale = t('sales').fromRow({
      id: 's', receipt_no: 'R-1', subtotal: 100, discount: 0, total: 100, change: 0,
      sale_items: [{ line_no: 1, product_id: null, name: 'Labour', qty: 1, unit_price: 100, serial: '', kind: 'labor' }],
      payments: [{ line_no: 1, method: 'cash', amount: 100, ref: '' }],
    });
    expect(sale.lines[0]).toMatchObject({ productId: null, kind: 'labor' });
    expect(sale.payments).toEqual([{ method: 'cash', amount: 100, ref: '' }]);
    const wo = t('work_orders').fromRow({
      id: 'w', job_no: 'J-1', deposit: 5, scheduled_start: AT,
      work_order_items: [{ id: 'l1', line_no: 1, kind: 'part', ref_id: 'p', name: 'Chain', qty: 1, unit_price: 9, duration_mins: 0, short: true }],
    });
    expect(wo.lines[0]).toEqual({ id: 'l1', kind: 'part', refId: 'p', name: 'Chain', qty: 1, unitPrice: 9, durationMins: 0, short: true });
    expect(wo.scheduledStart).toBe(AT);
  });
});
