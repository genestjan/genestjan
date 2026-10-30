import { isoDate, isoTime } from './dates';
import { stableId } from './ids';
import { catId, type PayPalLink, type Txn } from './model';
import { native } from './native';

// PayPal's Transaction Search API (needs a PayPal Business account and a REST app with
// "Transaction search" ticked). Calls go through the Android or Windows app because PayPal does
// not accept calls straight from a web page. Data appears in PayPal's API up to three hours late.

const HOST = { live: 'https://api-m.paypal.com', sandbox: 'https://api-m.sandbox.paypal.com' };
const DAY = 86_400_000;

async function token(link: PayPalLink): Promise<string> {
  const res = await native.http({
    method: 'POST',
    url: `${HOST[link.env]}/v1/oauth2/token`,
    headers: { Authorization: `Basic ${btoa(`${link.clientId.trim()}:${link.secret.trim()}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (res.status !== 200) throw new Error('PayPal did not accept the Client ID and Secret. Check them, and that the app is a Live app.');
  return JSON.parse(res.body).access_token as string;
}

interface Detail {
  transaction_info: {
    transaction_id: string;
    transaction_event_code: string;
    transaction_initiation_date: string;
    transaction_amount: { currency_code: string; value: string };
    fee_amount?: { value: string };
    transaction_status: string;
    transaction_subject?: string;
  };
  payer_info?: { email_address?: string; payer_name?: { alternate_full_name?: string; given_name?: string; surname?: string } };
}

// Event code families that are not money in or out of your balance.
const SKIP = /^T(02|11|13|15|21)/; // conversions, reversals of holds, authorisations, holds, reserves
const WITHDRAWAL = /^T04/;

export async function fetchPayPal(link: PayPalLink, accountId: string, withdrawTo: string | undefined, known: Set<string>):
  Promise<{ txns: Txn[]; until: string }> {
  const bearer = await token(link);
  const end = new Date(Date.now() - 5 * 60_000);
  const from = link.syncedUntil ? new Date(new Date(link.syncedUntil).getTime() - 3 * DAY) : new Date(end.getTime() - 90 * DAY);
  const out: Txn[] = [];
  for (let s = from.getTime(); s < end.getTime(); s += 31 * DAY) {
    const e = Math.min(s + 31 * DAY - 1000, end.getTime());
    for (let page = 1; page <= 20; page++) {
      const q = new URLSearchParams({
        start_date: new Date(s).toISOString().replace(/\.\d{3}Z$/, 'Z'),
        end_date: new Date(e).toISOString().replace(/\.\d{3}Z$/, 'Z'),
        fields: 'transaction_info,payer_info',
        page_size: '500',
        page: String(page),
      });
      const res = await native.http({ method: 'GET', url: `${HOST[link.env]}/v1/reporting/transactions?${q}`, headers: { Authorization: `Bearer ${bearer}` } });
      if (res.status === 403) throw new Error('PayPal says this app may not search transactions. Tick "Transaction search" in the app settings on developer.paypal.com and wait up to 9 hours.');
      if (res.status !== 200) throw new Error(`PayPal answered ${res.status}. Try again later.`);
      const body = JSON.parse(res.body) as { transaction_details: Detail[]; total_pages: number };
      for (const d of body.transaction_details ?? []) {
        const t = await toTxn(d, accountId, withdrawTo, known);
        if (t) { out.push(t); known.add(d.transaction_info.transaction_id); }
      }
      if (page >= (body.total_pages ?? 1)) break;
    }
  }
  return { txns: out, until: end.toISOString() };
}

async function toTxn(d: Detail, accountId: string, withdrawTo: string | undefined, known: Set<string>): Promise<Txn | null> {
  const i = d.transaction_info;
  if (known.has(i.transaction_id) || i.transaction_status !== 'S' || SKIP.test(i.transaction_event_code)) return null;
  const value = Math.round(parseFloat(i.transaction_amount.value) * 100);
  if (!value) return null;
  const fee = i.fee_amount ? Math.abs(Math.round(parseFloat(i.fee_amount.value) * 100)) : 0;
  const when = new Date(i.transaction_initiation_date);
  const n = d.payer_info?.payer_name;
  const payee = n?.alternate_full_name || [n?.given_name, n?.surname].filter(Boolean).join(' ') || d.payer_info?.email_address || i.transaction_subject;
  const base = {
    id: await stableId(`paypal:${i.transaction_id}`), kind: 'txn' as const, updatedAt: Date.now(),
    date: isoDate(when), time: isoTime(when), accountId, source: 'paypal' as const, ref: i.transaction_id, reviewed: false,
    fee: fee || undefined,
  };
  if (WITHDRAWAL.test(i.transaction_event_code)) {
    if (!withdrawTo) return null;
    return { ...base, type: 'transfer', amount: Math.abs(value), toAccountId: withdrawTo };
  }
  return value > 0
    ? { ...base, type: 'income', amount: value, payee, categoryId: catId('clients') }
    : { ...base, type: 'expense', amount: -value, payee };
}
