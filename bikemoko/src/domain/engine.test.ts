import { describe, it, expect, beforeEach } from 'vitest';
import { LedgerTx, StockError, expandBundles, lowStock, replenishmentPickList, needsReorder, levelId } from './stock';
import { compareSuppliers, pickSupplier, reliabilityFrom } from './po';
import { jobTotals, findConflicts, canMove, bookedMins } from './jobs';
import { settle, applyDiscount } from './payments';
import { channelLink, phPhone, messageFor } from './notify';
import { toCentavos } from './util';
import type { Product, StockLevel, Supplier, SupplierProduct, WorkOrder, PurchaseOrder } from './types';

const lvl = (productId: string, location: 'STORE' | 'WAREHOUSE', quantity: number, reorderPoint = 0, reserved = 0): StockLevel => ({
  id: levelId(productId, location), productId, location, quantity, reserved, reorderPoint, bin: '',
});

describe('ledger', () => {
  let tx: LedgerTx;
  beforeEach(() => {
    tx = new LedgerTx([lvl('a', 'STORE', 5), lvl('a', 'WAREHOUSE', 10)]);
  });

  it('deducts a sale from store and writes one ledger row', () => {
    tx.out('a', 'STORE', 2, { reason: 'sale' });
    expect(tx.get('a', 'STORE').quantity).toBe(3);
    expect(tx.movements).toHaveLength(1);
    expect(tx.movements[0]).toMatchObject({ from: 'STORE', to: null, qty: 2, reason: 'sale' });
  });

  it('refuses to sell more than is available', () => {
    expect(() => tx.out('a', 'STORE', 6, { reason: 'sale' })).toThrow(StockError);
    expect(tx.movements).toHaveLength(0);
  });

  it('reserved stock is not sellable', () => {
    tx.reserve('a', 'STORE', 4);
    expect(() => tx.out('a', 'STORE', 2, { reason: 'sale' })).toThrow(/Only 1/);
    tx.out('a', 'STORE', 4, { reason: 'repair' }, true);
    expect(tx.get('a', 'STORE')).toMatchObject({ quantity: 1, reserved: 0 });
  });

  it('transfer moves stock between locations with one row', () => {
    tx.transfer('a', 'WAREHOUSE', 'STORE', 7, {});
    expect(tx.get('a', 'STORE').quantity).toBe(12);
    expect(tx.get('a', 'WAREHOUSE').quantity).toBe(3);
    expect(tx.movements[0]).toMatchObject({ from: 'WAREHOUSE', to: 'STORE', qty: 7, reason: 'transfer' });
  });

  it('physical count records the difference as an adjustment', () => {
    tx.setCount('a', 'STORE', 2, {});
    expect(tx.get('a', 'STORE').quantity).toBe(2);
    expect(tx.movements[0]).toMatchObject({ reason: 'adjustment', qty: 3, from: 'STORE' });
    tx.setCount('a', 'STORE', 2, {});
    expect(tx.movements).toHaveLength(1);
  });

  it('rejects zero, negative and fractional quantities', () => {
    expect(() => tx.out('a', 'STORE', 0, { reason: 'sale' })).toThrow();
    expect(() => tx.in('a', 'STORE', -1, { reason: 'po_receive' })).toThrow();
    expect(() => tx.in('a', 'STORE', 1.5, { reason: 'po_receive' })).toThrow();
  });
});

describe('bundles', () => {
  it('expands a kit into its parts and merges duplicates', () => {
    const products = new Map<string, Product>([
      ['kit', { id: 'kit', isBundle: true, bundleItems: [{ productId: 'x', qty: 2 }, { productId: 'y', qty: 1 }] } as Product],
      ['x', { id: 'x', isBundle: false, bundleItems: [] } as unknown as Product],
      ['y', { id: 'y', isBundle: false, bundleItems: [] } as unknown as Product],
    ]);
    expect(expandBundles([{ productId: 'kit', qty: 2 }, { productId: 'x', qty: 1 }], products)).toEqual([
      { productId: 'x', qty: 5 },
      { productId: 'y', qty: 2 },
    ]);
  });
});

describe('low stock and replenishment', () => {
  const levels = [lvl('a', 'STORE', 2, 3), lvl('a', 'WAREHOUSE', 20, 10), lvl('b', 'STORE', 9, 3), lvl('b', 'WAREHOUSE', 1, 5), lvl('c', 'STORE', 0, 2), lvl('c', 'WAREHOUSE', 0, 2)];

  it('flags items at or below reorder point', () => {
    expect(lowStock(levels).map((r) => `${r.productId}:${r.location}`)).toEqual(['a:STORE', 'b:WAREHOUSE', 'c:STORE', 'c:WAREHOUSE']);
  });

  it('pick-list tops store up to twice its reorder point, limited by warehouse stock', () => {
    expect(replenishmentPickList(levels)).toEqual([{ productId: 'a', qty: 4, storeAvailable: 2, warehouseAvailable: 20 }]);
  });

  it('needs-reorder uses combined stock against the warehouse point', () => {
    expect(needsReorder(levels).map((r) => r.productId)).toEqual(['c']);
  });
});

