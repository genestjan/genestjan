import { useState } from 'react';
import { Bars, Donut, Legend, LineChart, Sparkline } from '../components/charts';
import { PageHeader } from '../components/Shell';
import { Card, Empty, Money, Segmented } from '../components/ui';
import { balances, billsFor, forecast, monthSummary, series, totals } from '../lib/compute';
import { addMonths, shortMonth, thisMonth } from '../lib/dates';
import { compact, formatMoney } from '../lib/money';
import { spendingSlices, useMoney, useSnap } from './Home';

type Range = '1' | '3' | '6' | '12';
type View = 'spending' | 'income' | 'networth' | 'forecast';

const axis = (n: number) => `₱${compact(Math.abs(n) / 100)}`;

export function Analytics() {
  const snap = useSnap();
  const money = useMoney();
  const [range, setRange] = useState<Range>('6');
  const [view, setView] = useState<View>('spending');
  const month = thisMonth();
  const n = Number(range);
  const barsN = Math.max(6, n);
  const pts = series(snap, month, Math.max(barsN, 12));
  const inRange = pts.slice(-n);
  const shown = pts.slice(-barsN);

  // Category and source totals across the range.
  const months = Array.from({ length: n }, (_, i) => addMonths(month, -i));
  const cat = new Map<string, number>();
  const src = new Map<string, number>();
  for (const m of months) {
    const s = monthSummary(snap, m);
    for (const x of s.byCategory) cat.set(x.id, (cat.get(x.id) ?? 0) + x.amount);
    for (const x of s.bySource) src.set(x.id, (src.get(x.id) ?? 0) + x.amount);
  }
  const byCat = [...cat].map(([id, amount]) => ({ id, amount })).sort((a, b) => b.amount - a.amount);
  const bySrc = [...src].map(([id, amount]) => ({ id, amount })).sort((a, b) => b.amount - a.amount).slice(0, 8);
  const income = inRange.reduce((s, p) => s + p.income, 0);
  const expenses = inRange.reduce((s, p) => s + p.expenses, 0);
  const slices = spendingSlices(snap, byCat);
  const periodLabel = n === 1 ? 'this month' : `the last ${n} months`;

  return (
    <>
      <PageHeader title="Analytics" subtitle="See where your money goes and plan for the future" actions={
        <Segmented value={range} onChange={setRange} options={[
          { value: '1', label: 'This month' }, { value: '3', label: '3 months' }, { value: '6', label: '6 months' }, { value: '12', label: '1 year' },
        ]} />
      } />
      <Segmented value={view} onChange={setView} className="mb-4 max-w-xl" options={[
        { value: 'spending', label: 'Spending' }, { value: 'income', label: 'Income' }, { value: 'networth', label: 'Net worth' }, { value: 'forecast', label: 'Forecast' },
      ]} />

      {view === 'spending' && (
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <Card title="Monthly spending">
            <Bars data={shown.map((p) => ({ key: p.month, label: shortMonth(p.month), value: p.expenses, highlight: p.month === month }))} format={money} axisFormat={axis} />
          </Card>
          <Card title="Expense breakdown" action={<span className="text-xs text-muted">{periodLabel}</span>}>
            {expenses ? (
              <div className="flex flex-col items-center gap-5 sm:flex-row lg:flex-col xl:flex-row">
                <Donut slices={slices} format={money} size={150} center={<div><div className="num font-display text-[15px] font-bold">{money(expenses)}</div><div className="text-[11px] text-muted">Total expenses</div></div>} />
                <Legend slices={slices} format={money} />
              </div>
            ) : <Empty title="No spending in this period" />}
          </Card>
          <Card title="Cash flow" className="lg:col-span-2">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div><div className="text-xs text-muted">Total income</div><Money value={income} tone="in" className="font-display text-xl font-bold" /></div>
              <div><div className="text-xs text-muted">Total expenses</div><Money value={expenses} tone="out" className="font-display text-xl font-bold" /></div>
              <div><div className="text-xs text-muted">Net cash flow</div><Money value={income - expenses} tone="auto" sign className="font-display text-xl font-bold" /></div>
              <div className="flex items-end justify-end"><Sparkline values={shown.map((p) => p.net)} width={150} /></div>
            </div>
          </Card>
        </div>
      )}

      {view === 'income' && (
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <Card title="Monthly income">
            <Bars data={shown.map((p) => ({ key: p.month, label: shortMonth(p.month), value: p.income, highlight: p.month === month }))} format={money} axisFormat={axis} colour="#3DD68C" />
          </Card>
          <Card title="By client or source" action={<span className="text-xs text-muted">{periodLabel}</span>}>
            {bySrc.length ? (
              <ul className="space-y-3">
                {bySrc.map((s) => (
                  <li key={s.id}>
                    <div className="mb-1 flex justify-between gap-2 text-sm"><span className="truncate">{s.id}</span><span className="num shrink-0 text-muted">{money(s.amount)}</span></div>
                    <div className="h-2 rounded-full bg-income/15"><div className="h-full rounded-full bg-income" style={{ width: `${(s.amount / bySrc[0].amount) * 100}%` }} /></div>
                  </li>
                ))}
              </ul>
            ) : <Empty title="No income in this period" />}
          </Card>
        </div>
      )}

      {view === 'networth' && <NetWorth />}
      {view === 'forecast' && <Forecast />}
    </>
  );

  function NetWorth() {
    const t = totals(snap, balances(snap));
    const line = pts.slice(-12).map((p) => ({ key: p.month, label: shortMonth(p.month), value: p.netWorth }));
    return (
      <div className="grid gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card><div className="text-xs text-muted">What you have</div><Money value={t.assets} className="font-display text-2xl font-bold" /></Card>
          <Card><div className="text-xs text-muted">What you owe</div><Money value={t.liabilities} tone={t.liabilities ? 'out' : 'plain'} className="font-display text-2xl font-bold" /></Card>
          <Card><div className="text-xs text-muted">Net worth</div><Money value={t.netWorth} tone="auto" className="font-display text-2xl font-bold" /></Card>
        </div>
        <Card title="Net worth at the end of each month">
          <LineChart data={line} format={money} axisFormat={axis} />
        </Card>
      </div>
    );
  }

  function Forecast() {
    const f = forecast(snap, month, 6);
    const past = pts.slice(-6).map((p) => ({ key: p.month, label: shortMonth(p.month), value: totals(snap, balances(snap, `${addMonths(p.month, 1)}-01`)).assets }));
    const line = [...past, ...f.points.map((p) => ({ key: p.month, label: shortMonth(p.month), value: p.assets, dashed: true }))];
    const upcoming = [...billsFor(snap, month), ...billsFor(snap, addMonths(month, 1))].filter((b) => b.state !== 'paid' && b.days >= 0 && b.days <= 30);
    const due = upcoming.reduce((s, b) => s + Math.max(0, b.amount - b.paid), 0);
    return (
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card title="Money you hold, six months ahead">
          <LineChart data={line} format={money} axisFormat={axis} />
          <p className="mt-3 text-xs leading-relaxed text-faint">The dashed line carries forward your average monthly net from the last three full months. It is a guide, not a promise.</p>
        </Card>
        <Card title="What drives it">
          <div className="space-y-4">
            <div><div className="text-xs text-muted">Average monthly net</div><Money value={f.avgNet} tone="auto" sign className="font-display text-xl font-bold" /></div>
            <div><div className="text-xs text-muted">Bills due in the next 30 days</div><Money value={due} className="font-display text-xl font-bold" /></div>
            <div><div className="text-xs text-muted">In six months, at this pace</div><Money value={f.points[f.points.length - 1]?.assets ?? 0} className="font-display text-xl font-bold" /></div>
            {f.avgNet < 0 && <p className="rounded-xl border border-expense/30 bg-expense/10 p-3 text-sm text-expense">You are spending more than you earn on average. At this pace you use up {formatMoney(-f.avgNet)} a month.</p>}
          </div>
        </Card>
      </div>
    );
  }
}
