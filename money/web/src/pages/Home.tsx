import { ArrowDownRight, ArrowUpRight, ChevronRight, Eye, EyeOff, Inbox, Lightbulb, Plus } from 'lucide-react';
import { Donut, Legend, Sparkline, type Slice } from '../components/charts';
import { PageHeader } from '../components/Shell';
import { TxnRow } from '../components/TxnRow';
import { Badge, Card, Empty, Money, cx, useHidden } from '../components/ui';
import { updateSettings } from '../lib/actions';
import {
  billsFor, categoryName, changeThisMonth, insights, monthSummary, series, topSlices, totals,
} from '../lib/compute';
import { dayHeading, monthLabel, shortDate, thisMonth, todayISO } from '../lib/dates';
import { OTHER_COLOUR } from '../lib/model';
import { formatMoney } from '../lib/money';
import { useApp } from '../lib/session';
import { navigate } from '../router';
import { openPay, openTxn } from '../ui-state';

export function useSnap() {
  return useApp((s) => s.snap)!;
}

export function useMoney(whole = false) {
  const hide = useHidden();
  return (n: number) => formatMoney(n, 'PHP', { hide, whole });
}

export function spendingSlices(snap: ReturnType<typeof useSnap>, byCategory: { id: string; amount: number }[]): Slice[] {
  return topSlices(byCategory, 6).map((s) => ({
    id: s.id,
    label: categoryName(snap, s.id),
    value: s.amount,
    color: s.id === 'others' ? OTHER_COLOUR : snap.categories.find((c) => c.id === s.id)?.color ?? OTHER_COLOUR,
  }));
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export function Home() {
  const snap = useSnap();
  const money = useMoney();
  const pesos = useMoney(true);
  const hidden = useHidden();
  const month = thisMonth();
  const today = todayISO();
  const t = totals(snap);
  const sum = monthSummary(snap, month);
  const change = changeThisMonth(snap, month);
  const slices = spendingSlices(snap, sum.byCategory);
  const bills = billsFor(snap, month).filter((b) => b.state !== 'paid').slice(0, 4);
  const tips = insights(snap, month, today, (n) => formatMoney(n));
  const recent = snap.txns.slice(0, 6);
  const review = snap.captures.filter((c) => c.status === 'review').length;
  const flow = series(snap, month, 6);
  const name = snap.settings.displayName || 'Jan';

  return (
    <>
      <div className="hidden lg:block">
        <PageHeader title={`${greeting()}, ${name}`} subtitle={`${dayHeading(today).replace(/^Today, /, '')} · ${monthLabel(month)}`}
          actions={<button className="btn-primary" onClick={() => openTxn()}><Plus size={18} /> Add transaction</button>} />
      </div>

      {review > 0 && (
        <button onClick={() => navigate('/inbox')} className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-signal/30 bg-signal/10 px-4 py-3 text-left text-sm">
          <Inbox size={18} className="text-signal" />
          <span className="flex-1">{review} captured notification{review > 1 ? 's' : ''} to check</span>
          <ChevronRight size={18} className="text-signal" />
        </button>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center gap-2 text-sm text-muted">
            Total balance
            <button onClick={() => void updateSettings({ hideBalances: !hidden })} className="rounded-full p-1 hover:bg-ink-4 hover:text-paper" aria-label={hidden ? 'Show balances' : 'Hide balances'}>
              {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
            <div>
              <Money value={t.assets} className="font-display text-[34px] font-bold leading-tight tracking-tight sm:text-[40px]" />
              {change != null && (
                <div className={cx('mt-1 flex items-center gap-1 text-sm', change >= 0 ? 'text-income' : 'text-expense')}>
                  {change >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                  {change >= 0 ? '+' : ''}{(change * 100).toFixed(1)}% this month
                </div>
              )}
            </div>
            <div className="hidden text-right sm:block">
              <div className="text-xs text-muted">Owed on cards and loans</div>
              <Money value={-t.liabilities} tone={t.liabilities ? 'out' : 'plain'} className="font-display text-lg font-semibold" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { label: 'Income', value: sum.income, cls: 'bg-income/10 text-income' },
              { label: 'Expenses', value: sum.expenses, cls: 'bg-expense/10 text-expense' },
              { label: 'Savings', value: sum.net, cls: 'bg-current/10 text-current' },
            ].map((p) => (
              <div key={p.label} className="rounded-xl border border-line bg-ink-2 p-2.5 sm:p-3">
                <div className="text-[11px] text-muted sm:text-xs">{p.label}</div>
                <div className={cx('mt-1.5 inline-block max-w-full rounded-lg px-1.5 py-1 text-[12.5px] font-semibold sm:px-2 sm:text-sm', p.cls)}>
                  <span className="num">{pesos(p.value)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Cash flow" className="hidden lg:block" action={<span className="text-xs text-muted">last 6 months</span>}>
          <div className="space-y-3">
            <div className="flex justify-between text-sm"><span className="text-muted">Money in</span><Money value={sum.income} tone="in" /></div>
            <div className="flex justify-between text-sm"><span className="text-muted">Money out</span><Money value={-sum.expenses} tone="out" /></div>
            <div className="flex items-end justify-between border-t border-line pt-3">
              <div>
                <div className="text-xs text-muted">Net this month</div>
                <Money value={sum.net} tone="auto" sign className="font-display text-xl font-bold" />
              </div>
              <Sparkline values={flow.map((p) => p.net)} />
            </div>
          </div>
        </Card>

        <Card title="Spending this month" className="lg:col-span-1" action={<a href="#/analytics" className="text-xs text-current">Details</a>}>
          {sum.expenses > 0 ? (
            <div className="flex items-center gap-5">
              <Donut slices={slices} format={money} size={140} center={
                <div>
                  <div className="num font-display text-[17px] font-bold">{money(sum.expenses)}</div>
                  <div className="text-[11px] text-muted">Total expenses</div>
                </div>
              } />
              <Legend slices={slices} format={money} />
            </div>
          ) : <Empty title="No spending yet this month" text="Captured and added expenses show up here." />}
        </Card>

        <Card title="Bills coming up" action={<a href="#/debts" className="text-xs text-current">All bills</a>}>
          {bills.length ? (
            <ul className="space-y-1">
              {bills.map((b) => (
                <li key={b.bill.id}>
                  <button onClick={() => openPay(b)} className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left hover:bg-ink-4">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{b.bill.name}</div>
                      <div className="text-xs text-muted">Due {shortDate(b.due)}</div>
                    </div>
                    <div className="text-right">
                      <Money value={b.amount - b.paid} className="text-sm font-semibold" />
                      <div className="mt-0.5">
                        {b.state === 'overdue' ? <Badge tone="bad">Overdue</Badge> : b.state === 'due-soon' ? <Badge tone="warn">{b.days === 0 ? 'Today' : `In ${b.days} d`}</Badge> : <Badge>Upcoming</Badge>}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : <Empty title="Nothing due" text="Add your bills under Debts & bills to see them here." />}
        </Card>

        <Card title="Insights">
          {tips.length ? (
            <ul className="space-y-3">
              {tips.map((tip) => (
                <li key={tip.text} className="flex gap-3 text-sm leading-relaxed">
                  <Lightbulb size={17} className={cx('mt-0.5 shrink-0', tip.tone === 'warn' ? 'text-signal' : tip.tone === 'good' ? 'text-income' : 'text-current')} />
                  <span className="text-paper/90">{tip.text}</span>
                </li>
              ))}
            </ul>
          ) : <Empty title="Insights appear after a few weeks" text="Set budgets to see how you are pacing." />}
        </Card>

        <Card title="Recent transactions" className="lg:col-span-3" action={<a href="#/tx" className="text-xs text-current">See all</a>}>
          {recent.length ? <div className="-mx-2 grid gap-x-6 lg:grid-cols-2">{recent.map((x) => <TxnRow key={x.id} t={x} s={snap} />)}</div>
            : <Empty title="No transactions yet" text="Add an account, then add your first transaction or turn on phone capture." />}
        </Card>
      </div>
    </>
  );
}
