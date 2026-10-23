import type { Charge } from './model';
export type FeeAction = 'submit' | 'confirm' | 'reject' | 'waive';
/** due -> submitted -> paid; submitted -> rejected -> due; due -> waived. */
export function nextCharge(c: Charge, action: FeeAction, ref?: string): Charge {
  if (action === 'submit' && c.status === 'due') {
    if (!/^\d{13}$/.test(ref ?? '')) throw new Error('GCash reference numbers have 13 digits');
    return { ...c, status: 'submitted', reference: ref };
  }
  if (action === 'confirm' && c.status === 'submitted') return { ...c, status: 'paid' };
  if (action === 'reject' && c.status === 'submitted') return { ...c, status: 'due', reference: undefined };
  if (action === 'waive' && (c.status === 'due' || c.status === 'submitted')) return { ...c, status: 'waived' };
  throw new Error(`Cannot ${action} a charge that is ${c.status}`);
}
export const fundTotals = (f: { target: number; entries: { amount: number }[] }) => {
  const have = f.entries.reduce((s, e) => s + e.amount, 0);
  return { have, still: Math.max(0, f.target - have), pct: f.target ? Math.min(100, Math.round((have / f.target) * 100)) : 0 };
};
