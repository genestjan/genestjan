import { addMonths, isoDate, pad, thisMonth, todayISO } from './dates';
import {
  catId, defaultCategories, defaultSettings, type Account, type AnyRecord, type Bill, type Budget, type Capture, type Txn,
} from './model';

// Made-up sample data for the demo screen (open the app with #demo). No real figures.

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function demoRecords(): AnyRecord[] {
  const r = rng(42);
  const now = Date.now();
  const today = todayISO();
  const end = thisMonth();
  const start = addMonths(end, -9);
  const out: AnyRecord[] = [...defaultCategories(now), { ...defaultSettings(now), displayName: 'Jan', rates: { USD: 58 } }];

  const acct = (id: string, a: Partial<Account>): Account => ({
    id, kind: 'account', updatedAt: now, name: id, type: 'bank', institution: 'other', currency: 'PHP', openingBalance: 0, openingDate: `${start}-01`, ...a,
  });
  const accounts = [
    acct('gcash', { name: 'GCash', type: 'ewallet', institution: 'gcash', openingBalance: 450_000 }),
    acct('bpi', { name: 'BPI Savings', institution: 'bpi', last4: '1234', openingBalance: 6_200_000 }),
    acct('ub', { name: 'UnionBank Visa', type: 'credit', institution: 'unionbank', last4: '4321', openingBalance: -2_400_000, creditLimit: 8_000_000, dueDay: 13, rate: 3, ratePer: 'month' }),
    acct('wise', { name: 'Wise', type: 'online', institution: 'wise', currency: 'USD', openingBalance: 12_000 }),
    acct('paypal', { name: 'PayPal', type: 'online', institution: 'paypal', currency: 'USD', openingBalance: 5_000 }),
    acct('cash', { name: 'Cash', type: 'cash', institution: 'cash', openingBalance: 300_000 }),
    acct('car', { name: 'Car loan', type: 'loan', institution: 'bdo', openingBalance: -48_000_000, monthlyPayment: 1_850_000, termMonths: 36, startMonth: addMonths(start, -8), dueDay: 20 }),
  ];
  out.push(...accounts);

  const bills: Bill[] = [
    { id: 'bill-power', kind: 'bill', updatedAt: now, name: 'Electricity (SOCOTECO II)', amount: 380_000, dueDay: 10, categoryId: catId('bills'), active: true, match: 'socoteco' },
    { id: 'bill-water', kind: 'bill', updatedAt: now, name: 'Water (GSCWD)', amount: 62_000, dueDay: 12, categoryId: catId('bills'), active: true, match: 'gscwd' },
    { id: 'bill-net', kind: 'bill', updatedAt: now, name: 'Converge internet', amount: 169_900, dueDay: 8, categoryId: catId('bills'), active: true, match: 'converge' },
    { id: 'bill-globe', kind: 'bill', updatedAt: now, name: 'Globe postpaid', amount: 149_900, dueDay: 21, categoryId: catId('bills'), active: true, match: 'globe' },
    { id: 'bill-ub', kind: 'bill', updatedAt: now, name: 'UnionBank Visa', amount: 1_350_000, dueDay: 13, accountId: 'ub', payFromId: 'bpi', active: true },
    { id: 'bill-car', kind: 'bill', updatedAt: now, name: 'Car loan', amount: 1_850_000, dueDay: 20, accountId: 'car', payFromId: 'bpi', active: true },
  ];
  out.push(...bills);

  const budgets: [string, number][] = [
    ['food', 900_000], ['groceries', 1_000_000], ['transport', 700_000], ['bills', 900_000],
    ['shopping', 500_000], ['health', 250_000], ['family', 900_000],
  ];
  out.push(...budgets.map(([slug, amount]): Budget => ({ id: `bud-${slug}`, kind: 'budget', updatedAt: now, categoryId: catId(slug), amount })));

  let n = 0;
  const txns: Txn[] = [];
  const add = (month: string, day: number, t: Partial<Txn>) => {
    const date = `${month}-${pad(Math.min(day, 28))}`;
    if (date > today) return;
    const hh = 7 + Math.floor(r() * 14);
    txns.push({ id: `demo-${++n}`, kind: 'txn', updatedAt: now, type: 'expense', date, time: `${pad(hh)}:${pad(Math.floor(r() * 60))}`, amount: 0, accountId: 'gcash', source: 'manual', reviewed: true, ...t });
  };
  const around = (base: number, spread = 0.25) => Math.round((base * (1 - spread + r() * spread * 2)) / 100) * 100;

  for (let i = 0; i <= 9; i++) {
    const m = addMonths(start, i);
    add(m, 1, { type: 'income', amount: around(90_000, 0.1), accountId: 'paypal', payee: 'Acme Coaching Ltd', categoryId: catId('clients'), source: 'capture' });
    add(m, 15, { type: 'income', amount: around(65_000, 0.1), accountId: 'wise', payee: 'Northstar Health Pty', categoryId: catId('clients'), source: 'capture' });
    add(m, 25, { type: 'income', amount: around(1_200_000, 0.05), accountId: 'bpi', payee: 'Local client', categoryId: catId('clients') });
    add(m, 3, { type: 'transfer', amount: 85_000, toAmount: 85_000 * 58, accountId: 'paypal', toAccountId: 'bpi' });
    add(m, 17, { type: 'transfer', amount: 60_000, toAmount: 60_000 * 58, accountId: 'wise', toAccountId: 'bpi' });
    add(m, 4, { type: 'transfer', amount: 1_000_000, fee: 1_500, accountId: 'bpi', toAccountId: 'gcash', source: 'capture' });
    add(m, 18, { type: 'transfer', amount: 700_000, fee: 1_500, accountId: 'bpi', toAccountId: 'gcash', source: 'capture' });
    add(m, 6, { type: 'transfer', amount: 900_000, accountId: 'bpi', toAccountId: 'cash' });
    add(m, 12, { type: 'transfer', amount: 1_350_000, accountId: 'bpi', toAccountId: 'ub', billId: 'bill-ub', billMonth: m, source: 'capture' });
    add(m, 19, { type: 'transfer', amount: 1_850_000, accountId: 'bpi', toAccountId: 'car', billId: 'bill-car', billMonth: m });
    add(m, 9, { amount: around(380_000, 0.15), payee: 'SOCOTECO II', categoryId: catId('bills'), billId: 'bill-power', billMonth: m, source: 'capture' });
    add(m, 11, { amount: around(62_000, 0.1), payee: 'GSCWD', categoryId: catId('bills'), billId: 'bill-water', billMonth: m, source: 'capture' });
    add(m, 7, { amount: 169_900, accountId: 'bpi', payee: 'Converge ICT', categoryId: catId('bills'), billId: 'bill-net', billMonth: m });
    add(m, 21, { amount: 149_900, accountId: 'ub', payee: 'Globe Telecom', categoryId: catId('bills'), billId: 'bill-globe', billMonth: m, source: 'capture' });
    for (const d of [2, 9, 16, 23]) add(m, d, { amount: around(230_000), accountId: r() > 0.5 ? 'ub' : 'gcash', payee: r() > 0.5 ? 'Puregold Gensan' : 'KCC Mall', categoryId: catId('groceries'), source: 'capture' });
    for (const d of [5, 12, 19, 26]) add(m, d, { amount: around(150_000), accountId: 'ub', payee: 'Petron', categoryId: catId('transport'), source: 'capture' });
    for (const d of [1, 8, 15, 22]) add(m, d, { amount: 200_000, accountId: 'cash', payee: 'Allowance', categoryId: catId('family') });
    const foods = ['Jollibee', 'Mang Inasal', 'Starbucks', 'Chowking', 'Greenwich'];
    for (let k = 0; k < 9; k++) add(m, 1 + Math.floor(r() * 27), { amount: around(42_000, 0.5), payee: foods[Math.floor(r() * foods.length)], categoryId: catId('food'), source: 'capture' });
    for (let k = 0; k < 2; k++) add(m, 3 + Math.floor(r() * 24), { amount: around(150_000, 0.6), accountId: 'ub', payee: r() > 0.5 ? 'Shopee PH' : 'Lazada PH', categoryId: catId('shopping'), source: 'capture' });
    add(m, 14, { amount: around(45_000, 0.4), payee: 'Mercury Drug', categoryId: catId('health'), source: 'capture' });
    add(m, 10, { amount: 54_900, accountId: 'ub', payee: 'Netflix', categoryId: catId('subscriptions'), source: 'capture' });
    add(m, 2, { amount: 1_299, accountId: 'paypal', payee: 'Canva', categoryId: catId('work'), source: 'capture' });
  }
  out.push(...txns);

  const caps: Capture[] = [
    { id: 'cap-1', kind: 'capture', updatedAt: now, capturedAt: now - 3_600_000, app: 'GCash', pkg: 'com.globe.gcash.android', title: 'GCash', text: 'You have paid P420.00 to JOLLIBEE KCC. Ref. No. 1002003004005.', status: 'added', txnId: txns[txns.length - 1]?.id },
    { id: 'cap-2', kind: 'capture', updatedAt: now, capturedAt: now - 7_200_000, app: 'Messages', pkg: 'com.samsung.android.messaging', title: 'BDO', text: 'BDO: Your BDO Credit Card ending 9876 was charged PHP 1,850.00 at ACE HARDWARE on ' + isoDate(new Date()) + '.', status: 'review', reason: 'No account ending 9876 yet. Add it under Accounts, or add this by hand.' },
  ];
  out.push(...caps);
  return out;
}
