import { describe, expect, it } from 'vitest';
import { groupBySupplier, isOverdue, mergeReorder, poText } from './helpers';
import type { SupplierOption } from '@/domain/po';
import type { JobLine, PurchaseOrder } from '@/domain/types';

const part = (refId: string, qty: number, short = true): JobLine => ({
  id: refId, kind: 'part', refId, name: refId, qty, unitPrice: 0, durationMins: 0, short,
});

describe('mergeReorder', () => {
  it('merges stock and job reasons per product', () => {
    const r = mergeReorder(
      [{ productId: 'a', suggestQty: 5 }],
      [
        { jobNo: 'J-000012', status: 'waiting_parts', lines: [part('a', 2), part('b', 1), part('c', 1, false)] },
        { jobNo: 'J-000013', status: 'in_repair', lines: [part('d', 1)] },
      ],
    );
    expect(r).toEqual([
      { productId: 'a', qty: 7, reasons: ['Low stock', 'Job J-000012'] },
      { productId: 'b', qty: 1, reasons: ['Job J-000012'] },
    ]);
  });
});

const opt = (supplierId: string, unitCost: number, leadDays: number, orderQty: number): SupplierOption => ({
  supplierId, supplierName: supplierId, unitCost, leadDays, moq: 1, reliability: 1, orderQty, lineTotal: unitCost * orderQty, score: 0, badges: [],
});

describe('groupBySupplier', () => {
  it('groups by supplier with max lead time', () => {
    const g = groupBySupplier([
      { productId: 'a', option: opt('s1', 100, 2, 3) },
      { productId: 'b', option: opt('s1', 50, 7, 1) },
      { productId: 'c', option: opt('s2', 10, 1, 4) },
    ]);
    expect(g).toHaveLength(2);
    expect(g[0]).toMatchObject({ supplierId: 's1', leadDays: 7 });
    expect(g[0].items).toHaveLength(2);
    expect(g[1].leadDays).toBe(1);
  });
});

describe('isOverdue and poText', () => {
  const po: PurchaseOrder = {
    id: '1', poNo: 'PO-000001', supplierId: 's', status: 'sent', notes: '',
    items: [{ productId: 'a', qty: 2, unitCost: 500, receivedQty: 0 }],
    createdAt: '2026-01-01T00:00:00Z', expectedDate: '2026-01-05T00:00:00Z', receivedDate: null,
  };
  it('flags late open orders only', () => {
    expect(isOverdue(po, new Date('2026-01-10'))).toBe(true);
    expect(isOverdue({ ...po, status: 'received' }, new Date('2026-01-10'))).toBe(false);
    expect(isOverdue(po, new Date('2026-01-01'))).toBe(false);
  });
  it('writes plain text', () => {
    const t = poText(po, undefined, new Map(), 'Bikemoko', (c) => `P${c / 100}`);
    expect(t).toContain('PO-000001');
    expect(t).toContain('Total: P10');
    expect(t).not.toContain('—');
  });
});
