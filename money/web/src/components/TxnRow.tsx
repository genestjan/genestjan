import { ArrowLeftRight } from 'lucide-react';
import { timeLabel } from '../lib/dates';
import type { Snapshot } from '../lib/ledger';
import type { Txn } from '../lib/model';
import { openTxn } from '../ui-state';
import { CategoryIcon, InstitutionBadge, Money } from './ui';

export function describe(t: Txn, s: Snapshot) {
  const acct = s.accounts.find((a) => a.id === t.accountId);
  const to = s.accounts.find((a) => a.id === t.toAccountId);
  const cat = s.categories.find((c) => c.id === t.categoryId);
  if (t.type === 'transfer') {
    const bill = s.bills.find((b) => b.id === t.billId);
    return {
      title: bill ? `${bill.name} payment` : t.payee || `To ${to?.name ?? 'another account'}`,
      sub: `Transfer · ${acct?.name ?? '?'} to ${to?.name ?? '?'}${t.fee ? ' · fee' : ''}`,
      acct, cat,
    };
  }
  return {
    title: t.payee || cat?.name || (t.type === 'income' ? 'Income' : 'Expense'),
    sub: `${cat?.name ?? (t.type === 'income' ? 'Income' : 'Uncategorised')} · ${acct?.name ?? '?'}`,
    acct, cat,
  };
}

export function TxnRow({ t, s }: { t: Txn; s: Snapshot }) {
  const d = describe(t, s);
  const amount = t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : -(t.amount + (t.fee ?? 0));
  return (
    <button onClick={() => openTxn(t)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-ink-4">
      {t.type === 'transfer'
        ? <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-current/15 text-current"><ArrowLeftRight size={18} /></span>
        : d.cat ? <CategoryIcon category={d.cat} size={40} /> : <InstitutionBadge id={d.acct?.institution ?? 'other'} size={40} />}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14px] font-medium">{d.title}</span>
          {t.reviewed === false && <span className="chip shrink-0 bg-signal/15 px-1.5 py-0 text-[10px] text-signal">New</span>}
        </div>
        <div className="truncate text-xs text-muted">{d.sub}</div>
      </div>
      <div className="shrink-0 text-right">
        <Money value={amount} currency={d.acct?.currency} sign tone={t.type === 'transfer' ? 'muted' : 'auto'} className="text-[14px] font-semibold" />
        <div className="text-[11px] text-faint">{timeLabel(t.time)}</div>
      </div>
    </button>
  );
}
