// Pure helpers for the POS screen. No React, no database.
import type { Centavos, PayMethod, Product, Sale, Shift, StockLevel } from '@/domain/types';
import { levelId } from '@/domain/stock';

/** Exact barcode or SKU match (case-insensitive) among active products. */
export function findByCode(products: Product[], code: string): Product | undefined {
  const c = code.trim().toLowerCase();
  if (!c) return undefined;
  return products.find((p) => p.active && (p.barcode.toLowerCase() === c || p.sku.toLowerCase() === c));
}

/** Free-text match on name, brand, SKU or barcode. */
export function matchesQuery(p: Product, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return [p.name, p.brand, p.sku, p.barcode].some((x) => x.toLowerCase().includes(s));
}

/** Sellable count at the Store (on hand minus reserved). Bundles are limited by their scarcest part. */
export function storeAvailable(p: Product, products: Map<string, Product>, levels: Map<string, StockLevel>): number {
  const own = (id: string) => {
    const l = levels.get(levelId(id, 'STORE'));
    return l ? Math.max(0, l.quantity - l.reserved) : 0;
  };
  if (p.isBundle && p.bundleItems.length) {
    return Math.min(...p.bundleItems.map((b) => (products.has(b.productId) ? Math.floor(own(b.productId) / Math.max(1, b.qty)) : 0)));
  }
  return own(p.id);
}

/** Quick cash amounts: exact, then round-ups to the next P500 and P1000. */
export function cashChips(due: Centavos): Centavos[] {
  if (due <= 0) return [];
  const up = (step: number) => Math.ceil(due / step) * step;
  const set = new Set<number>([due, up(50_000), up(100_000), up(100_000) + 100_000]);
  return [...set].sort((a, b) => a - b).slice(0, 4);
}

export function billTotals(subtotal: Centavos, discount: Centavos, deposit = 0) {
  const total = Math.max(0, subtotal - discount);
  return { total, due: Math.max(0, total - deposit) };
}

export interface Reading {
  sales: number;
  byMethod: Record<PayMethod, Centavos>;
  cashSales: Centavos;
  change: Centavos;
  expectedCash: Centavos;
  total: Centavos;
}

const EMPTY_METHODS = (): Record<PayMethod, Centavos> => ({ cash: 0, gcash: 0, maya: 0, bank: 0, card: 0 });

/**
 * X-reading for a shift. Expected cash = opening + cash taken - change given.
 * A repair deposit was collected before this shift, so it is left out of the drawer.
 */
export function reading(shift: Pick<Shift, 'id' | 'openingCash'>, sales: Sale[]): Reading {
  const mine = sales.filter((s) => s.shiftId === shift.id && !s.voided);
  const byMethod = EMPTY_METHODS();
  let change = 0;
  let total = 0;
  for (const s of mine) {
    change += s.change;
    total += s.total;
    for (const p of s.payments) if (p.ref !== 'Deposit') byMethod[p.method] += p.amount;
  }
  return {
    sales: mine.length,
    byMethod,
    cashSales: byMethod.cash,
    change,
    expectedCash: shift.openingCash + byMethod.cash - change,
    total,
  };
}

/** Positive = over, negative = short. */
export const overShort = (counted: Centavos, expected: Centavos) => counted - expected;
