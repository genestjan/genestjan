// Settings module writes: shop profile, staff, services, product import, backup and restore.
import { db, type BikemokoDB } from './db';
import { seedIfEmpty } from './seed';
import { LedgerTx } from '@/domain/stock';
import { nowISO, uid } from '@/domain/util';
import type { Product, Service, Settings, Staff, StockLevel } from '@/domain/types';
import type { ImportRow } from '@/screens/settings/csv';

const out = (action: string, payload: unknown) =>
  db.outbox.add({ action, payload, createdAt: nowISO(), syncedAt: null, error: null });

// ---------- Shop profile ----------

export async function saveSettings(s: Omit<Settings, 'id'>) {
  if (!s.shopName.trim()) throw new Error('Enter the shop name');
  for (const k of ['warrantyDays', 'deadStockDays', 'followUpDays'] as const) {
    if (!Number.isInteger(s[k]) || s[k] < 1) throw new Error('Day counts must be whole numbers, 1 or more');
  }
  if (!(s.closeHour > s.openHour)) throw new Error('Closing time must be after opening time');
  const row: Settings = { ...s, id: 'shop', shopName: s.shopName.trim() };
  await db.transaction('rw', [db.settings, db.outbox], async () => {
    await db.settings.put(row);
    await out('update_settings', row);
  });
}

// ---------- Staff ----------

export async function saveStaff(input: Omit<Staff, 'id'> & { id?: string }): Promise<Staff> {
  const name = input.name.trim();
  if (!name) throw new Error('Enter the staff name');
  if (!/^\d{4}$/.test(input.pin)) throw new Error('PIN must be exactly 4 digits');
  if (!Number.isInteger(input.dailyCapacityMins) || input.dailyCapacityMins < 0) throw new Error('Daily capacity must be 0 or more minutes');
  return db.transaction('rw', [db.staff, db.outbox], async () => {
    const all = await db.staff.toArray();
    const id = input.id ?? uid();
    if (all.some((s) => s.id !== id && s.active && input.active && s.pin === input.pin)) throw new Error('Another active staff member already uses that PIN');
    const others = all.filter((s) => s.id !== id);
    if (!(input.role === 'owner' && input.active) && !others.some((s) => s.role === 'owner' && s.active)) {
      throw new Error('Keep at least one active owner');
    }
    const row: Staff = { ...input, id, name, skills: input.skills.map((x) => x.trim()).filter(Boolean) };
    await db.staff.put(row);
    await out('upsert_staff', row);
    return row;
  });
}

// ---------- Services ----------

export async function saveService(input: Omit<Service, 'id'> & { id?: string }): Promise<Service> {
  const name = input.name.trim();
  if (!name) throw new Error('Enter the service name');
  if (input.laborFee < 0) throw new Error('Fee cannot be negative');
  if (!Number.isInteger(input.durationMins) || input.durationMins < 0) throw new Error('Duration must be 0 or more minutes');
  const row: Service = {
    ...input,
    id: input.id ?? uid(),
    name,
    category: input.category.trim() || 'General',
    checklist: input.checklist.map((x) => x.trim()).filter(Boolean),
  };
  await db.transaction('rw', [db.services, db.outbox], async () => {
    await db.services.put(row);
    await out('upsert_service', row);
  });
  return row;
}

// ---------- Product import ----------

export interface ImportResult {
  created: number;
  skippedSkus: string[]; // SKUs that already existed
}

/**
 * Create products with their stock levels and an 'opening' movement for any starting quantity.
 * Everything happens in one transaction. SKUs already in the catalogue are skipped, never overwritten.
 */
