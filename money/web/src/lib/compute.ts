import { addMonths, daysInMonth, daysUntil, dueDate, monthOf, monthsBetween, todayISO } from './dates';
import { toBase, type Currency } from './money';
import {
  FEES_CATEGORY, OTHER_CATEGORY, OTHER_INCOME, isLiability,
  type Account, type Bill, type Budget, type Category, type Settings, type Txn,
} from './model';

// Everything the screens show is worked out here from the transactions, so the numbers always
// agree with each other. Amounts come back in pesos (the base currency) unless named otherwise.

export interface Book {
  accounts: Account[];
  txns: Txn[];
  categories: Category[];
  budgets: Budget[];
  bills: Bill[];
  settings: Settings;
}

const live = <T extends { deleted?: boolean }>(xs: T[]) => xs.filter((x) => !x.deleted);

export function accountMap(book: Book) {
  return new Map(live(book.accounts).map((a) => [a.id, a]));
}

const counts = (a: Account | undefined, date: string) => !!a && (!a.openingDate || date >= a.openingDate);

/** Balance of every account, in its own currency, from transactions dated before `before`. */
export function balances(book: Book, before?: string): Map<string, number> {
  const accts = accountMap(book);
  const out = new Map<string, number>();
  for (const a of accts.values()) out.set(a.id, a.openingDate && before && before <= a.openingDate ? 0 : a.openingBalance);
  for (const t of book.txns) {
    if (t.deleted || (before && t.date >= before)) continue;
    const a = accts.get(t.accountId);
    if (!counts(a, t.date)) continue;
    const fee = t.fee ?? 0;
    if (t.type === 'expense') out.set(a!.id, out.get(a!.id)! - t.amount - fee);
    else if (t.type === 'income') out.set(a!.id, out.get(a!.id)! + t.amount - fee);
    else {
      out.set(a!.id, out.get(a!.id)! - t.amount - fee);
      const to = t.toAccountId ? accts.get(t.toAccountId) : undefined;
      if (to && counts(to, t.date)) {
        const arrived = t.toAmount ?? (to.currency === a!.currency ? t.amount : convert(book, t.amount, a!.currency, to.currency));
        out.set(to.id, out.get(to.id)! + arrived);
      }
    }
  }
  return out;
}

export function convert(book: Book, minor: number, from: Currency, to: Currency) {
  return toBase(minor, from, book.settings.rates, to);
}

const base = (book: Book, minor: number, currency: Currency) => toBase(minor, currency, book.settings.rates, book.settings.baseCurrency);

export interface Totals { assets: number; liabilities: number; netWorth: number }

export function totals(book: Book, bal = balances(book)): Totals {
  let assets = 0, liabilities = 0;
  for (const a of accountMap(book).values()) {
    if (a.archived) continue;
    const v = base(book, bal.get(a.id) ?? 0, a.currency);
    if (isLiability(a)) liabilities += Math.max(0, -v);
    else assets += v;
  }
  return { assets, liabilities, netWorth: assets - liabilities };
}

export interface Slice { id: string; amount: number }

export interface MonthSummary {
  month: string;
  income: number;
  expenses: number;
  net: number;
  byCategory: Slice[];
  bySource: Slice[];
  count: number;
}

export function monthSummary(book: Book, month: string): MonthSummary {
  const accts = accountMap(book);
  const byCat = new Map<string, number>();
  const bySrc = new Map<string, number>();
  let income = 0, expenses = 0, count = 0;
  for (const t of book.txns) {
    if (t.deleted || monthOf(t.date) !== month) continue;
    const a = accts.get(t.accountId);
    if (!a) continue;
    count++;
    const fee = base(book, t.fee ?? 0, a.currency);
    if (fee) { expenses += fee; byCat.set(FEES_CATEGORY, (byCat.get(FEES_CATEGORY) ?? 0) + fee); }
    if (t.type === 'transfer') continue;
    const v = base(book, t.amount, a.currency);
    if (t.type === 'income') {
      income += v;
      const key = t.payee?.trim() || book.categories.find((c) => c.id === t.categoryId)?.name || 'Other income';
      bySrc.set(key, (bySrc.get(key) ?? 0) + v);
    } else {
      expenses += v;
      const c = t.categoryId ?? OTHER_CATEGORY;
      byCat.set(c, (byCat.get(c) ?? 0) + v);
    }
  }
  const sorted = (m: Map<string, number>) => [...m].map(([id, amount]) => ({ id, amount })).sort((x, y) => y.amount - x.amount);
  return { month, income, expenses, net: income - expenses, byCategory: sorted(byCat), bySource: sorted(bySrc), count };
}