describe('smart PO', () => {
  const suppliers = new Map<string, Supplier>([
    ['s1', { id: 's1', name: 'Cheap', reliability: 0.7, active: true } as Supplier],
    ['s2', { id: 's2', name: 'Fast', reliability: 0.95, active: true } as Supplier],
  ]);
  const offers = [
    { supplierId: 's1', unitCost: 10000, leadDays: 7, moq: 10 },
    { supplierId: 's2', unitCost: 12000, leadDays: 1, moq: 1 },
  ] as SupplierProduct[];

  it('badges cheapest and fastest and rounds up to MOQ', () => {
    const rows = compareSuppliers(4, offers, suppliers);
    expect(rows[0]).toMatchObject({ badges: expect.arrayContaining(['Cheapest']), orderQty: 10, lineTotal: 100000 });
    expect(rows[1].badges).toEqual(expect.arrayContaining(['Fastest', 'Most reliable']));
    expect(pickSupplier(rows, 'cheapest')!.supplierId).toBe('s1');
    expect(pickSupplier(rows, 'fastest')!.supplierId).toBe('s2');
    expect(rows.filter((r) => r.badges.includes('Best value'))).toHaveLength(1);
  });

  it('reliability is on-time share of received POs', () => {
    const pos = [
      { status: 'received', expectedDate: '2026-01-05', receivedDate: '2026-01-04' },
      { status: 'received', expectedDate: '2026-01-05', receivedDate: '2026-01-08' },
      { status: 'sent', expectedDate: '2026-01-05', receivedDate: null },
    ] as PurchaseOrder[];
    expect(reliabilityFrom(pos)).toBe(0.5);
  });
});

describe('repair jobs', () => {
  it('sums parts, labour and duration', () => {
    const t = jobTotals([
      { id: '1', kind: 'labor', refId: 's', name: 'Tune', qty: 1, unitPrice: 35000, durationMins: 45 },
      { id: '2', kind: 'labor', refId: 's', name: 'Bleed', qty: 2, unitPrice: 30000, durationMins: 30 },
      { id: '3', kind: 'part', refId: 'p', name: 'Pads', qty: 2, unitPrice: 35000, durationMins: 0 },
    ]);
    expect(t).toEqual({ parts: 70000, labor: 95000, total: 165000, durationMins: 105 });
  });

  const job = (id: string, mechanicId: string, bay: string, s: string, e: string, status = 'scheduled') =>
    ({ id, jobNo: id, mechanicId, bay, scheduledStart: s, scheduledEnd: e, status }) as WorkOrder;

  it('detects mechanic and bay double-booking, ignores touching edges', () => {
    const jobs = [job('J1', 'm1', 'Bay 1', '2026-12-01T09:00:00Z', '2026-12-01T10:00:00Z')];
    expect(findConflicts(jobs, { mechanicId: 'm1', bay: 'Bay 2', start: '2026-12-01T09:30:00Z', end: '2026-12-01T10:30:00Z' })).toHaveLength(1);
    expect(findConflicts(jobs, { mechanicId: 'm2', bay: 'Bay 1', start: '2026-12-01T09:30:00Z', end: '2026-12-01T10:30:00Z' })).toHaveLength(1);
    expect(findConflicts(jobs, { mechanicId: 'm1', bay: 'Bay 1', start: '2026-12-01T10:00:00Z', end: '2026-12-01T11:00:00Z' })).toHaveLength(0);
    expect(findConflicts([{ ...jobs[0], status: 'completed' }], { mechanicId: 'm1', bay: 'Bay 1', start: '2026-12-01T09:00:00Z', end: '2026-12-01T10:00:00Z' })).toHaveLength(0);
  });

  it('counts booked minutes per day', () => {
    const d = new Date('2026-12-01T09:00:00');
    const jobs = [job('J1', 'm1', 'Bay 1', new Date('2026-12-01T09:00:00').toISOString(), new Date('2026-12-01T10:30:00').toISOString())];
    expect(bookedMins(jobs, 'm1', d)).toBe(90);
  });

  it('enforces workflow order', () => {
    expect(canMove('scheduled', 'checked_in')).toBe(true);
    expect(canMove('scheduled', 'ready')).toBe(false);
    expect(canMove('completed', 'in_repair')).toBe(false);
  });
});

describe('payments', () => {
  it('cash gives change, split payments settle', () => {
    expect(settle(100000, [{ method: 'cash', amount: 150000, ref: '' }])).toMatchObject({ ok: true, change: 50000 });
    expect(settle(100000, [{ method: 'gcash', amount: 60000, ref: '' }, { method: 'cash', amount: 40000, ref: '' }])).toMatchObject({ ok: true, change: 0 });
    expect(settle(100000, [{ method: 'gcash', amount: 50000, ref: '' }])).toMatchObject({ ok: false, balance: 50000 });
    expect(settle(100000, [{ method: 'gcash', amount: 120000, ref: '' }]).ok).toBe(false);
  });

  it('discounts never exceed the subtotal', () => {
    expect(applyDiscount(10000, { type: 'percent', value: 10 })).toBe(1000);
    expect(applyDiscount(10000, { type: 'amount', value: 50000 })).toBe(10000);
  });

  it('parses typed peso amounts', () => {
    expect(toCentavos('1,234.50')).toBe(123450);
    expect(toCentavos('abc')).toBe(0);
  });
});

describe('notifications', () => {
  it('normalises PH numbers and builds an SMS link', () => {
    expect(phPhone('0917 123 4567')).toBe('+639171234567');
    expect(channelLink('sms', '09171234567', 'Hi')).toBe('sms:+639171234567?body=Hi');
  });
  it('fills the ready-for-pickup template with no em dashes', () => {
    const m = messageFor('ready_for_pickup', { shop: 'Bikemoko', customer: 'Mark V', bike: 'Trinx M136', jobNo: 'J-000001', total: 185000 });
    expect(m).toContain('Mark');
    expect(m).toContain('1,850.00');
    expect(m).not.toContain('—');
  });
});
