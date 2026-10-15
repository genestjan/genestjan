/* Invoices · Genest Jan Ramirez
   Plain JavaScript, no build step. Invoices, clients and business details live in this browser,
   locked with Jan's password, and travel between devices through an encrypted secret gist
   (core.js does the lock, fingerprint unlock and sync). Nothing personal is written in this
   file: the page is public, the data is not. The only other network request is for today's
   exchange rates, used for the peso estimates. */
(() => {
'use strict';

/* ------------------------------------------------------------------ constants */

const CUR = {
  AUD: { sym: 'A$', name: 'Australian dollar' },
  USD: { sym: '$', name: 'US dollar' },
  GBP: { sym: '£', name: 'UK pound' },
  EUR: { sym: '€', name: 'Euro' },
  CAD: { sym: 'C$', name: 'Canadian dollar' },
  NZD: { sym: 'NZ$', name: 'New Zealand dollar' },
  SGD: { sym: 'S$', name: 'Singapore dollar' },
  PHP: { sym: '₱', name: 'Philippine peso' },
};
const CODES = Object.keys(CUR);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const TABS = ['overview', 'invoices', 'clients', 'settings'];
const STATUS = { draft: 'Draft', sent: 'Sent', partial: 'Partly paid', overdue: 'Overdue', paid: 'Paid', void: 'Void' };
// "Due on receipt" invoices only count as overdue after a week, so they don't turn red the next day
const RECEIPT_GRACE = 7;
// the same free feeds the Payroll app uses (ppcurrencyconverter.com calls the first one)
const FEEDS = [
  { name: 'exchangerate-api.com', url: c => `https://api.exchangerate-api.com/v4/latest/${c}`, date: j => j.date || '' },
  { name: 'open.er-api.com', url: c => `https://open.er-api.com/v6/latest/${c}`,
    date: j => (j.time_last_update_unix ? new Date(j.time_last_update_unix * 1000).toISOString().slice(0, 10) : '') },
];

const DEFAULT_BUSINESS = {
  name: 'Genest Jan Ramirez', email: '', phone: '', website: '', address: '',
  paypalMe: '', paypalEmail: '', bank: '', payNote: '',
  nextNumber: '000001', taxLabel: '', taxRate: '', note: 'Thank you for your business!', terms: '', feePct: '4',
  emailSubject: 'Invoice {number} from {business}',
  emailBody: 'Hi {first},\n\nHere is invoice {number} for {total}, due {due}. The PDF is attached.\n\nYou can pay online here: {paylink}\n\nThank you!\n{business}',
  updatedAt: 0,
};
const BF = Object.keys(DEFAULT_BUSINESS).filter(k => k !== 'updatedAt');
const CF = ['name', 'company', 'email', 'cc', 'address', 'currency', 'rate', 'dueDays', 'item'];

/* ------------------------------------------------------------------ small helpers */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = p => p + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 8);
const validId = v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v);
const str = (v, max) => (typeof v === 'string' ? v : v == null ? '' : String(v)).slice(0, max);
const pad = n => String(n).padStart(2, '0');
const byStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const save = () => GJCore.save();
const toast = (m, a) => GJCore.toast(m, a);

/* ------------------------------------------------------------------ money and hours */