/** Top slices plus one "Others" slice, so a chart never has more than `max` parts. */
export function topSlices(slices: Slice[], max = 6): Slice[] {
  if (slices.length <= max) return slices;
  const head = slices.slice(0, max - 1);
  const rest = slices.slice(max - 1).reduce((s, x) => s + x.amount, 0);
  return [...head, { id: 'others', amount: rest }];
}

export interface MonthPoint { month: string; income: number; expenses: number; net: number; netWorth: number }

export function series(book: Book, endMonth: string, n: number): MonthPoint[] {
  const out: MonthPoint[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const m = addMonths(endMonth, -i);
    const s = monthSummary(book, m);
    const nw = totals(book, balances(book, `${addMonths(m, 1)}-01`)).netWorth;
    out.push({ month: m, income: s.income, expenses: s.expenses, net: s.net, netWorth: nw });
  }
  return out;
}

/** Change in money you hold (assets) since the first of the month, as a fraction. */
export function changeThisMonth(book: Book, month: string): number | null {
  const start = totals(book, balances(book, `${month}-01`)).assets;
  const now = totals(book).assets;
  if (!start) return null;
  return (now - start) / Math.abs(start);
}

// ---- Budgets --------------------------------------------------------------------------------

export interface BudgetLine { categoryId: string; limit: number; spent: number; pct: number }
export interface BudgetStatus { lines: BudgetLine[]; limit: number; spent: number; remaining: number; pct: number }

export function budgetsFor(book: Book, month: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const b of live(book.budgets)) if (!b.month) m.set(b.categoryId, b.amount);
  for (const b of live(book.budgets)) if (b.month === month) m.set(b.categoryId, b.amount);
  for (const [k, v] of m) if (v <= 0) m.delete(k);
  return m;
}

export function budgetStatus(book: Book, month: string): BudgetStatus {
  const limits = budgetsFor(book, month);
  const spentBy = new Map(monthSummary(book, month).byCategory.map((s) => [s.id, s.amount]));
  const lines = [...limits].map(([categoryId, limit]) => {
    const spent = spentBy.get(categoryId) ?? 0;
    return { categoryId, limit, spent, pct: limit ? spent / limit : 0 };
  }).sort((a, b) => b.pct - a.pct);
  const limit = lines.reduce((s, l) => s + l.limit, 0);
  const spent = lines.reduce((s, l) => s + l.spent, 0);
  return { lines, limit, spent, remaining: limit - spent, pct: limit ? spent / limit : 0 };
}

// ---- Bills and debts ------------------------------------------------------------------------

export type BillState = 'paid' | 'overdue' | 'due-soon' | 'upcoming';

export interface BillRow { bill: Bill; amount: number; due: string; paid: number; state: BillState; days: number }

export function billAmount(bill: Bill, month: string) {
  return bill.amounts?.[month] ?? bill.amount;
}

export function billsFor(book: Book, month: string, today = todayISO()): BillRow[] {
  const accts = accountMap(book);
  return live(book.bills).filter((b) => b.active).map((bill) => {
    const amount = billAmount(bill, month);
    const due = dueDate(month, bill.dueDay);
    let paid = 0;
    for (const t of book.txns) {
      if (t.deleted || t.billId !== bill.id || (t.billMonth ?? monthOf(t.date)) !== month) continue;
      const a = accts.get(t.accountId);
      paid += a ? base(book, t.amount, a.currency) : t.amount;
    }
    const days = daysUntil(due, today);
    // A bill with this month's exact amount (a card statement) needs paying in full; a variable
    // one (power, water) is settled by any payment.
    const exact = bill.amounts?.[month] != null || !!bill.accountId;
    const settled = paid > 0 && (!exact || paid >= amount * 0.99);
    const state: BillState = settled ? 'paid' : days < 0 ? 'overdue' : days <= 7 ? 'due-soon' : 'upcoming';
    return { bill, amount, due, paid, state, days };
  }).sort((a, b) => a.due.localeCompare(b.due));
}

export interface DebtRow {
  account: Account;
  outstanding: number;
  monthly: number;
  due?: string;
  monthsLeft?: number;
  state: BillState | 'none';
  bill?: BillRow;
}

