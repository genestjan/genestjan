import { CalendarClock, Car, CreditCard, FileSpreadsheet, Landmark, Plus } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../components/Shell';
import { Badge, Card, Empty, Money, Segmented } from '../components/ui';
import { billsFor, debts, type BillRow, type BillState } from '../lib/compute';
import { shortDate, thisMonth } from '../lib/dates';
import { openAccount, openBill, openImporter, openPay } from '../ui-state';
import { MonthSwitch } from './Budgets';
import { useMoney, useSnap } from './Home';

export function StateBadge({ state, days }: { state: BillState | 'none'; days?: number }) {
  if (state === 'paid') return <Badge tone="good">Paid</Badge>;
  if (state === 'overdue') return <Badge tone="bad">Overdue</Badge>;
  if (state === 'due-soon') return <Badge tone="warn">{days === 0 ? 'Due today' : days != null ? `Due in ${days} d` : 'Due soon'}</Badge>;
  if (state === 'upcoming') return <Badge>Upcoming</Badge>;
  return null;
}

export function Debts() {
  const snap = useSnap();
  const money = useMoney();
  const [tab, setTab] = useState<'overview' | 'schedule'>('overview');
  const [month, setMonth] = useState(thisMonth());
  const d = debts(snap, thisMonth());
  const rows = billsFor(snap, month);
  const unpaid = rows.filter((r) => r.state !== 'paid').reduce((s, r) => s + Math.max(0, r.amount - r.paid), 0);

  return (
    <>
      <PageHeader title="Debts & bills" subtitle="What you owe and what is due" actions={
        <>
          <button className="btn-outline" onClick={() => openImporter('bills')}><FileSpreadsheet size={17} /> <span className="hidden sm:inline">Import from Google Sheet</span><span className="sm:hidden">Import</span></button>
          <button className="btn-primary" onClick={() => (tab === 'overview' ? openAccount({ type: 'credit', institution: 'unionbank' }) : openBill())}>
            <Plus size={18} /> {tab === 'overview' ? 'Add debt' : 'Add bill'}
          </button>
        </>
      } />
      <Segmented value={tab} onChange={setTab} className="mb-4 max-w-md" options={[{ value: 'overview', label: 'Overview' }, { value: 'schedule', label: 'Payment schedule' }]} />

      {tab === 'overview' ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <Card className="h-fit">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-muted"><span className="h-2 w-2 rounded-full bg-expense" /> Total outstanding</div>
                <Money value={d.outstanding} className="mt-1 block font-display text-2xl font-bold" />
              </div>
              <div>
                <div className="text-xs text-muted">Monthly payments</div>
                <Money value={d.monthly} className="mt-1 block font-display text-2xl font-bold" />
              </div>
            </div>
            <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-faint">
              Cards update as captured purchases and payments come in. Loans go down with each payment you record.
            </p>
          </Card>
          <Card pad={false} className="p-2 sm:p-3">
            {d.rows.length ? d.rows.map((r) => {
              const Icon = r.account.type === 'credit' ? CreditCard : /car|auto/i.test(r.account.name) ? Car : Landmark;
              return (
                <button key={r.account.id} onClick={() => (r.bill ? openPay(r.bill) : openAccount(r.account))}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-ink-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-expense" style={{ background: 'rgba(255,107,107,0.12)' }}><Icon size={20} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-medium">{r.account.name}</div>
                    <div className="text-xs text-muted">{r.account.type === 'credit' ? 'Credit card' : 'Loan'}{r.monthly ? ` · ${money(r.monthly)} a month` : ''}</div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <StateBadge state={r.state} />
                      {r.monthsLeft != null && <Badge>{r.monthsLeft} months left</Badge>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <Money value={r.outstanding} className="font-semibold" />
                    {r.due && <div className="mt-0.5 text-xs text-muted">Due {shortDate(r.due)}</div>}
                  </div>
                </button>
              );
            }) : <Empty title="No debts recorded" text="Add each credit card and loan (car, Home Credit, Pag-IBIG) to see what you owe in one place." />}
          </Card>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <MonthSwitch month={month} onChange={setMonth} />
            <div className="text-sm text-muted">Still to pay: <Money value={unpaid} className="font-semibold text-paper" /></div>
          </div>
          <Card pad={false} className="p-2 sm:p-3">
            {rows.length ? rows.map((r) => <BillLine key={r.bill.id} r={r} />) : (
              <Empty icon={<CalendarClock />} title="No bills yet" text="Add electricity, water, internet, phone plans, card and loan payments, or import them from your Google Sheet."
                action={<button className="btn-outline" onClick={() => openImporter('bills')}><FileSpreadsheet size={17} /> Import from Google Sheet</button>} />
            )}
          </Card>
        </>
      )}
    </>
  );
}

function BillLine({ r }: { r: BillRow }) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-ink-4">
      <button onClick={() => openBill(r.bill)} className="min-w-0 flex-1 text-left">
        <div className="truncate text-[15px] font-medium">{r.bill.name}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">Due {shortDate(r.due)} <StateBadge state={r.state} days={r.days} /></div>
      </button>
      <div className="text-right">
        <Money value={r.amount} className="font-semibold" />
        {r.paid > 0 && r.state !== 'paid' && <div className="text-xs text-muted">paid <Money value={r.paid} /></div>}
      </div>
      {r.state !== 'paid'
        ? <button className="btn-outline px-3 py-2 text-sm" onClick={() => openPay(r)}>Pay</button>
        : <span className="w-[58px]" />}
    </div>
  );
}
