import type { Payment, Centavos, PayMethod } from './types';

export const PAY_METHODS: { id: PayMethod; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'gcash', label: 'GCash' },
  { id: 'maya', label: 'Maya' },
  { id: 'bank', label: 'Bank transfer' },
  { id: 'card', label: 'Card' },
];

export interface Settlement {
  paid: Centavos;
  balance: Centavos; // still owed (0 when fully paid)
  change: Centavos; // cash to hand back
  ok: boolean;
}

/** Only cash can produce change. Non-cash overpayment is rejected. */
export function settle(total: Centavos, payments: Payment[]): Settlement {
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const nonCash = payments.filter((p) => p.method !== 'cash').reduce((s, p) => s + p.amount, 0);
  const balance = Math.max(0, total - paid);
  const over = Math.max(0, paid - total);
  const nonCashOver = Math.max(0, nonCash - total);
  return { paid, balance, change: nonCashOver > 0 ? 0 : over, ok: balance === 0 && nonCashOver === 0 };
}

export function applyDiscount(subtotal: Centavos, discount: { type: 'amount' | 'percent'; value: number }): Centavos {
  const d = discount.type === 'percent' ? Math.round((subtotal * Math.min(100, Math.max(0, discount.value))) / 100) : Math.round(discount.value);
  return Math.min(subtotal, Math.max(0, d));
}
