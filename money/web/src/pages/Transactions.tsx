import { Filter, Plus, Search, Upload, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '../components/Shell';
import { TxnRow, describe } from '../components/TxnRow';
import { Card, Empty, Field, Segmented, Sheet, cx } from '../components/ui';
import { dayHeading, monthLabel, monthOf } from '../lib/dates';
import { openImporter, openTxn } from '../ui-state';
import { useSnap } from './Home';

type Tab = 'all' | 'income' | 'expense' | 'transfer';

export function Transactions() {
  const snap = useSnap();
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [month, setMonth] = useState('');
  const [limit, setLimit] = useState(150);

  const months = useMemo(() => [...new Set(snap.txns.map((t) => monthOf(t.date)))], [snap.txns]);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return snap.txns.filter((t) => {
      if (tab !== 'all' && t.type !== tab) return false;
      if (accountId && t.accountId !== accountId && t.toAccountId !== accountId) return false;
      if (categoryId && t.categoryId !== categoryId) return false;
      if (month && monthOf(t.date) !== month) return false;
      if (!needle) return true;
      const d = describe(t, snap);
      return `${d.title} ${d.sub} ${t.note ?? ''} ${t.ref ?? ''} ${(t.amount / 100).toFixed(2)}`.toLowerCase().includes(needle);
    });
  }, [snap, tab, q, accountId, categoryId, month]);

  const groups = useMemo(() => {
    const out: { date: string; items: typeof list }[] = [];
    for (const t of list.slice(0, limit)) {
      const last = out[out.length - 1];
      if (last && last.date === t.date) last.items.push(t);
      else out.push({ date: t.date, items: [t] });
    }
    return out;
  }, [list, limit]);

  const filters = [accountId, categoryId, month].filter(Boolean).length;

  return (
    <>
      <PageHeader title="Transactions" subtitle={`${list.length} shown`} actions={
        <>
          <button className="btn-outline hidden sm:inline-flex" onClick={() => openImporter('statement')}><Upload size={17} /> Import statement</button>
          <button className="btn-primary hidden lg:inline-flex" onClick={() => openTxn()}><Plus size={18} /> Add</button>
        </>
      } />
      <Segmented value={tab} onChange={setTab} className="mb-3" options={[
        { value: 'all', label: 'All' }, { value: 'income', label: 'Income' }, { value: 'expense', label: 'Expenses' }, { value: 'transfer', label: 'Transfers' },
      ]} />
      <div className="mb-4 flex gap-2">
        <label className="field flex flex-1 items-center gap-2 py-2.5">
          <Search size={17} className="text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search transactions…" className="w-full bg-transparent outline-none placeholder:text-faint" />
          {q && <button onClick={() => setQ('')} aria-label="Clear search"><X size={16} className="text-muted" /></button>}
        </label>
        <button onClick={() => setOpen(true)} className={cx('btn-outline relative px-3', filters > 0 && 'border-current text-current')} aria-label="Filter">
          <Filter size={18} />
          {filters > 0 && <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-current text-[10px] font-bold text-ink">{filters}</span>}
        </button>
      </div>

      {groups.length ? (
        <Card pad={false} className="px-2 py-2 sm:px-3">
          {groups.map((g) => (
            <div key={g.date}>
              <h3 className="px-2 pb-1 pt-3 text-xs font-medium text-muted">{dayHeading(g.date)}</h3>
              {g.items.map((t) => <TxnRow key={t.id} t={t} s={snap} />)}
            </div>
          ))}
          {list.length > limit && <button className="btn-ghost my-2 w-full text-current" onClick={() => setLimit((n) => n + 300)}>Show more</button>}
        </Card>
      ) : (
        <Card><Empty icon={<Search />} title="Nothing matches" text="Try another search or clear the filters." /></Card>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="Filter"
        footer={<div className="flex gap-2">
          <button className="btn-outline flex-1" onClick={() => { setAccountId(''); setCategoryId(''); setMonth(''); }}>Clear</button>
          <button className="btn-primary flex-1" onClick={() => setOpen(false)}>Show results</button>
        </div>}>
        <div className="space-y-4">
          <Field label="Account">
            <select className="field" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">All accounts</option>
              {snap.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Category">
            <select className="field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">All categories</option>
              {snap.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Month">
            <select className="field" value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="">All months</option>
              {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          </Field>
        </div>
      </Sheet>
    </>
  );
}
