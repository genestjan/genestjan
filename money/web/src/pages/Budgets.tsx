import { ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../components/Shell';
import { Card, CategoryIcon, Empty, Meter, Money, Ring } from '../components/ui';
import { budgetStatus } from '../lib/compute';
import { addMonths, monthLabel, thisMonth } from '../lib/dates';
import { openBudgets } from '../ui-state';
import { useMoney, useSnap } from './Home';

export function MonthSwitch({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      <button className="rounded-lg p-2 text-muted hover:bg-ink-4 hover:text-paper" onClick={() => onChange(addMonths(month, -1))} aria-label="Previous month"><ChevronLeft size={18} /></button>
      <span className="min-w-[132px] text-center text-sm font-medium">{monthLabel(month)}</span>
      <button className="rounded-lg p-2 text-muted hover:bg-ink-4 hover:text-paper disabled:opacity-30" disabled={month >= thisMonth()} onClick={() => onChange(addMonths(month, 1))} aria-label="Next month"><ChevronRight size={18} /></button>
    </div>
  );
}

export function Budgets() {
  const snap = useSnap();
  const money = useMoney(true);
  const [month, setMonth] = useState(thisMonth());
  const b = budgetStatus(snap, month);
  const cat = (id: string) => snap.categories.find((c) => c.id === id);

  return (
    <>
      <PageHeader title="Budgets" actions={
        <>
          <MonthSwitch month={month} onChange={setMonth} />
          <button className="btn-outline" onClick={() => openBudgets(month)}><SlidersHorizontal size={17} /> Set budgets</button>
        </>
      } />
      {b.lines.length === 0 ? (
        <Card><Empty title="No budgets yet" text="Give each spending category a monthly limit. Money Hub tracks every captured and added expense against it." action={<button className="btn-primary" onClick={() => openBudgets(month)}>Set budgets</button>} /></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <Card className="h-fit">
            <div className="flex items-center gap-5">
              <Ring value={b.pct} size={108} stroke={10}>
                <span className="num font-display text-2xl font-bold">{Math.round(b.pct * 100)}%</span>
              </Ring>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-muted">Total budget</div>
                <Money value={b.limit} className="font-display text-[22px] font-bold" />
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4">
              <div>
                <div className="text-xs text-muted">Spent</div>
                <Money value={b.spent} className="font-semibold" />
              </div>
              <div className="text-right">
                <div className="text-xs text-muted">{b.remaining >= 0 ? 'Remaining' : 'Over budget'}</div>
                <Money value={Math.abs(b.remaining)} tone={b.remaining >= 0 ? 'in' : 'out'} className="font-semibold" />
              </div>
            </div>
          </Card>

          <Card title="Categories">
            <ul className="space-y-4">
              {b.lines.map((l) => (
                <li key={l.categoryId} className="flex items-center gap-3">
                  <CategoryIcon category={cat(l.categoryId)} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{cat(l.categoryId)?.name ?? 'Category'}</span>
                      <span className="num shrink-0 text-xs text-muted"><span className="text-paper">{money(l.spent)}</span> / {money(l.limit)}</span>
                    </div>
                    <Meter value={l.pct} />
                  </div>
                  <span className="num w-11 shrink-0 text-right text-sm text-muted">{Math.round(l.pct * 100)}%</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}