export function debts(book: Book, month: string, today = todayISO()): { rows: DebtRow[]; outstanding: number; monthly: number } {
  const bal = balances(book);
  const bills = billsFor(book, month, today);
  const rows = [...accountMap(book).values()].filter((a) => isLiability(a) && !a.archived).map((account) => {
    const outstanding = Math.max(0, -base(book, bal.get(account.id) ?? 0, account.currency));
    const bill = bills.find((b) => b.bill.accountId === account.id);
    const monthly = bill?.amount ?? account.monthlyPayment ?? 0;
    const due = bill?.due ?? (account.dueDay ? dueDate(month, account.dueDay) : undefined);
    const monthsLeft = account.termMonths && account.startMonth
      ? Math.max(0, account.termMonths - monthsBetween(account.startMonth, month))
      : undefined;
    let state: DebtRow['state'] = bill?.state ?? 'none';
    if (!bill && due) {
      const paidThisMonth = book.txns.some((t) => !t.deleted && t.type === 'transfer' && t.toAccountId === account.id && monthOf(t.date) === month);
      const days = daysUntil(due, today);
      state = paidThisMonth ? 'paid' : days < 0 && outstanding > 0 ? 'overdue' : days <= 7 ? 'due-soon' : 'upcoming';
    }
    return { account, outstanding, monthly, due, monthsLeft, state, bill };
  }).sort((a, b) => b.outstanding - a.outstanding);
  return {
    rows,
    outstanding: rows.reduce((s, r) => s + r.outstanding, 0),
    monthly: rows.reduce((s, r) => s + r.monthly, 0),
  };
}

// ---- Looking ahead --------------------------------------------------------------------------

export interface ForecastPoint { month: string; assets: number }

/** Money you hold, carried forward at the average monthly net of the last three full months. */
export function forecast(book: Book, fromMonth: string, months = 6): { avgNet: number; points: ForecastPoint[] } {
  const past = series(book, addMonths(fromMonth, -1), 3);
  const used = past.filter((p) => p.income || p.expenses);
  const avgNet = used.length ? Math.round(used.reduce((s, p) => s + p.net, 0) / used.length) : 0;
  let assets = totals(book).assets;
  const points: ForecastPoint[] = [];
  for (let i = 1; i <= months; i++) {
    assets += avgNet;
    points.push({ month: addMonths(fromMonth, i), assets });
  }
  return { avgNet, points };
}

export interface Insight { tone: 'good' | 'warn' | 'info'; text: string }

export function insights(book: Book, month: string, today = todayISO(), money: (n: number) => string = String): Insight[] {
  const out: Insight[] = [];
  const b = budgetStatus(book, month);
  if (b.limit) {
    const dim = daysInMonth(month);
    const dayNo = month === monthOf(today) ? Number(today.slice(8, 10)) : dim;
    const pace = dayNo / dim;
    const left = dim - dayNo;
    if (b.pct > 1) out.push({ tone: 'warn', text: `You are ${money(b.spent - b.limit)} over this month's budget.` });
    else if (b.pct > pace + 0.1) out.push({ tone: 'warn', text: `${Math.round(b.pct * 100)}% of the budget is used with ${left} day${left === 1 ? '' : 's'} to go. Ease off a little.` });
    else out.push({ tone: 'good', text: `On track: ${Math.round(b.pct * 100)}% of the budget used, ${left} day${left === 1 ? '' : 's'} to go.` });
  }
  const now = monthSummary(book, month);
  const prev = [1, 2, 3].map((i) => monthSummary(book, addMonths(month, -i)));
  if (prev.some((p) => p.expenses)) {
    let worst: { id: string; over: number } | undefined;
    for (const s of now.byCategory) {
      const avg = prev.reduce((t, p) => t + (p.byCategory.find((x) => x.id === s.id)?.amount ?? 0), 0) / 3;
      const over = s.amount - avg;
      if (avg > 0 && over > 50_000 && (!worst || over > worst.over)) worst = { id: s.id, over };
    }
    if (worst) {
      const name = book.categories.find((c) => c.id === worst!.id)?.name ?? 'One category';
      out.push({ tone: 'info', text: `${name} is ${money(Math.round(worst.over))} above your three-month average.` });
    }
  }
  const soon = billsFor(book, month, today).filter((r) => r.state === 'due-soon' || r.state === 'overdue');
  if (soon.length) {
    const sum = soon.reduce((s, r) => s + Math.max(0, r.amount - r.paid), 0);
    const late = soon.filter((r) => r.state === 'overdue').length;
    out.push({ tone: late ? 'warn' : 'info', text: late ? `${late} bill${late > 1 ? 's are' : ' is'} overdue. ${money(sum)} still to pay.` : `${soon.length} bill${soon.length > 1 ? 's' : ''} due this week, ${money(sum)} in total.` });
  }
  return out;
}

export const categoryName = (book: Book, id: string) =>
  id === 'others' ? 'Others' : book.categories.find((c) => c.id === id)?.name ?? (id === OTHER_INCOME ? 'Other income' : 'Uncategorised');
