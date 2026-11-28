import { describe, it, expect, beforeEach } from 'vitest';
import { useTestDb, db } from './db';
import { seedIfEmpty } from './seed';
import * as A from './actions';
import { levelId } from '@/domain/stock';

let n = 0;
beforeEach(async () => {
  useTestDb('t' + n++);
  await seedIfEmpty();
});

const bySku = async (sku: string) => (await db.products.where('sku').equals(sku).first())!;
const lvl = async (pid: string, loc: 'STORE' | 'WAREHOUSE') => (await db.stock.get(levelId(pid, loc)))!;

describe('end-to-end actions', () => {
  it('a POS sale deducts store stock, writes ledger and outbox', async () => {
    const p = await bySku('CH-KMC-11');
    const before = (await lvl(p.id, 'STORE')).quantity;
    const sale = await A.recordSale({ lines: [{ productId: p.id, qty: 2, unitPrice: p.price }], payments: [{ method: 'cash', amount: 200000, ref: '' }], discount: 0 });
    expect(sale.total).toBe(p.price * 2);
    expect(sale.change).toBe(200000 - p.price * 2);
    expect((await lvl(p.id, 'STORE')).quantity).toBe(before - 2);
    expect(await db.movements.where('refId').equals(sale.id).count()).toBe(1);
    expect(await db.outbox.count()).toBe(1);
  });

  it('a failed sale changes nothing', async () => {
    const p = await bySku('CH-KMC-11');
    const before = (await lvl(p.id, 'STORE')).quantity;
    await expect(A.recordSale({ lines: [{ productId: p.id, qty: 999, unitPrice: p.price }], payments: [{ method: 'cash', amount: 1, ref: '' }], discount: 0 })).rejects.toThrow();
    expect((await lvl(p.id, 'STORE')).quantity).toBe(before);
    expect(await db.movements.count()).toBe(0);
  });

  it('serialised bikes need a frame number', async () => {
    const p = await bySku('BK-MTB-275');
    await expect(A.recordSale({ lines: [{ productId: p.id, qty: 1, unitPrice: p.price }], payments: [{ method: 'cash', amount: p.price, ref: '' }], discount: 0 })).rejects.toThrow(/serial/);
  });

  it('selling a kit deducts every part inside', async () => {
    const kit = await bySku('KIT-TUNE');
    const pads = await bySku('BP-RES');
    const before = (await lvl(pads.id, 'STORE')).quantity;
    await A.recordSale({ lines: [{ productId: kit.id, qty: 1, unitPrice: kit.price }], payments: [{ method: 'gcash', amount: kit.price, ref: 'x' }], discount: 0 });
    expect((await lvl(pads.id, 'STORE')).quantity).toBe(before - 1);
  });

  it('estimate to job to billing: reserve then deduct', async () => {
    const pads = await bySku('BP-RES');
    const svc = (await db.services.toArray()).find((s) => s.name === 'Brake Pad Replacement')!;
    const cust = (await db.customers.toArray())[0];
    const mech = (await db.staff.where('role').equals('mechanic').first())!;
    const before = await lvl(pads.id, 'STORE');
    const est = await A.saveEstimate({
      customerId: cust.id, bikeId: null, status: 'draft', complaint: 'Squeaky brakes',
      lines: [
        { id: 'l1', kind: 'labor', refId: svc.id, name: svc.name, qty: 1, unitPrice: svc.laborFee, durationMins: svc.durationMins },
        { id: 'l2', kind: 'part', refId: pads.id, name: pads.name, qty: 2, unitPrice: pads.price, durationMins: 0 },
      ],
    });
    const start = new Date('2026-12-01T09:00:00').toISOString();
    const wo = await A.approveEstimateToJob(est.id, { mechanicId: mech.id, bay: 'Bay 1', start }, 10000);
    expect(wo.status).toBe('scheduled');
    expect(wo.checklist.length).toBeGreaterThan(0);
    expect((await lvl(pads.id, 'STORE')).reserved).toBe(before.reserved + 2);

    await expect(A.approveEstimateToJob(est.id, { mechanicId: mech.id, bay: 'Bay 1', start })).rejects.toThrow(/converted/);

    for (const s of ['checked_in', 'in_repair', 'quality_check', 'ready'] as const) await A.setJobStatus(wo.id, s);
    const due = svc.laborFee + pads.price * 2 - 10000;
    const sale = await A.completeRepairBilling(wo.id, [{ method: 'cash', amount: due, ref: '' }]);
    expect(sale.total).toBe(svc.laborFee + pads.price * 2);
    const after = await lvl(pads.id, 'STORE');
    expect(after.quantity).toBe(before.quantity - 2);
    expect(after.reserved).toBe(before.reserved);
    expect((await db.workOrders.get(wo.id))!.status).toBe('completed');
  });

  it('blocks double-booking a mechanic', async () => {
    const cust = (await db.customers.toArray())[0];
    const mech = (await db.staff.where('role').equals('mechanic').first())!;
    const base = { customerId: cust.id, bikeId: null, mechanicId: mech.id, status: 'scheduled' as const, lines: [], checklist: [], complaint: '', intakeNotes: '', photos: [], deposit: 0, estimateId: null };
    await A.createJob({ ...base, bay: 'Bay 1', scheduledStart: '2026-12-01T01:00:00Z', scheduledEnd: '2026-12-01T02:00:00Z' });
    await expect(A.createJob({ ...base, bay: 'Bay 2', scheduledStart: '2026-12-01T01:30:00Z', scheduledEnd: '2026-12-01T02:30:00Z' })).rejects.toThrow(/clash/);
  });

  it('cancelling a job releases reserved parts', async () => {
    const pads = await bySku('BP-RES');
    const cust = (await db.customers.toArray())[0];
    const before = (await lvl(pads.id, 'STORE')).reserved;
    const wo = await A.createJob({ customerId: cust.id, bikeId: null, mechanicId: null, bay: 'Bay 3', status: 'scheduled', estimateId: null, checklist: [], complaint: '', intakeNotes: '', photos: [], deposit: 0, scheduledStart: '2026-12-02T01:00:00Z', scheduledEnd: '2026-12-02T02:00:00Z', lines: [{ id: 'x', kind: 'part', refId: pads.id, name: 'pads', qty: 3, unitPrice: 1, durationMins: 0 }] });
    expect((await lvl(pads.id, 'STORE')).reserved).toBe(before + 3);
    await A.setJobStatus(wo.id, 'cancelled');
    expect((await lvl(pads.id, 'STORE')).reserved).toBe(before);
  });

  it('receiving a PO adds to warehouse and updates reliability when complete', async () => {
    const p = await bySku('TB-275-AV');
    const s = (await db.suppliers.toArray())[0];
    const before = (await lvl(p.id, 'WAREHOUSE')).quantity;
    const po = await A.createPO(s.id, [{ productId: p.id, qty: 10, unitCost: 9000 }], 2);
    let r = await A.receivePO(po.id, [{ productId: p.id, qty: 4 }]);
    expect(r.status).toBe('partial');
    r = await A.receivePO(po.id, [{ productId: p.id, qty: 6 }]);
    expect(r.status).toBe('received');
    expect((await lvl(p.id, 'WAREHOUSE')).quantity).toBe(before + 10);
    expect((await db.suppliers.get(s.id))!.reliability).toBe(1);
  });
});