export async function importProducts(rows: ImportRow[], staffId?: string | null): Promise<ImportResult> {
  return db.transaction('rw', [db.products, db.stock, db.movements, db.outbox], async () => {
    const existing = new Set((await db.products.toArray()).map((p) => p.sku.toLowerCase()));
    const fresh: ImportRow[] = [];
    const skippedSkus: string[] = [];
    for (const r of rows) {
      const key = r.sku.toLowerCase();
      if (existing.has(key)) skippedSkus.push(r.sku);
      else {
        existing.add(key);
        fresh.push(r);
      }
    }
    const now = nowISO();
    const tx = new LedgerTx([]);
    const products: Product[] = [];
    const levels: StockLevel[] = [];
    for (const r of fresh) {
      const id = uid();
      products.push({
        id, sku: r.sku, barcode: r.barcode, name: r.name, category: r.category, brand: r.brand,
        isSerialized: r.serialized, isBundle: false, bundleItems: [], cost: r.cost, price: r.price,
        unit: 'pc', active: true, createdAt: now,
      });
      const store = tx.get(id, 'STORE');
      const wh = tx.get(id, 'WAREHOUSE');
      store.reorderPoint = r.storeReorder;
      wh.reorderPoint = r.warehouseReorder;
      if (r.storeQty > 0) tx.in(id, 'STORE', r.storeQty, { reason: 'opening', staffId, note: 'CSV import' });
      if (r.warehouseQty > 0) tx.in(id, 'WAREHOUSE', r.warehouseQty, { reason: 'opening', staffId, note: 'CSV import' });
      levels.push(store, wh);
    }
    await db.products.bulkAdd(products);
    await db.stock.bulkPut(levels);
    await db.movements.bulkAdd(tx.movements);
    if (products.length) await out('import_products', { products, levels, movements: tx.movements });
    return { created: products.length, skippedSkus };
  });
}

// ---------- Backup, restore, reset ----------

const TABLES = [
  'staff', 'products', 'stock', 'movements', 'suppliers', 'supplierProducts', 'purchaseOrders',
  'customers', 'bikes', 'services', 'estimates', 'workOrders', 'sales', 'shifts',
  'notifications', 'settings', 'counters', 'outbox',
] as const satisfies readonly (keyof BikemokoDB)[];

export const BACKUP_FORMAT = 'bikemoko-backup';

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: 1;
  exportedAt: string;
  tables: Record<(typeof TABLES)[number], unknown[]>;
}

const tableOf = (name: (typeof TABLES)[number]) => db[name] as unknown as import('dexie').Table<unknown, unknown>;

export async function exportBackup(): Promise<Backup> {
  const tables = {} as Backup['tables'];
  await db.transaction('r', TABLES.map(tableOf), async () => {
    for (const t of TABLES) tables[t] = await tableOf(t).toArray();
  });
  return { format: BACKUP_FORMAT, version: 1, exportedAt: nowISO(), tables };
}

/** Check a parsed JSON file looks like a Bikemoko backup. Returns an error message or null. */
export function validateBackup(data: unknown): string | null {
  const b = data as Partial<Backup> | null;
  if (!b || typeof b !== 'object' || b.format !== BACKUP_FORMAT) return 'This is not a Bikemoko backup file.';
  if (b.version !== 1) return 'This backup is from a different version of the app.';
  if (!b.tables || typeof b.tables !== 'object') return 'The backup has no data in it.';
  for (const t of TABLES) {
    if (!Array.isArray((b.tables as Record<string, unknown>)[t])) return `The backup is missing the "${t}" table.`;
  }
  return null;
}

/** Replace everything on this device with the backup. All or nothing. */
export async function restoreBackup(data: unknown) {
  const err = validateBackup(data);
  if (err) throw new Error(err);
  const b = data as Backup;
  await db.transaction('rw', TABLES.map(tableOf), async () => {
    for (const t of TABLES) {
      await tableOf(t).clear();
      await tableOf(t).bulkAdd(b.tables[t]);
    }
  });
}

/** Wipe every table and load the starter demo data again. */
export async function resetDemoData() {
  await db.transaction('rw', TABLES.map(tableOf), async () => {
    for (const t of TABLES) await tableOf(t).clear();
  });
  await seedIfEmpty();
}

/** Number of changes not yet pushed to the cloud. */
export const countUnsynced = () => db.outbox.filter((r) => r.syncedAt === null).count();
