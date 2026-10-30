import { guessCategory, tidyPayee } from './categorize';
import { isoDate, isoTime, monthOf } from './dates';
import { stableId } from './ids';
import { isLiability, type Account, type Bill, type Capture, type Rule, type Settings, type Txn } from './model';
import { parseNotification, type CaptureInput, type Parsed } from './parse/notifications';
import { sourceApp } from './parse/sources';

// What happens to one captured notification: it becomes a new transaction, completes the other
// half of a transfer, is recognised as a duplicate, or waits in "To review".

export interface CaptureItem extends CaptureInput { id: string }

export interface CaptureContext {
  accounts: Account[];
  txns: Txn[];
  captures: Capture[];
  rules: Rule[];
  bills: Bill[];
  settings: Settings;
}

export interface CaptureOutcome {
  capture?: Capture;
  /** New or changed transactions to save. */
  txns: Txn[];
}

const MIN = 60_000;
const FEE_LIMIT = 5_000; // ₱50: the most a transfer fee plausibly is

const when = (t: Txn) => new Date(`${t.date}T${t.time ?? '12:00'}:00`).getTime();

function matchAccount(p: Parsed, accounts: Account[]): Account | undefined {
  const live = accounts.filter((a) => !a.deleted && !a.archived && a.institution === p.institution);
  if (!live.length) return undefined;
  if (p.last4) {
    const exact = live.filter((a) => a.last4 === p.last4);
    if (exact.length === 1) return exact[0];
    // A different card from the same bank: better to ask than to guess.
    if (live.every((a) => a.last4 && a.last4 !== p.last4)) return undefined;
  }
  const sameCurrency = live.filter((a) => a.currency === p.currency);
  const pool = sameCurrency.length ? sameCurrency : live;
  if (pool.length === 1) return pool[0];
  // Card alerts nearly always name the card ending, so a message without one is the account.
  const plain = pool.filter((a) => !isLiability(a) && !a.last4);
  if (plain.length === 1) return plain[0];
  const nonCard = pool.filter((a) => !isLiability(a));
  return nonCard.length === 1 ? nonCard[0] : undefined;
}

/** Does this existing transaction move money into (in) or out of (out) the account? */
function flowOf(t: Txn, accountId: string): 'in' | 'out' | undefined {
  if (t.type === 'transfer') return t.accountId === accountId ? 'out' : t.toAccountId === accountId ? 'in' : undefined;
  if (t.accountId !== accountId) return undefined;
  return t.type === 'income' ? 'in' : 'out';
}

function amountFor(t: Txn, accountId: string) {
  return t.type === 'transfer' && t.toAccountId === accountId ? t.toAmount ?? t.amount : t.amount;
}

function findDuplicate(p: Parsed, acct: Account, ts: number, txns: Txn[]): Txn | undefined {
  // A card says "payment received" hours or days after the bank said "sent".
  const window = isLiability(acct) && p.direction === 'in' ? 3 * 24 * 60 * MIN : 15 * MIN;
  return txns.find((t) => {
    if (t.deleted) return false;
    if (p.ref && t.ref && t.ref === p.ref) return true;
    if (flowOf(t, acct.id) !== p.direction) return false;
    const same = amountFor(t, acct.id) === p.amount || (t.type === 'transfer' && t.accountId === acct.id && t.amount + (t.fee ?? 0) === p.amount);
    return same && Math.abs(when(t) - ts) <= window;
  });
}

/** A transfer into this account recorded from the sending side, still missing what arrived
 *  (a PayPal dollar withdrawal that lands in BPI as pesos a day or two later). */
function findPendingArrival(p: Parsed, acct: Account, ts: number, txns: Txn[], accounts: Account[]): Txn | undefined {
  if (p.direction !== 'in') return undefined;
  const byId = new Map(accounts.map((a) => [a.id, a]));
  return txns.find((t) => {
    if (t.deleted || t.type !== 'transfer' || t.toAccountId !== acct.id || t.toAmount != null) return false;
    const from = byId.get(t.accountId);
    if (!from || from.currency === acct.currency) return false;
    const age = ts - when(t);
    return age >= -60 * MIN && age <= 5 * 24 * 60 * MIN;
  });
}

/** The other half of a transfer between two of your own accounts, already on the books. */
function findOtherHalf(p: Parsed, acct: Account, ts: number, txns: Txn[], accounts: Account[]): Txn | undefined {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  return txns.find((t) => {
    if (t.deleted || t.type === 'transfer' || t.accountId === acct.id) return false;
    if (Math.abs(when(t) - ts) > 60 * MIN) return false;
    const other = byId.get(t.accountId);
    if (!other) return false;
    const otherDir = t.type === 'income' ? 'in' : 'out';
    if (otherDir === p.direction) return false;
    const out = p.direction === 'out' ? p.amount : t.amount;
    const inn = p.direction === 'in' ? p.amount : t.amount;
    if (out < inn || out - inn > FEE_LIMIT) return false;
    // Only pair when one side names the other's bank or wallet, or it is a card payment.
    const named = p.counterInstitution === other.institution || (t.payee ?? '').toLowerCase().includes(acct.institution);
    return named || isLiability(acct) || isLiability(other);
  });
}

function billFor(bills: Bill[], text: string, toAccountId?: string): Bill | undefined {
  const live = bills.filter((b) => !b.deleted && b.active);
  if (toAccountId) {
    const b = live.find((x) => x.accountId === toAccountId);
    if (b) return b;
  }
  const hay = text.toLowerCase();
  return live.find((b) => b.match && b.match.split(',').some((w) => w.trim() && hay.includes(w.trim().toLowerCase())));
}

