import { balances, billsFor, budgetStatus, debts, monthSummary, topSlices, totals, type Book } from './compute';
import { catId, defaultCategories, defaultSettings, FEES_CATEGORY, type Account, type Txn } from './model';

const acct = (id: string, extra: Partial<Account>): Account => ({
  id, kind: 'account', updatedAt: 1, name: id, type: 'bank', institution: 'bpi', currency: 'PHP', openingBalance: 0, ...extra,
});
let n = 0;
const tx = (t: Partial<Txn>): Txn => ({
  id: `t${++n}`, kind: 'txn', updatedAt: 1, type: 'expense', date: '2026-10-05', amount: 0, accountId: 'bpi', source: 'manual', ...t,
});

function book(txns: Txn[]): Book {
  return {
    accounts: [
      acct('bpi', { openingBalance: 5_000_000 }),
      acct('gcash', { institution: 'gcash', type: 'ewallet', openingBalance: 100_000 }),
      acct('card', { institution: 'unionbank', type: 'credit', openingBalance: -2_000_000, dueDay: 13 }),
      acct('paypal', { institution: 'paypal', type: 'online', currency: 'USD', openingBalance: 10_000 }),
    ],
    txns,
    categories: defaultCategories(),
    budgets: [
      { id: 'b1', kind: 'budget', updatedAt: 1, categoryId: catId('food'), amount: 1_000_000 },
      { id: 'b2', kind: 'budget', updatedAt: 1, categoryId: catId('food'), amount: 1_500_000, month: '2026-11' },
    ],
    bills: [
      { id: 'card-bill', kind: 'bill', updatedAt: 1, name: 'UnionBank card', amount: 500_000, dueDay: 13, accountId: 'card', active: true },
      { id: 'water', kind: 'bill', updatedAt: 1, name: 'Water', amount: 62_000, amounts: { '2026-10': 70_000 }, dueDay: 28, categoryId: catId('bills'), active: true },
    ],
    settings: { ...defaultSettings(), rates: { USD: 58 } },
  };
}

describe('balances and totals', () => {
  it('moves money with expenses, income, transfers and fees', () => {
    const b = book([
      tx({ type: 'expense', amount: 25_000, accountId: 'gcash', categoryId: catId('food') }),
      tx({ type: 'transfer', amount: 500_000, fee: 1_500, accountId: 'bpi', toAccountId: 'gcash' }),
      tx({ type: 'expense', amount: 300_000, accountId: 'card', categoryId: catId('shopping') }),
      tx({ type: 'transfer', amount: 1_000_000, accountId: 'bpi', toAccountId: 'card' }),
    ]);
    const bal = balances(b);
    expect(bal.get('bpi')).toBe(5_000_000 - 500_000 - 1_500 - 1_000_000);
    expect(bal.get('gcash')).toBe(100_000 - 25_000 + 500_000);
    expect(bal.get('card')).toBe(-2_000_000 - 300_000 + 1_000_000);
    const t = totals(b, bal);
    // assets include the $100 PayPal balance at ₱58
    expect(t.assets).toBe(bal.get('bpi')! + bal.get('gcash')! + 580_000);
    expect(t.liabilities).toBe(1_300_000);
  });

  it('converts a dollar withdrawal to pesos with what actually arrived', () => {
    const b = book([tx({ type: 'transfer', amount: 5_000, toAmount: 290_000, accountId: 'paypal', toAccountId: 'bpi' })]);
    expect(balances(b).get('bpi')).toBe(5_290_000);
    expect(balances(b).get('paypal')).toBe(5_000);
  });

  it('ignores history dated before an account was added with its current balance', () => {
    const b = book([tx({ type: 'expense', amount: 99_900, accountId: 'bpi', date: '2026-09-01' })]);
    b.accounts[0].openingDate = '2026-10-01';
    expect(balances(b).get('bpi')).toBe(5_000_000);
  });
});

describe('month summary', () => {
  it('counts card spending as spending, card payments not at all, and fees as fees', () => {
    const b = book([
      tx({ type: 'income', amount: 4_000_000, accountId: 'bpi', payee: 'Client A', categoryId: catId('clients') }),
      tx({ type: 'income', amount: 50_000, accountId: 'paypal', payee: 'Client B' }),
      tx({ type: 'expense', amount: 300_000, accountId: 'card', categoryId: catId('shopping') }),
      tx({ type: 'transfer', amount: 1_000_000, fee: 1_500, accountId: 'bpi', toAccountId: 'card' }),
      tx({ type: 'expense', amount: 10_000, accountId: 'bpi', date: '2026-09-30' }),
    ]);
    const s = monthSummary(b, '2026-10');
    expect(s.income).toBe(4_000_000 + 2_900_000);
    expect(s.expenses).toBe(300_000 + 1_500);
    expect(s.byCategory.find((x) => x.id === FEES_CATEGORY)?.amount).toBe(1_500);
    expect(s.bySource[0]).toEqual({ id: 'Client A', amount: 4_000_000 });
  });

  it('folds small categories into one Others slice', () => {
    const slices = Array.from({ length: 9 }, (_, i) => ({ id: `c${i}`, amount: 100 - i }));
    const top = topSlices(slices, 6);
    expect(top).toHaveLength(6);
    expect(top[5]).toEqual({ id: 'others', amount: [95, 94, 93, 92].reduce((a, b) => a + b, 0) });
  });
});

describe('budgets', () => {
  it('uses the month override when there is one', () => {
    const b = book([tx({ amount: 400_000, categoryId: catId('food') })]);
    expect(budgetStatus(b, '2026-10')).toMatchObject({ limit: 1_000_000, spent: 400_000, remaining: 600_000, pct: 0.4 });
    expect(budgetStatus(b, '2026-11').limit).toBe(1_500_000);
  });
});

describe('bills and debts', () => {
  it('marks bills paid, overdue or due soon', () => {
    const b = book([tx({ type: 'transfer', amount: 500_000, accountId: 'bpi', toAccountId: 'card', billId: 'card-bill', date: '2026-10-10' })]);
    const rows = billsFor(b, '2026-10', '2026-10-25');
    expect(rows.find((r) => r.bill.id === 'card-bill')?.state).toBe('paid');
    const water = rows.find((r) => r.bill.id === 'water')!;
    expect(water).toMatchObject({ amount: 70_000, state: 'due-soon', due: '2026-10-28' });
    expect(billsFor(b, '2026-10', '2026-10-29').find((r) => r.bill.id === 'water')?.state).toBe('overdue');
  });

  it('lists cards and loans with what is owed', () => {
    const b = book([tx({ type: 'expense', amount: 300_000, accountId: 'card' })]);
    const d = debts(b, '2026-10', '2026-10-20');
    expect(d.outstanding).toBe(2_300_000);
    expect(d.rows[0]).toMatchObject({ outstanding: 2_300_000, monthly: 500_000, state: 'overdue' });
  });
});
