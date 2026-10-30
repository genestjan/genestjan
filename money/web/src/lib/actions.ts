import { guessCategory } from './categorize';
import type { BillRow } from './compute';
import { draftKey, type BillDraft, type Draft } from './csv';
import { todayISO } from './dates';
import { newId } from './ids';
import type { Snapshot } from './ledger';
import { catId, isLiability, type Account, type Bill, type Budget, type Capture, type Settings, type Txn } from './model';
import { native, platform } from './native';
import { fetchPayPal } from './paypal';
import { getLedger, removeRecords, save, toast, useApp } from './session';

// Everything a button can change. Each function saves through the encrypted ledger, which then
// syncs on its own.

const snap = (): Snapshot => {
  const s = useApp.getState().snap;
  if (!s) throw new Error('Unlock the app first.');
  return s;
};

export async function saveTxn(t: Txn) {
  if (!(t.amount > 0)) throw new Error('Enter an amount.');
  if (!t.accountId) throw new Error('Choose an account.');
  if (t.type === 'transfer' && (!t.toAccountId || t.toAccountId === t.accountId)) throw new Error('Choose a different account to move the money to.');
  const clean: Txn = { ...t, reviewed: true };
  if (t.type !== 'transfer') { delete clean.toAccountId; delete clean.toAmount; }
  else delete clean.categoryId;
  await save([clean]);
}

export const deleteTxn = (id: string) => removeRecords([id]);

export async function saveAccount(a: Account) {
  if (!a.name.trim()) throw new Error('Give the account a name.');
  await save([{ ...a, name: a.name.trim(), last4: a.last4?.replace(/\D/g, '').slice(-4) || undefined }]);
}

export async function removeAccount(a: Account): Promise<'archived' | 'deleted'> {
  const used = snap().txns.some((t) => t.accountId === a.id || t.toAccountId === a.id);
  if (used) {
    await save([{ ...a, archived: true }]);
    return 'archived';
  }
  await removeRecords([a.id]);
  return 'deleted';
}

export async function setBudget(categoryId: string, amount: number, month?: string) {
  const existing = snap().budgets.find((b) => b.categoryId === categoryId && (b.month ?? '') === (month ?? ''));
  if (!amount) {
    if (existing) await removeRecords([existing.id]);
    return;
  }
  const b: Budget = existing ? { ...existing, amount } : { id: newId(), kind: 'budget', updatedAt: 0, categoryId, amount, month };
  await save([b]);
}

export async function saveBill(b: Bill) {
  if (!b.name.trim()) throw new Error('Give the bill a name.');
  if (!(b.dueDay >= 1 && b.dueDay <= 31)) throw new Error('The due day is a number from 1 to 31.');
  await save([{ ...b, name: b.name.trim() }]);
}

export const deleteBill = (id: string) => removeRecords([id]);

/** Record paying a bill: a transfer when it pays down a card or loan, spending otherwise. */
export async function payBill(row: BillRow, fromAccountId: string, amount: number, date = todayISO()) {
  const bill = row.bill;
  const base = {
    id: newId(), kind: 'txn' as const, updatedAt: 0, date, amount, accountId: fromAccountId,
    billId: bill.id, billMonth: row.due.slice(0, 7), source: 'manual' as const, reviewed: true,
  };
  const t: Txn = bill.accountId
    ? { ...base, type: 'transfer', toAccountId: bill.accountId }
    : { ...base, type: 'expense', categoryId: bill.categoryId ?? catId('bills'), payee: bill.name };
  await saveTxn(t);
  if (bill.payFromId !== fromAccountId) await save([{ ...bill, payFromId: fromAccountId }]);
}

export async function updateSettings(patch: Partial<Settings>) {
  await save([{ ...snap().settings, ...patch }]);
}

export async function dismissCapture(c: Capture) {
  await save([{ ...c, status: 'ignored' }]);
}

export async function captureAdded(c: Capture, txnId: string) {
  await save([{ ...c, status: 'added', txnId }]);
}

// ---- Imports --------------------------------------------------------------------------------

export async function importStatement(drafts: Draft[], account: Account): Promise<{ added: number; duplicates: number }> {
  const s = snap();
  const seen = new Set(s.txns.filter((t) => t.accountId === account.id).map((t) =>
    draftKey({ date: t.date, amount: t.type === 'income' ? t.amount : -t.amount, payee: t.payee })));
  const refs = new Set(s.txns.map((t) => t.ref).filter(Boolean));
  const txns: Txn[] = [];
  let duplicates = 0;
  for (const d of drafts) {
    if ((d.ref && refs.has(d.ref)) || seen.has(draftKey(d))) { duplicates++; continue; }
    seen.add(draftKey(d));
    const type = d.amount > 0 ? 'income' : 'expense';
    txns.push({
      id: newId(), kind: 'txn', updatedAt: 0, type, date: d.date, time: d.time, amount: Math.abs(d.amount), fee: d.fee,
      accountId: account.id, payee: d.description, ref: d.ref, source: 'import', reviewed: false,
      categoryId: guessCategory(type, d.description, d.description, { rules: s.rules, txns: s.txns }, account.institution),
    });
  }
  for (let i = 0; i < txns.length; i += 400) await save(txns.slice(i, i + 400));
  return { added: txns.length, duplicates };
}