export async function processCapture(item: CaptureItem, ctx: CaptureContext, now = Date.now()): Promise<CaptureOutcome> {
  if (ctx.captures.some((c) => c.id === item.id)) return { txns: [] };
  const app = sourceApp(item.pkg);
  const base: Omit<Capture, 'status'> = {
    id: item.id, kind: 'capture', updatedAt: now, capturedAt: item.postedAt,
    app: item.app || app?.name || item.pkg, pkg: item.pkg, title: item.title, text: item.text,
  };
  const result = parseNotification(item);
  if (!result.ok) {
    // One-time PINs, promos, declined cards and balance reminders are dropped, not stored.
    if (result.reason !== 'no-direction') return { txns: [] };
    return { capture: { ...base, status: 'review', reason: 'Could not tell if money came in or went out.' }, txns: [] };
  }
  const p = result.parsed;
  const acct = matchAccount(p, ctx.accounts);
  if (!acct) {
    const why = p.institution
      ? `No ${p.last4 ? `account ending ${p.last4}` : 'matching account'} yet. Add it under Accounts, or add this by hand.`
      : 'Could not tell which bank or wallet this was.';
    return { capture: { ...base, status: 'review', reason: why }, txns: [] };
  }

  const dup = findDuplicate(p, acct, item.postedAt, ctx.txns);
  if (dup) return { capture: { ...base, status: 'duplicate', txnId: dup.id }, txns: [] };

  const pending = findPendingArrival(p, acct, item.postedAt, ctx.txns, ctx.accounts);
  if (pending) {
    return { capture: { ...base, status: 'added', txnId: pending.id }, txns: [{ ...pending, toAmount: p.amount, updatedAt: now }] };
  }

  const half = findOtherHalf(p, acct, item.postedAt, ctx.txns, ctx.accounts);
  if (half) {
    const outIsNew = p.direction === 'out';
    const fromId = outIsNew ? acct.id : half.accountId;
    const toId = outIsNew ? half.accountId : acct.id;
    const out = outIsNew ? p.amount : half.amount;
    const inn = outIsNew ? half.amount : p.amount;
    const bill = billFor(ctx.bills, item.text, toId);
    const merged: Txn = {
      ...half, type: 'transfer', accountId: fromId, toAccountId: toId, amount: inn, fee: out - inn || undefined,
      categoryId: undefined, payee: undefined, updatedAt: now, reviewed: false,
      billId: bill?.id ?? half.billId, billMonth: bill ? monthOf(half.date) : half.billMonth,
    };
    return { capture: { ...base, status: 'added', txnId: half.id }, txns: [merged] };
  }

  const d = new Date(item.postedAt);
  const txnId = await stableId(`${item.id}:txn`);
  const payee = tidyPayee(p.counterparty);
  const live = ctx.accounts.filter((a) => !a.deleted && !a.archived && a.id !== acct.id);
  const counter = p.counterInstitution ? live.filter((a) => a.institution === p.counterInstitution) : [];
  const counterAcct = counter.length === 1 ? counter[0] : undefined;

  let txn: Txn;
  const common = {
    id: txnId, kind: 'txn' as const, updatedAt: now, date: isoDate(d), time: isoTime(d),
    source: 'capture' as const, ref: p.ref, captureId: item.id, reviewed: false,
  };
  if (counterAcct && p.transferHint) {
    const [from, to] = p.direction === 'out' ? [acct, counterAcct] : [counterAcct, acct];
    const bill = billFor(ctx.bills, item.text, to.id);
    txn = { ...common, type: 'transfer', amount: p.amount, accountId: from.id, toAccountId: to.id,
      billId: bill?.id, billMonth: bill ? isoDate(d).slice(0, 7) : undefined };
  } else if (isLiability(acct) && p.direction === 'in') {
    // Money into a card or loan is a payment from somewhere else; ask which account paid.
    return { capture: { ...base, status: 'review', reason: 'A payment reached this card. Which account paid it?' }, txns: [] };
  } else {
    const type = p.direction === 'in' ? 'income' : 'expense';
    const bill = type === 'expense' ? billFor(ctx.bills, `${payee ?? ''} ${item.text}`) : undefined;
    txn = {
      ...common, type, amount: p.amount, accountId: acct.id, payee,
      categoryId: bill?.categoryId ?? guessCategory(type, item.text, payee, ctx, acct.institution),
      billId: bill?.id, billMonth: bill ? isoDate(d).slice(0, 7) : undefined,
    };
  }

  if (!ctx.settings.autoAdd || p.confidence < 0.6) {
    return { capture: { ...base, status: 'review', reason: 'Check the details, then add it.' }, txns: [] };
  }
  return { capture: { ...base, status: 'added', txnId: txn.id }, txns: [txn] };
}

/** Rebuild a draft transaction from a capture waiting in "To review". */
export function draftFromCapture(c: Capture): Partial<Txn> {
  const r = parseNotification({ ...c, postedAt: c.capturedAt });
  const d = new Date(c.capturedAt);
  const draft: Partial<Txn> = { date: isoDate(d), time: isoTime(d), source: 'capture', captureId: c.id };
  if (r.ok) {
    draft.type = r.parsed.direction === 'in' ? 'income' : 'expense';
    draft.amount = r.parsed.amount;
    draft.payee = tidyPayee(r.parsed.counterparty);
    draft.ref = r.parsed.ref;
  }
  return draft;
}
