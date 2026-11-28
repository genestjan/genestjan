import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { useTestDb, db } from './db';
import { seedIfEmpty } from './seed';
import { recordSale } from './actions';
import {
  countUnsynced, exportBackup, importProducts, resetDemoData, restoreBackup, saveService, saveSettings, saveStaff, validateBackup,
} from './settingsActions';
import { levelId } from '@/domain/stock';
import type { ImportRow } from '@/screens/settings/csv';

let n = 0;
beforeEach(async () => {
  useTestDb('s' + n++);
  await seedIfEmpty();
});

const row = (o: Partial<ImportRow> = {}): ImportRow => ({
  sku: 'NEW-1', barcode: '999', name: 'New item', category: 'Misc', brand: 'X', cost: 10000, price: 15000,
  storeQty: 4, warehouseQty: 9, storeReorder: 2, warehouseReorder: 5, serialized: false, ...o,
});

describe('importProducts', () => {
  it('creates products, both stock levels and opening movements in one go', async () => {
    const before = await db.products.count();
    const res = await importProducts([row(), row({ sku: 'NEW-2', storeQty: 0, warehouseQty: 0 })], 'staff-1');
    expect(res).toEqual({ created: 2, skippedSkus: [] });
    expect(await db.products.count()).toBe(before + 2);
    const p = (await db.products.where('sku').equals('NEW-1').first())!;
    expect(p.price).toBe(15000);
    expect((await db.stock.get(levelId(p.id, 'STORE')))).toMatchObject({ quantity: 4, reorderPoint: 2 });
    expect((await db.stock.get(levelId(p.id, 'WAREHOUSE')))).toMatchObject({ quantity: 9, reorderPoint: 5 });
    const moves = await db.movements.where('productId').equals(p.id).toArray();
    expect(moves.map((m) => [m.reason, m.to, m.qty]).sort()).toEqual([['opening', 'STORE', 4], ['opening', 'WAREHOUSE', 9]]);
    expect(moves.every((m) => m.staffId === 'staff-1')).toBe(true);
    // zero-quantity product still gets levels (so reorder points exist) but no movement
    const p2 = (await db.products.where('sku').equals('NEW-2').first())!;
    expect(await db.stock.get(levelId(p2.id, 'STORE'))).toBeDefined();
    expect(await db.movements.where('productId').equals(p2.id).count()).toBe(0);
    expect(await countUnsynced()).toBe(1);
  });

  it('skips SKUs that already exist, case-insensitively, and never overwrites', async () => {
    const existing = (await db.products.toArray())[0];
    const res = await importProducts([row({ sku: existing.sku.toLowerCase(), price: 1 }), row()]);
    expect(res.created).toBe(1);
    expect(res.skippedSkus).toHaveLength(1);
    expect((await db.products.get(existing.id))!.price).toBe(existing.price);
  });

  it('adds nothing and no outbox row for an empty import', async () => {
    const out = await db.outbox.count();
    expect(await importProducts([])).toEqual({ created: 0, skippedSkus: [] });
    expect(await db.outbox.count()).toBe(out);
  });
});

describe('saveSettings, staff, services', () => {
  it('validates and saves shop settings', async () => {
    const cur = (await db.settings.get('shop'))!;
    const { id: _id, ...rest } = cur;
    await expect(saveSettings({ ...rest, closeHour: rest.openHour })).rejects.toThrow(/Closing/);
    await expect(saveSettings({ ...rest, warrantyDays: 0 })).rejects.toThrow(/Day counts/);
    await saveSettings({ ...rest, shopName: ' Bikemoko GenSan ', warrantyDays: 45 });
    expect(await db.settings.get('shop')).toMatchObject({ shopName: 'Bikemoko GenSan', warrantyDays: 45 });
  });

  it('enforces PIN format, unique active PINs and at least one owner', async () => {
    const staff = await db.staff.toArray();
    const owner = staff.find((s) => s.role === 'owner')!;
    const cashier = staff.find((s) => s.role === 'cashier')!;
    await expect(saveStaff({ ...cashier, pin: '12' })).rejects.toThrow(/4 digits/);
    await expect(saveStaff({ ...cashier, pin: owner.pin })).rejects.toThrow(/already uses/);
    await expect(saveStaff({ ...owner, active: false })).rejects.toThrow(/at least one active owner/);
    await expect(saveStaff({ ...owner, role: 'cashier' })).rejects.toThrow(/at least one active owner/);
    await saveStaff({ ...cashier, pin: '9021', skills: [' till ', ''] });
    expect(await db.staff.get(cashier.id)).toMatchObject({ pin: '9021', skills: ['till'] });
    const added = await saveStaff({ name: 'New Mech', role: 'mechanic', pin: '5566', skills: [], dailyCapacityMins: 480, color: '#22c55e', active: true });
    expect(await db.staff.get(added.id)).toBeDefined();
  });

  it('saves a service with a clean checklist', async () => {
    const s = await saveService({ name: 'Chain Clean', category: '', laborFee: 20000, durationMins: 20, checklist: ['Degrease', '  ', 'Lube'], active: true });
    expect(await db.services.get(s.id)).toMatchObject({ category: 'General', checklist: ['Degrease', 'Lube'] });
    await expect(saveService({ ...s, name: ' ' })).rejects.toThrow();
  });
});

describe('backup, restore, reset', () => {
  it('round-trips everything through a backup', async () => {
    const p = (await db.products.toArray())[0];
    await recordSale({ lines: [{ productId: p.id, qty: 1, unitPrice: p.price, serial: p.isSerialized ? 'SER1' : '' }], payments: [{ method: 'cash', amount: p.price, ref: '' }], discount: 0 });
    const backup = JSON.parse(JSON.stringify(await exportBackup()));
    expect(validateBackup(backup)).toBeNull();
    const sales = await db.sales.count();
    const products = await db.products.count();

    await db.sales.clear();
    await db.products.clear();
    await db.customers.add({ id: 'extra', name: 'Extra', phone: '', messenger: '', channel: 'sms', notes: '', createdAt: '' });
    await restoreBackup(backup);
    expect(await db.sales.count()).toBe(sales);
    expect(await db.products.count()).toBe(products);
    expect(await db.customers.get('extra')).toBeUndefined();
  });

  it('refuses a bad file and leaves data alone', async () => {
    const before = await db.products.count();
    expect(validateBackup({ hello: 1 })).toMatch(/not a Bikemoko backup/);
    await expect(restoreBackup({ format: 'bikemoko-backup', version: 1, tables: {} })).rejects.toThrow(/missing/);
    expect(await db.products.count()).toBe(before);
  });

  it('a failed restore rolls back completely', async () => {
    const backup = JSON.parse(JSON.stringify(await exportBackup()));
    backup.tables.staff = [...backup.tables.staff, backup.tables.staff[0]]; // duplicate key makes bulkAdd fail
    const before = await db.products.count();
    await expect(restoreBackup(backup)).rejects.toThrow();
    expect(await db.products.count()).toBe(before);
  });

  it('reset wipes changes and reloads the demo data', async () => {
    await importProducts([row()]);
    await resetDemoData();
    expect(await db.products.where('sku').equals('NEW-1').count()).toBe(0);
    expect(await db.products.count()).toBeGreaterThan(5);
    expect(await db.staff.count()).toBe(5);
  });
});
