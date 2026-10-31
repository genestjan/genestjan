import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  captureAdded, deleteBill, deleteTxn, payBill, removeAccount, saveAccount, saveBill, saveTxn, setBudget,
} from '../lib/actions';
import { budgetsFor, type BillRow } from '../lib/compute';
import { isoTime, monthLabel, todayISO } from '../lib/dates';
import { newId } from '../lib/ids';
import {
  ACCOUNT_TYPES, INSTITUTIONS, isLiability, type Account, type AccountType, type Bill, type InstitutionId, type Txn, type TxnType,
} from '../lib/model';
import { CURRENCIES, formatMoney, type Currency } from '../lib/money';
import { toast, useApp } from '../lib/session';
import { useUI } from '../ui-state';
import { CategoryIcon, ErrorText, Field, MoneyInput, Segmented, Sheet, cx } from './ui';

function useSnap() {
  return useApp((s) => s.snap)!;
}

function Footer({ onSave, onDelete, saveLabel = 'Save', deleteLabel = 'Delete' }: { onSave: () => void; onDelete?: () => void; saveLabel?: string; deleteLabel?: string }) {
  return (
    <div className="flex gap-2">
      {onDelete && <button type="button" onClick={onDelete} className="btn-danger px-3" aria-label={deleteLabel}><Trash2 size={18} /></button>}
      <button type="button" onClick={onSave} className="btn-primary flex-1">{saveLabel}</button>
    </div>
  );
}

function AccountSelect({ value, onChange, accounts, placeholder = 'Choose an account' }: { value: string; onChange: (v: string) => void; accounts: Account[]; placeholder?: string }) {
  return (
    <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {accounts.filter((a) => !a.archived || a.id === value).map((a) => <option key={a.id} value={a.id}>{a.name}{a.last4 ? ` ••${a.last4}` : ''} ({a.currency})</option>)}
    </select>
  );
}

// ---- Transaction ----------------------------------------------------------------------------

export function TxnSheet() {
  const draft = useUI((s) => s.txn);
  if (!draft) return null;
  return <TxnForm key={draft.id ?? 'new'} draft={draft} />;
}