export async function importBills(drafts: BillDraft[], opts: { payFromId?: string }): Promise<{ bills: number; cards: number }> {
  const s = snap();
  const recs: (Bill | Account)[] = [];
  let cards = 0;
  for (const d of drafts) {
    let accountId: string | undefined;
    if (d.isCard) {
      const match = s.accounts.find((a) => isLiability(a) && a.name.toLowerCase() === d.name.toLowerCase());
      if (match) accountId = match.id;
      else {
        accountId = newId();
        cards++;
        recs.push({
          id: accountId, kind: 'account', updatedAt: 0, name: d.name, type: 'credit', institution: d.institution ?? 'other',
          currency: 'PHP', openingBalance: -d.amount, openingDate: todayISO(), dueDay: d.dueDay,
        });
      }
    }
    const existing = s.bills.find((b) => b.name.toLowerCase() === d.name.toLowerCase());
    recs.push({
      id: existing?.id ?? newId(), kind: 'bill', updatedAt: 0, name: d.name, amount: d.amount,
      amounts: { ...(existing?.amounts ?? {}), ...d.amounts }, dueDay: d.dueDay, active: true,
      accountId, payFromId: opts.payFromId,
      categoryId: accountId ? undefined : guessCategory('expense', d.name, d.name, { rules: s.rules, txns: s.txns }) ?? catId('bills'),
    });
  }
  await save(recs);
  return { bills: drafts.length, cards };
}

// ---- PayPal ---------------------------------------------------------------------------------

export async function syncPayPal(): Promise<number> {
  const s = snap();
  const link = s.settings.paypal;
  if (!link) throw new Error('Connect PayPal first.');
  const account = s.accounts.find((a) => a.id === link.accountId) ?? s.accounts.find((a) => a.institution === 'paypal' && !a.archived);
  if (!account) throw new Error('Add a PayPal account under Accounts first.');
  const withdrawTo = s.accounts.find((a) => a.id === link.withdrawTo && !a.archived)?.id;
  const known = new Set(s.txns.map((t) => t.ref).filter((r): r is string => !!r));
  const { txns, until } = await fetchPayPal(link, account.id, withdrawTo, known);
  if (txns.length) await save(txns);
  await updateSettings({ paypal: { ...link, accountId: account.id, lastSync: Date.now(), syncedUntil: until } });
  return txns.length;
}

// ---- Exports --------------------------------------------------------------------------------

const q = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function transactionsCSV(s: Snapshot): string {
  const acct = new Map(s.accounts.map((a) => [a.id, a]));
  const cat = new Map(s.categories.map((c) => [c.id, c.name]));
  const rows = [['Date', 'Time', 'Type', 'Account', 'To account', 'Amount', 'Currency', 'Fee', 'Category', 'Payee', 'Note', 'Source', 'Reference']];
  for (const t of [...s.txns].reverse()) {
    const a = acct.get(t.accountId);
    rows.push([
      t.date, t.time ?? '', t.type, a?.name ?? '', t.toAccountId ? acct.get(t.toAccountId)?.name ?? '' : '',
      (t.amount / 100).toFixed(2), a?.currency ?? '', t.fee ? (t.fee / 100).toFixed(2) : '',
      t.categoryId ? cat.get(t.categoryId) ?? '' : '', t.payee ?? '', t.note ?? '', t.source, t.ref ?? '',
    ]);
  }
  return rows.map((r) => r.map(q).join(',')).join('\r\n');
}

export async function saveTextFile(name: string, mime: string, text: string) {
  if (platform !== 'web') {
    const { saved } = await native.saveFile(name, mime, text);
    if (saved) toast(`Saved ${name}.`);
    return;
  }
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The encrypted copies plus the locked key: restorable with your password, unreadable without. */
export async function encryptedBackup(): Promise<string> {
  const ledger = getLedger();
  const meta = useApp.getState().meta;
  if (!ledger || !meta) throw new Error('Unlock the app first.');
  return JSON.stringify({
    app: 'money-hub', v: 1, exportedAt: new Date().toISOString(), email: meta.email, mode: meta.mode, boxes: meta.boxes,
    records: ledger.encryptedRows(),
  });
}

