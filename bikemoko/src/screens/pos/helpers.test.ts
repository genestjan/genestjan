import { describe, expect, it } from 'vitest';
import { billTotals, cashChips, findByCode, overShort, reading } from './helpers';
import type { Product, Sale } from '@/domain/types';

const prod = (o: Partial<Product>): Product => ({
  id: 'p', sku: 'SKU-1', barcode: '4800001', name: 'Tube', category: 'Parts', brand: 'X', isSerialized: false,
  isBundle: false, bundleItems: [], cost: 0, price: 100, unit: 'pc', active: true, createdAt: '', ...o,
});

describe('findByCode', () => {
  it('matches barcode or sku, ignores inactive', () => {
    const list = [prod({ id: 'a' }), prod({ id: 'b', sku: 'OLD', barcode: '999', active: false })];
    expect(findByCode(list, '4800001')?.id).toBe('a');
    expect(findByCode(list, 'sku-1')?.id).toBe('a');
    expect(findByCode(list, '999')).toBeUndefined();
    expect(findByCode(list, ' ')).toBeUndefined();
  });
});

describe('cashChips', () => {
  it('gives exact then round-ups', () => {
    expect(cashChips(34_500)).toEqual([34_500, 50_000, 100_000, 200_000]);
    expect(cashChips(100_000)).toEqual([100_000, 200_000]);
    expect(cashChips(0)).toEqual([]);
  });
});

describe('billTotals', () => {
  it('subtracts discount and deposit', () => {
    expect(billTotals(100_000, 10_000, 30_000)).toEqual({ total: 90_000, due: 60_000 });
    expect(billTotals(10_000, 50_000, 0)).toEqual({ total: 0, due: 0 });
  });
});

describe('reading', () => {
  const sale = (o: Partial<Sale>): Sale => ({
    id: 'x', receiptNo: 'R', lines: [], payments: [], subtotal: 0, discount: 0, total: 0, change: 0, workOrderId: null,
    customerId: null, staffId: null, shiftId: 's1', voided: false, createdAt: '', ...o,
  });
  it('computes expected cash net of change and ignores other shifts, voids and deposits', () => {
    const r = reading({ id: 's1', openingCash: 200_000 }, [
      sale({ total: 80_000, change: 20_000, payments: [{ method: 'cash', amount: 100_000, ref: '' }] }),
      sale({ total: 50_000, payments: [{ method: 'gcash', amount: 50_000, ref: 'abc' }] }),
      sale({ shiftId: 's2', total: 99, payments: [{ method: 'cash', amount: 99, ref: '' }] }),
      sale({ voided: true, total: 99, payments: [{ method: 'cash', amount: 99, ref: '' }] }),
      sale({ total: 70_000, payments: [{ method: 'cash', amount: 30_000, ref: 'Deposit' }, { method: 'card', amount: 40_000, ref: '' }] }),
    ]);
    expect(r.sales).toBe(3);
    expect(r.byMethod.cash).toBe(100_000);
    expect(r.byMethod.gcash).toBe(50_000);
    expect(r.byMethod.card).toBe(40_000);
    expect(r.expectedCash).toBe(200_000 + 100_000 - 20_000);
    expect(overShort(285_000, r.expectedCash)).toBe(5_000);
  });
});