const round2 = x => Math.sign(x) * Math.round(Number((Math.abs(x) * 100).toPrecision(12))) / 100;
// 15,50 with no dot is a decimal comma (some phone keyboards type one); 1,500 is a thousands comma
const decimalComma = t => (!t.includes('.') && /,\d{1,2}$/.test(t) ? t.replace(/,(\d{1,2})$/, '.$1') : t);
// a number typed by a person: commas, spaces and currency signs are ignored
function num(v) {
  const s = decimalComma(String(v ?? '').trim()).replace(/[^\d.]/g, '');
  if (!s || (s.match(/\./g) || []).length > 1) return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
// the same, but a leading minus (or brackets) makes it a credit
function signedNum(v) {
  const t = String(v ?? '').trim();
  const n = num(t);
  return /^\(.*\)$|^-|^−/.test(t) ? -n : n;
}
const money = x => Number(x).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sym = cur => (CUR[cur] || CUR.USD).sym;
const fmt = (x, cur) => (x < 0 ? '-' : '') + sym(cur) + money(Math.abs(x));
const peso = x => '₱' + money(x);
const plainAmt = x => (Math.round(x * 100) / 100).toFixed(2);
// hours or a quantity: 52:32 and 52h 32m are hours and minutes (52.53 hours), 52.53 is decimal
function qtyOf(raw) {
  const t = decimalComma(String(raw ?? '').trim().toLowerCase()).replace(/,/g, '');
  if (!t) return null;
  let m = t.match(/^(\d+)\s*h(?:ours?|rs?)?\s*(?:(\d+)\s*m(?:ins?|inutes?)?)?$/) || t.match(/^(\d*):(\d{1,2})$/);
  if (m) {
    const h = +(m[1] || 0), min = +(m[2] || 0);
    if (min > 59) return { error: 'Minutes go up to 59. Type it as 52:32 or 52.53' };
    return { value: round2(h + min / 60), hm: `${h}:${pad(min)}` };
  }
  m = t.match(/^(\d+)\s*m(?:ins?|inutes?)?$/);
  if (m) return { value: round2(+m[1] / 60), hm: `${Math.floor(+m[1] / 60)}:${pad(+m[1] % 60)}` };
  if (/^\d*\.?\d+$|^\d+\.$/.test(t)) return { value: Number(t) };
  return { error: 'Type hours as 52:32 or 52.53' };
}
const fmtQty = v => (Number.isInteger(v) ? String(v) : v.toFixed(2));

/* ------------------------------------------------------------------ dates */

const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseIso = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const isoOk = s => (parseIso(s) ? s : '');
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const today = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
const daysBetween = (a, b) => Math.round((b - a) / 864e5);
const shortDate = d => (d ? `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}` : '');
const longDate = d => (d ? `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` : '');
const lastDay = (y, m) => new Date(y, m + 1, 0).getDate();
// October 1 - 15, 2026 · October 16 - November 15, 2026 · December 16, 2026 - January 15, 2027
function periodText(s, e) {
  if (!s || !e) return s ? longDate(s) : '';
  if (+s === +e) return longDate(s);
  if (s.getFullYear() !== e.getFullYear()) return `${longDate(s)} - ${longDate(e)}`;
  if (s.getMonth() === e.getMonth()) return `${MONTHS[s.getMonth()]} ${s.getDate()} - ${e.getDate()}, ${e.getFullYear()}`;
  return `${MONTHS[s.getMonth()]} ${s.getDate()} - ${MONTHS[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
}
// the half month just worked: on the 15th that is the 1st to the 15th, on the last day the 16th to the end
function defaultPeriod(ref) {
  const y = ref.getFullYear(), m = ref.getMonth(), d = ref.getDate(), last = lastDay(y, m);
  if (d >= 15 && d < last) return [new Date(y, m, 1), new Date(y, m, 15)];
  if (d === last) return [new Date(y, m, 16), new Date(y, m, last)];
  const pm = new Date(y, m, 0);
  return [new Date(pm.getFullYear(), pm.getMonth(), 16), pm];
}
// the period after this one, keeping its shape (half months, whole months, or the same length)
function nextPeriod(s, e) {
  const sy = s.getFullYear(), sm = s.getMonth();
  const isEnd = d => d.getDate() === lastDay(d.getFullYear(), d.getMonth());
  if (s.getDate() === 1 && e.getDate() === 15 && e.getMonth() === sm) return [new Date(sy, sm, 16), new Date(sy, sm, lastDay(sy, sm))];
  if (s.getDate() === 16 && isEnd(e) && e.getMonth() === sm) return [new Date(sy, sm + 1, 1), new Date(sy, sm + 1, 15)];
  if (s.getDate() === 1 && isEnd(e)) {
    const months = (e.getFullYear() - sy) * 12 + e.getMonth() - sm + 1;
    const ns = new Date(sy, sm + months, 1);
    return [ns, new Date(ns.getFullYear(), ns.getMonth() + months, 0)];
  }
  // monthly from another day, e.g. the 16th to the 15th
  const d = s.getDate();
  if (d > 1 && e.getDate() === d - 1 && (e.getFullYear() - sy) * 12 + e.getMonth() - sm === 1) {
    const ns = addDays(e, 1);
    const ny = ns.getFullYear(), nm = ns.getMonth() + 1;
    return [ns, new Date(ny, nm, Math.min(d - 1, lastDay(ny, nm)))];
  }
  const len = daysBetween(s, e) + 1;
  return [addDays(e, 1), addDays(e, len)];
}

/* ------------------------------------------------------------------ data */

// Everything below is what syncs. Each client and invoice carries updatedAt, so when both devices
// changed things the newer copy of each one wins, and deletions travel as tombstones.
function cleanBusiness(x) {
  const o = x && typeof x === 'object' ? x : {};
  const b = {};
  for (const k of BF) b[k] = typeof o[k] === 'string' ? o[k].slice(0, k === 'emailBody' || k === 'terms' ? 2500 : 600) : DEFAULT_BUSINESS[k];
  b.updatedAt = +o.updatedAt || 0;
  return b;
}
const cleanParty = x => {
  const o = x && typeof x === 'object' ? x : {};
  return { name: str(o.name, 120), company: str(o.company, 160), email: str(o.email, 200), address: str(o.address, 600) };
};
function cleanClient(x) {
  if (!x || typeof x !== 'object' || !validId(x.id)) return null;
  const due = Math.round(+x.dueDays);
  return {
    id: x.id, name: str(x.name, 120), company: str(x.company, 160), email: str(x.email, 200), cc: str(x.cc, 400),
    address: str(x.address, 600), currency: CODES.includes(x.currency) ? x.currency : 'USD', rate: str(x.rate, 20),
    dueDays: due >= 0 && due <= 365 ? due : 0, item: str(x.item, 400),
    createdAt: +x.createdAt || 0, updatedAt: +x.updatedAt || 0,
  };
}
const cleanItem = (x, i) => {
  const o = x && typeof x === 'object' ? x : {};
  return { id: validId(o.id) ? o.id : 'i' + i, desc: str(o.desc, 1000), qty: str(o.qty, 20), rate: str(o.rate, 20) };
};
const cleanPayment = (x, i) => {
  const o = x && typeof x === 'object' ? x : {};
  return { id: validId(o.id) ? o.id : 'p' + i, amount: str(o.amount, 20), date: isoOk(o.date), method: str(o.method, 40), php: str(o.php, 20), note: str(o.note, 200) };
};
function cleanInvoice(x) {
  if (!x || typeof x !== 'object' || !validId(x.id)) return null;
  const items = Array.isArray(x.items) ? x.items.slice(0, 100).map(cleanItem) : [];
  return {
    id: x.id, number: str(x.number, 40), clientId: validId(x.clientId) ? x.clientId : '', billTo: cleanParty(x.billTo), cc: str(x.cc, 400),
    currency: CODES.includes(x.currency) ? x.currency : 'USD', issue: isoOk(x.issue), due: isoOk(x.due), pStart: isoOk(x.pStart), pEnd: isoOk(x.pEnd),
    items: items.length ? items : [cleanItem({}, 0)],
    discType: ['pct', 'amt'].includes(x.discType) ? x.discType : 'none', discVal: str(x.discVal, 20),
    taxLabel: str(x.taxLabel, 40), taxRate: str(x.taxRate, 10), adjLabel: str(x.adjLabel, 60), adjAmt: str(x.adjAmt, 20),
    note: str(x.note, 1000), terms: str(x.terms, 2500), ref: str(x.ref, 80), memo: str(x.memo, 300),
    payMode: ['custom', 'none'].includes(x.payMode) ? x.payMode : 'auto', payLink: str(x.payLink, 1000),
    sentAt: +x.sentAt || 0, voidAt: +x.voidAt || 0,
    payments: Array.isArray(x.payments) ? x.payments.slice(0, 60).map(cleanPayment) : [],
    createdAt: +x.createdAt || 0, updatedAt: +x.updatedAt || 0,
  };
}
// a or b, whichever is newer; the same time is settled the same way on every device
const newer = (a, b) => a.updatedAt > b.updatedAt || (a.updatedAt === b.updatedAt && JSON.stringify(a) > JSON.stringify(b));

// the fixed form that travels between devices: the same data always gives the same text
function normalize(p) {
  const o = p && typeof p === 'object' ? p : {};
  const del = {};
  for (const d of Array.isArray(o.deleted) ? o.deleted : []) {
    if (Array.isArray(d) && validId(d[0]) && +d[1] > 0) del[d[0]] = Math.max(del[d[0]] || 0, +d[1]);
  }
  const list = (arr, clean) => {
    const m = {};
    for (const x of Array.isArray(arr) ? arr : []) {
      const c = clean(x);
      if (c && !(del[c.id] >= c.updatedAt) && (!m[c.id] || newer(c, m[c.id]))) m[c.id] = c;
    }
    return Object.values(m).sort((a, b) => byStr(a.id, b.id));
  };
  return {
    v: 1,
    business: cleanBusiness(o.business),
    clients: list(o.clients, cleanClient),
    invoices: list(o.invoices, cleanInvoice),
    deleted: Object.entries(del).sort((a, b) => byStr(a[0], b[0])),
  };
}

const S = { business: cleanBusiness(null), clients: {}, invoices: {}, deleted: {} };
let UI = { tab: 'overview', filter: 'all', edId: '', clId: '', backTo: '' };
let rates = {}; // code -> { mid, date, feed, at }, kept on this device only
let draft = null; // a new invoice that hasn't been typed in yet: it is only kept once something changes

const payload = () => normalize({ business: S.business, clients: Object.values(S.clients), invoices: Object.values(S.invoices), deleted: Object.entries(S.deleted) });
function loadPayload(p) {
  const n = normalize(p);
  S.business = n.business;
  S.clients = Object.fromEntries(n.clients.map(c => [c.id, c]));
  S.invoices = Object.fromEntries(n.invoices.map(i => [i.id, i]));
  S.deleted = Object.fromEntries(n.deleted);
}
function dump() { return { v: 1, data: payload(), ui: UI, rates }; }
function load(d) {
  loadPayload(d && d.data);
  const u = d && d.ui && typeof d.ui === 'object' ? d.ui : {};
  UI = {
    tab: TABS.includes(u.tab) ? u.tab : 'overview',
    filter: ['all', 'draft', 'unpaid', 'overdue', 'paid'].includes(u.filter) ? u.filter : 'all',
    edId: validId(u.edId) ? u.edId : '', clId: validId(u.clId) ? u.clId : '', backTo: '',
  };
  rates = {};
  const r = d && d.rates && typeof d.rates === 'object' ? d.rates : {};
  for (const c of CODES) if (r[c] && +r[c].mid > 0) rates[c] = { mid: +r[c].mid, date: str(r[c].date, 10), feed: str(r[c].feed, 40), at: +r[c].at || 0 };
  draft = null;
}
function merge(p, opts) {
  const r = normalize(p);
  const restore = !!(opts && opts.restore);
  for (const [id, t] of r.deleted) S.deleted[id] = Math.max(S.deleted[id] || 0, t);
  const rb = r.business, lb = S.business;
  if (opts && opts.first && rb.updatedAt > 0 && lb.updatedAt > 0) {
    // this device's first sync with these devices: the newer copy wins, but a detail still at its
    // default there comes from the other copy (a phone with one field typed can't wipe the rest)
    const win = newer(rb, lb) ? rb : lb, lose = win === rb ? lb : rb;
    const b = { ...win };
    for (const k of BF) if (b[k] === DEFAULT_BUSINESS[k] && lose[k] !== DEFAULT_BUSINESS[k]) b[k] = lose[k];
    if (JSON.stringify(b) !== JSON.stringify(win)) b.updatedAt = Math.max(Date.now(), rb.updatedAt + 1, lb.updatedAt + 1);
    S.business = b;
  } else if (newer(rb, lb)) S.business = rb;
  for (const kind of ['clients', 'invoices']) {
    const map = S[kind];
    for (const x of r[kind]) {
      if (restore && !map[x.id] && S.deleted[x.id] >= x.updatedAt) {
        // deleted after the backup was made: restoring brings it back
        map[x.id] = { ...x, updatedAt: S.deleted[x.id] + 1 }; // newer than its deletion, not than later edits elsewhere
        continue;
      }
      if (!map[x.id] || newer(x, map[x.id])) map[x.id] = x;
    }
    for (const id of Object.keys(map)) if (S.deleted[id] >= map[id].updatedAt) delete map[id];
  }
}
// nothing in the app yet (an unlocked setup link is only accepted then)
const isEmpty = () => !Object.keys(S.clients).length && !Object.keys(S.invoices).length && !S.business.updatedAt;
// a time for an edit: now, but never older than the record's last edit (another device's clock may run ahead)
const stamp = x => Math.max(Date.now(), ((x && x.updatedAt) || 0) + 1);
// what a setup link carries: business details and clients (invoices come across with sync)
// Each part of the link keeps the time it was last edited, so an old link never replaces newer
// details or brings back a client deleted since. A first-setup link without times counts as oldest.
function applySetup(s, opts) {
  if (!s || typeof s !== 'object') return;
  const now = Date.now();
  const unlocked = !!(opts && opts.unlocked);
  const when = t => (unlocked ? 1 : Math.min(now, Math.max(1, +t || 1)));
  if (s.business && typeof s.business === 'object') {
    const given = {};
    for (const k of BF) if (typeof s.business[k] === 'string') given[k] = s.business[k];
    const b = cleanBusiness({ ...S.business, ...given, updatedAt: when(s.business.updatedAt) });
    if (newer(b, S.business)) S.business = b;
  }
  for (const x of Array.isArray(s.clients) ? s.clients : []) {
    if (!x || typeof x !== 'object' || !validId(x.id)) continue;
    const c = cleanClient({ ...x, createdAt: when(x.createdAt), updatedAt: when(x.updatedAt) });
    if (!c || S.deleted[c.id] >= c.updatedAt) continue;
    if (!S.clients[c.id] || newer(c, S.clients[c.id])) S.clients[c.id] = c;
  }
}
function describeSetup(s) {
  const n = Array.isArray(s && s.clients) ? s.clients.length : 0;
  const who = s && s.business && s.business.name ? ` for ${s.business.name}` : '';
  return `Business details${who}` + (n ? ` and ${n} client${n === 1 ? '' : 's'}` : '') + '. Anything already on this device stays unless the link has a newer copy.';
}

/* ------------------------------------------------------------------ the sums */

function lineOf(it, cur) {
  const q = qtyOf(it.qty);
  const pr = it.rate.trim() ? num(it.rate) : NaN;
  const filled = !!(it.desc.trim() || it.qty.trim() || it.rate.trim());
  let error = '';
  if (q && q.error) error = q.error;
  else if (it.rate.trim() && !(pr >= 0)) error = 'The price should be a number, like 15 or 15.50';
  // no hours or quantity yet: the line counts as nothing, and can't be sent like that
  const missing = !error && !q && filled;
  const noPrice = !error && filled && !it.rate.trim();
  const qty = q && !q.error ? q.value : 0;
  const amount = !error && pr >= 0 ? round2(qty * pr) : 0;
  return { it, q, qty, price: pr >= 0 ? pr : null, amount, error, missing, noPrice, filled, cur };
}
function calc(inv) {
  const lines = inv.items.map(it => lineOf(it, inv.currency));
  const subtotal = round2(lines.reduce((t, l) => t + l.amount, 0));
  let discount = 0;
  const dv = num(inv.discVal);
  if (inv.discType === 'pct' && dv > 0) discount = round2(subtotal * Math.min(dv, 100) / 100);
  if (inv.discType === 'amt' && dv > 0) discount = Math.min(round2(dv), subtotal);
  const taxRate = num(inv.taxRate);
  const tax = taxRate > 0 ? round2((subtotal - discount) * taxRate / 100) : 0;
  const adjN = signedNum(inv.adjAmt);
  const adj = Number.isFinite(adjN) ? round2(adjN) : 0;
  const total = round2(subtotal - discount + tax + adj);
  const pays = inv.payments.map(p => ({ ...p, n: num(p.amount) })).filter(p => p.n > 0);
  const paid = round2(pays.reduce((t, p) => t + p.n, 0));
  const balance = round2(total - paid);
  const lastPay = pays.map(p => p.date).filter(Boolean).sort().pop() || '';
  return { lines, subtotal, discount, dv, tax, taxRate, adj, total, paid, balance, lastPay, errors: lines.filter(l => l.error), missing: lines.filter(l => l.missing) };
}
function overdueDays(inv) {
  const due = parseIso(inv.due);
  if (!due) return 0;
  const grace = inv.due === inv.issue ? RECEIPT_GRACE : 0;
  const late = daysBetween(due, today());
  return late > grace ? late : 0;
}
function statusOf(inv, c = calc(inv)) {
  if (inv.voidAt) return 'void';
  if (c.balance <= 0 && (c.paid > 0 || inv.sentAt)) return 'paid';
  if (!inv.sentAt && !c.paid) return 'draft';
  if (overdueDays(inv)) return 'overdue';
  return c.paid > 0 ? 'partial' : 'sent';
}
const isOpen = st => st === 'sent' || st === 'partial' || st === 'overdue';
function party(inv) {
  const c = !inv.sentAt && !inv.payments.length && S.clients[inv.clientId];
  return c ? { name: c.name, company: c.company, email: c.email, address: c.address } : inv.billTo;
}
const who = inv => { const b = party(inv); return b.name || b.company || b.email || 'No client yet'; };
const firstName = inv => { const b = party(inv); return (b.name || b.company || 'there').trim().split(/\s+/)[0]; };
function allRows() {
  return Object.values(S.invoices).map(inv => { const c = calc(inv); return { inv, c, st: statusOf(inv, c) }; })
    .sort((a, b) => byStr(b.inv.issue, a.inv.issue) || byStr(b.inv.number, a.inv.number) || b.inv.createdAt - a.inv.createdAt);
}
// the period and {tokens} in item text
function fillText(text, inv, line) {
  const ps = parseIso(inv.pStart), pe = parseIso(inv.pEnd);
  return String(text || '').replace(/\{(client|hours|qty|period|month)\}/gi, (m, k) => {
    k = k.toLowerCase();
    if (k === 'client') { const b = party(inv); return b.name || b.company || ''; }
    if (k === 'hours' || k === 'qty') return line && line.q && !line.q.error ? fmtQty(line.q.value) : '';
    if (k === 'period') return periodText(ps, pe);
    return ps ? `${MONTHS[ps.getMonth()]} ${ps.getFullYear()}` : '';
  });
}

// invoice numbers: the next one after the highest used, never below the number in Settings
function splitNo(s) { const m = /^(.*?)(\d+)$/.exec(String(s || '').trim()); return m ? { pre: m[1], n: +m[2], w: m[2].length } : null; }
function nextNumber() {
  const floor = splitNo(S.business.nextNumber) || { pre: '', n: 1, w: 6 };
  let n = floor.n;
  for (const inv of Object.values(S.invoices)) {
    const x = splitNo(inv.number);
    if (x && x.pre === floor.pre && x.n + 1 > n) n = x.n + 1;
  }
  return floor.pre + String(n).padStart(floor.w, '0');
}

/* ------------------------------------------------------------------ peso estimates */

async function fetchMid(code) {
  for (const f of FEEDS) {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 9000);
      const r = await fetch(f.url(code), { signal: ctl.signal, cache: 'no-store' });
      clearTimeout(timer);
      if (!r.ok) continue;
      const j = await r.json();
      const mid = Number(j && j.rates && j.rates.PHP);
      if (mid > 0) return { mid, date: f.date(j), feed: f.name };
    } catch (e) { /* try the next feed */ }
  }
  return null;
}
let ratesLoading = false;
async function refreshRates() {
  if (ratesLoading) return;
  const used = new Set([...Object.values(S.invoices).map(i => i.currency), ...Object.values(S.clients).map(c => c.currency)]);
  const need = [...used].filter(c => c !== 'PHP' && !(rates[c] && Date.now() - rates[c].at < 3 * 3600 * 1000));
  if (!need.length) return;
  ratesLoading = true;
  try {
    const got = await Promise.all(need.map(fetchMid));
    need.forEach((c, i) => { if (got[i]) rates[c] = { ...got[i], at: Date.now() }; });
    if (got.some(Boolean) && GJCore.unlocked()) { save(); renderOverview(); if (cur()) renderSummary(); }
  } finally { ratesLoading = false; }
}
// what Jan would get in pesos through PayPal: mid-market less the PayPal cut, like the Payroll app
function payRate(code) {
  if (code === 'PHP') return 1;
  const r = rates[code];
  if (!r) return null;
  const pct = num(S.business.feePct);
  const cut = pct >= 0 && pct < 50 ? pct : 4;
  return round2(r.mid - round2(r.mid * cut / 100));
}
const toPeso = (amount, code) => { const r = payRate(code); return r == null ? null : round2(amount * r); };

/* ------------------------------------------------------------------ links and messages */

const httpUrl = u => { try { const x = new URL(String(u).trim()); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch (e) { return ''; } };
function payUrl(inv, c = calc(inv)) {
  if (inv.voidAt || inv.payMode === 'none') return '';
  if (inv.payMode === 'custom') return httpUrl(inv.payLink);
  const me = S.business.paypalMe.trim().replace(/^.*paypal\.me\//i, '').replace(/[^A-Za-z0-9_-]/g, '');
  if (!me) return '';
  const due = c.balance > 0 ? c.balance : c.total;
  return `https://paypal.me/${me}` + (due > 0 && inv.currency ? `/${plainAmt(due)}${inv.currency}` : '');
}
function dueText(inv) {
  if (!inv.due) return '';
  return inv.due === inv.issue ? 'on receipt' : longDate(parseIso(inv.due));
}
function fillMail(tpl, inv, c) {
  const link = payUrl(inv, c);
  const lines = String(tpl || '').split('\n').filter(l => link || !/\{paylink\}/i.test(l));
  return lines.join('\n').replace(/\{(first|number|total|balance|due|paylink|business|client|period)\}/gi, (m, k) => ({
    first: firstName(inv), number: inv.number, total: fmt(c.total, inv.currency) + ' ' + inv.currency,
    balance: fmt(c.balance, inv.currency), due: dueText(inv), paylink: link, business: S.business.name,
    client: who(inv), period: periodText(parseIso(inv.pStart), parseIso(inv.pEnd)),
  }[k.toLowerCase()] ?? m)).replace(/\n{3,}/g, '\n\n').trim();
}

/* ------------------------------------------------------------------ what the invoice shows (shared by the preview and the PDF) */

function view(inv) {
  const c = calc(inv);
  const st = statusOf(inv, c);
  const B = S.business;
  const f = x => fmt(x, inv.currency);
  const rows = [['Subtotal', f(c.subtotal)]];
  if (c.discount) rows.push([inv.discType === 'pct' ? `Discount (${c.dv}%)` : 'Discount', '-' + f(c.discount)]);
  if (c.tax) rows.push([`${inv.taxLabel.trim() || 'Tax'} (${c.taxRate}%)`, f(c.tax)]);
  if (c.adj) rows.push([inv.adjLabel.trim() || (c.adj < 0 ? 'Credit' : 'Other charge'), f(c.adj)]);
  const lines = c.lines.filter(l => l.filled).map((l, i) => ({
    n: i + 1, desc: fillText(l.it.desc, inv, l) || 'Item', qty: fmtQty(l.qty), price: l.price == null ? '' : f(l.price), amount: f(l.amount),
  }));
  const url = st === 'paid' ? '' : payUrl(inv, c);
  return {
    st, c,
    business: { name: B.name.trim() || 'Genest Jan Ramirez', tagline: 'Connect, Engage, Succeed', address: B.address.trim(), phone: B.phone.trim(), email: B.email.trim(), website: B.website.trim() },
    number: inv.number || 'Draft', issued: shortDate(parseIso(inv.issue)), due: inv.due && inv.due === inv.issue ? 'On receipt' : shortDate(parseIso(inv.due)),
    dueLong: inv.due ? (inv.due === inv.issue ? 'Due on receipt' : 'Due ' + longDate(parseIso(inv.due))) : '',
    period: periodText(parseIso(inv.pStart), parseIso(inv.pEnd)), ref: inv.ref.trim(),
    billTo: { ...party(inv) },
    cur: inv.currency, curName: (CUR[inv.currency] || CUR.USD).name, symbol: sym(inv.currency),
    lines, rows, total: f(c.total), paid: c.paid ? f(c.paid) : '', balance: f(Math.max(c.balance, 0)),
    amountDue: st === 'paid' ? f(c.total) : st === 'void' ? f(c.total) : f(Math.max(c.balance, 0)),
    paidOn: c.lastPay ? longDate(parseIso(c.lastPay)) : '',
    pay: { url, label: url ? `Pay ${f(c.balance > 0 ? c.balance : c.total)} now` : '', paypalEmail: B.paypalEmail.trim(), bank: B.bank.trim(), note: B.payNote.trim() },
    note: inv.note.trim(), terms: inv.terms.trim(),
  };
}

/* ------------------------------------------------------------------ screens */

function setTab(name, opts = {}) {
  if (!TABS.includes(name)) name = 'overview';
  if (!opts.detour && UI.backTo) { // left the client detour another way: it ends here
    UI.backTo = '';
    if ($('#panel-editor').hidden) draft = null;
    layerDone('detour');
  }
  if ($('#panel-editor').hidden === false) {
    if (opts.detour) { UI.edId = ''; pushLayer('detour'); } // the invoice (even an unsaved one) waits; Back returns to it
    else leaveEditor();
  }
  UI.tab = name;
  for (const t of TABS) {
    const on = t === name;
    const b = $('#tab-' + t);
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
    $('#panel-' + t).hidden = !on;
  }
  $('#panel-editor').hidden = true;
  document.body.classList.remove('editing');
  if (name === 'overview') renderOverview();
  if (name === 'invoices') renderList();
  if (name === 'clients') renderClients();
  if (name === 'settings') renderSettings();
  if (opts.focus) $('#tab-' + name).focus();
  if (!opts.keepScroll) window.scrollTo(0, 0);
  save();
}
function leaveEditor() {
  draft = null;
  UI.edId = '';
  layerDone('editor');
}

// Android's back button closes the open sheet or the editor instead of leaving the app
let skipPop = false;
function pushLayer(kind) { try { if (!(history.state && history.state.gjLayer === kind)) history.pushState({ gjLayer: kind }, ''); } catch (e) { /* ignore */ } }
function layerDone(kind) {
  if (history.state && history.state.gjLayer === kind) { skipPop = true; try { history.back(); } catch (e) { skipPop = false; } }
}
window.addEventListener('popstate', () => {
  if (skipPop) { skipPop = false; return; }
  const open = $$('.sheet').find(s => !s.hidden);
  if (open) { closeSheet(open, true); return; }
  if ($('#panel-editor').hidden && backInvoice()) { returnToInvoice(); return; }
  if (!$('#panel-editor').hidden) { draft = null; UI.edId = ''; setTab('invoices'); return; }
  // an entry left from before a reload has nothing to close: step past it (and past the next, if stale too)
  if (history.state && history.state.gjLayer) { try { history.back(); } catch (e) { /* ignore */ } }
});
const backInvoice = () => (UI.backTo && (S.invoices[UI.backTo] || (draft && draft.id === UI.backTo ? draft : null))) || null;
// back from a client to the invoice it was opened from; pick = a client to put on the invoice
function returnToInvoice(pick) {
  const inv = backInvoice();
  UI.backTo = '';
  if (!inv) return false;
  if (!S.invoices[inv.id]) draft = inv;
  // the detour's history entry becomes the invoice's, so Back from the invoice still leaves it in one press
  try { if (history.state && history.state.gjLayer === 'detour') history.replaceState({ gjLayer: 'editor' }, ''); } catch (e) { /* ignore */ }
  if (pick && pick !== inv.clientId) { pickClient(inv, pick); touch(inv); }
  openEditor(inv.id);
  return true;
}

function renderAll() {
  $('#mastDate').textContent = today().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  renderOverview();
  renderList();
  renderClients();
  renderSettings();
  if (!$('#panel-editor').hidden) {
    if (cur()) renderEditor(); else { UI.edId = ''; setTab('invoices'); }
  }
  refreshRates(); // a new client or invoice may use another currency
}

/* ---------- overview ---------- */

function sumBy(rows, pick) {
  const m = {};
  for (const r of rows) { const v = pick(r); if (v) m[r.inv.currency] = round2((m[r.inv.currency] || 0) + v); }
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}
function amountsHtml(pairs, none) {
  if (!pairs.length) return esc(none);
  const [first, ...rest] = pairs;
  return esc(fmt(first[1], first[0])) + rest.map(([c, v]) => `<span class="more">+ ${esc(fmt(v, c))}</span>`).join('');
}
function pesoOf(pairs) {
  let t = 0;
  for (const [c, v] of pairs) { const p = toPeso(v, c); if (p == null) return null; t += p; }
  return round2(t);
}
function renderOverview() {
  const rows = allRows();
  const open = rows.filter(r => isOpen(r.st));
  const overdue = rows.filter(r => r.st === 'overdue');
  const drafts = rows.filter(r => r.st === 'draft');
  const now = today();
  const monthKey = iso(now).slice(0, 7);
  // paid this month: payments dated this month; pesos as received when typed in, else estimated
  const paidRows = [];
  let phpGot = 0, phpAll = true;
  for (const r of rows) {
    if (r.st === 'void') continue;
    for (const p of r.inv.payments) {
      const n = num(p.amount);
      if (!(n > 0) || !p.date.startsWith(monthKey)) continue;
      paidRows.push({ inv: r.inv, n });
      const php = num(p.php);
      if (php > 0) phpGot += php;
      else { const e = toPeso(n, r.inv.currency); if (e == null) phpAll = false; else phpGot += e; }
    }
  }
  const owed = sumBy(open, r => r.c.balance);
  const late = sumBy(overdue, r => r.c.balance);
  const paid = sumBy(paidRows, r => r.n);
  const owedPhp = pesoOf(owed);
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  $('#welcome').hidden = !(Object.keys(S.clients).length === 0 && !S.business.email.trim());
  $('#kpis').innerHTML = `
    <button class="kpi lead" type="button" data-kfilter="unpaid">
      <span class="eyebrow">Waiting to be paid</span>
      <span class="kpi-val">${amountsHtml(owed, 'All paid up')}</span>
      <span class="kpi-sub">${open.length ? plural(open.length, 'invoice') + (owedPhp != null && owed.length ? ` · about ${esc(peso(owedPhp))}` : '') : 'Nothing waiting'}</span>
    </button>
    <button class="kpi bad${overdue.length ? '' : ' none'}" type="button" data-kfilter="overdue">
      <span class="eyebrow">Overdue</span>
      <span class="kpi-val">${amountsHtml(late, 'None')}</span>
      <span class="kpi-sub">${overdue.length ? plural(overdue.length, 'invoice') + ' past due' : 'Every client is on time'}</span>
    </button>
    <button class="kpi" type="button" data-kfilter="paid">
      <span class="eyebrow">Paid in ${MONTHS[now.getMonth()]}</span>
      <span class="kpi-val">${amountsHtml(paid, 'Nothing yet')}</span>
      <span class="kpi-sub">${paidRows.length ? (phpAll ? `About ${esc(peso(round2(phpGot)))} in pesos` : plural(paidRows.length, 'payment')) : 'No payments this month'}</span>
    </button>
    <button class="kpi" type="button" data-kfilter="draft">
      <span class="eyebrow">Drafts</span>
      <span class="kpi-val">${drafts.length}</span>
      <span class="kpi-sub">${drafts.length ? 'Not sent yet' : 'Nothing waiting to send'}</span>
    </button>`;

  const soon = rows.filter(r => r.st === 'sent' || r.st === 'partial').filter(r => { const d = parseIso(r.inv.due); return d && daysBetween(now, d) <= 3; });
  const attn = [...overdue.sort((a, b) => overdueDays(b.inv) - overdueDays(a.inv)), ...soon, ...drafts].slice(0, 6);
  $('#attnCount').textContent = attn.length ? plural(attn.length, 'invoice') : '';
  $('#attnList').innerHTML = attn.length ? attn.map(rowHtml).join('')
    : `<div class="inv-empty">Nothing needs you right now.</div>`;
  const recent = rows.slice().sort((a, b) => Math.max(b.inv.updatedAt, b.inv.createdAt) - Math.max(a.inv.updatedAt, a.inv.createdAt)).slice(0, 6);
  $('#recentList').innerHTML = recent.length ? recent.map(rowHtml).join('')
    : `<div class="inv-empty"><span>No invoices yet.</span><button class="btn gold btn-sm" type="button" data-new>Create your first invoice</button></div>`;

  const used = [...new Set(rows.map(r => r.inv.currency))].filter(c => c !== 'PHP');
  const known = used.filter(c => rates[c]);
  const pct = num(S.business.feePct) >= 0 ? num(S.business.feePct) : 4;
  $('#fxNote').textContent = known.length
    ? `Peso amounts are estimates at today's PayPal rate (the mid-market rate less ${pct}%): ${known.map(c => `${sym(c)}1 = ₱${money(payRate(c))}`).join(', ')}.`
    : used.length ? "Peso estimates show once today's exchange rates load." : '';
}

function whenText(r) {
  const { inv, c, st } = r;
  if (st === 'draft') return ['Not sent', ''];
  if (st === 'void') return ['Void', ''];
  if (st === 'paid') return [c.lastPay ? 'Paid ' + shortDate(parseIso(c.lastPay)) : 'Paid', ''];
  if (st === 'overdue') { const d = overdueDays(inv); return [`${d} day${d === 1 ? '' : 's'} overdue`, 'bad']; }
  if (st === 'partial') return [`${fmt(c.balance, inv.currency)} left`, ''];
  if (!inv.due) return ['Sent', ''];
  const d = daysBetween(today(), parseIso(inv.due));
  if (inv.due === inv.issue) return ['Due on receipt', ''];
  return [d === 0 ? 'Due today' : d === 1 ? 'Due tomorrow' : d < 0 ? 'Due ' + shortDate(parseIso(inv.due)) : `Due in ${d} days`, ''];
}
function rowHtml(r) {
  const { inv, c, st } = r;
  const [when, tone] = whenText(r);
  const issued = parseIso(inv.issue);
  const bt = party(inv);
  const sub = [`No. ${inv.number || '–'}`, issued ? shortDate(issued) : '', bt.company && bt.name ? bt.company : ''].filter(Boolean).join(' · ');
  return `<button class="inv-row" type="button" data-open="${esc(inv.id)}">
    <span class="inv-who"><span class="pill ${st}">${STATUS[st]}</span><span class="inv-name">${esc(who(inv))}</span></span>
    <span class="inv-amt">${esc(fmt(c.total, inv.currency))}</span>
    <span class="inv-sub">${esc(sub)}</span>
    <span class="inv-when ${tone}">${esc(when)}</span>
  </button>`;
}

/* ---------- invoice list ---------- */

function renderList() {
  const rows = allRows();
  const counts = { all: rows.length, draft: 0, unpaid: 0, overdue: 0, paid: 0 };
  for (const r of rows) {
    if (r.st === 'draft') counts.draft++;
    if (isOpen(r.st)) counts.unpaid++;
    if (r.st === 'overdue') counts.overdue++;
    if (r.st === 'paid') counts.paid++;
  }
  for (const b of $$('[data-filter]')) {
    const f = b.dataset.filter;
    b.setAttribute('aria-pressed', String(f === UI.filter));
    const label = { all: 'All', draft: 'Drafts', unpaid: 'Unpaid', overdue: 'Overdue', paid: 'Paid' }[f];
    b.innerHTML = `${label}<span class="n">${counts[f]}</span>`;
  }
  const q = $('#invSearch').value.trim().toLowerCase();
  const show = rows.filter(r => {
    const f = UI.filter;
    if (f === 'draft' && r.st !== 'draft') return false;
    if (f === 'unpaid' && !isOpen(r.st)) return false;
    if (f === 'overdue' && r.st !== 'overdue') return false;
    if (f === 'paid' && r.st !== 'paid') return false;
    if (!q) return true;
    const bt = party(r.inv);
    const hay = [r.inv.number, bt.name, bt.company, bt.email, r.inv.ref, r.inv.memo, ...r.inv.items.map(i => fillText(i.desc, r.inv))].join(' ').toLowerCase();
    return hay.includes(q);
  });
  $('#invList').innerHTML = show.length ? show.map(rowHtml).join('')
    : rows.length ? `<div class="inv-empty">No invoices match.</div>`
      : `<div class="inv-empty"><span>No invoices yet.</span><button class="btn gold btn-sm" type="button" data-new>Create your first invoice</button></div>`;
}

/* ---------- the editor ---------- */

const cur = () => (UI.edId && S.invoices[UI.edId]) || (draft && draft.id === UI.edId ? draft : null);
let savedAt = 0;
// something changed: a new invoice is kept from now on, and the change syncs
let autoNo = ''; // the draft whose number was picked by the app, not typed
function touch(inv) {
  if (!S.invoices[inv.id]) {
    // the number picked when the draft opened may have been used since (on the other device, say)
    if (autoNo === inv.id && Object.values(S.invoices).some(x => x.number.trim() === inv.number.trim())) { inv.number = nextNumber(); setVal('edNumber', inv.number); }
    S.invoices[inv.id] = inv;
    if (draft === inv) draft = null;
  }
  inv.updatedAt = stamp(inv);
  savedAt = Date.now();
  save();
}
function snapClient(c) { return c ? { name: c.name, company: c.company, email: c.email, address: c.address } : cleanParty(null); }

function newInvoice(clientId) {
  const list = Object.values(S.clients).filter(x => x.name.trim() || x.company.trim());
  const c = (clientId && S.clients[clientId]) || (list.length === 1 ? list[0] : null);
  const issue = today();
  const [ps, pe] = defaultPeriod(issue);
  const B = S.business;
  draft = cleanInvoice({
    id: uid('v'), number: nextNumber(), clientId: c ? c.id : '', billTo: snapClient(c), cc: '',
    currency: c ? c.currency : (allRows()[0] ? allRows()[0].inv.currency : 'USD'),
    issue: iso(issue), due: iso(addDays(issue, c ? c.dueDays : 0)), pStart: iso(ps), pEnd: iso(pe),
    items: [{ id: uid('i'), desc: c ? c.item : '', qty: '', rate: c ? c.rate : '' }],
    taxLabel: B.taxLabel, taxRate: B.taxRate, note: B.note, terms: B.terms, payMode: 'auto',
    createdAt: Date.now(), updatedAt: 0,
  });
  autoNo = draft.id;
  openEditor(draft.id);
}
function openEditor(id) {
  if (!(S.invoices[id] || (draft && draft.id === id))) return;
  if (UI.backTo && UI.backTo !== id) { // another invoice opened during a client detour: the detour ends
    UI.backTo = '';
    try { if (history.state && history.state.gjLayer === 'detour') history.replaceState({ gjLayer: 'editor' }, ''); } catch (e) { /* ignore */ }
  }
  if (UI.edId && UI.edId !== id && draft && draft.id === UI.edId) draft = null;
  UI.edId = id;
  for (const t of TABS) { const b = $('#tab-' + t); b.setAttribute('aria-selected', String(t === 'invoices')); b.tabIndex = t === 'invoices' ? 0 : -1; $('#panel-' + t).hidden = true; }
  $('#panel-editor').hidden = false;
  document.body.classList.add('editing');
  $('#edDelConfirm').hidden = true;
  savedAt = 0;
  renderEditor();
  window.scrollTo(0, 0);
  pushLayer('editor');
  save();
}

function fillSelect(sel, options, value) {
  const html = options.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('');
  if (sel.dataset.html !== html) { sel.innerHTML = html; sel.dataset.html = html; }
  sel.value = value;
}
const currencyOptions = () => CODES.map(c => [c, `${c} · ${CUR[c].name}`]);
function setVal(id, v) { const el = document.getElementById(id); if (el && document.activeElement !== el && el.value !== v) el.value = v; }

function renderEditor() {
  const inv = cur();
  if (!inv) return;
  const clients = Object.values(S.clients).sort((a, b) => byStr((a.name || a.company).toLowerCase(), (b.name || b.company).toLowerCase()));
  const opts = [['', 'Choose a client'], ...clients.map(c => [c.id, c.name + (c.company ? ` · ${c.company}` : '')])];
  if (inv.clientId && !S.clients[inv.clientId]) opts.push([inv.clientId, (who(inv)) + ' (removed)']);
  opts.push(['__new', '+ Add a new client']);
  fillSelect($('#edClient'), opts, inv.clientId);
  $('#edEditClient').hidden = !S.clients[inv.clientId];
  const cl = S.clients[inv.clientId];
  $('#edCc').placeholder = cl && cl.cc.trim() ? `${cl.cc} (from the client)` : 'name@company.com, other@company.com';
  const b = party(inv);
  $('#edBillTo').innerHTML = b.name || b.company || b.email || b.address
    ? `<b>${esc(b.name || b.company)}</b>${b.name && b.company ? `<span>${esc(b.company)}</span>` : ''}${b.email ? `<span>${esc(b.email)}</span>` : '<span class="warn-text">No email address yet</span>'}${b.address ? `<span class="muted">${esc(b.address)}</span>` : ''}`
    : '';
  fillSelect($('#edCurrency'), currencyOptions(), inv.currency);
  fillSelect($('#edDiscType'), [['none', 'None'], ['pct', 'Percent'], ['amt', 'Amount']], inv.discType);
  fillSelect($('#edPayMode'), [['auto', 'PayPal.me, with the amount filled in'], ['custom', 'A link I paste (PayPal invoice, Wise...)'], ['none', 'No button']], inv.payMode);
  const map = { edCc: 'cc', edNumber: 'number', edIssue: 'issue', edDue: 'due', edPStart: 'pStart', edPEnd: 'pEnd', edDiscVal: 'discVal', edTaxLabel: 'taxLabel', edTaxRate: 'taxRate', edAdjLabel: 'adjLabel', edAdjAmt: 'adjAmt', edNote: 'note', edTerms: 'terms', edRef: 'ref', edMemo: 'memo', edPayLink: 'payLink' };
  for (const [id, k] of Object.entries(map)) setVal(id, inv[k]);
  $('#edDiscVal').disabled = inv.discType === 'none';
  $('#edPayLinkWrap').hidden = inv.payMode !== 'custom';
  renderItems();
  renderSummary();
}
function itemHtml(it, i, inv) {
  const id = esc(it.id);
  return `<div class="item" data-row="${id}">
    <span class="item-n">${i + 1}</span>
    <div class="fld f-desc"><label class="mlabel" for="it-${id}-desc">Item ${i + 1}</label><textarea id="it-${id}-desc" class="in" data-item="${id}" data-f="desc" rows="1" placeholder="What you did, e.g. VA work for {client} - {hours} hours for {period}">${esc(it.desc)}</textarea></div>
    <div class="fld f-qty"><label class="mlabel" for="it-${id}-qty">Hours or qty</label><input id="it-${id}-qty" class="in mono qty" data-item="${id}" data-f="qty" value="${esc(it.qty)}" placeholder="0:00" autocomplete="off"></div>
    <div class="fld f-price"><label class="mlabel" for="it-${id}-rate">Price (${esc(sym(inv.currency))})</label><input id="it-${id}-rate" class="in mono price" data-item="${id}" data-f="rate" value="${esc(it.rate)}" inputmode="decimal" placeholder="0.00" autocomplete="off"></div>
    <span class="item-amt" data-amt></span>
    <button class="icon-btn item-x" type="button" data-del-item="${id}" aria-label="Remove item ${i + 1}" title="Remove">×</button>
    <div class="item-echo" data-echo></div>
  </div>`;
}
function renderItems() {
  const inv = cur();
  const box = $('#edItems');
  const keyNow = inv.id + '|' + inv.currency + '|' + inv.items.map(i => i.id).join(',');
  if (box.dataset.key !== keyNow || !box.querySelector('.item')) {
    box.innerHTML = `<div class="item-labels" aria-hidden="true"><span></span><span>Item</span><span>Hours/Qty</span><span>Price</span><span>Amount</span><span></span></div>` +
      inv.items.map((it, i) => itemHtml(it, i, inv)).join('');
    box.dataset.key = keyNow;
  } else {
    for (const it of inv.items) for (const f of ['desc', 'qty', 'rate']) setVal(`it-${it.id}-${f}`, it[f]);
  }
  requestAnimationFrame(() => $$('#edItems textarea').forEach(grow));
}
const grow = t => { t.style.height = 'auto'; t.style.height = Math.max(40, t.scrollHeight + 2) + 'px'; };

function renderSummary() {
  const inv = cur();
  if (!inv) return;
  const c = calc(inv);
  const st = statusOf(inv, c);
  const f = x => fmt(x, inv.currency);
  // the items' amounts and notes
  c.lines.forEach(l => {
    const row = $(`#edItems [data-row="${CSS.escape(l.it.id)}"]`);
    if (!row) return;
    row.querySelector('[data-amt]').textContent = l.filled && !l.error ? f(l.amount) : '';
    const echo = row.querySelector('[data-echo]');
    const bits = [];
    if (l.error) bits.push(l.error);
    else if (l.missing) bits.push('Type the hours or quantity');
    if (!l.error && l.noPrice) bits.push('Type the price');
    else if (l.q && l.q.hm) bits.push(`${l.q.hm} = ${fmtQty(l.q.value)} hours`);
    if (!l.error && /\{[a-z]+\}/i.test(l.it.desc)) bits.push('Shows as: ' + fillText(l.it.desc, inv, l));
    echo.textContent = bits.join(' · ');
    echo.classList.toggle('bad', !!l.error);
    row.querySelector('.qty').classList.toggle('bad', !!(l.q && l.q.error));
  });
  const rows = [['Subtotal', f(c.subtotal)]];
  if (c.discount) rows.push([inv.discType === 'pct' ? `Discount (${c.dv}%)` : 'Discount', '-' + f(c.discount)]);
  if (c.tax) rows.push([`${inv.taxLabel.trim() || 'Tax'} (${c.taxRate}%)`, f(c.tax)]);
  if (c.adj) rows.push([inv.adjLabel.trim() || (c.adj < 0 ? 'Credit' : 'Other charge'), f(c.adj)]);
  $('#edSummary').innerHTML = rows.map(([a, v]) => `<dt>${esc(a)}</dt><dd>${esc(v)}</dd>`).join('') +
    `<dt class="tot">Total ${esc(inv.currency)}</dt><dd class="tot">${esc(f(c.total))}</dd>` +
    (c.paid ? `<dt>Paid</dt><dd>-${esc(f(c.paid))}</dd><dt class="bal">Balance due</dt><dd class="bal">${esc(f(c.balance))}</dd>` : '');
  const php = toPeso(c.paid && c.balance > 0 ? c.balance : c.total, inv.currency);
  $('#edPhp').textContent = inv.currency === 'PHP' || !c.total ? '' : php == null ? '' : `About ${peso(php)} after PayPal's cut, at today's rate.`;
  $('#mobTotal').textContent = f(c.paid && c.balance > 0 ? c.balance : c.total);

  $('#edTitle').textContent = (S.invoices[inv.id] ? 'Invoice ' : 'New invoice ') + (inv.number || '');
  const pill = $('#edStatus');
  pill.className = 'pill ' + st;
  pill.textContent = STATUS[st];
  $('#edSaved').textContent = !S.invoices[inv.id] ? 'Not saved until you type something' : savedAt ? 'Saved' : '';

  const dup = Object.values(S.invoices).find(x => x.id !== inv.id && x.number.trim() && x.number.trim() === inv.number.trim());
  const warn = $('#edNumberWarn');
  warn.hidden = !dup && !!inv.number.trim();
  warn.textContent = !inv.number.trim() ? 'Give this invoice a number.' : dup ? `Number ${dup.number} is already used for ${who(dup)} (${shortDate(parseIso(dup.issue))}).` : '';
  for (const b of $$('[data-due]')) {
    const issue = parseIso(inv.issue), due = parseIso(inv.due);
    b.setAttribute('aria-pressed', String(!!(issue && due && daysBetween(issue, due) === +b.dataset.due)));
  }

  const url = payUrl(inv, c);
  $('#edPayInfo').innerHTML = inv.payMode === 'none' ? 'The invoice shows your PayPal email and bank details only.'
    : inv.payMode === 'custom' ? (url ? `Button goes to ${esc(url.length > 60 ? url.slice(0, 57) + '...' : url)}` : 'Paste the link from PayPal, Wise or your bank.')
      : url ? `Button opens <a class="link" href="${esc(url)}" target="_blank" rel="noopener">${esc(url.replace(/^https:\/\//, ''))}</a>, with the amount and currency filled in.`
        : 'Add your PayPal.me name in <button class="link" type="button" data-goto="settings">Settings</button> to show a Pay now button.';

  // actions that depend on the state
  $('#edSend').textContent = inv.sentAt ? 'Send again' : 'Send';
  $('#edPaid').hidden = st === 'void' || st === 'paid';
  $('#edVoid').textContent = inv.voidAt ? 'Restore' : 'Void';
  $('#edVoid').hidden = !S.invoices[inv.id];
  $('#edDel').hidden = !S.invoices[inv.id];
  $('#edDup').hidden = !S.invoices[inv.id];
  $('#edNext').hidden = !S.invoices[inv.id] || !(inv.pStart && inv.pEnd);
  renderActivity(inv, c);
}
function renderActivity(inv, c) {
  const ev = [];
  if (inv.createdAt) ev.push([inv.createdAt, 'Created ' + shortDate(new Date(inv.createdAt))]);
  if (inv.sentAt) ev.push([inv.sentAt, 'Sent ' + shortDate(new Date(inv.sentAt))]);
  if (inv.voidAt) ev.push([inv.voidAt, 'Voided ' + shortDate(new Date(inv.voidAt))]);
  const pays = inv.payments.map(p => {
    const n = num(p.amount);
    const php = num(p.php);
    const d = parseIso(p.date);
    return `<div class="pay-row"><span>${esc([d ? shortDate(d) : '', p.method, php > 0 ? `you got ${peso(php)}` : '', p.note].filter(Boolean).join(' · '))}</span><b>${esc(n > 0 ? fmt(n, inv.currency) : p.amount)}</b><button class="icon-btn" type="button" data-del-pay="${esc(p.id)}" aria-label="Remove this payment" title="Remove">×</button></div>`;
  }).join('');
  $('#edPayments').innerHTML = (ev.length ? `<ul class="timeline">${ev.sort((a, b) => a[0] - b[0]).map(e => `<li>${esc(e[1])}</li>`).join('')}</ul>` : '') + pays;
}

function pickClient(inv, id) {
  const c = S.clients[id];
  const prev = S.clients[inv.clientId];
  // items still exactly as the previous client's usual item (nothing typed yet) follow the new client
  const asPrev = !!prev && inv.items.length === 1 && !inv.items[0].qty.trim() && inv.items[0].desc === prev.item && inv.items[0].rate === prev.rate;
  inv.clientId = c ? c.id : '';
  inv.billTo = snapClient(c);
  if (!c) return;
  inv.cc = ''; // empty: the client's own copy-to list is used
  inv.currency = c.currency;
  const issue = parseIso(inv.issue) || today();
  inv.due = iso(addDays(issue, c.dueDays));
  const used = inv.items.filter(i => i.desc.trim() || i.qty.trim() || i.rate.trim());
  if (!used.length || asPrev) inv.items = [{ id: inv.items[0] ? inv.items[0].id : uid('i'), desc: c.item, qty: '', rate: c.rate }];
}

function editorInput(e) {
  const inv = cur();
  const t = e.target;
  if (!inv || !t.id) return;
  const map = { edCc: 'cc', edNumber: 'number', edDiscVal: 'discVal', edTaxLabel: 'taxLabel', edTaxRate: 'taxRate', edAdjLabel: 'adjLabel', edAdjAmt: 'adjAmt', edNote: 'note', edTerms: 'terms', edRef: 'ref', edMemo: 'memo', edPayLink: 'payLink', edPStart: 'pStart', edPEnd: 'pEnd' };
  if (t.id === 'edNumber') autoNo = '';
  if (t.dataset.item) {
    const it = inv.items.find(i => i.id === t.dataset.item);
    if (!it) return;
    it[t.dataset.f] = t.value;
    if (t.tagName === 'TEXTAREA') grow(t);
  } else if (t.id === 'edIssue' || t.id === 'edDue') {
    if (!parseIso(t.value)) return; // half typed
    if (t.id === 'edIssue') {
      // the due date keeps its distance from the issue date
      const oldI = parseIso(inv.issue), oldD = parseIso(inv.due), nI = parseIso(t.value);
      inv.issue = isoOk(t.value);
      if (oldI && oldD && nI) { inv.due = iso(addDays(nI, Math.max(0, daysBetween(oldI, oldD)))); setVal('edDue', inv.due); }
    } else inv.due = isoOk(t.value);
  } else if (map[t.id]) {
    inv[map[t.id]] = (t.type === 'date' ? isoOk(t.value) : t.value);
  } else if (t.id === 'edCurrency') {
    inv.currency = CODES.includes(t.value) ? t.value : inv.currency;
    $('#edItems').dataset.key = '';
    renderItems();
    setTimeout(refreshRates, 0);
  } else if (t.id === 'edDiscType') {
    inv.discType = t.value;
    $('#edDiscVal').disabled = t.value === 'none';
    if (t.value !== 'none') $('#edDiscVal').focus();
  } else if (t.id === 'edPayMode') {
    inv.payMode = t.value;
    $('#edPayLinkWrap').hidden = t.value !== 'custom';
    if (t.value === 'custom') $('#edPayLink').focus();
  } else if (t.id === 'edClient') {
    if (t.value === '__new') { t.value = inv.clientId; addClient(inv.id); return; }
    pickClient(inv, t.value);
    touch(inv);
    renderEditor();
    return;
  } else return;
  touch(inv);
  renderSummary();
}

function addItem() {
  const inv = cur();
  if (!inv) return;
  const last = inv.items[inv.items.length - 1];
  const c = S.clients[inv.clientId];
  const it = { id: uid('i'), desc: '', qty: '', rate: last && last.rate ? last.rate : c ? c.rate : '' };
  inv.items.push(it);
  touch(inv);
  renderItems();
  renderSummary();
  setTimeout(() => { const el = document.getElementById(`it-${it.id}-desc`); if (el) el.focus(); }, 20);
}
function removeItem(id) {
  const inv = cur();
  if (!inv) return;
  const i = inv.items.findIndex(x => x.id === id);
  if (i < 0) return;
  const [gone] = inv.items.splice(i, 1);
  if (!inv.items.length) inv.items.push({ id: uid('i'), desc: '', qty: '', rate: '' });
  touch(inv);
  renderItems();
  renderSummary();
  if (gone.desc.trim() || gone.qty.trim()) {
    toast('Item removed.', { label: 'Undo', run: () => {
      const x = S.invoices[inv.id] || (cur() && cur().id === inv.id ? cur() : null);
      if (!x) return;
      x.items.splice(Math.min(i, x.items.length), 0, gone);
      x.items = x.items.filter(y => y.desc || y.qty || y.rate || y === gone);
      touch(x);
      if (cur() === x) { renderItems(); renderSummary(); }
      renderAfterChange();
    } });
  }
}

function duplicate(next) {
  const src = cur();
  if (!src) return;
  const issue = today();
  let ps = parseIso(src.pStart), pe = parseIso(src.pEnd);
  let issueD = issue;
  if (next && ps && pe) {
    [ps, pe] = nextPeriod(ps, pe);
    if (pe > issue) issueD = pe; // the invoice for a period goes out when the period ends
  }
  const c = S.clients[src.clientId];
  const gap = Math.max(0, daysBetween(parseIso(src.issue) || issue, parseIso(src.due) || issue));
  const copy = cleanInvoice({
    ...JSON.parse(JSON.stringify(src)),
    id: uid('v'), number: nextNumber(), billTo: c ? snapClient(c) : src.billTo,
    issue: iso(issueD), due: iso(addDays(issueD, c ? c.dueDays : gap)),
    pStart: ps ? iso(ps) : '', pEnd: pe ? iso(pe) : '',
    items: src.items.map(it => ({ ...it, id: uid('i'), qty: next ? '' : it.qty })),
    sentAt: 0, voidAt: 0, payments: [], memo: '', createdAt: Date.now(), updatedAt: 0,
  });
  draft = copy;
  autoNo = copy.id;
  UI.edId = '';
  openEditor(copy.id);
  touch(copy);
  renderSummary();
  toast(next ? `Invoice ${copy.number} for ${periodText(ps, pe)} is ready. Type the hours.` : `Copied as invoice ${copy.number}.`);
  if (next) setTimeout(() => { const el = $('#edItems .qty'); if (el) el.focus(); }, 60);
}

function markSent(inv) {
  if (!inv.sentAt) { inv.billTo = party(inv); inv.sentAt = Date.now(); touch(inv); }
  renderAfterChange();
}
function renderAfterChange() {
  if (cur()) renderSummary();
  renderOverview();
  renderList();
}

/* ---------- payments ---------- */

function openPay() {
  const inv = cur();
  if (!inv) return;
  const c = calc(inv);
  $('#psAmount').value = plainAmt(Math.max(c.balance, 0));
  $('#psDate').value = iso(today());
  $('#psMethod').value = 'PayPal';
  $('#psPhp').value = '';
  $('#psNote').value = '';
  const est = toPeso(Math.max(c.balance, 0), inv.currency);
  $('#psPhp').placeholder = est != null && inv.currency !== 'PHP' ? `About ${peso(est)}` : '₱';
  $('label[for="psAmount"]').textContent = `Amount received (${inv.currency})`;
  openSheet('#paySheet', '#psAmount');
}
function savePay() {
  const inv = cur();
  if (!inv) return;
  const n = num($('#psAmount').value);
  if (!(n > 0)) { toast('Type the amount you received.'); $('#psAmount').focus(); return; }
  if (!inv.sentAt) { inv.billTo = party(inv); inv.sentAt = Date.now(); }
  inv.payments.push(cleanPayment({ id: uid('p'), amount: plainAmt(n), date: isoOk($('#psDate').value) || iso(today()), method: $('#psMethod').value, php: $('#psPhp').value.trim(), note: $('#psNote').value.trim() }, 0));
  touch(inv);
  closeSheet($('#paySheet'));
  const c = calc(inv);
  toast(c.balance <= 0 ? `Invoice ${inv.number} is paid in full.` : `Payment saved. ${fmt(c.balance, inv.currency)} still to come.`);
  renderAfterChange();
}
function removePay(id) {
  const inv = cur();
  if (!inv) return;
  const i = inv.payments.findIndex(p => p.id === id);
  if (i < 0) return;
  const [gone] = inv.payments.splice(i, 1);
  touch(inv);
  renderAfterChange();
  toast('Payment removed.', { label: 'Undo', run: () => {
    const x = S.invoices[inv.id];
    if (!x) return;
    x.payments.splice(Math.min(i, x.payments.length), 0, gone);
    touch(x);
    renderAfterChange();
  } });
}

/* ---------- sheets ---------- */

let sheetReturn = null;
function openSheet(sel, focusSel) {
  const s = $(sel);
  sheetReturn = document.activeElement;
  s.hidden = false;
  document.body.classList.add('sheet-open');
  pushLayer('sheet');
  setTimeout(() => { const f = focusSel ? $(focusSel) : s.querySelector('button, input'); if (f) f.focus(); }, 30);
}
function closeSheet(s, fromPop) {
  if (!s || s.hidden) return;
  s.hidden = true;
  if (!$$('.sheet').some(x => !x.hidden)) document.body.classList.remove('sheet-open');
  if (!fromPop) layerDone('sheet');
  if (sheetReturn && document.contains(sheetReturn)) { try { sheetReturn.focus(); } catch (e) { /* ignore */ } }
}

/* ---------- preview ---------- */

function paperHtml(inv) {
  const v = view(inv);
  const lines = s => esc(s).replace(/\n/g, '<br>');
  const bz = v.business;
  const from = [bz.address, bz.phone, bz.email, bz.website].filter(Boolean).map(lines).join('<br>');
  const bt = v.billTo;
  const to = [bt.name && bt.company ? bt.company : '', bt.address, bt.email].filter(Boolean).map(lines).join('<br>');
  const box = v.st === 'paid'
    ? `<div class="pp-due paid"><div class="pp-lbl">Paid in full</div><div class="amt">${esc(v.total)}</div><div class="sub">${esc(v.paidOn ? 'Paid ' + v.paidOn : v.cur)}</div></div>`
    : v.st === 'void'
      ? `<div class="pp-due void"><div class="pp-lbl">Void</div><div class="amt">${esc(v.total)}</div><div class="sub">This invoice was cancelled</div></div>`
      : `<div class="pp-due"><div class="pp-lbl">Amount due</div><div class="amt">${esc(v.amountDue)}</div><div class="sub">${esc([v.cur, v.dueLong].filter(Boolean).join(' · '))}</div></div>`;
  const meta = [['Invoice no.', v.number], ['Issued', v.issued], ['Due', v.due]];
  if (v.period) meta.push(['Work period', v.period]);
  if (v.ref) meta.push(['Reference', v.ref]);
  const pay = [];
  if (v.pay.url) pay.push(`<a class="pp-paybtn" href="${esc(v.pay.url)}" target="_blank" rel="noopener">${esc(v.pay.label)}</a>`);
  if (v.pay.paypalEmail) pay.push(`<div><b>PayPal:</b> ${esc(v.pay.paypalEmail)}</div>`);
  if (v.pay.bank) pay.push(`<div>${lines(v.pay.bank)}</div>`);
  if (v.pay.note) pay.push(`<div class="muted">${lines(v.pay.note)}</div>`);
  const showPay = pay.length && v.st !== 'paid' && v.st !== 'void';
  return `
    <div class="pp-band">
      <div class="pp-brand"><img src="img/mark.png" alt=""><div><div class="pp-bname">${esc(bz.name)}</div><div class="pp-btag">${esc(bz.tagline)}</div></div></div>
      <div class="pp-kind"><div class="k">INVOICE</div><div class="n">No. ${esc(v.number)}</div>${v.st === 'paid' ? '<span class="pp-tag">PAID</span>' : v.st === 'void' ? '<span class="pp-tag void">VOID</span>' : ''}</div>
    </div>
    <div class="pp-gold"></div>
    <div class="pp-body">
      <div class="pp-top">
        <div><div class="pp-lbl">From</div><div class="pp-block"><b>${esc(bz.name)}</b><br>${from}</div></div>
        <div><div class="pp-lbl">Bill to</div><div class="pp-block"><b>${esc(bt.name || bt.company || 'Client')}</b><br>${to}</div></div>
        ${box}
      </div>
      <div class="pp-meta" style="--n: ${meta.length}">${meta.map(([a, b]) => `<div><div class="pp-lbl">${esc(a)}</div><div class="v">${esc(b || '–')}</div></div>`).join('')}</div>
      <table class="pp-items">
        <thead><tr><th>#</th><th>Description</th><th class="r">Hrs/Qty</th><th class="r">Rate</th><th class="r">Amount (${esc(v.symbol)})</th></tr></thead>
        <tbody>${v.lines.length ? v.lines.map(l => `<tr><td class="n">${l.n}</td><td class="d">${lines(l.desc)}</td><td class="r m">${esc(l.qty)}</td><td class="r m">${esc(l.price)}</td><td class="r m">${esc(l.amount)}</td></tr>`).join('') : '<tr><td></td><td class="muted" colspan="4">No items yet</td></tr>'}</tbody>
      </table>
      <div class="pp-low">
        <div class="pp-pay">${showPay ? `<div class="pp-lbl">How to pay</div>${pay.join('')}` : ''}</div>
        <div class="pp-tot">
          ${v.rows.map(([a, b]) => `<span class="l">${esc(a)}</span><span class="v">${esc(b)}</span>`).join('')}
          <span class="bar"></span>
          <span class="tl">Total</span><span class="tv">${esc(v.total)}<small>${esc(v.cur)}</small></span>
          ${v.paid ? `<span class="l">Paid</span><span class="v">-${esc(v.paid)}</span><span class="bl">Balance due</span><span class="bv">${esc(v.balance)}</span>` : ''}
        </div>
      </div>
      ${v.note || v.terms ? `<div class="pp-notes">${v.note ? `<div><div class="pp-lbl">Note</div><div class="pp-block">${lines(v.note)}</div></div>` : ''}${v.terms ? `<div><div class="pp-lbl">Terms</div><div class="pp-block">${lines(v.terms)}</div></div>` : ''}</div>` : ''}
    </div>
    <div class="pp-foot"><span>${esc([bz.name, bz.website, bz.email].filter(Boolean).join(' · '))}</span><span>Invoice ${esc(v.number)}</span></div>`;
}
function openPreview() {
  const inv = cur();
  if (!inv) return;
  $('#pvTitle').textContent = `Invoice ${inv.number}`;
  $('#paper').innerHTML = paperHtml(inv);
  openSheet('#preview', '#pvClose');
}

/* ---------- PDF ---------- */

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load ' + src));
    document.head.appendChild(s);
  });
}
async function pdfKit() {
  if (!window.jspdf) await loadScript('vendor/jspdf.umd.min.js');
  if (!window.InvoicePDF) await loadScript('pdf.js');
  return window.InvoicePDF;
}
const fileSafe = s => String(s).normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
const pdfName = inv => `Invoice-${fileSafe(inv.number) || 'draft'}${who(inv) !== 'No client yet' ? '-' + fileSafe(who(inv)) : ''}.pdf`;
async function makePdf(inv) {
  const kit = await pdfKit();
  return kit.invoice(view(inv));
}
function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
async function downloadPdf() {
  const inv = cur();
  if (!inv) return;
  const why = notReady(inv);
  if (why) { toast(why); return; }
  if (!S.invoices[inv.id]) { touch(inv); renderSummary(); }
  try {
    const doc = await makePdf(inv);
    download(doc.output('blob'), pdfName(inv));
    toast('Saved ' + pdfName(inv));
  } catch (e) { console.error(e); toast("Couldn't make the PDF. Check your connection and try again."); }
}
// a reason the invoice can't go out yet, or ''
function notReady(inv, c = calc(inv)) {
  if (c.errors.length) return `Item ${c.lines.indexOf(c.errors[0]) + 1} still has something to fix.`;
  if (c.missing.length) return `Item ${c.lines.indexOf(c.missing[0]) + 1} needs its hours or quantity.`;
  const np = c.lines.find(l => l.noPrice);
  if (np) return `Item ${c.lines.indexOf(np) + 1} needs its price.`;
  if (!c.lines.some(l => l.filled)) return 'Add an item first.';
  if (c.total <= 0 && !inv.sentAt) return `This invoice comes to ${fmt(c.total, inv.currency)}. Check the prices, discount and credit.`;
  return '';
}
function canShareFiles() {
  try {
    return !!(navigator.canShare && matchMedia('(pointer: coarse)').matches &&
      navigator.canShare({ files: [new File(['x'], 'x.pdf', { type: 'application/pdf' })] }));
  } catch (e) { return false; }
}