function TxnForm({ draft }: { draft: Partial<Txn> }) {
  const snap = useSnap();
  const close = () => useUI.setState({ txn: null });
  const existing = draft.id ? snap.txns.find((t) => t.id === draft.id) : undefined;
  const firstAcct = snap.accounts.find((a) => !a.archived && !isLiability(a))?.id ?? '';
  const [type, setType] = useState<TxnType>(draft.type ?? 'expense');
  const [amount, setAmount] = useState<number | null>(draft.amount ?? null);
  const [accountId, setAccountId] = useState(draft.accountId ?? firstAcct);
  const [toAccountId, setToAccountId] = useState(draft.toAccountId ?? '');
  const [toAmount, setToAmount] = useState<number | null>(draft.toAmount ?? null);
  const [fee, setFee] = useState<number | null>(draft.fee ?? null);
  const [categoryId, setCategoryId] = useState(draft.categoryId ?? '');
  const [payee, setPayee] = useState(draft.payee ?? '');
  const [date, setDate] = useState(draft.date ?? todayISO());
  const [time, setTime] = useState(draft.time ?? isoTime(new Date()));
  const [note, setNote] = useState(draft.note ?? '');
  const [billId, setBillId] = useState(draft.billId ?? '');
  const [error, setError] = useState<string | null>(null);

  const acct = snap.accounts.find((a) => a.id === accountId);
  const to = snap.accounts.find((a) => a.id === toAccountId);
  const cats = snap.categories.filter((c) => c.type === (type === 'income' ? 'income' : 'expense'));
  const crossCurrency = type === 'transfer' && acct && to && acct.currency !== to.currency;

  async function submit() {
    try {
      const t: Txn = {
        ...(existing ?? {}), id: existing?.id ?? draft.id ?? newId(), kind: 'txn', updatedAt: 0, type, amount: amount ?? 0, accountId,
        toAccountId: type === 'transfer' ? toAccountId : undefined, toAmount: crossCurrency ? toAmount ?? undefined : undefined,
        fee: fee || undefined, categoryId: type === 'transfer' ? undefined : categoryId || undefined, payee: payee.trim() || undefined,
        date, time: time || undefined, note: note.trim() || undefined, billId: billId || undefined,
        billMonth: billId ? date.slice(0, 7) : undefined, source: existing?.source ?? draft.source ?? 'manual',
        ref: existing?.ref ?? draft.ref, captureId: existing?.captureId ?? draft.captureId,
      };
      await saveTxn(t);
      const cap = draft.captureId ? snap.captures.find((c) => c.id === draft.captureId) : undefined;
      if (cap && cap.status !== 'added') await captureAdded(cap, t.id);
      toast(existing ? 'Saved.' : 'Transaction added.');
      close();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Sheet open onClose={close} title={existing ? 'Edit transaction' : 'Add transaction'}
      footer={<Footer onSave={submit} onDelete={existing ? async () => { await deleteTxn(existing.id); toast('Deleted.'); close(); } : undefined} />}>
      <div className="space-y-4">
        <Segmented value={type} onChange={setType} options={[{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }, { value: 'transfer', label: 'Transfer' }]} />
        <MoneyInput value={amount} onChange={setAmount} currency={acct?.currency} large autoFocus={!existing} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={type === 'transfer' ? 'From' : type === 'income' ? 'Into' : 'Paid with'}>
            <AccountSelect value={accountId} onChange={setAccountId} accounts={snap.accounts} />
          </Field>
          {type === 'transfer' && (
            <Field label="To"><AccountSelect value={toAccountId} onChange={setToAccountId} accounts={snap.accounts.filter((a) => a.id !== accountId)} /></Field>
          )}
        </div>
        {crossCurrency && (
          <Field label={`Amount that arrived in ${to!.name}`} hint="Different currencies: enter what actually landed, after the exchange.">
            <MoneyInput value={toAmount} onChange={setToAmount} currency={to!.currency} />
          </Field>
        )}
        {type !== 'transfer' && (
          <Field label="Category">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {cats.map((c) => (
                <button key={c.id} type="button" onClick={() => setCategoryId(c.id)} className={cx(
                  'flex flex-col items-center gap-1.5 rounded-xl border px-1.5 py-2.5 text-center text-[11px] leading-tight transition',
                  categoryId === c.id ? 'border-current bg-current/10 text-paper' : 'border-line text-muted hover:border-line-strong',
                )}>
                  <CategoryIcon category={c} size={30} />
                  <span className="line-clamp-2">{c.name}</span>
                </button>
              ))}
            </div>
          </Field>
        )}
        <Field label={type === 'income' ? 'From (client or payer)' : type === 'transfer' ? 'Description' : 'Paid to'}>
          <input className="field" value={payee} onChange={(e) => setPayee(e.target.value)} placeholder={type === 'income' ? 'e.g. Acme Coaching' : 'e.g. Puregold'} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Time"><input type="time" className="field" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Fee (optional)" hint="InstaPay, PayPal or other charges on top.">
            <MoneyInput value={fee} onChange={setFee} currency={acct?.currency} />
          </Field>
          <Field label="Pays a bill (optional)">
            <select className="field" value={billId} onChange={(e) => setBillId(e.target.value)}>
              <option value="">No</option>
              {snap.bills.filter((b) => b.active).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Note (optional)"><input className="field" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        {existing?.source && existing.source !== 'manual' && (
          <p className="text-xs text-faint">Added {existing.source === 'capture' ? 'from a phone notification' : existing.source === 'paypal' ? 'from PayPal' : 'from an import'}{existing.ref ? `, ref ${existing.ref}` : ''}.</p>
        )}
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}

// ---- Account --------------------------------------------------------------------------------

export function AccountSheet() {
  const draft = useUI((s) => s.account);
  if (!draft) return null;
  return <AccountForm key={draft.id ?? 'new'} draft={draft} />;
}

function AccountForm({ draft }: { draft: Partial<Account> }) {
  const snap = useSnap();
  const close = () => useUI.setState({ account: null });
  const existing = draft.id ? snap.accounts.find((a) => a.id === draft.id) : undefined;
  const [a, setA] = useState<Account>({
    id: newId(), kind: 'account', updatedAt: 0, name: '', type: 'bank', institution: 'bpi', currency: 'PHP',
    openingBalance: 0, openingDate: todayISO(), ...draft, ...(existing ?? {}),
  });
  const [error, setError] = useState<string | null>(null);
  const owed = isLiability(a);
  const up = (p: Partial<Account>) => setA((x) => ({ ...x, ...p }));

  async function submit() {
    try {
      await saveAccount(a);
      toast(existing ? 'Saved.' : `${a.name} added.`);
      close();
    } catch (e) { setError((e as Error).message); }
  }

  return (
    <Sheet open onClose={close} title={existing ? 'Edit account' : owed ? 'Add a debt' : 'Add account'}
      footer={<Footer onSave={submit} deleteLabel="Remove account" onDelete={existing ? async () => {
        const how = await removeAccount(existing);
        toast(how === 'archived' ? 'Archived. Its history stays in your reports.' : 'Removed.');
        close();
      } : undefined} />}>
      <div className="space-y-4">
        <Field label="Type">
          <select className="field" value={a.type} onChange={(e) => up({ type: e.target.value as AccountType })}>
            {ACCOUNT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bank or provider">
            <select className="field" value={a.institution} onChange={(e) => {
              const inst = e.target.value as InstitutionId;
              const i = INSTITUTIONS.find((x) => x.id === inst)!;
              up({ institution: inst, name: a.name || i.name, currency: inst === 'wise' || inst === 'paypal' ? 'USD' : a.currency });
            }}>
              {INSTITUTIONS.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </Field>
          <Field label="Currency">
            <select className="field" value={a.currency} onChange={(e) => up({ currency: e.target.value as Currency })}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Name"><input className="field" value={a.name} onChange={(e) => up({ name: e.target.value })} placeholder="e.g. BPI Savings, UnionBank Visa" /></Field>
        <Field label={owed ? 'Amount you owe now' : 'Balance now'} hint={owed ? 'From your latest statement or app. New charges and payments are added from here.' : 'What the app or bank shows today. New transactions are added from here.'}>
          <MoneyInput value={Math.abs(a.openingBalance)} onChange={(v) => up({ openingBalance: owed ? -(v ?? 0) : v ?? 0, openingDate: existing?.openingDate ?? todayISO() })} currency={a.currency} />
        </Field>
        {(owed || a.type === 'bank' || a.type === 'ewallet') && (
          <Field label="Last 4 digits of the card or account" hint="So captured notifications land in the right account (“ending in 4321”).">
            <input className="field" inputMode="numeric" maxLength={4} value={a.last4 ?? ''} onChange={(e) => up({ last4: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
          </Field>
        )}
        {owed && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Due day of the month"><input className="field" inputMode="numeric" value={a.dueDay ?? ''} onChange={(e) => up({ dueDay: Number(e.target.value) || undefined })} placeholder="e.g. 13" /></Field>
              <Field label={a.type === 'credit' ? 'Credit limit' : 'Monthly payment'}>
                {a.type === 'credit'
                  ? <MoneyInput value={a.creditLimit ?? null} onChange={(v) => up({ creditLimit: v ?? undefined })} currency={a.currency} />
                  : <MoneyInput value={a.monthlyPayment ?? null} onChange={(v) => up({ monthlyPayment: v ?? undefined })} currency={a.currency} />}
              </Field>
            </div>
            {a.type === 'loan' && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Term (months)"><input className="field" inputMode="numeric" value={a.termMonths ?? ''} onChange={(e) => up({ termMonths: Number(e.target.value) || undefined })} /></Field>
                <Field label="First payment month"><input type="month" className="field" value={a.startMonth ?? ''} onChange={(e) => up({ startMonth: e.target.value || undefined })} /></Field>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Interest (%)"><input className="field" inputMode="decimal" value={a.rate ?? ''} onChange={(e) => up({ rate: parseFloat(e.target.value) || undefined })} placeholder="e.g. 3" /></Field>
              <Field label="Per">
                <select className="field" value={a.ratePer ?? 'month'} onChange={(e) => up({ ratePer: e.target.value as 'month' | 'year' })}>
                  <option value="month">Month</option><option value="year">Year</option>
                </select>
              </Field>
            </div>
          </>
        )}
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}

// ---- Bill -----------------------------------------------------------------------------------

export function BillSheet() {
  const draft = useUI((s) => s.bill);
  if (!draft) return null;
  return <BillForm key={draft.id ?? 'new'} draft={draft} />;
}

function BillForm({ draft }: { draft: Partial<Bill> }) {
  const snap = useSnap();
  const close = () => useUI.setState({ bill: null });
  const existing = draft.id ? snap.bills.find((b) => b.id === draft.id) : undefined;
  const [b, setB] = useState<Bill>({ id: newId(), kind: 'bill', updatedAt: 0, name: '', amount: 0, dueDay: 15, active: true, ...draft, ...(existing ?? {}) });
  const [error, setError] = useState<string | null>(null);
  const up = (p: Partial<Bill>) => setB((x) => ({ ...x, ...p }));
  const debts = snap.accounts.filter((a) => isLiability(a) && !a.archived);

  return (
    <Sheet open onClose={close} title={existing ? 'Edit bill' : 'Add bill'}
      footer={<Footer onSave={async () => { try { await saveBill(b); toast('Saved.'); close(); } catch (e) { setError((e as Error).message); } }}
        onDelete={existing ? async () => { await deleteBill(existing.id); toast('Bill removed.'); close(); } : undefined} />}>
      <div className="space-y-4">
        <Field label="Name"><input className="field" value={b.name} onChange={(e) => up({ name: e.target.value })} placeholder="e.g. Electricity, Globe postpaid" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Usual amount"><MoneyInput value={b.amount || null} onChange={(v) => up({ amount: v ?? 0 })} /></Field>
          <Field label="Due day"><input className="field" inputMode="numeric" value={b.dueDay || ''} onChange={(e) => up({ dueDay: Number(e.target.value) || 0 })} /></Field>
        </div>
        <Field label="This bill pays down" hint="Pick a card or loan so paying it counts as a transfer, not new spending.">
          <select className="field" value={b.accountId ?? ''} onChange={(e) => up({ accountId: e.target.value || undefined })}>
            <option value="">Nothing (it is spending)</option>
            {debts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        {!b.accountId && (
          <Field label="Category">
            <select className="field" value={b.categoryId ?? ''} onChange={(e) => up({ categoryId: e.target.value || undefined })}>
              <option value="">Bills & utilities</option>
              {snap.categories.filter((c) => c.type === 'expense').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Usually paid from"><AccountSelect value={b.payFromId ?? ''} onChange={(v) => up({ payFromId: v || undefined })} accounts={snap.accounts.filter((a) => !isLiability(a))} placeholder="Any account" /></Field>
        <Field label="Words that identify a payment (optional)" hint="Comma separated, e.g. socoteco, meralco. Captured payments with these words are matched to this bill.">
          <input className="field" value={b.match ?? ''} onChange={(e) => up({ match: e.target.value })} />
        </Field>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={b.active} onChange={(e) => up({ active: e.target.checked })} className="h-4 w-4 accent-[#FFB03A]" /> Active</label>
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}

// ---- Paying a bill --------------------------------------------------------------------------

export function PaySheet() {
  const row = useUI((s) => s.pay);
  if (!row) return null;
  return <PayForm key={`${row.bill.id}${row.due}`} row={row} />;
}

function PayForm({ row }: { row: BillRow }) {
  const snap = useSnap();
  const close = () => useUI.setState({ pay: null });
  const [amount, setAmount] = useState<number | null>(Math.max(0, row.amount - row.paid) || row.amount);
  const [from, setFrom] = useState(row.bill.payFromId ?? snap.accounts.find((a) => !isLiability(a) && !a.archived)?.id ?? '');
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);
  return (
    <Sheet open onClose={close} title={`Pay ${row.bill.name}`}
      footer={<button className="btn-primary w-full" onClick={async () => {
        try { await payBill(row, from, amount ?? 0, date); toast('Marked as paid.'); close(); } catch (e) { setError((e as Error).message); }
      }}>Mark as paid</button>}>
      <div className="space-y-4">
        <p className="text-sm text-muted">Due {row.due}. {row.paid > 0 && `${formatMoney(row.paid)} already paid.`}</p>
        <Field label="Amount paid"><MoneyInput value={amount} onChange={setAmount} large /></Field>
        <Field label="Paid from"><AccountSelect value={from} onChange={setFrom} accounts={snap.accounts.filter((a) => !isLiability(a))} /></Field>
        <Field label="Date"><input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}

// ---- Budgets --------------------------------------------------------------------------------

export function BudgetSheet() {
  const month = useUI((s) => s.budgets);
  if (!month) return null;
  return <BudgetForm key={month} month={month} />;
}

function BudgetForm({ month }: { month: string }) {
  const snap = useSnap();
  const close = () => useUI.setState({ budgets: null });
  const [scope, setScope] = useState<'every' | 'this'>('every');
  const current = budgetsFor(snap, month);
  const [values, setValues] = useState<Record<string, number | null>>(
    Object.fromEntries(snap.categories.filter((c) => c.type === 'expense').map((c) => [c.id, current.get(c.id) ?? null])),
  );
  const total = Object.values(values).reduce<number>((s, v) => s + (v ?? 0), 0);
  return (
    <Sheet open onClose={close} title="Set budgets" wide
      footer={
        <div className="flex items-center gap-3">
          <span className="flex-1 text-sm text-muted">Total <span className="num font-semibold text-paper">{formatMoney(total)}</span> a month</span>
          <button className="btn-primary" onClick={async () => {
            for (const [id, v] of Object.entries(values)) {
              if ((v ?? 0) !== (current.get(id) ?? 0)) await setBudget(id, v ?? 0, scope === 'this' ? month : undefined);
            }
            toast('Budgets saved.');
            close();
          }}>Save budgets</button>
        </div>
      }>
      <div className="space-y-4">
        <Segmented value={scope} onChange={setScope} options={[{ value: 'every', label: 'Every month' }, { value: 'this', label: `Only ${monthLabel(month)}` }]} />
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          {snap.categories.filter((c) => c.type === 'expense').map((c) => (
            <div key={c.id} className="flex items-center gap-3">
              <CategoryIcon category={c} size={32} />
              <div className="min-w-0 flex-1">
                <div className="mb-1 truncate text-[13px] text-muted">{c.name}</div>
                <MoneyInput value={values[c.id]} onChange={(v) => setValues((x) => ({ ...x, [c.id]: v }))} placeholder="No budget" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
