import { describe, it, expect } from 'vitest';
import { summariseSales, rangeFor, followUpsDue, deadStock, salesByDay, topProducts } from './calc';
import type { Customer, Product, Sale, StockLevel, WorkOrder } from '@/domain/types';

const prod = (id: string, cost: number): Product => ({ id, sku: id, barcode: '', name: id, category: '', brand: '', isSerialized: false, isBundle: false, bundleItems: [], cost, price: cost * 2, unit: 'pc', active: true, createdAt: '2020-01-01T00:00:00Z' });
const sale = (o: Partial<Sale>): Sale => ({ id: 's', receiptNo: 'R', lines: [], payments: [], subtotal: 0, discount: 0, total: 0, change: 0, workOrderId: null, customerId: null, staffId: null, shiftId: null, voided: false, createdAt: new Date().toISOString(), ...o });

describe('summariseSales', () => {
  const products = new Map([['p1', prod('p1', 4000)]]);
  const s1 = sale({
    lines: [{ productId: 'p1', name: 'P1', qty: 2, unitPrice: 10000, serial: '', kind: 'part' }, { productId: null, name: 'Labour', qty: 1, unitPrice: 5000, serial: '', kind: 'labor' }],
    subtotal: 25000, discount: 5000, total: 20000, payments: [{ method: 'cash', amount: 30000, ref: '' }], change: 10000,
  });
  it('adds up money, split and margin; voided sales ignored', () => {
    const r = summariseSales([s1, sale({ voided: true, total: 99999, subtotal: 99999 })], products);
    expect(r).toMatchObject({ count: 1, gross: 25000, discounts: 5000, net: 20000, avgTicket: 20000, parts: 20000, labor: 5000, cost: 8000, margin: 12000 });
    expect(r.byMethod.cash).toBe(20000); // change handed back is not revenue
    expect(r.marginPct).toBeCloseTo(0.6);
  });
  it('is all zero with no sales', () => {
    expect(summariseSales([], products)).toMatchObject({ count: 0, net: 0, avgTicket: 0, marginPct: 0 });
  });
  it('ranks top products by revenue', () => {
    const t = topProducts([s1], products);
    expect(t[0]).toMatchObject({ productId: 'p1', qty: 2, revenue: 20000, margin: 12000 });
  });
});

describe('ranges and series', () => {
  it('rangeFor covers the right number of days', () => {
    const now = new Date(2026, 10, 28, 15);
    const r7 = rangeFor('7d', now);
    expect((r7.to.getTime() - r7.from.getTime()) / 86_400_000).toBe(7);
    expect(rangeFor('month', now).from.getDate()).toBe(1);
    expect(rangeFor('today', now).from.getHours()).toBe(0);
  });
  it('salesByDay buckets into the last n days', () => {
    const now = new Date(2026, 10, 28, 15);
    const d = salesByDay([sale({ total: 100, createdAt: new Date(2026, 10, 28, 9).toISOString() }), sale({ total: 50, createdAt: new Date(2026, 10, 22, 9).toISOString() })], 7, now);
    expect(d).toHaveLength(7);
    expect(d[6].total).toBe(100);
    expect(d[0].total).toBe(50);
  });
});

describe('dead stock and follow-ups', () => {
  const now = new Date('2026-11-28T00:00:00Z');
  it('lists stocked items with no recent sale or repair use', () => {
    const lv = (productId: string, quantity: number): StockLevel => ({ id: productId, productId, location: 'STORE', quantity, reserved: 0, reorderPoint: 0, bin: '' });
    const rows = deadStock([prod('a', 100), prod('b', 100), prod('c', 100)], [lv('a', 3), lv('b', 2), lv('c', 0)], [{ id: 'm', productId: 'b', from: 'STORE', to: null, qty: 1, reason: 'sale', refId: null, staffId: null, note: '', createdAt: '' }], 60, now);
    expect(rows).toEqual([{ productId: 'a', name: 'a', qty: 3, value: 300 }]);
  });
  it('finds customers whose last completed job is older than the window and nothing is open', () => {
    const c = (id: string): Customer => ({ id, name: id, phone: '', messenger: '', channel: 'sms', notes: '', createdAt: '' });
    const job = (customerId: string, status: WorkOrder['status'], end: string) => ({ customerId, status, actualEnd: end, scheduledEnd: end }) as WorkOrder;
    const r = followUpsDue([c('old'), c('recent'), c('open'), c('none')], [job('old', 'completed', '2026-06-01T00:00:00Z'), job('recent', 'completed', '2026-11-01T00:00:00Z'), job('open', 'completed', '2026-01-01T00:00:00Z'), job('open', 'in_repair', '2026-11-20T00:00:00Z')], 90, now);
    expect(r.map((x) => x.customer.id)).toEqual(['old']);
  });
});