/* ---------- sending ---------- */

function recipients(inv) {
  const split = s => String(s || '').split(/[,;\s]+/).map(x => x.trim()).filter(x => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
  const c = S.clients[inv.clientId];
  return { to: split(party(inv).email), cc: split(inv.cc.trim() ? inv.cc : c ? c.cc : '') };
}
function openSend() {
  const inv = cur();
  if (!inv) return;
  const c = calc(inv);
  const why = notReady(inv, c);
  if (why) { toast(why); return; }
  if (!S.invoices[inv.id]) { touch(inv); renderSummary(); }
  const r = recipients(inv);
  $('#sdTitle').textContent = `Send invoice ${inv.number}`;
  $('#sdTo').innerHTML = r.to.length
    ? `<span class="to-line">To ${r.to.map(e => `<button class="chip" type="button" data-copy="${esc(e)}" title="Copy">${esc(e)}</button>`).join('')}${r.cc.length ? ' Copy to ' + r.cc.map(e => `<button class="chip" type="button" data-copy="${esc(e)}" title="Copy">${esc(e)}</button>`).join('') : ''}</span>`
    : `<span class="warn-text">This client has no email address yet. Add it under Clients, or type it in the email.</span>`;
  $('#sdSubject').value = fillMail(S.business.emailSubject, inv, c);
  $('#sdBody').value = fillMail(S.business.emailBody, inv, c);
  const share = canShareFiles();
  $('#sdShare').hidden = !share;
  $('#sdGmail').hidden = share;
  $('#sdHint').textContent = share
    ? `Tap Share, pick Gmail, and the PDF and message go in. Then add ${r.to[0] || 'the client'} as the recipient (tap the address above to copy it).`
    : 'Gmail opens in a new tab with the email ready, and the PDF downloads. Drag the PDF into the email, then press Send.';
  $('#sdMark').checked = !inv.sentAt;
  $('#sdMark').parentElement.hidden = !!inv.sentAt;
  openSheet('#sendSheet', share ? '#sdShare' : '#sdGmail');
}
function afterSend(inv) {
  if ($('#sdMark').checked) markSent(inv);
}
async function sendShare() {
  const inv = cur();
  if (!inv) return;
  try {
    const doc = await makePdf(inv);
    const file = new File([doc.output('blob')], pdfName(inv), { type: 'application/pdf' });
    await navigator.share({ files: [file], title: $('#sdSubject').value, text: $('#sdBody').value });
    afterSend(inv);
    closeSheet($('#sendSheet'));
    if (inv.sentAt) toast(`Invoice ${inv.number} is marked as sent.`);
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    console.error(e);
    toast("Couldn't share. Use Download PDF and Copy message instead.");
  }
}
async function sendGmail() {
  const inv = cur();
  if (!inv) return;
  const r = recipients(inv);
  const q = new URLSearchParams({ view: 'cm', fs: '1', to: r.to.join(','), su: $('#sdSubject').value, body: $('#sdBody').value });
  if (r.cc.length) q.set('cc', r.cc.join(','));
  // open the tab first: browsers only allow it straight after the tap
  // noopener: the Gmail tab must not get a copy of this window's sessionStorage (it can't be told apart
  // from a blocked popup then, so the message covers both)
  window.open('https://mail.google.com/mail/?' + q.toString(), '_blank', 'noopener');
  try {
    const doc = await makePdf(inv);
    download(doc.output('blob'), pdfName(inv));
  } catch (e) { console.error(e); toast("Couldn't make the PDF. Use Download PDF to try again."); return; }
  afterSend(inv);
  closeSheet($('#sendSheet'));
  toast("The PDF downloaded and Gmail opened in a new tab. Drag the PDF into the email. If Gmail didn't open, use Copy message.");
}
async function copyText(text, okMsg) {
  try { await navigator.clipboard.writeText(text); toast(okMsg); return true; } catch (e) { toast("Couldn't copy. Select the text and copy it."); return false; }
}

/* ---------- clients ---------- */

const initials = s => String(s || '?').split(/\s+/).filter(Boolean).map(w => w[0]).join('').replace(/[^\p{L}\p{N}]/gu, '').toUpperCase().slice(0, 2) || '?';
function clientStats(id) {
  const rows = allRows().filter(r => r.inv.clientId === id);
  const owed = sumBy(rows.filter(r => isOpen(r.st)), r => r.c.balance);
  const paid = sumBy(rows.filter(r => r.st !== 'void'), r => r.c.paid);
  return { rows, owed, paid };
}
function renderClients() {
  const list = Object.values(S.clients).sort((a, b) => byStr((a.name || a.company).toLowerCase(), (b.name || b.company).toLowerCase()));
  $('#clList').innerHTML = list.length ? list.map(renderClientRow).join('') : `<div class="inv-empty">No clients yet. Add the people you invoice, with their email, currency and usual rate.</div>`;
  const c = curClient();
  $('#clEditor').hidden = !c;
  if (!c) return;
  fillSelect($('#clCurrency'), currencyOptions(), c.currency);
  const dueOpts = [[0, 'Due on receipt'], [7, '7 days'], [14, '14 days'], [30, '30 days']];
  if (!dueOpts.some(o => o[0] === c.dueDays)) dueOpts.push([c.dueDays, c.dueDays + ' days']);
  fillSelect($('#clDue'), dueOpts.map(([v, t]) => [String(v), t]), String(c.dueDays));
  for (const el of $$('[data-cf]')) if (el.tagName !== 'SELECT') setVal(el.id, String(c[el.dataset.cf] ?? ''));
  const st = clientStats(c.id);
  $('#clStats').textContent = st.rows.length
    ? [`${st.rows.length} invoice${st.rows.length === 1 ? '' : 's'}`, st.paid.length ? st.paid.map(([k, v]) => fmt(v, k)).join(' + ') + ' paid' : '', st.owed.length ? st.owed.map(([k, v]) => fmt(v, k)).join(' + ') + ' owed' : ''].filter(Boolean).join(' · ')
    : 'No invoices yet';
  const back = backInvoice();
  $('#clNewInv').textContent = back ? (back.clientId === c.id ? 'Back to the invoice' : 'Use on the invoice') : 'New invoice for this client';
  $('#clDelConfirm').hidden = true;
  $('#clDel').hidden = false;
}
let newClient = null; // a client being added: kept once it has a name
const curClient = () => S.clients[UI.clId] || (newClient && newClient.id === UI.clId ? newClient : null);
function addClient(backTo) {
  const now = Date.now();
  newClient = cleanClient({ id: uid('c'), currency: 'USD', dueDays: 0, createdAt: now, updatedAt: now });
  UI.clId = newClient.id;
  const keep = backTo ? (S.invoices[backTo] || draft) : null;
  setTab('clients', { detour: !!keep });
  UI.backTo = keep ? keep.id : '';
  renderClients();
  setTimeout(() => $('#clName').focus(), 30);
}
function editClientFor(inv) {
  if (!inv || !S.clients[inv.clientId]) return;
  UI.clId = inv.clientId;
  setTab('clients', { detour: true });
  UI.backTo = inv.id;
  renderClients();
}
function clientInput(e) {
  const t = e.target;
  const c = curClient();
  if (!c || !t.dataset.cf) return;
  const f = t.dataset.cf;
  c[f] = f === 'dueDays' ? +t.value || 0 : t.value;
  Object.assign(c, cleanClient(c));
  c.updatedAt = stamp(c); // unsent invoices show the new details without being edited themselves
  if (c === newClient) {
    if (!(c.name.trim() || c.company.trim())) return; // nothing worth keeping yet
    S.clients[c.id] = c;
    newClient = null;
    $('#clNewInv').textContent = backInvoice() ? 'Use on the invoice' : 'New invoice for this client';
  }
  save();
  if (f === 'currency') refreshRates();
  clearTimeout(clientInput.t);
  clientInput.t = setTimeout(() => {
    const keep = document.activeElement && document.activeElement.id;
    const list = $('#clList');
    const row = list.querySelector(`[data-client="${CSS.escape(c.id)}"]`);
    if (row) row.outerHTML = renderClientRow(c);
    else renderClients();
    if (keep && document.getElementById(keep)) document.getElementById(keep).focus();
  }, 250);
}
function renderClientRow(c) {
  const st = clientStats(c.id);
  const owe = st.owed.length ? `<b>${esc(fmt(st.owed[0][1], st.owed[0][0]))}</b>owed` : `${st.rows.length} invoice${st.rows.length === 1 ? '' : 's'}`;
  return `<button class="cl-row" type="button" data-client="${esc(c.id)}" aria-current="${c.id === UI.clId}">
      <span class="avatar" aria-hidden="true">${esc(initials(c.name || c.company))}</span>
      <span class="cl-name">${esc(c.name || c.company || 'New client')}</span>
      <span class="cl-owe">${owe}</span>
      <span class="cl-sub">${esc([c.company && c.name ? c.company : '', c.email, c.currency].filter(Boolean).join(' · '))}</span>
    </button>`;
}
function deleteClient() {
  const c = curClient();
  if (!c) return;
  if (c === newClient) { newClient = null; UI.clId = ''; renderClients(); return; }
  // unsent invoices read the client's details live: keep them on the invoices before the client goes
  for (const inv of [...Object.values(S.invoices), ...(draft ? [draft] : [])]) {
    if (inv.clientId !== c.id || inv.sentAt || inv.payments.length) continue;
    inv.billTo = party(inv);
    if (!inv.cc.trim()) inv.cc = c.cc;
    if (S.invoices[inv.id]) inv.updatedAt = stamp(inv);
  }
  delete S.clients[c.id];
  S.deleted[c.id] = Math.max(Date.now(), c.updatedAt);
  UI.clId = '';
  save();
  renderClients();
  toast(`${c.name || 'Client'} removed. Their invoices stay.`);
}

/* ---------- settings ---------- */

function renderSettings() {
  for (const el of $$('[data-bf]')) setVal(el.id, String(S.business[el.dataset.bf] ?? ''));
  $('#bzNext').placeholder = '000001';
  const hint = $('#bzNextHint');
  if (hint) hint.textContent = `The next invoice will be ${nextNumber()}.`;
}
function businessInput(e) {
  const f = e.target.dataset.bf;
  if (!f) return;
  S.business[f] = e.target.value;
  S.business.updatedAt = stamp(S.business);
  save();
  const hint = $('#bzNextHint');
  if (hint) hint.textContent = `The next invoice will be ${nextNumber()}.`;
  if (f === 'feePct') renderOverview();
}

/* ------------------------------------------------------------------ wiring */

function wire() {
  $('.tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) { newClient = null; setTab(b.id.slice(4)); } });
  $('.tabs').addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const i = Math.max(0, TABS.indexOf(UI.tab));
    const n = e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
    setTab(TABS[n], { focus: true });
  });
  document.addEventListener('click', e => {
    if (!GJCore.unlocked()) return;
    const t = e.target;
    const g = t.closest('[data-goto]');
    if (g) { setTab(g.dataset.goto); return; }
    if (t.closest('[data-new]')) { newInvoice(); return; }
    const o = t.closest('[data-open]');
    if (o) { openEditor(o.dataset.open); return; }
    const k = t.closest('[data-kfilter]');
    if (k) { UI.filter = k.dataset.kfilter; setTab('invoices'); return; }
    const cp = t.closest('[data-copy]');
    if (cp) { copyText(cp.dataset.copy, 'Copied ' + cp.dataset.copy); return; }
  });
  $('.filters').addEventListener('click', e => { const b = e.target.closest('[data-filter]'); if (b) { UI.filter = b.dataset.filter; renderList(); save(); } });
  $('#invSearch').addEventListener('input', renderList);

  // editor
  const ed = $('#panel-editor');
  ed.addEventListener('input', editorInput);
  ed.addEventListener('click', e => {
    const t = e.target;
    const di = t.closest('[data-del-item]');
    if (di) { removeItem(di.dataset.delItem); return; }
    const dp = t.closest('[data-del-pay]');
    if (dp) { removePay(dp.dataset.delPay); return; }
    const dd = t.closest('[data-due]');
    if (dd) {
      const inv = cur();
      if (!inv) return;
      inv.due = iso(addDays(parseIso(inv.issue) || today(), +dd.dataset.due));
      setVal('edDue', inv.due);
      touch(inv); renderSummary();
      return;
    }
    const act = t.closest('[data-act]');
    if (act) { if (act.dataset.act === 'preview') openPreview(); else openSend(); }
  });
  $('#edAddItem').addEventListener('click', addItem);
  $('#edEditClient').addEventListener('click', () => editClientFor(cur()));
  $('#edPreview').addEventListener('click', openPreview);
  $('#edPdf').addEventListener('click', downloadPdf);
  $('#edSend').addEventListener('click', openSend);
  $('#edPaid').addEventListener('click', openPay);
  $('#edDup').addEventListener('click', () => duplicate(false));
  $('#edNext').addEventListener('click', () => duplicate(true));
  $('#edVoid').addEventListener('click', () => {
    const inv = cur();
    if (!inv || !S.invoices[inv.id]) return;
    inv.voidAt = inv.voidAt ? 0 : Date.now();
    touch(inv);
    renderAfterChange();
    toast(inv.voidAt ? `Invoice ${inv.number} is void. It stays in your list, crossed out.` : `Invoice ${inv.number} is back.`);
  });
  $('#edDel').addEventListener('click', () => { $('#edDelConfirm').hidden = false; });
  $('#edDelNo').addEventListener('click', () => { $('#edDelConfirm').hidden = true; });
  $('#edDelYes').addEventListener('click', () => {
    const inv = cur();
    if (!inv) return;
    delete S.invoices[inv.id];
    S.deleted[inv.id] = Math.max(Date.now(), inv.updatedAt);
    draft = null;
    UI.edId = '';
    save();
    setTab('invoices');
    toast(`Invoice ${inv.number} deleted.`);
  });

  // sheets
  $('#pvClose').addEventListener('click', () => closeSheet($('#preview')));
  $('#pvPdf').addEventListener('click', downloadPdf);
  $('#pvSend').addEventListener('click', () => { closeSheet($('#preview')); setTimeout(openSend, 60); });
  $('#sdClose').addEventListener('click', () => closeSheet($('#sendSheet')));
  $('#sdShare').addEventListener('click', sendShare);
  $('#sdGmail').addEventListener('click', sendGmail);
  $('#sdCopy').addEventListener('click', async () => {
    const inv = cur();
    if (!inv) return;
    if (await copyText(`${$('#sdSubject').value}\n\n${$('#sdBody').value}`, 'Message copied.')) afterSend(inv);
  });
  $('#sdPdf').addEventListener('click', downloadPdf);
  $('#psClose').addEventListener('click', () => closeSheet($('#paySheet')));
  $('#psSave').addEventListener('click', savePay);
  $('#paySheet').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); savePay(); } });
  for (const s of $$('.sheet')) {
    let downOnBackdrop = false;
    s.addEventListener('pointerdown', e => { downOnBackdrop = e.target === s; });
    s.addEventListener('click', e => { if (e.target === s && downOnBackdrop) closeSheet(s); downOnBackdrop = false; });
  }
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = $$('.sheet').filter(s => !s.hidden).pop();
    if (open) closeSheet(open);
  });

  // clients
  $('#clList').addEventListener('click', e => { const b = e.target.closest('[data-client]'); if (b) { UI.clId = b.dataset.client; newClient = null; renderClients(); save(); if (matchMedia('(max-width: 899px)').matches) $('#clEditor').scrollIntoView({ behavior: 'smooth', block: 'start' }); } });
  $('#clAdd').addEventListener('click', () => addClient(''));
  $('#clEditor').addEventListener('input', clientInput);
  $('#clNewInv').addEventListener('click', () => {
    const c = curClient();
    if (!c) return;
    if (!S.clients[c.id]) { toast("Type the client's name first."); $('#clName').focus(); return; }
    if (backInvoice()) { returnToInvoice(c.id); return; }
    newInvoice(c.id);
  });
  $('#clDel').addEventListener('click', () => { $('#clDelConfirm').hidden = false; $('#clDel').hidden = true; });
  $('#clDelNo').addEventListener('click', () => { $('#clDelConfirm').hidden = true; $('#clDel').hidden = false; });
  $('#clDelYes').addEventListener('click', deleteClient);

  // settings
  $('#panel-settings').addEventListener('input', businessInput);
}

/* ------------------------------------------------------------------ start */

function onUnlock() {
  renderAll();
  if (UI.edId && S.invoices[UI.edId]) openEditor(UI.edId);
  else setTab(UI.tab, { keepScroll: true });
}

wire();
GJCore.start({
  ns: 'gjr-invoices',
  name: 'Invoices',
  kind: 'gj-invoices',
  gistFile: 'genestjan-invoices-sync.json',
  gistDesc: 'Invoices sync (encrypted)',
  text: {
    create: ['Create your password', 'It locks your invoices, clients and business details on this device. Nobody can open them without it.', 'Create password'],
    unlock: ['Invoices', 'Type your password to open your invoices.', 'Unlock'],
  },
  load, dump, payload, normalize, merge, isEmpty,
  render: renderAll,
  onUnlock,
  setupPayload: () => ({ business: S.business, clients: Object.values(S.clients) }),
  applySetup,
  describeSetup,
});
setInterval(() => { if (GJCore.unlocked()) refreshRates(); }, 30 * 60 * 1000);
})();
