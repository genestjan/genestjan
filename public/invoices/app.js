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
const TABS = ['overview', 'invoices', 'time', 'reports', 'payroll', 'clients', 'settings', 'hours'];
const OWNER_TABS = ['overview', 'invoices', 'time', 'reports', 'payroll', 'clients', 'settings'];
const PARTNER_TABS = ['time', 'hours', 'settings'];
const TK = window.TimeKit;
const PK = window.PayrollKit;
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
  nextNumber: '000001', taxLabel: '', taxRate: '', note: 'Thank you for your business!', terms: '', feePct: '4', timerLong: '6',
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
    payRate: str(x.payRate, 20), commission: !!x.commission, about: str(x.about, 60),
    createdAt: +x.createdAt || 0, updatedAt: +x.updatedAt || 0,
  };
}
const cleanItem = (x, i) => {
  const o = x && typeof x === 'object' ? x : {};
  // src: 'time:<project id>' for a line filled from tracked time
  return { id: validId(o.id) ? o.id : 'i' + i, desc: str(o.desc, 1000), qty: str(o.qty, 20), rate: str(o.rate, 20), src: /^time:[A-Za-z0-9_-]{1,40}$/.test(o.src || '') ? o.src : '' };
};
// a time entry's key on an invoice: 'me:<id>' for Jan's own, 'p:<partner>:<id>' for a partner's
const REF = /^(me|p:[A-Za-z0-9_-]{1,40}):[A-Za-z0-9_-]{1,40}$/;
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
    timeLink: !!x.timeLink, timeRefs: Array.isArray(x.timeRefs) ? [...new Set(x.timeRefs.filter(r => typeof r === 'string' && REF.test(r)))].sort().slice(0, 5000) : [],
    createdAt: +x.createdAt || 0, updatedAt: +x.updatedAt || 0,
  };
}
// a client's project: what time is tracked against, and who works on it
function cleanProject(x) {
  if (!x || typeof x !== 'object' || !validId(x.id)) return null;
  return {
    id: x.id, clientId: validId(x.clientId) ? x.clientId : '', name: str(x.name, 120),
    color: TK.COLORS.includes(x.color) ? x.color : TK.COLORS[0], rate: str(x.rate, 20), billable: x.billable !== false, archived: !!x.archived,
    assignees: Array.isArray(x.assignees) ? [...new Set(x.assignees.filter(validId))].sort() : [],
    createdAt: +x.createdAt || 0, updatedAt: +x.updatedAt || 0,
  };
}
// a partner: their team channel and the words that must never reach a client
function cleanPartner(x) {
  if (!x || typeof x !== 'object' || !validId(x.id)) return null;
  return {
    id: x.id, name: str(x.name, 80), nicknames: str(x.nicknames, 200), color: TK.COLORS.includes(x.color) ? x.color : TK.COLORS[1],
    gistId: typeof x.gistId === 'string' && /^[0-9a-f]{20,64}$/i.test(x.gistId) ? x.gistId : '',
    key: typeof x.key === 'string' && /^[A-Za-z0-9+/]{43}=$/.test(x.key) ? x.key : '',
    active: x.active !== false, createdAt: +x.createdAt || 0, updatedAt: +x.updatedAt || 0,
  };
}
const cleanTeam = x => {
  const o = x && typeof x === 'object' ? x : {};
  return { token: str(o.token, 200).trim(), login: str(o.login, 60), updatedAt: +o.updatedAt || 0 };
};
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
    projects: list(o.projects, cleanProject),
    partners: list(o.partners, cleanPartner),
    team: cleanTeam(o.team),
    log: TK.normalizeLog(o.log), // Jan's own time
    // each partner's time as Jan's devices know it: a removed partner's channel is gone, this stays
    teamLogs: Object.fromEntries(Object.entries(o.teamLogs && typeof o.teamLogs === 'object' ? o.teamLogs : {}).filter(([id]) => validId(id)).sort((a, b) => byStr(a[0], b[0])).map(([id, l]) => [id, TK.normalizeLog(l)])),
    payroll: PK.cleanPayroll(o.payroll),
    payRuns: list(o.payRuns, PK.cleanPayRun),
    imports: { payroll: +(o.imports && o.imports.payroll) || 0 },
    deleted: Object.entries(del).sort((a, b) => byStr(a[0], b[0])),
  };
}

const S = { business: cleanBusiness(null), clients: {}, invoices: {}, projects: {}, partners: {}, team: cleanTeam(null), log: TK.emptyLog(), payroll: null, payRuns: {}, imports: { payroll: 0 }, deleted: {} };
// each partner's time, as last read from their team channel and from Jan's other devices (the logs
// go in Jan's sync and backups as teamLogs; when and how it last synced stays on this device)
let teamCache = {}; // partner id -> { log, at, err, dirty }
let UI = { tab: 'overview', filter: 'all', edId: '', clId: '', backTo: '' };
let rates = {}; // code -> { mid, date, feed, at }, kept on this device only
let draft = null; // a new invoice that hasn't been typed in yet: it is only kept once something changes

const payload = () => (MODE === 'partner' ? { role: 'partner', me: PS.me.id, log: TK.logDoc(PS.log) } : ownerPayload());
const ownerPayload = () => normalize({
  business: S.business, clients: Object.values(S.clients), invoices: Object.values(S.invoices),
  projects: Object.values(S.projects), partners: Object.values(S.partners), team: S.team, log: TK.logDoc(S.log),
  teamLogs: Object.fromEntries(Object.entries(teamCache).map(([id, c]) => [id, TK.logDoc(c.log)])),
  payroll: S.payroll, payRuns: Object.values(S.payRuns), imports: S.imports,
  deleted: Object.entries(S.deleted),
});
function loadPayload(p) {
  const n = normalize(p);
  S.business = n.business;
  S.clients = Object.fromEntries(n.clients.map(c => [c.id, c]));
  S.invoices = Object.fromEntries(n.invoices.map(i => [i.id, i]));
  S.projects = Object.fromEntries(n.projects.map(x => [x.id, x]));
  S.partners = Object.fromEntries(n.partners.map(x => [x.id, x]));
  S.team = n.team;
  S.log = TK.logFrom(n.log);
  S.payroll = n.payroll;
  S.payRuns = Object.fromEntries(n.payRuns.map(x => [x.id, x]));
  S.imports = n.imports;
  S.deleted = Object.fromEntries(n.deleted);
  return n;
}
const cacheDump = () => Object.fromEntries(Object.entries(teamCache).map(([id, c]) => [id, { log: TK.logDoc(c.log), at: c.at, dirty: c.dirty }]));
function dump() { return MODE === 'partner' ? partnerDump() : { v: 1, data: payload(), ui: UI, rates, team: cacheDump() }; }
function load(d) {
  if (d && d.role === 'partner') {
    ownerLoad({});
    setMode('partner');
    loadPartner(d);
    UI.tab = d.ui && PARTNER_TABS.includes(d.ui.tab) ? d.ui.tab : 'time';
    return;
  }
  setMode('owner');
  PS = blankPartnerState();
  ownerLoad(d);
}
function ownerLoad(d) {
  const n = loadPayload(d && d.data);
  const u = d && d.ui && typeof d.ui === 'object' ? d.ui : {};
  UI = {
    tab: TABS.includes(u.tab) ? u.tab : 'overview',
    filter: ['all', 'draft', 'unpaid', 'overdue', 'paid'].includes(u.filter) ? u.filter : 'all',
    edId: validId(u.edId) ? u.edId : '', clId: validId(u.clId) ? u.clId : '', backTo: '',
  };
  rates = {};
  const r = d && d.rates && typeof d.rates === 'object' ? d.rates : {};
  for (const c of CODES) if (r[c] && +r[c].mid > 0) rates[c] = { mid: +r[c].mid, date: str(r[c].date, 10), feed: str(r[c].feed, 40), at: +r[c].at || 0 };
  teamCache = {};
  const t = d && d.team && typeof d.team === 'object' ? d.team : {};
  for (const [id, c] of Object.entries(t)) if (validId(id) && c && typeof c === 'object') teamCache[id] = { log: TK.logFrom(c.log), at: +c.at || 0, err: '', dirty: !!c.dirty };
  for (const [id, l] of Object.entries(n.teamLogs)) TK.mergeLog(cacheOf(id).log, l);
  draft = null;
}
function merge(p, opts) {
  if (MODE === 'partner') { if (p && p.role === 'partner' && p.log) TK.mergeLog(PS.log, p.log); return; }
  if (p && p.role === 'partner') return;
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
  if (newer(r.team, S.team)) S.team = r.team;
  TK.mergeLog(S.log, r.log, restore);
  for (const [id, l] of Object.entries(r.teamLogs)) TK.mergeLog(cacheOf(id).log, l, restore);
  if (r.payroll) {
    if (!S.payroll) S.payroll = r.payroll;
    else {
      // each part on its own: the hours calculator on the phone never wipes hours typed on the laptop
      const L = S.payroll, R = r.payroll;
      for (const k of PK.PARTS) {
        if (R.at[k] > L.at[k] || (R.at[k] === L.at[k] && JSON.stringify(R[k]) > JSON.stringify(L[k]))) { L[k] = R[k]; L.at[k] = R.at[k]; }
      }
      L.updatedAt = Math.max(L.updatedAt, R.updatedAt);
    }
  }
  S.imports = { payroll: Math.max(S.imports.payroll || 0, r.imports.payroll || 0) };
  for (const kind of ['clients', 'invoices', 'projects', 'partners', 'payRuns']) {
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
  if (s.kind === 'team-invite' || s.kind === 'team-device') { applyTeamSetup(s, opts); return; }
  if (MODE === 'partner') { toast(`This device is set up for ${PS.me.name || 'a partner'}'s time, so it can't take Jan's business setup.`); return; }
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
// an invite from Jan (or a partner's link from their other device) turns an empty device into theirs
function applyTeamSetup(s, opts) {
  if (opts && opts.unlocked) return; // only locked links
  if (!validId(s.partnerId) || !cleanRawKey(s.key) || typeof s.token !== 'string' || !/^[0-9a-f]{20,64}$/i.test(s.gistId || '')) return;
  // a device is one person's: Jan's, or one partner's (their time and work never go into another's channel)
  if ((MODE === 'owner' && !ownerEmpty()) || (MODE === 'partner' && PS.me.id && PS.me.id !== s.partnerId)) { toast(`That's ${s.name || 'a partner'}'s invite. Open it on their own phone or computer, not on this one.`); return; }
  setMode('partner');
  PS.me = { id: s.partnerId, name: str(s.name, 80) };
  PS.key = s.key;
  PS.token = s.token;
  PS.gistId = s.gistId;
  PS.err = '';
  if (s.kind === 'team-invite') PS.firstRun = true;
  UI.tab = 'time';
  schedulePartnerSync(); // their projects come straight in
}
function describeSetup(s) {
  if (s && (s.kind === 'team-invite' || s.kind === 'team-device')) {
    const theirs = (MODE === 'owner' && !ownerEmpty()) || (MODE === 'partner' && PS.me.id && s.partnerId !== PS.me.id);
    return theirs ? `This is ${s.name || 'a partner'}'s invite. Open it on their own device instead.` : `Work Hub for ${s.name || 'a partner'}: their time and their projects.`;
  }
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
let ratesLoading = null;
const ratesTried = {};
async function refreshRates(extra, force) {
  if (MODE !== 'owner') return;
  while (ratesLoading) { try { await ratesLoading; } catch (e) { /* that round reports its own */ } } // then only what is still missing
  const used = new Set([...Object.values(S.invoices).map(i => i.currency), ...Object.values(S.clients).map(c => c.currency), ...(Array.isArray(extra) ? extra : [])]);
  if (payrollClients().length) used.add('USD');
  const need = [...used].filter(c => c !== 'PHP' && (force || !(rates[c] && Date.now() - rates[c].at < 3 * 3600 * 1000) && !(Date.now() - (ratesTried[c] || 0) < 5 * 60 * 1000)));
  if (!need.length) return;
  for (const c of need) ratesTried[c] = Date.now(); // a feed that fails isn't asked again for a few minutes, unless Refresh is tapped
  const run = (async () => {
    const got = await Promise.all(need.map(fetchMid));
    need.forEach((c, i) => { if (got[i]) rates[c] = { ...got[i], at: Date.now() }; });
    if (got.some(Boolean) && GJCore.unlocked() && MODE === 'owner') { save(); renderOverview(); if (cur()) renderSummary(); if (payrollView) payrollView.rates(); }
    return got.some(Boolean);
  })();
  ratesLoading = run;
  try { return await run; } finally { if (ratesLoading === run) ratesLoading = null; }
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

const allowedTabs = () => (MODE === 'partner' ? PARTNER_TABS : OWNER_TABS);
function setTab(name, opts = {}) {
  if (!allowedTabs().includes(name)) name = allowedTabs()[0];
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
  if (MODE === 'partner') {
    if (name === 'time' && timeView) timeView.render();
    if (name === 'hours') renderHours();
    if (!opts.keepScroll) window.scrollTo(0, 0);
    save();
    return;
  }
  if (name === 'payroll') { renderImport(); if (payrollView) { payrollView.render(); refreshRates(payrollView.codes()); } }
  if (name === 'overview') renderOverview();
  if (name === 'invoices') renderList();
  if (name === 'clients') renderClients();
  if (name === 'settings') { renderSettings(); renderTeam(); }
  if (name === 'time' && timeView) { timeView.render(); syncTeam(); }
  if (name === 'reports') { renderReport(); syncTeam(); }
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
  if (MODE === 'partner') { renderPartner(); return; }
  refreshLinkedDrafts(); // time from another device may have just come in
  renderImport();
  if (payrollView && !$('#panel-payroll').hidden) payrollView.render();
  $('#mastDate').textContent = today().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  renderOverview();
  renderList();
  renderClients();
  renderSettings();
  renderTeam();
  if (timeView) timeView.render();
  renderReport();
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
  renderWorkCards();
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
  renderEditorTime(inv);
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
  if (t.id === 'edTimeLink') {
    inv.timeLink = t.checked;
    if (inv.timeLink) { const tt = timeFor(inv); if (tt) applyTime(inv, tt); $('#edItems').dataset.key = ''; renderItems(); }
    touch(inv);
    renderSummary();
    return;
  }
  if (t.dataset.item) {
    const it = inv.items.find(i => i.id === t.dataset.item);
    if (!it) return;
    if (it.src && inv.timeLink) { inv.timeLink = false; $('#edTimeLink').checked = false; toast('You changed a line from tracked time, so this invoice stops following new time. Tick "Keep in step" to go back.'); }
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
    if (inv.timeLink && (t.id === 'edPStart' || t.id === 'edPEnd')) { const tt = timeFor(inv); if (tt && applyTime(inv, tt)) { $('#edItems').dataset.key = ''; renderItems(); } renderEditorTime(inv); }
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
    if (inv.timeLink) { const tt = timeFor(inv); if (tt) applyTime(inv, tt); else { inv.items = inv.items.filter(i => !i.src); if (!inv.items.length) inv.items = [cleanItem({}, 0)]; inv.timeRefs = []; } $('#edItems').dataset.key = ''; }
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
    items: src.items.filter(it => !it.src).map(it => ({ ...it, id: uid('i'), qty: next ? '' : it.qty })),
    sentAt: 0, voidAt: 0, payments: [], memo: '', timeRefs: [], createdAt: Date.now(), updatedAt: 0,
  });
  draft = copy;
  autoNo = copy.id;
  UI.edId = '';
  if (copy.timeLink) { const tt = timeFor(copy); if (tt) applyTime(copy, tt); }
  if (!copy.items.length) copy.items = [cleanItem({}, 0)];
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
  const leaks = findLeaks([
    ...c.lines.filter(l => l.filled).map((l, i) => ({ where: `item ${i + 1}`, text: fillText(l.it.desc, inv, l) })),
    { where: 'the note', text: inv.note }, { where: 'the terms', text: inv.terms }, { where: 'the reference', text: inv.ref },
    { where: 'the discount or charge label', text: inv.adjLabel + ' ' + inv.taxLabel },
  ]);
  if (leaks.length) return leakMessage(leaks);
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
  $('#sdReportWrap').hidden = !inv.timeRefs.length;
  $('#sdReport').checked = inv.timeRefs.length > 0;
  $('#sdMark').checked = !inv.sentAt;
  $('#sdMark').parentElement.hidden = !!inv.sentAt;
  openSheet('#sendSheet', share ? '#sdShare' : '#sdGmail');
}
function afterSend(inv) {
  if ($('#sdMark').checked) markSent(inv);
}
// checked again at the moment of sending: the email as typed, and the invoice (time may have come in)
function sendBlocked(inv) {
  const why = notReady(inv);
  if (why) return why;
  const leaks = findLeaks([{ where: 'the email subject', text: $('#sdSubject').value }, { where: 'the email message', text: $('#sdBody').value }]);
  return leaks.length ? leakMessage(leaks) : '';
}
// the time report for exactly the entries an invoice billed, when it is to go with the invoice
async function invoiceReport(inv) {
  if (!$('#sdReport').checked || !inv.timeRefs.length) return null;
  const rep = clientReport(inv.clientId, '', '', new Set(inv.timeRefs));
  const leaks = clientReportLeaks(rep);
  if (leaks.length) throw Object.assign(new Error('leak'), { leakText: leakMessage(leaks) });
  // an entry changed after the invoice was filled: the report would show other hours than the invoice
  const lines = inv.items.filter(i => i.src);
  const billed = lines.reduce((t, i) => {
    const q = qtyOf(i.qty);
    if (!q || q.error) return t;
    const hm = /^(\d+):(\d{2})$/.exec(q.hm || '');
    return t + (hm ? +hm[1] * 60 + +hm[2] : Math.round(q.value * 60));
  }, 0);
  if (lines.length && Math.abs(billed - rep.total) > lines.length) {
    throw Object.assign(new Error('changed'), { leakText: `The tracked time changed after this invoice was filled: the report has ${TK.fmtHM(rep.total)}, the invoice ${TK.fmtHM(billed)}. Untick "Attach the time report", or fill the invoice from tracked time again.` });
  }
  return rep.entries.length ? { rep, blob: (await clientReportPdf(rep)).output('blob') } : null;
}
async function sendShare() {
  const inv = cur();
  if (!inv) return;
  const why = sendBlocked(inv);
  if (why) { toast(why); return; }
  try {
    const doc = await makePdf(inv);
    const files = [new File([doc.output('blob')], pdfName(inv), { type: 'application/pdf' })];
    const extra = await invoiceReport(inv);
    if (extra) files.push(new File([extra.blob], reportFile(extra.rep), { type: 'application/pdf' }));
    await navigator.share({ files, title: $('#sdSubject').value, text: $('#sdBody').value });
    afterSend(inv);
    closeSheet($('#sendSheet'));
    if (inv.sentAt) toast(`Invoice ${inv.number} is marked as sent.`);
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    if (e && e.leakText) { toast(e.leakText); return; }
    console.error(e);
    toast("Couldn't share. Use Download PDF and Copy message instead.");
  }
}
async function sendGmail() {
  const inv = cur();
  if (!inv) return;
  const why = sendBlocked(inv);
  if (why) { toast(why); return; }
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
    const extra = await invoiceReport(inv);
    if (extra) download(extra.blob, reportFile(extra.rep));
  } catch (e) { if (e && e.leakText) { toast(e.leakText); return; } console.error(e); toast("Couldn't make the PDF. Use Download PDF to try again."); return; }
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
  for (const el of $$('[data-cf]')) {
    if (el.type === 'checkbox') el.checked = !!c[el.dataset.cf];
    else if (el.tagName !== 'SELECT') setVal(el.id, String(c[el.dataset.cf] ?? ''));
  }
  const st = clientStats(c.id);
  $('#clStats').textContent = st.rows.length
    ? [`${st.rows.length} invoice${st.rows.length === 1 ? '' : 's'}`, st.paid.length ? st.paid.map(([k, v]) => fmt(v, k)).join(' + ') + ' paid' : '', st.owed.length ? st.owed.map(([k, v]) => fmt(v, k)).join(' + ') + ' owed' : ''].filter(Boolean).join(' · ')
    : 'No invoices yet';
  const back = backInvoice();
  $('#clNewInv').textContent = back ? (back.clientId === c.id ? 'Back to the invoice' : 'Use on the invoice') : 'New invoice for this client';
  $('#clDelConfirm').hidden = true;
  $('#clDel').hidden = false;
  renderProjects();
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
  c[f] = f === 'dueDays' ? +t.value || 0 : t.type === 'checkbox' ? t.checked : t.value;
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

/* ------------------------------------------------------------------ projects, time and the team */

const projectList = () => Object.values(S.projects).map(p => ({ ...p, clientName: (S.clients[p.clientId] && (S.clients[p.clientId].name || S.clients[p.clientId].company)) || 'Removed client' }));
const activePartners = () => Object.values(S.partners).filter(p => p.active).sort((a, b) => byStr(a.name.toLowerCase(), b.name.toLowerCase()));
const cacheOf = id => (teamCache[id] = teamCache[id] || { log: TK.emptyLog(), at: 0, err: '', dirty: false });
// everyone's time as one list; who = 'me' or a partner's id
function allEntries() {
  const out = Object.values(S.log.entries).map(e => ({ ...e, who: 'me' }));
  for (const [pid, c] of Object.entries(teamCache)) for (const e of Object.values(c.log.entries)) out.push({ ...e, who: pid });
  return out;
}
const entryKey = e => (e.who === 'me' ? 'me:' + e.id : `p:${e.who}:${e.id}`);
const personName = who => (who === 'me' ? S.business.name || 'Me' : (S.partners[who] && S.partners[who].name) || 'Former partner');

// What a client may see of a time entry: never who did it. Client reports and invoices are built
// only from this, so a partner's name has no field to travel in.
const forClient = e => ({ date: e.date, minutes: e.minutes, start: e.start, end: e.end, note: e.note, projectId: e.projectId });

/* ---------- never a partner's name in front of a client ---------- */

function partnerTerms() {
  const t = new Set();
  for (const p of Object.values(S.partners)) {
    const full = p.name.trim();
    if (full.length >= 3) { t.add(full.toLowerCase()); for (const w of full.split(/\s+/)) if (w.length >= 3) t.add(w.toLowerCase()); }
    for (const n of p.nicknames.split(/[,;\n]+/)) if (n.trim().length >= 2) t.add(n.trim().toLowerCase());
  }
  // Jan's own name is his business: never a leak
  for (const w of (S.business.name || '').toLowerCase().split(/\s+/)) t.delete(w);
  t.delete((S.business.name || '').toLowerCase());
  return [...t];
}
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// [{ where, term }] for every text that names a partner
function findLeaks(texts) {
  const terms = partnerTerms();
  if (!terms.length) return [];
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${terms.map(escRe).join('|')})(?=$|[^\\p{L}\\p{N}])`, 'iu');
  const out = [];
  for (const x of texts) { const m = re.exec(String(x.text || '')); if (m) out.push({ ...x, term: m[2] }); }
  return out;
}
function leakMessage(leaks) {
  const first = leaks[0];
  return `"${first.term}" appears in ${first.where}${leaks.length > 1 ? ` and ${leaks.length - 1} more place${leaks.length > 2 ? 's' : ''}` : ''}. Clients must not see your partners' names, so fix the wording first.`;
}

/* ---------- the Time screen ---------- */

let timeView = null;
function initTime() {
  const partner = () => MODE === 'partner';
  timeView = TK.view({
    root: $('#timeRoot'),
    me: 'me',
    people: () => (partner() ? [] : activePartners().length || Object.keys(teamCache).length
      ? [{ id: 'me', name: 'Me', color: '#b8873a' }, ...Object.values(S.partners).filter(p => p.active || (teamCache[p.id] && Object.keys(teamCache[p.id].log.entries).length)).map(p => ({ id: p.id, name: p.name, color: p.color }))]
      : []),
    projects: () => (partner() ? partnerProjects() : projectList()),
    entries: () => (partner() ? Object.values(PS.log.entries).map(e => ({ ...e, who: 'me' })) : allEntries()),
    timer: () => (partner() ? PS.log.timer : S.log.timer),
    setTimer: t => {
      if (partner()) { PS.log.timer = TK.cleanTimer(t); save(); schedulePartnerSync(); return; }
      S.log.timer = TK.cleanTimer(t); save(); renderOverview();
    },
    save: (who, e) => {
      if (partner()) { PS.log.entries[e.id] = e; save(); schedulePartnerSync(); renderHours(); return; }
      if (who === 'me') S.log.entries[e.id] = e;
      else { const c = cacheOf(who); c.log.entries[e.id] = e; c.dirty = true; scheduleTeamSync(); }
      save();
      afterTimeChange();
    },
    remove: (who, id) => {
      const L = partner() ? PS.log : who === 'me' ? S.log : cacheOf(who).log;
      const old = L.entries[id];
      delete L.entries[id];
      L.deleted[id] = Math.max(Date.now(), old ? old.updatedAt : 0);
      if (partner()) { save(); schedulePartnerSync(); renderHours(); return; }
      if (who !== 'me') { cacheOf(who).dirty = true; scheduleTeamSync(); }
      save();
      afterTimeChange();
    },
    working: () => (partner() ? [] : activePartners()).filter(p => teamCache[p.id] && teamCache[p.id].log.timer.startedAt).map(p => {
      const t = teamCache[p.id].log.timer;
      const pr = projectList().find(x => x.id === t.projectId);
      return { name: p.name, project: pr ? `${pr.clientName} · ${pr.name}` : '', note: t.note, since: t.startedAt };
    }),
    emptyText: () => (!partner() ? (projectList().length ? 'No time this week yet.' : 'Add a project under Clients first, then start the timer.')
      : PS.ws.projects.length ? 'No time this week yet.' : 'No projects yet. Jan adds the ones you work on, and they show here.'),
    longHours: () => { const n = num(S.business.timerLong); return n > 0 && n <= 24 ? n : 6; },
    onChange: afterTimeChange,
  });
}
function afterTimeChange() {
  if (MODE === 'partner') return;
  refreshLinkedDrafts();
  if (payrollView && !$('#panel-payroll').hidden) payrollView.update();
  if (!$('#panel-overview').hidden) renderOverview();
  if (!$('#panel-reports').hidden) renderReport();
  if (!$('#panel-clients').hidden) renderClients();
  if (cur()) renderEditor();
}

/* ---------- the team: channels on the team GitHub account ---------- */

let teamRun = null, teamTimer = 0, teamQueued = false;
function scheduleTeamSync() { clearTimeout(teamTimer); teamTimer = setTimeout(() => syncTeam(), 2000); }
// the work a partner may see: their projects and those projects' clients, names only
function workspaceFor(p) {
  const projects = Object.values(S.projects).filter(x => x.assignees.includes(p.id));
  const clients = [...new Set(projects.map(x => x.clientId))].map(id => S.clients[id]).filter(Boolean).map(c => ({ id: c.id, name: c.name || c.company }));
  return TK.cleanWorkspace({ partner: { id: p.id, name: p.name }, clients, projects });
}
async function syncTeam() {
  if (!S.team.token || !GJCore.unlocked()) return;
  if (teamRun) { teamQueued = true; return teamRun; }
  teamRun = (async () => {
    let changed = false;
    for (const p of activePartners()) {
      if (!p.gistId || !p.key) continue;
      const c = cacheOf(p.id);
      try {
        const r = await TK.readChannel(S.team.token, p.gistId, p.key);
        if (!r.exists) { c.err = 'missing'; continue; }
        const before = JSON.stringify(TK.logDoc(c.log));
        const unreadable = r.entries && r.entries.unreadable;
        if (r.entries && !unreadable) TK.mergeLog(c.log, r.entries);
        const mine = TK.logDoc(c.log);
        if (JSON.stringify(mine) !== before) changed = true;
        const docs = {};
        // never write over entries that are locked with another key (a partner on an old invite)
        if (!unreadable && (!r.entries || JSON.stringify(mine) !== JSON.stringify(TK.normalizeLog(r.entries)))) docs.entries = mine;
        const ws = workspaceFor(p);
        if (!r.workspace || r.workspace.unreadable || JSON.stringify(ws) !== JSON.stringify(TK.cleanWorkspace(r.workspace))) docs.workspace = ws;
        if (Object.keys(docs).length) await TK.writeChannel(S.team.token, p.gistId, p.key, docs);
        c.at = Date.now();
        c.err = unreadable ? 'key' : '';
        c.dirty = false;
      } catch (e) { c.err = e && e.code ? e.code : 'error'; if (e && !e.code) console.error(e); }
    }
    save();
    if (changed) afterTimeChange();
    if (timeView && !$('#panel-time').hidden) timeView.render();
    renderTeam();
  })();
  try { await teamRun; } finally {
    teamRun = null;
    if (teamQueued) { teamQueued = false; syncTeam(); }
  }
}

/* ---------- invoices from tracked time ---------- */

// keys of entries already on another invoice (a void one frees its time again)
function billedKeys(exceptId) {
  const set = new Set();
  for (const inv of Object.values(S.invoices)) if (inv.id !== exceptId && !inv.voidAt) for (const k of inv.timeRefs) set.add(k);
  return set;
}
// the tracked time an invoice can bill: its client's billable projects, inside its work period
function timeFor(inv) {
  const projects = Object.values(S.projects).filter(p => p.clientId === inv.clientId && p.billable);
  if (!inv.clientId || !projects.length) return null;
  const ids = new Set(projects.map(p => p.id));
  const taken = billedKeys(inv.id);
  const list = allEntries().filter(e => ids.has(e.projectId) && (!inv.pStart || e.date >= inv.pStart) && (!inv.pEnd || e.date <= inv.pEnd) && !taken.has(entryKey(e)));
  const per = {};
  for (const e of list) per[e.projectId] = (per[e.projectId] || 0) + e.minutes;
  const client = S.clients[inv.clientId];
  const lines = projects.filter(p => per[p.id]).sort((a, b) => byStr(a.name.toLowerCase(), b.name.toLowerCase()) || byStr(a.id, b.id)).map(p => ({
    id: 'tl' + p.id.slice(-30), src: 'time:' + p.id,
    desc: `${p.name} - {hours} hours` + (inv.pStart && inv.pEnd ? ' for the period of {period}' : ''),
    qty: TK.fmtHM(per[p.id]), rate: p.rate.trim() || (client ? client.rate : ''),
  }));
  return { lines, refs: list.map(entryKey).sort(), minutes: list.reduce((t, e) => t + e.minutes, 0), projects: Object.keys(per).length, entries: list };
}
// put the time lines on the invoice (one per project), keeping lines typed by hand
function applyTime(inv, t) {
  // lines typed by hand stay; a blank starter line (perhaps holding only the client's usual rate or item) goes
  const client = S.clients[inv.clientId];
  const manual = inv.items.filter(i => !i.src && i.qty.trim() !== '' || (!i.src && i.desc.trim() && !(client && i.desc === client.item && !i.qty.trim())));
  const items = [...t.lines.map((l, i) => cleanItem(l, i)), ...manual];
  const next = { items: items.length ? items : [cleanItem({}, 0)], refs: t.refs };
  if (JSON.stringify(next.items) === JSON.stringify(inv.items) && JSON.stringify(next.refs) === JSON.stringify(inv.timeRefs)) return false;
  inv.items = next.items;
  inv.timeRefs = next.refs;
  return true;
}
function fillFromTime() {
  const inv = cur();
  if (!inv) return;
  const t = timeFor(inv);
  if (!t || !t.lines.length) { toast('No tracked time to bill for this client in this work period.'); return; }
  applyTime(inv, t);
  inv.timeLink = true;
  touch(inv);
  $('#edItems').dataset.key = '';
  renderEditor();
  toast(`Filled ${TK.fmtHM(t.minutes)} across ${t.projects} project${t.projects === 1 ? '' : 's'}. It stays in step with new time while this is a draft.`);
}
// drafts that follow tracked time pick up new and changed entries; sent invoices never change.
// Not stamped: an automatic refresh isn't an edit (each device works it out the same way), so it
// never wins over a real change made on another device, like sending it or a payment.
function refreshLinkedDrafts() {
  for (const inv of Object.values(S.invoices)) {
    if (!inv.timeLink || statusOf(inv) !== 'draft') continue;
    const t = timeFor(inv);
    if (t && applyTime(inv, t)) { save(); if (cur() === inv) { $('#edItems').dataset.key = ''; } }
  }
}
function renderEditorTime(inv) {
  const card = $('#edTimeCard');
  const t = timeFor(inv);
  card.hidden = !t;
  if (!t) return;
  const sent = !!inv.sentAt || inv.payments.length > 0;
  const period = inv.pStart && inv.pEnd ? periodText(parseIso(inv.pStart), parseIso(inv.pEnd)) : 'any date';
  $('#edTimeSum').textContent = t.minutes ? TK.fmtHM(t.minutes) : '';
  $('#edTimeText').textContent = sent
    ? (inv.timeRefs.length ? `This invoice billed ${inv.timeRefs.length} time entr${inv.timeRefs.length === 1 ? 'y' : 'ies'}. It no longer changes now it has gone out.` : 'Sent invoices keep their lines as they are.')
    : t.minutes ? `${TK.fmtHM(t.minutes)} tracked for ${period} across ${t.projects} project${t.projects === 1 ? '' : 's'}, not on any other invoice.` : `No unbilled time for ${period} yet.`;
  $('#edTimeFill').hidden = sent;
  $('#edTimeLinkWrap').hidden = sent;
  $('#edTimeLink').checked = inv.timeLink;
}

/* ---------- reports ---------- */

const R = { mode: 'client', clientId: '', preset: 'this-half', from: '', to: '', who: 'all' };
function presetRange(k) {
  const t = today(), y = t.getFullYear(), m = t.getMonth(), d = t.getDate();
  const half = dt => (dt.getDate() <= 15 ? [new Date(dt.getFullYear(), dt.getMonth(), 1), new Date(dt.getFullYear(), dt.getMonth(), 15)] : [new Date(dt.getFullYear(), dt.getMonth(), 16), new Date(dt.getFullYear(), dt.getMonth() + 1, 0)]);
  if (k === 'this-half') return half(t);
  if (k === 'last-half') return half(d <= 15 ? new Date(y, m, 0) : new Date(y, m, 1));
  if (k === 'this-month') return [new Date(y, m, 1), new Date(y, m + 1, 0)];
  if (k === 'last-month') return [new Date(y, m - 1, 1), new Date(y, m, 0)];
  if (k === 'this-week') { const s = TK.weekStart(t); return [s, addDays(s, 6)]; }
  if (k === 'last-week') { const s = addDays(TK.weekStart(t), -7); return [s, addDays(s, 6)]; }
  return [parseIso(R.from) || addDays(t, -13), parseIso(R.to) || t];
}
function reportRange() { const [a, b] = presetRange(R.preset); return [iso(a), iso(b)]; }
const tally = (list, keyOf, nameOf) => {
  const m = {};
  for (const e of list) { const k = keyOf(e); (m[k] = m[k] || { key: k, name: nameOf(e), minutes: 0 }).minutes += e.minutes; }
  return Object.values(m).sort((a, b) => b.minutes - a.minutes || byStr(a.name, b.name));
};
function perDay(list, from, to) {
  const out = [];
  for (let d = parseIso(from); d <= parseIso(to) && out.length < 62; d = addDays(d, 1)) out.push({ date: iso(d), minutes: list.filter(e => e.date === iso(d)).reduce((t, e) => t + e.minutes, 0) });
  return out;
}
// What a client report holds. Built only from forClient(), so there is no field for who did the work.
function clientReport(clientId, from, to, onlyKeys) {
  const client = S.clients[clientId];
  const projects = Object.fromEntries(Object.values(S.projects).filter(p => p.clientId === clientId).map(p => [p.id, p]));
  const raw = allEntries().filter(e => projects[e.projectId] && (onlyKeys ? onlyKeys.has(entryKey(e)) : e.date >= from && e.date <= to && projects[e.projectId].billable));
  const entries = hideOverlaps(raw.map(forClient).map(e => ({ ...e, project: projects[e.projectId].name }))
    .sort((a, b) => byStr(a.date, b.date) || byStr(a.start || '99', b.start || '99') || byStr(a.project, b.project)));
  if (onlyKeys && entries.length) { from = entries[0].date; to = entries[entries.length - 1].date; }
  return {
    client: client ? { name: client.name, company: client.company } : { name: 'Client', company: '' },
    from, to, period: periodText(parseIso(from), parseIso(to)),
    total: entries.reduce((t, e) => t + e.minutes, 0),
    days: new Set(entries.map(e => e.date)).size,
    byProject: tally(entries, e => e.projectId, e => e.project),
    byTask: tally(entries.filter(e => e.note.trim()), e => e.note.trim().toLowerCase(), e => e.note.trim()),
    perDay: perDay(entries, from, to),
    entries,
  };
}
// Times that overlap on one day would show the client that more than one person worked: such a day
// is reported in hours only, without start and end times.
function hideOverlaps(entries) {
  const byDay = {};
  for (const e of entries) (byDay[e.date] = byDay[e.date] || []).push(e);
  const mins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  for (const list of Object.values(byDay)) {
    const spans = list.filter(e => e.start && e.end).map(e => { const a = mins(e.start), b = mins(e.end); return [a, b <= a ? b + 1440 : b]; }).sort((x, y) => x[0] - y[0]);
    let end = -1, clash = false;
    for (const [a, b] of spans) { if (a < end) clash = true; end = Math.max(end, b); }
    if (clash) for (const e of list) { e.start = ''; e.end = ''; }
  }
  return entries;
}
function clientReportLeaks(rep) {
  return findLeaks([
    ...rep.entries.map(e => ({ where: `the ${TK.dayLabel(parseIso(e.date))} entry on ${e.project}`, text: e.note })),
    ...rep.byProject.map(p => ({ where: `the project name "${p.name}"`, text: p.name })),
  ]);
}
// The internal report: everyone's time, with the signals that show how it was logged
function teamReport(from, to, who) {
  const people = ['me', ...Object.keys(S.partners)].filter(id => who === 'all' || id === who);
  const projects = Object.fromEntries(projectList().map(p => [p.id, p]));
  const list = allEntries().filter(e => e.date >= from && e.date <= to);
  return {
    from, to, period: periodText(parseIso(from), parseIso(to)),
    people: people.map(id => {
      const es = list.filter(e => e.who === id).map(e => ({ ...e, client: projects[e.projectId] ? projects[e.projectId].clientName : 'Removed', project: projects[e.projectId] ? projects[e.projectId].name : 'Removed project' }))
        .sort((a, b) => byStr(a.date, b.date) || byStr(a.start || '99', b.start || '99'));
      const total = es.reduce((t, e) => t + e.minutes, 0);
      const timed = es.filter(e => e.source === 'timer').reduce((t, e) => t + e.minutes, 0);
      return {
        id, name: personName(id), total, timed, typed: total - timed, edited: es.filter(e => e.edited).length,
        days: new Set(es.map(e => e.date)).size, noNote: es.filter(e => !e.note.trim()).length,
        byWork: tally(es, e => e.projectId, e => `${e.client} · ${e.project}`),
        perDay: perDay(es, from, to), entries: es,
      };
    }).filter(p => p.total || p.id === 'me' || (S.partners[p.id] && S.partners[p.id].active)),
  };
}

function barRows(rows, total) {
  const max = Math.max(...rows.map(r => r.minutes), 1);
  return rows.map(r => `<tr><td>${esc(r.name)}</td><td class="bar-cell"><span class="sbar"><span style="width:${Math.max(2, Math.round(r.minutes / max * 100))}%"></span></span></td><td class="r mono">${TK.fmtLong(r.minutes)}</td><td class="r muted small">${total ? Math.round(r.minutes / total * 100) : 0}%</td></tr>`).join('');
}
function dayBars(days) {
  const max = Math.max(...days.map(d => d.minutes), 60);
  const peak = days.reduce((b, d, i) => (d.minutes > days[b].minutes ? i : b), 0);
  return `<div class="rbars" role="img" aria-label="Hours per day">${days.map((d, i) => {
    const dt = parseIso(d.date);
    return `<div class="wkcol" tabindex="0" data-tip="${esc(TK.dayLabel(dt))} · ${TK.fmtHM(d.minutes)}"><div class="wkplot">${i === peak && d.minutes ? `<span class="wkval">${TK.fmtHM(d.minutes)}</span>` : ''}<div class="wkbar" style="height:${d.minutes ? Math.max(2, Math.round(d.minutes / max * 100)) : 0}%"></div></div><div class="wkday">${days.length <= 16 ? `${['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][dt.getDay()]}<br>` : ''}<span>${dt.getDate()}</span></div></div>`;
  }).join('')}</div>`;
}
function renderReport() {
  if (!$('#rpOut')) return;
  for (const b of $$('[data-rmode]')) b.setAttribute('aria-pressed', String(b.dataset.rmode === R.mode));
  const clients = Object.values(S.clients).filter(c => Object.values(S.projects).some(p => p.clientId === c.id)).sort((a, b) => byStr((a.name || a.company).toLowerCase(), (b.name || b.company).toLowerCase()));
  if (!S.clients[R.clientId] && clients[0]) R.clientId = clients[0].id;
  fillSelect($('#rpClient'), clients.map(c => [c.id, c.name || c.company]), R.clientId);
  const ppl = [['all', 'Everyone'], ['me', 'Me'], ...Object.values(S.partners).map(p => [p.id, p.name + (p.active ? '' : ' (former)')])];
  fillSelect($('#rpWho'), ppl, R.who);
  $('#rpClientWrap').hidden = R.mode !== 'client';
  $('#rpWhoWrap').hidden = R.mode !== 'team';
  $('#rpPreset').value = R.preset;
  const [from, to] = reportRange();
  $('#rpCustom').hidden = R.preset !== 'custom';
  setVal('rpFrom', from); setVal('rpTo', to);
  $('#rpInvoice').hidden = R.mode !== 'client';
  $('#rpEmail').hidden = R.mode !== 'client';
  $('#rpInternal').hidden = R.mode !== 'team';
  const out = $('#rpOut');
  if (R.mode === 'client') {
    if (!clients.length) { out.innerHTML = '<div class="inv-empty">Add a project to a client (under Clients) and track some time, then the client report shows here.</div>'; return; }
    const rep = clientReport(R.clientId, from, to);
    const leaks = clientReportLeaks(rep);
    out.innerHTML = `
      ${leaks.length ? `<div class="card leak"><b>Fix before sending:</b> ${esc(leakMessage(leaks))}<ul>${leaks.slice(0, 6).map(l => `<li>${esc(l.where)}</li>`).join('')}</ul></div>` : ''}
      <div class="r-hero card"><div><span class="eyebrow">Total time</span><div class="big">${TK.fmtLong(rep.total)}</div><div class="muted small">${esc(rep.client.name || rep.client.company)} · ${esc(rep.period)} · ${rep.days} day${rep.days === 1 ? '' : 's'} worked</div></div>${dayBars(rep.perDay)}</div>
      <div class="r-grid">
        <section class="card"><h3>By project</h3><table class="rtable">${barRows(rep.byProject, rep.total) || '<tr><td class="muted">No time in this period</td></tr>'}</table></section>
        <section class="card"><h3>By task</h3><table class="rtable">${barRows(rep.byTask.slice(0, 8), rep.total) || '<tr><td class="muted">No descriptions yet</td></tr>'}</table>${rep.byTask.length > 8 ? `<p class="muted small">and ${rep.byTask.length - 8} more</p>` : ''}</section>
      </div>
      <section class="card"><h3>Timesheet</h3><div class="table-wrap"><table class="rtable sheet-t"><thead><tr><th>Date</th><th>Time</th><th>Project</th><th>Work done</th><th class="r">Hours</th></tr></thead><tbody>${rep.entries.map(e => `<tr><td>${esc(shortDate(parseIso(e.date)))}</td><td class="muted small">${e.start && e.end ? `${esc(TK.clock12(e.start))} - ${esc(TK.clock12(e.end))}` : ''}</td><td>${esc(e.project)}</td><td>${esc(e.note)}</td><td class="r mono">${TK.fmtHM(e.minutes)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No time in this period</td></tr>'}</tbody></table></div></section>`;
  } else {
    const rep = teamReport(from, to, R.who);
    out.innerHTML = `<p class="note">Internal only. This report shows who did the work, so it never goes to a client.</p>` + rep.people.map(p => `
      <section class="card r-person">
        <div class="card-hd"><h3>${esc(p.name)}</h3><span class="big mono">${TK.fmtHM(p.total)}</span></div>
        <div class="r-stats">
          <span><b>${p.days}</b> day${p.days === 1 ? '' : 's'} worked</span>
          <span><b>${p.total ? Math.round(p.timed / p.total * 100) : 0}%</b> from the live timer</span>
          <span><b>${TK.fmtHM(p.typed)}</b> typed in afterwards</span>
          <span><b>${p.edited}</b> timed entr${p.edited === 1 ? 'y' : 'ies'} edited</span>
          <span><b>${p.noNote}</b> without a description</span>
        </div>
        ${p.total ? dayBars(p.perDay) : ''}
        <table class="rtable">${barRows(p.byWork, p.total) || '<tr><td class="muted">No time in this period</td></tr>'}</table>
        ${p.entries.length ? `<details><summary>All ${p.entries.length} entries</summary><div class="table-wrap"><table class="rtable sheet-t"><thead><tr><th>Date</th><th>Time</th><th>Client · project</th><th>Work done</th><th class="r">Hours</th></tr></thead><tbody>${p.entries.map(e => `<tr><td>${esc(shortDate(parseIso(e.date)))}</td><td class="muted small">${e.start && e.end ? `${esc(TK.clock12(e.start))} - ${esc(TK.clock12(e.end))}` : 'typed'}${e.edited ? ' · edited' : ''}</td><td>${esc(e.client)} · ${esc(e.project)}</td><td>${esc(e.note)}</td><td class="r mono">${TK.fmtHM(e.minutes)}</td></tr>`).join('')}</tbody></table></div></details>` : ''}
      </section>`).join('');
  }
}
const reportFile = rep => `Time-report-${fileSafe(rep.client.name || rep.client.company || 'client')}-${rep.from}-to-${rep.to}.pdf`;
async function clientReportPdf(rep) {
  const kit = await pdfKit();
  return kit.timeReport({ business: { name: S.business.name.trim() || 'Genest Jan Ramirez', tagline: 'Connect, Engage, Succeed', email: S.business.email.trim(), website: S.business.website.trim() }, ...rep });
}
async function reportPdf() {
  const [from, to] = reportRange();
  try {
    if (R.mode === 'client') {
      const rep = clientReport(R.clientId, from, to);
      const leaks = clientReportLeaks(rep);
      if (leaks.length) { toast(leakMessage(leaks)); return; }
      if (!rep.entries.length) { toast('There is no time in this period.'); return; }
      download((await clientReportPdf(rep)).output('blob'), reportFile(rep));
      toast('Saved ' + reportFile(rep));
    } else {
      const kit = await pdfKit();
      const rep = teamReport(from, to, R.who);
      const doc = await kit.teamReport({ business: { name: S.business.name.trim() || 'Genest Jan Ramirez', tagline: 'Connect, Engage, Succeed' }, ...rep });
      const name = `Team-report-INTERNAL-${from}-to-${to}.pdf`;
      download(doc.output('blob'), name);
      toast('Saved ' + name + '. Internal only: never send it to a client.');
    }
  } catch (e) { console.error(e); toast("Couldn't make the PDF. Check your connection and try again."); }
}
async function reportEmail() {
  const [from, to] = reportRange();
  const rep = clientReport(R.clientId, from, to);
  const leaks = clientReportLeaks(rep);
  if (leaks.length) { toast(leakMessage(leaks)); return; }
  if (!rep.entries.length) { toast('There is no time in this period.'); return; }
  const c = S.clients[R.clientId];
  const subject = `Time report for ${rep.period}`;
  const body = `Hi ${((c && (c.name || c.company)) || 'there').trim().split(/\s+/)[0]},\n\nHere is the time report for ${rep.period}: ${TK.fmtLong(rep.total)} in total. The PDF is attached.\n\nThank you!\n${S.business.name}`;
  try {
    const doc = await clientReportPdf(rep);
    const blob = doc.output('blob');
    if (canShareFiles()) {
      try { await navigator.share({ files: [new File([blob], reportFile(rep), { type: 'application/pdf' })], title: subject, text: body }); } catch (e) { if (e && e.name !== 'AbortError') toast("Couldn't share. Use Download PDF instead."); }
      return;
    }
    const q = new URLSearchParams({ view: 'cm', fs: '1', to: c ? c.email : '', su: subject, body });
    window.open('https://mail.google.com/mail/?' + q.toString(), '_blank', 'noopener');
    download(blob, reportFile(rep));
    toast("The PDF downloaded and Gmail opened in a new tab. Drag the PDF into the email. If Gmail didn't open, use Download PDF.");
  } catch (e) { console.error(e); toast("Couldn't make the PDF. Check your connection and try again."); }
}
function reportInvoice() {
  const [from, to] = reportRange();
  const c = S.clients[R.clientId];
  if (!c) return;
  newInvoice(c.id);
  const inv = cur();
  inv.pStart = from; inv.pEnd = to;
  const t = timeFor(inv);
  if (!t || !t.lines.length) { renderEditor(); toast('All the time in this period is already on an invoice, or none is billable.'); return; }
  applyTime(inv, t);
  inv.timeLink = true;
  touch(inv);
  $('#edItems').dataset.key = '';
  renderEditor();
  toast(`Invoice filled with ${TK.fmtHM(t.minutes)} for ${periodText(parseIso(from), parseIso(to))}.`);
}

/* ---------- overview: working now, ready to invoice ---------- */

function readyToInvoice() {
  const taken = billedKeys('');
  const out = [];
  for (const c of Object.values(S.clients)) {
    const ids = new Set(Object.values(S.projects).filter(p => p.clientId === c.id && p.billable).map(p => p.id));
    if (!ids.size) continue;
    const list = allEntries().filter(e => ids.has(e.projectId) && !taken.has(entryKey(e)));
    if (!list.length) continue;
    const dates = list.map(e => e.date).sort();
    out.push({ client: c, minutes: list.reduce((t, e) => t + e.minutes, 0), from: dates[0], to: dates[dates.length - 1] });
  }
  return out.sort((a, b) => b.minutes - a.minutes);
}
function renderWorkCards() {
  const box = $('#workCards');
  if (!box) return;
  const running = [];
  if (S.log.timer.startedAt) running.push({ name: 'You', t: S.log.timer });
  for (const p of activePartners()) if (teamCache[p.id] && teamCache[p.id].log.timer.startedAt) running.push({ name: p.name, t: teamCache[p.id].log.timer });
  const ready = readyToInvoice();
  const projName = id => { const p = projectList().find(x => x.id === id); return p ? `${p.clientName} · ${p.name}` : ''; };
  box.hidden = !running.length && !ready.length;
  box.innerHTML = (running.length ? `<section class="card"><div class="card-hd"><h2>Working now</h2></div>${running.map(r => `<div class="wnow"><span class="live" aria-hidden="true"></span><b>${esc(r.name)}</b> ${esc(projName(r.t.projectId))}${r.t.note ? ` · ${esc(r.t.note)}` : ''} <span class="mono muted">${TK.fmtHM((Date.now() - r.t.startedAt) / 60000)}</span></div>`).join('')}</section>` : '') +
    (ready.length ? `<section class="card"><div class="card-hd"><h2>Ready to invoice</h2><span class="muted small">Tracked time not on an invoice yet</span></div>${ready.map(r => {
      const amt = round2(TK.decimal(r.minutes) * (num(r.client.rate) || 0));
      return `<div class="ready-row"><div><b>${esc(r.client.name || r.client.company)}</b><div class="muted small">${TK.fmtHM(r.minutes)} · ${esc(periodText(parseIso(r.from), parseIso(r.to)))}${amt ? ` · about ${esc(fmt(amt, r.client.currency))}` : ''}</div></div><button class="btn btn-sm gold" type="button" data-bill="${esc(r.client.id)}|${esc(r.from)}|${esc(r.to)}">Create invoice</button></div>`;
    }).join('')}</section>` : '');
}
function billFromOverview(clientId, from, to) {
  const c = S.clients[clientId];
  if (!c) return;
  // the half-month (or other period) the time falls in, when it all fits; else exactly the dates tracked
  const [ps, pe] = defaultPeriod(today());
  const inside = from >= iso(ps) && to <= iso(pe);
  newInvoice(c.id);
  const inv = cur();
  inv.pStart = inside ? iso(ps) : from;
  inv.pEnd = inside ? iso(pe) : to;
  const t = timeFor(inv);
  if (t && t.lines.length) { applyTime(inv, t); inv.timeLink = true; touch(inv); }
  $('#edItems').dataset.key = '';
  renderEditor();
}

/* ---------- projects (in the client editor) ---------- */

function renderProjects() {
  const c = curClient();
  const box = $('#clProjects');
  if (!box || !c) return;
  $('#clProjectsCard').hidden = !S.clients[c.id];
  const ps = Object.values(S.projects).filter(p => p.clientId === c.id).sort((a, b) => (a.archived - b.archived) || (a.createdAt - b.createdAt) || byStr(a.id, b.id));
  const partners = activePartners();
  const minutesOf = id => allEntries().filter(e => e.projectId === id).reduce((t, e) => t + e.minutes, 0);
  box.innerHTML = ps.length ? ps.map(p => `
    <div class="proj-row${p.archived ? ' archived' : ''}" data-proj="${esc(p.id)}">
      <button class="pdot" type="button" data-pact="color" style="background:${esc(p.color)}" title="Change colour" aria-label="Change colour"></button>
      <input class="in" data-pf="name" value="${esc(p.name)}" placeholder="Project name" aria-label="Project name" autocomplete="off">
      <input class="in mono" data-pf="rate" value="${esc(p.rate)}" placeholder="${esc(c.rate || 'Rate')}" aria-label="Rate for this project (blank uses the client's)" inputmode="decimal" autocomplete="off">
      <label class="check check-sm"><input type="checkbox" data-pf="billable"${p.billable ? ' checked' : ''}> Billable</label>
      <span class="muted small mono">${TK.fmtHM(minutesOf(p.id))}</span>
      <button class="link small" type="button" data-pact="archive">${p.archived ? 'Restore' : 'Archive'}</button>
      ${partners.length ? `<div class="assign" role="group" aria-label="Who works on it"><span class="muted small">Who works on it:</span>${partners.map(t => `<button class="fchip" type="button" data-assign="${esc(t.id)}" aria-pressed="${p.assignees.includes(t.id)}">${esc(t.name)}</button>`).join('')}</div>` : ''}
    </div>`).join('') : '<p class="muted small">No projects yet. Add one for each kind of work, for example "Social media" or "Video editing".</p>';
}
function addProject() {
  const c = S.clients[UI.clId];
  if (!c) { toast("Type the client's name first."); return; }
  const now = Date.now();
  const used = new Set(Object.values(S.projects).filter(p => p.clientId === c.id).map(p => p.color));
  const p = cleanProject({ id: TK.uid('j'), clientId: c.id, name: '', color: TK.COLORS.find(x => !used.has(x)) || TK.COLORS[0], billable: true, createdAt: now, updatedAt: now });
  S.projects[p.id] = p;
  save();
  renderProjects();
  setTimeout(() => { const el = $(`[data-proj="${CSS.escape(p.id)}"] [data-pf="name"]`); if (el) el.focus(); }, 20);
}
function projectEvent(e) {
  const row = e.target.closest('[data-proj]');
  if (!row) return;
  const p = S.projects[row.dataset.proj];
  if (!p) return;
  const t = e.target;
  if (e.type === 'input' && t.dataset.pf) {
    if (t.dataset.pf === 'billable') p.billable = t.checked;
    else p[t.dataset.pf] = t.value;
  } else if (e.type === 'click') {
    const a = t.closest('[data-pact]');
    const as = t.closest('[data-assign]');
    if (a && a.dataset.pact === 'color') { p.color = TK.COLORS[(TK.COLORS.indexOf(p.color) + 1) % TK.COLORS.length]; a.style.background = p.color; }
    else if (a && a.dataset.pact === 'archive') p.archived = !p.archived;
    else if (as) { const id = as.dataset.assign; p.assignees = p.assignees.includes(id) ? p.assignees.filter(x => x !== id) : [...p.assignees, id].sort(); as.setAttribute('aria-pressed', String(p.assignees.includes(id))); scheduleTeamSync(); }
    else return;
    if (a && a.dataset.pact === 'archive') setTimeout(renderProjects, 0);
  } else return;
  Object.assign(p, cleanProject(p));
  p.updatedAt = stamp(p);
  save();
  if (e.type === 'input' && t.dataset.pf === 'name') scheduleTeamSync();
  if (e.type === 'input' && t.dataset.pf === 'billable') afterTimeChange();
}

/* ---------- team settings ---------- */

function renderTeam() {
  if (!$('#teamCard') || MODE !== 'owner') return;
  const on = !!S.team.token;
  $('#teamOff').hidden = on;
  $('#teamOn').hidden = !on;
  const n = activePartners().length;
  $('#teamChip').textContent = `${n} partner${n === 1 ? '' : 's'}`;
  $('#teamChip').className = 'chip' + (n ? ' ok' : '');
  $('#teamAccount').textContent = S.team.login ? `Partner logins use the team GitHub account ${S.team.login}.` : 'Team GitHub account connected.';
  const list = Object.values(S.partners).sort((a, b) => (b.active - a.active) || byStr(a.name.toLowerCase(), b.name.toLowerCase()));
  const state = p => {
    const c = teamCache[p.id];
    if (!p.active) return ['Removed', ''];
    if (!p.gistId) return ['No login yet', ''];
    if (!c || !c.at) return [c && c.err ? 'Sync problem' : 'Invited, not synced yet', c && c.err ? 'warn' : ''];
    if (c.err === 'key') return ['On an old invite: send a new one', 'warn'];
    if (c.err) return ['Sync problem', 'warn'];
    const n = Object.keys(c.log.entries).length;
    return [`Synced ${GJCore.ago(c.at)} · ${n} entr${n === 1 ? 'y' : 'ies'}`, 'ok'];
  };
  $('#partnerList').innerHTML = list.length ? list.map(p => {
    const [label, tone] = state(p);
    return `<div class="set-row partner-row" data-partner="${esc(p.id)}">
      <div class="fields two">
        <div class="field"><label>Name</label><input class="in" data-tf="name" value="${esc(p.name)}" autocomplete="off"${p.active ? '' : ' disabled'}></div>
        <div class="field"><label>Other names to keep out of client reports</label><input class="in" data-tf="nicknames" value="${esc(p.nicknames)}" placeholder="Nicknames, comma between" autocomplete="off"></div>
      </div>
      <div class="row-ft"><span class="chip ${tone}">${esc(label)}</span>
        <span class="inline-field">${p.active ? `<button class="btn btn-sm" type="button" data-tact="invite">Invite link</button><button class="link small" type="button" data-tact="remove">Remove</button>` : `<button class="btn btn-sm" type="button" data-tact="readd">Invite again</button>`}</span></div>
      <div class="confirm" data-tconfirm hidden><span>Remove ${esc(p.name)}? They lose access; their past time stays in your reports.</span><button class="btn btn-sm" type="button" data-tact="removeYes">Yes, remove</button><button class="link" type="button" data-tact="removeNo">Cancel</button></div>
    </div>`;
  }).join('') : '<p class="muted small">No partners yet.</p>';
}
async function connectTeam() {
  const token = $('#teamToken').value.trim();
  if (!/^(gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})$/.test(token)) { toast("That doesn't look like a GitHub token. It starts with ghp_."); return; }
  let me = null;
  try { me = await GJCore.github(token, '/user'); } catch (e) { toast(e && e.code === 'offline' ? "Couldn't reach GitHub. Try again." : "GitHub didn't accept that token."); return; }
  if (!me || !me.login) { toast("GitHub didn't accept that token."); return; }
  // the whole point of the team account is that partners never hold the key to Jan's own gists:
  // refused when it's the account this device syncs with, or one holding Work Hub's or Payroll's sync
  const own = `That token is for your own GitHub account (${me.login}). Use the separate team account, so partners can never reach your invoices.`;
  const mine = GJCore.syncInfo().login;
  if (mine && mine.toLowerCase() === String(me.login).toLowerCase()) { toast(own); return; }
  let gists = null;
  try { gists = await GJCore.github(token, '/gists?per_page=100'); } catch (e) { toast("Couldn't reach GitHub. Try again."); return; }
  const SYNC_FILES = ['genestjan-invoices-sync.json', 'partner-payroll-sync.json'];
  if (Array.isArray(gists) && gists.some(g => g && g.files && SYNC_FILES.some(f => g.files[f]))) { toast(own); return; }
  // channels made on another account can't be written with this token: those partners get new ones with their next invite
  let moved = 0;
  for (const p of Object.values(S.partners)) {
    if (!p.gistId) continue;
    let owner = '';
    try { const g = await GJCore.github(token, '/gists/' + p.gistId); owner = g && g.owner ? String(g.owner.login || '') : ''; } catch (e) { owner = '?'; }
    if (owner !== '?' && owner.toLowerCase() !== String(me.login).toLowerCase()) { p.gistId = ''; p.key = ''; p.updatedAt = stamp(p); moved++; }
  }
  S.team = cleanTeam({ token, login: me.login, updatedAt: stamp(S.team) });
  $('#teamToken').value = '';
  save();
  renderTeam();
  toast(moved ? `Team sync is on with ${me.login}. Send ${moved === 1 ? 'your partner' : 'your partners'} a new invite link (Invite link below).` : `Team sync is on with the GitHub account ${me.login}. Now add your partners.`);
}
function addPartner() {
  const name = $('#partnerName').value.trim();
  if (!name) { toast("Type the partner's name."); $('#partnerName').focus(); return; }
  const now = Date.now();
  const used = new Set(Object.values(S.partners).map(p => p.color));
  const p = cleanPartner({ id: TK.uid('pt'), name, color: TK.COLORS.slice(1).find(x => !used.has(x)) || TK.COLORS[1], active: true, createdAt: now, updatedAt: now });
  S.partners[p.id] = p;
  $('#partnerName').value = '';
  save();
  renderTeam();
  if (S.team.token) openInvite(p.id); // their login straight away
  else toast(`${name} added for payroll. To give them a login for tracking time, connect the team account below.`);
}
// their team channel (a secret gist on the team account, sealed with a key only Jan and they have)
async function ensureChannel(p) {
  if (p.gistId && p.key) return true;
  if (!S.team.token) { toast('Connect the team GitHub account first (below), then the invite can be made.'); return false; }
  let key = '', gistId = '';
  try {
    key = GJCore.newRawKey();
    gistId = await TK.createChannel(S.team.token, key, workspaceFor(p));
  } catch (e) { console.error(e); toast("Couldn't reach the team GitHub account. Check your connection and try again."); return false; }
  // a sync while it was being made may have changed the partner: another device's channel wins
  const now = S.partners[p.id];
  if (!now || !now.active || (now.gistId && now.key)) {
    try { await TK.deleteChannel(S.team.token, gistId); } catch (e) { /* an empty spare channel */ }
    return !!(now && now.active);
  }
  now.key = key; now.gistId = gistId;
  now.updatedAt = stamp(now);
  save();
  renderTeam();
  return true;
}
async function openInvite(id) {
  if (!S.partners[id] || !(await ensureChannel(S.partners[id]))) return;
  const p = S.partners[id];
  const code = GJCore.randomCode(12).replace(/(.{4})(.{4})(.{4})/, '$1-$2-$3');
  const box = await GJCore.sealWithPassword(code, JSON.stringify({ s: { kind: 'team-invite', partnerId: p.id, name: p.name, key: p.key, token: S.team.token, gistId: p.gistId }, sync: null }));
  const link = new URL('./', location.href.split('#')[0]).href + '#setup=' + GJCore.b64url(JSON.stringify(box));
  const first = p.name.split(/\s+/)[0];
  $('#ivTitle').textContent = `Invite ${p.name}`;
  $('#ivLink').value = link;
  $('#ivCode').textContent = code;
  $('#ivMsg').value = `Hi ${first}! Here is your link to Work Hub, where you'll log your hours:\n${link}\n\nOpen it in Chrome, type the invite code I'll send you separately, then choose your own password. Install it from Chrome's menu so it's on your home screen.`;
  openSheet('#inviteSheet', '#ivCopyMsg');
}
async function partnerEvent(e) {
  const row = e.target.closest('[data-partner]');
  if (!row) return;
  const p = S.partners[row.dataset.partner];
  if (!p) return;
  const t = e.target;
  if (e.type === 'input' && t.dataset.tf) {
    p[t.dataset.tf] = t.value;
    Object.assign(p, cleanPartner(p));
    p.updatedAt = stamp(p);
    save();
    if (t.dataset.tf === 'name') scheduleTeamSync();
    return;
  }
  const a = t.closest('[data-tact]');
  if (!a) return;
  const act = a.dataset.tact;
  if (act === 'invite') openInvite(p.id);
  if (act === 'remove') row.querySelector('[data-tconfirm]').hidden = false;
  if (act === 'removeNo') row.querySelector('[data-tconfirm]').hidden = true;
  if (act === 'removeYes') {
    // their channel goes, so the old invite and key stop working; their time stays in Jan's reports
    if (p.gistId && p.key) { // their latest time first: after this it lives only in Jan's own data
      try { const r = await TK.readChannel(S.team.token, p.gistId, p.key); if (r.entries && !r.entries.unreadable) TK.mergeLog(cacheOf(p.id).log, r.entries); } catch (err) { /* what this device has stays */ }
    }
    // the channel goes first: if it can't (offline), they'd go on logging time that never reaches Jan
    try { if (p.gistId) await TK.deleteChannel(S.team.token, p.gistId); } catch (err) {
      // (a revoked team token can't reach it either, so removing goes ahead then)
      if (err && ['offline', 'busy', 'error'].includes(err.code)) { toast(`Couldn't reach the team account, so ${p.name} isn't removed yet. Try again when you're online.`); row.querySelector('[data-tconfirm]').hidden = true; return; }
    }
    p.active = false; p.gistId = ''; p.key = ''; p.updatedAt = stamp(p);
    for (const pr of Object.values(S.projects)) if (pr.assignees.includes(p.id)) { pr.assignees = pr.assignees.filter(x => x !== p.id); pr.updatedAt = stamp(pr); }
    save();
    renderTeam();
    toast(`${p.name} is removed and their channel deleted. They still know the team token: if that matters, make a new one, connect it, and invite the others again.`);
  }
  if (act === 'readd') {
    p.active = true;
    p.key = ''; p.gistId = '';
    p.updatedAt = stamp(p);
    save();
    renderTeam();
    if (S.team.token) openInvite(p.id);
  }
}

/* ------------------------------------------------------------------ payroll (owner) */

let payrollView = null;
let blankPayroll = null;
// who gets paid, and the clients with a partner rate or commission, in the shape the payroll sums use
const payrollPartners = () => activePartners().map(p => ({ id: p.id, name: p.name }));
const payrollClients = () => Object.values(S.clients)
  .filter(c => num(c.payRate) > 0 || c.commission)
  .sort((a, b) => byStr((a.name || a.company).toLowerCase(), (b.name || b.company).toLowerCase()))
  .map(c => ({ id: c.id, name: c.name || c.company, about: c.about, currency: PK.CODES.includes(c.currency) ? c.currency : 'USD', rate: num(c.payRate) > 0 ? num(c.payRate) : 0, commission: c.commission }));
// each partner's tracked minutes per client in a pay period: { 'partner|client': minutes }
function trackedHours(from, to) {
  const out = {};
  const clientOf = Object.fromEntries(Object.values(S.projects).map(p => [p.id, p.clientId]));
  for (const p of activePartners()) {
    const c = teamCache[p.id];
    if (!c) continue;
    for (const e of Object.values(c.log.entries)) {
      if (e.date < from || e.date > to || !clientOf[e.projectId]) continue;
      const k = p.id + '|' + clientOf[e.projectId];
      out[k] = (out[k] || 0) + e.minutes;
    }
  }
  return out;
}
async function deliver(doc, filename, how) {
  const blob = doc.output('blob');
  if (how === 'share') {
    try { await navigator.share({ files: [new File([blob], filename, { type: 'application/pdf' })], title: filename }); }
    catch (e) { if (e && e.name !== 'AbortError') toast("Couldn't share. Use Download PDF instead."); }
    return;
  }
  download(blob, filename);
  toast('Saved ' + filename);
}
async function payslipKit() {
  if (!window.jspdf) await loadScript('vendor/jspdf.umd.min.js');
  if (!window.PayrollPDF) await loadScript('payslip.js');
  return window.PayrollPDF;
}
function initPayroll() {
  payrollView = PK.mount({
    root: $('#payrollRoot'),
    state: () => S.payroll || (blankPayroll = blankPayroll || PK.blankPayroll()),
    change: fn => {
      if (!S.payroll) S.payroll = blankPayroll || PK.blankPayroll();
      const P = S.payroll;
      const before = PK.PARTS.map(k => JSON.stringify(P[k]));
      fn(P);
      PK.PARTS.forEach((k, i) => { if (JSON.stringify(P[k]) !== before[i]) P.at[k] = Math.max(Date.now(), P.at[k] + 1); });
      P.updatedAt = stamp(P);
      save();
    },
    runs: () => Object.values(S.payRuns).sort((a, b) => byStr(b.run.end, a.run.end) || b.savedAt - a.savedAt),
    saveRun: rec => {
      const r = PK.cleanPayRun(rec);
      if (!r) return;
      // one saved run per pay period: saving it again replaces the earlier copy
      for (const h of Object.values(S.payRuns)) if (h.id !== r.id && h.run.start === r.run.start && h.run.end === r.run.end) { delete S.payRuns[h.id]; S.deleted[h.id] = Math.max(Date.now(), h.updatedAt); }
      r.updatedAt = Math.max(stamp(S.payRuns[r.id] || r), (S.deleted[r.id] || 0) + 1);
      S.payRuns[r.id] = r;
      delete S.deleted[r.id];
      save();
    },
    deleteRun: id => { const h = S.payRuns[id]; delete S.payRuns[id]; S.deleted[id] = Math.max(Date.now(), h ? h.updatedAt : 0); save(); },
    partners: payrollPartners,
    clients: payrollClients,
    tracked: trackedHours,
    feePct: () => { const n = num(S.business.feePct); return n >= 0 && n < 50 ? n : 4; },
    live: () => rates,
    refreshRates: codes => refreshRates(codes, true),
    canShareFiles, deliver, payslipKit, toast,
  });
}

/* ---------- bringing in the old Payroll app's data (same website, same browser) ---------- */

const PAYROLL_VAULT = 'gjr-payroll-vault-v1';
function readStore(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
const payrollWaiting = () => MODE === 'owner' && !S.imports.payroll && !!readStore(PAYROLL_VAULT);
function renderImport() {
  const show = payrollWaiting();
  for (const el of $$('[data-import-card]')) el.hidden = !show;
}
// The Payroll app also kept a copy in its own sync gist, which may be newer than this device's
// (Payroll last used on the other device). It opens with the same password.
async function payrollRemote(d, password) {
  const ps = d.sync && typeof d.sync === 'object' ? d.sync : null;
  if (!ps || typeof ps.token !== 'string' || !/^[0-9a-f]{20,64}$/i.test(ps.gistId || '')) return null;
  const FILE = 'partner-payroll-sync.json';
  const read = async id => {
    const g = await GJCore.github(ps.token, '/gists/' + id);
    const f = g && g.files && g.files[FILE];
    if (!f) return null;
    const text = f.truncated && f.raw_url ? await (await fetch(f.raw_url, { cache: 'no-store' })).text() : f.content;
    return JSON.parse(text);
  };
  try {
    let j = await read(ps.gistId);
    if (j && j.kind === 'moved' && /^[0-9a-f]{20,64}$/i.test(j.movedTo || '')) j = await read(j.movedTo);
    if (!j || !j.box) return null;
    const r = (await GJCore.openWithCurrent(j.box)) || (password ? await GJCore.openBox(password, j.box).catch(() => null) : null);
    return r && typeof r === 'object' ? r : null;
  } catch (e) { return null; } // offline or no longer there: this device's copy is used
}
async function importPayroll(password) {
  const box = readStore(PAYROLL_VAULT);
  if (!box) return false;
  // what Jan's other devices have first (partners, clients, an import done there)
  if (GJCore.syncInfo().on) { try { await GJCore.syncNow(); } catch (e) { /* imports from here anyway */ } }
  let d = await GJCore.openWithCurrent(box);
  if (!d) { try { d = await GJCore.openBox(password, box); } catch (e) { return false; } }
  if (!d || typeof d !== 'object') return false;
  const remote = await payrollRemote(d, password);
  if (remote) {
    // the newer copy's run and settings; pay history from both
    const pick = +remote.updatedAt > +d.updatedAt ? remote : d;
    const gone = [...new Set([...(Array.isArray(d.deleted) ? d.deleted : []), ...(Array.isArray(remote.deleted) ? remote.deleted : [])])];
    const hist = {};
    for (const h of [...(Array.isArray(d.history) ? d.history : []), ...(Array.isArray(remote.history) ? remote.history : [])]) {
      if (h && typeof h.id === 'string' && (!hist[h.id] || +h.savedAt > +hist[h.id].savedAt)) hist[h.id] = h;
    }
    d = { settings: pick.settings, run: pick.run, sheet: pick.sheet, history: Object.values(hist), deleted: gone };
  }
  if (S.imports.payroll) return { already: true }; // another device brought it across meanwhile
  const now = Date.now();
  const st = d.settings && typeof d.settings === 'object' ? d.settings : {};
  const lower = s => String(s || '').trim().toLowerCase();
  // partners: the same person when the name matches, else a new partner (no login yet)
  const pmap = {};
  const used = new Set(Object.values(S.partners).map(p => p.color));
  for (const pp of Array.isArray(st.partners) ? st.partners : []) {
    if (!pp || !validId(pp.id) || !String(pp.name || '').trim()) continue;
    const name = String(pp.name).trim();
    const match = Object.values(S.partners).find(p => lower(p.name) === lower(name) || lower(p.name).split(/\s+/)[0] === lower(name).split(/\s+/)[0]);
    if (match) { pmap[pp.id] = match.id; continue; }
    const id = ('pp' + pp.id).slice(0, 40);
    if (S.deleted[id]) continue; // brought across before and removed since
    if (!S.partners[id]) {
      const color = TK.COLORS.slice(1).find(x => !used.has(x)) || TK.COLORS[1];
      used.add(color);
      S.partners[id] = cleanPartner({ id, name, color, active: true, createdAt: now, updatedAt: now });
    }
    pmap[pp.id] = id;
  }
  // clients: matched by name ("Anna" finds "Anna Lee"), else added; their partner rate comes along
  const cmap = {};
  for (const pc of Array.isArray(st.clients) ? st.clients : []) {
    if (!pc || !validId(pc.id) || !String(pc.name || '').trim()) continue;
    const name = String(pc.name).trim();
    const n = lower(name);
    let c = Object.values(S.clients).find(x => lower(x.name) === n || lower(x.company) === n)
      || Object.values(S.clients).find(x => lower(x.name).startsWith(n + ' ') || lower(x.company).startsWith(n + ' '));
    if (!c) {
      const id = ('pc' + pc.id).slice(0, 40);
      if (S.deleted[id]) continue; // brought across before and removed since
      c = S.clients[id] || cleanClient({ id, name, currency: CODES.includes(pc.currency) ? pc.currency : 'USD', createdAt: now, updatedAt: now });
      S.clients[id] = c;
    }
    const was = JSON.stringify(c);
    if (!num(c.payRate) && +pc.rate > 0) c.payRate = String(pc.rate);
    if (pc.commission) c.commission = true;
    if (!c.about && pc.about) c.about = String(pc.about).slice(0, 60);
    if (JSON.stringify(c) !== was) c.updatedAt = stamp(c); // only a real change counts as an edit
    cmap[pc.id] = c.id;
  }
  // runs carry partner and client ids: the old app's become Work Hub's (one it doesn't know stays as is)
  const pid = x => pmap[x] || x, cid = x => cmap[x] || x;
  const remapRun = run => {
    const r = run && typeof run === 'object' ? run : {};
    const hours = {};
    for (const [k, v] of Object.entries(r.hours || {})) { const [a, b] = k.split('|'); hours[pid(a) + '|' + cid(b)] = v; }
    const commission = {};
    for (const [c, v] of Object.entries(r.commission || {})) {
      if (!v || typeof v !== 'object') continue;
      const inc = {};
      for (const [p, on] of Object.entries(v.include || {})) inc[pid(p)] = on;
      commission[cid(c)] = { ...v, include: inc };
    }
    return { ...r, hours, commission };
  };
  // the pay run in progress (with any rates it was frozen with), the hours calculator, payslip details;
  // Payroll that was only looked at in Work Hub (nothing typed yet) takes them too
  const P0 = S.payroll;
  const untouched = !P0 || (!Object.keys(P0.run.hours).length && !Object.values(P0.run.commission).some(c => c && c.on) && !Object.keys(P0.run.rateOverride).length);
  if (untouched) {
    const sheet = d.sheet && typeof d.sheet === 'object' ? { ...d.sheet, sendPid: pmap[d.sheet.sendPid] || '', sendCid: cmap[d.sheet.sendCid] || '' } : null;
    S.payroll = PK.cleanPayroll({ settings: { preparedBy: st.preparedBy, location: st.location, split: st.split }, run: remapRun(d.run), sheet, updatedAt: stamp(P0) });
  } else {
    const blank = PK.blankPayroll().settings, ps = P0.settings;
    if (ps.preparedBy === blank.preparedBy && typeof st.preparedBy === 'string') ps.preparedBy = st.preparedBy.slice(0, 80);
    if (ps.location === blank.location && typeof st.location === 'string') ps.location = st.location.slice(0, 80);
    if (ps.split === blank.split && parseInt(st.split, 10) >= 1) ps.split = parseInt(st.split, 10);
    P0.at.settings = Math.max(Date.now(), P0.at.settings + 1);
    P0.updatedAt = stamp(P0);
  }
  // the PayPal cut, when Work Hub still has the default
  if (+st.feePct >= 0 && +st.feePct < 50 && S.business.feePct === DEFAULT_BUSINESS.feePct && String(st.feePct) !== S.business.feePct) { S.business.feePct = String(st.feePct); S.business.updatedAt = stamp(S.business); }
  // pay history: each saved run keeps its own partners, clients and rates
  const gone = new Set(Array.isArray(d.deleted) ? d.deleted : []);
  // newest first, so of two saved copies of one pay period the later one comes across
  const history = (Array.isArray(d.history) ? d.history : []).filter(h => h && typeof h === 'object').sort((a, b) => (+b.savedAt || 0) - (+a.savedAt || 0));
  for (const h of history) {
    if (gone.has(h.id)) continue;
    // its own names and rates stay; only the ids change, so Open in payroll finds its hours
    const hs = h.settings && typeof h.settings === 'object' ? h.settings : {};
    const settings = { ...hs, partners: (Array.isArray(hs.partners) ? hs.partners : []).map(p => (p && typeof p === 'object' ? { ...p, id: pid(p.id) } : p)), clients: (Array.isArray(hs.clients) ? hs.clients : []).map(c => (c && typeof c === 'object' ? { ...c, id: cid(c.id) } : c)) };
    const r = PK.cleanPayRun({ ...h, settings, run: remapRun(h.run), updatedAt: +h.savedAt || now });
    if (!r || S.deleted[r.id] >= r.updatedAt) continue;
    if (Object.values(S.payRuns).some(x => x.id !== r.id && x.run.start === r.run.start && x.run.end === r.run.end)) continue;
    if (!S.payRuns[r.id] || newer(r, S.payRuns[r.id])) S.payRuns[r.id] = r;
  }
  S.imports.payroll = now;
  save();
  return { partners: Object.keys(pmap).length, clients: Object.keys(cmap).length, runs: (d.history || []).filter(h => h && !gone.has(h.id)).length };
}

/* ------------------------------------------------------------------ partner mode */

// On a partner's own device the app holds only their state: who they are, the key and
// address of their team channel, the work Jan shares with them, and their own time.
let MODE = 'owner';
const cleanRawKey = k => (typeof k === 'string' && /^[A-Za-z0-9+/]{43}=$/.test(k) ? k : '');
const blankPartnerState = () => ({ me: { id: '', name: '' }, key: '', token: '', gistId: '', ws: TK.cleanWorkspace(null), log: TK.emptyLog(), firstRun: false, at: 0, err: '' });
let PS = blankPartnerState();
function loadPartner(o) {
  PS = blankPartnerState();
  if (o.me && validId(o.me.id)) PS.me = { id: o.me.id, name: str(o.me.name, 80) };
  PS.key = cleanRawKey(o.key);
  PS.token = str(o.token, 200);
  PS.gistId = typeof o.gistId === 'string' && /^[0-9a-f]{20,64}$/i.test(o.gistId) ? o.gistId : '';
  PS.ws = TK.cleanWorkspace(o.ws);
  PS.log = TK.logFrom(o.log);
  PS.firstRun = !!o.firstRun;
  PS.at = +o.at || 0;
}
const partnerDump = () => ({ v: 1, role: 'partner', me: PS.me, key: PS.key, token: PS.token, gistId: PS.gistId, ws: PS.ws, log: TK.logDoc(PS.log), firstRun: PS.firstRun, at: PS.at, ui: { tab: PARTNER_TABS.includes(UI.tab) ? UI.tab : 'time' } });
function setMode(m) {
  MODE = m;
  document.body.classList.toggle('partner', m === 'partner');
}
// nothing of Jan's yet on this device: only then can it become a partner's device
const ownerEmpty = () => isEmpty() && !GJCore.syncInfo().on && !S.team.token && !Object.keys(teamCache).length && !Object.keys(S.projects).length && !Object.keys(S.partners).length && !Object.keys(S.log.entries).length && !S.payroll && !Object.keys(S.payRuns).length;
let pRun = null, pQueued = false, pTimer = 0;
function schedulePartnerSync() { clearTimeout(pTimer); pTimer = setTimeout(syncChannel, 2000); }
async function syncChannel() {
  if (MODE !== 'partner' || !PS.token || !PS.gistId || !PS.key || !GJCore.unlocked()) return;
  if (pRun) { pQueued = true; return pRun; }
  pRun = (async () => {
    try {
      const r = await TK.readChannel(PS.token, PS.gistId, PS.key);
      if (!r.exists) { PS.err = 'removed'; return; }
      if ((r.workspace && r.workspace.unreadable) || (r.entries && r.entries.unreadable)) { PS.err = 'key'; return; }
      if (r.workspace) PS.ws = TK.cleanWorkspace(r.workspace);
      if (r.entries) TK.mergeLog(PS.log, r.entries);
      const mine = TK.logDoc(PS.log);
      if (!r.entries || JSON.stringify(mine) !== JSON.stringify(TK.normalizeLog(r.entries))) await TK.writeChannel(PS.token, PS.gistId, PS.key, { entries: mine });
      PS.at = Date.now();
      PS.err = '';
    } catch (e) {
      PS.err = e && e.code === 'token' ? 'removed' : e && e.code ? e.code : 'error';
      if (e && !e.code) console.error(e);
    } finally {
      save();
      renderPartner();
    }
  })();
  try { await pRun; } finally { pRun = null; if (pQueued) { pQueued = false; syncChannel(); } }
}
const partnerProjects = () => {
  const names = Object.fromEntries(PS.ws.clients.map(c => [c.id, c.name]));
  return PS.ws.projects.map(p => ({ ...p, clientName: names[p.clientId] || 'Client' }));
};
function renderHours() {
  const out = $('#hrOut');
  if (!out || MODE !== 'partner') return;
  const [a, b] = presetRange($('#hrPreset').value);
  const from = iso(a), to = iso(b);
  const list = Object.values(PS.log.entries).filter(e => e.date >= from && e.date <= to);
  const total = list.reduce((t, e) => t + e.minutes, 0);
  const names = Object.fromEntries(partnerProjects().map(p => [p.id, `${p.clientName} · ${p.name}`]));
  const per = {};
  for (const e of list) per[e.projectId] = (per[e.projectId] || 0) + e.minutes;
  const rows = Object.entries(per).map(([id, m]) => ({ name: names[id] || 'Removed project', minutes: m })).sort((x, y) => y.minutes - x.minutes);
  const days = new Set(list.map(e => e.date)).size;
  out.innerHTML = `
    <div class="r-hero card"><div><span class="eyebrow">Your time</span><div class="big">${TK.fmtLong(total)}</div><div class="muted small">${esc(periodText(a, b))} · ${days} day${days === 1 ? '' : 's'} worked</div></div>${dayBars(perDay(list, from, to))}</div>
    <section class="card"><h3>By project</h3><table class="rtable">${barRows(rows, total) || '<tr><td class="muted">No time in this period</td></tr>'}</table></section>`;
}
function renderPartner() {
  if (MODE !== 'partner') return;
  const states = {
    removed: ['Removed', 'bad', 'Your access was removed, or the invite was replaced. Ask Jan for a new invite link.'],
    key: ['Old invite', 'warn', 'This device is on an old invite. Ask Jan for a new invite link and open it here.'],
    offline: ['Offline', 'warn', "Can't reach the internet right now. Your time is saved here and goes to Jan when you're back online."],
    busy: ['Paused', 'warn', 'GitHub asked the app to slow down. It tries again in a minute.'],
    error: ['Problem', 'warn', 'Something went wrong while syncing. It tries again in a minute.'],
  };
  const st = states[PS.err];
  const chip = $('#meChip');
  chip.className = 'chip ' + (st ? st[1] : PS.at ? 'ok' : '');
  chip.textContent = st ? st[0] : PS.at ? 'Synced' : 'Not synced yet';
  const n = PS.ws.projects.filter(p => !p.archived).length;
  $('#meText').textContent = !PS.me.id ? 'Not set up yet. Open the invite link Jan sent you.'
    : st ? st[2] : `Logging time as ${PS.me.name}. ${PS.at ? `Last sent to Jan ${GJCore.ago(PS.at)}.` : 'Your time goes to Jan automatically.'} You see ${n} project${n === 1 ? '' : 's'}.`;
  const blocked = PS.err === 'removed' || PS.err === 'key';
  $('#noAccess').hidden = !blocked;
  if (blocked) { $('#noAccessTitle').textContent = PS.err === 'removed' ? 'Your access was removed.' : 'This invite is out of date.'; $('#noAccessText').textContent = st[2]; }
  $('#firstRun').hidden = !PS.firstRun;
  // just switched into partner mode (an invite pasted in): show one of their screens
  if (!PARTNER_TABS.some(t => !$('#panel-' + t).hidden)) setTab(UI.tab, { keepScroll: true });
  $('#mastDate').textContent = today().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  if (timeView && !$('#panel-time').hidden) timeView.render();
  if (!$('#panel-hours').hidden) renderHours();
}

/* ------------------------------------------------------------------ wiring */

function wire() {
  $('.tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) { newClient = null; setTab(b.id.slice(4)); } });
  $('.tabs').addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const tabs = allowedTabs();
    const i = Math.max(0, tabs.indexOf(UI.tab));
    const n = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    setTab(tabs[n], { focus: true });
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
    const why = sendBlocked(inv);
    if (why) { toast(why); return; }
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
  $('#panel-settings').addEventListener('input', e => { if (e.target.closest('[data-partner]')) partnerEvent(e); else businessInput(e); });

  // payroll, and bringing the old Payroll app's data in
  initPayroll();
  for (const btn of $$('[data-import-go]')) btn.addEventListener('click', async () => {
    const card = btn.closest('[data-import-card]');
    const pw = card.querySelector('input[type=password]');
    btn.disabled = true;
    try {
      const res = await importPayroll(pw.value);
      if (res && res.already) { pw.value = ''; renderAll(); toast('Payroll was already brought across on your other device.'); return; }
      if (!res) { card.querySelector('[data-import-pw]').hidden = false; pw.focus(); toast("That isn't the Payroll password. Type the one you use to open Payroll."); return; }
      pw.value = '';
      renderAll();
      if (!$('#panel-payroll').hidden && payrollView) payrollView.render();
      toast(`Payroll is in: ${res.partners} partner${res.partners === 1 ? '' : 's'}, ${res.clients} client${res.clients === 1 ? '' : 's'} and ${res.runs} saved pay run${res.runs === 1 ? '' : 's'}.`);
    } finally { btn.disabled = false; }
  });
  $('#hrPreset').addEventListener('input', renderHours);
  $('#meSyncNow').addEventListener('click', () => syncChannel());
  $('#ownPwForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (await GJCore.changePassword($('#ownPw').value, $('#ownPw2').value)) {
      PS.firstRun = false;
      $('#ownPw').value = ''; $('#ownPw2').value = '';
      save();
      renderPartner();
      toast('Password saved. Start the timer when you start working.');
    }
  });
  setInterval(() => { if (GJCore.unlocked() && MODE === 'partner' && document.visibilityState === 'visible') syncChannel(); }, 60000);
  document.addEventListener('visibilitychange', () => {
    if (!GJCore.unlocked() || MODE !== 'partner') return;
    if (document.visibilityState === 'visible') syncChannel();
    else if (pTimer) { clearTimeout(pTimer); syncChannel(); } // a pending edit goes before switching away
  });
  window.addEventListener('online', () => { if (GJCore.unlocked() && MODE === 'partner') syncChannel(); });

  // time, team, reports
  initTime();
  $('#edTimeFill').addEventListener('click', fillFromTime);
  $('#clAddProject').addEventListener('click', addProject);
  $('#clProjects').addEventListener('input', projectEvent);
  $('#clProjects').addEventListener('click', projectEvent);
  $('#partnerList').addEventListener('click', partnerEvent);
  $('#teamConnect').addEventListener('click', connectTeam);
  $('#partnerAdd').addEventListener('click', addPartner);
  $('#partnerName').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addPartner(); } });
  $('#teamOffBtn').addEventListener('click', () => { S.team = cleanTeam({ updatedAt: stamp(S.team) }); save(); renderTeam(); toast('Team sync is off. Partners keep their entries until you turn it back on.'); });
  $('#ivClose').addEventListener('click', () => closeSheet($('#inviteSheet')));
  $('#ivCopyMsg').addEventListener('click', () => copyText($('#ivMsg').value, 'Message copied. Send the invite code separately.'));
  $('#ivCopyCode').addEventListener('click', () => copyText($('#ivCode').textContent, 'Invite code copied.'));
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-bill]');
    if (b && GJCore.unlocked()) { const [cid, from, to] = b.dataset.bill.split('|'); billFromOverview(cid, from, to); }
  });
  $('#rpModes').addEventListener('click', e => { const b = e.target.closest('[data-rmode]'); if (b) { R.mode = b.dataset.rmode; renderReport(); } });
  $('#rpClient').addEventListener('input', e => { R.clientId = e.target.value; renderReport(); });
  $('#rpWho').addEventListener('input', e => { R.who = e.target.value; renderReport(); });
  $('#rpPreset').addEventListener('input', e => { const [a, b] = reportRange(); R.from = a; R.to = b; R.preset = e.target.value; renderReport(); });
  $('#rpFrom').addEventListener('input', e => { if (isoOk(e.target.value)) { R.from = e.target.value; R.to = R.to || e.target.value; renderReport(); } });
  $('#rpTo').addEventListener('input', e => { if (isoOk(e.target.value)) { R.to = e.target.value; renderReport(); } });
  $('#rpPdf').addEventListener('click', reportPdf);
  $('#rpEmail').addEventListener('click', reportEmail);
  $('#rpInvoice').addEventListener('click', reportInvoice);
  // the report charts' tooltip
  const tip = document.createElement('div');
  tip.className = 'ctip'; tip.hidden = true; document.body.appendChild(tip);
  let tipTimer = 0;
  const showTip = el => { const r = el.getBoundingClientRect(); tip.textContent = el.dataset.tip; tip.hidden = false; tip.style.left = `${r.left + r.width / 2 + window.scrollX}px`; tip.style.top = `${r.top + window.scrollY - 8}px`; clearTimeout(tipTimer); tipTimer = setTimeout(() => { tip.hidden = true; }, 2500); };
  window.addEventListener('scroll', () => { tip.hidden = true; }, { passive: true });
  $('#rpOut').addEventListener('pointerover', e => { const c = e.target.closest('.wkcol'); if (c) showTip(c); });
  $('#rpOut').addEventListener('pointerout', e => { if (e.target.closest('.wkcol')) tip.hidden = true; });
  $('#rpOut').addEventListener('focusin', e => { const c = e.target.closest('.wkcol'); if (c) showTip(c); });
  $('#rpOut').addEventListener('focusout', () => { tip.hidden = true; });
  setInterval(() => { if (GJCore.unlocked() && MODE === 'owner' && document.visibilityState === 'visible') syncTeam(); }, 90000);
  setInterval(() => { if (GJCore.unlocked() && !$('#panel-overview').hidden) renderWorkCards(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && GJCore.unlocked() && MODE === 'owner') syncTeam(); });
}

/* ------------------------------------------------------------------ start */

function onUnlock() {
  if (MODE === 'partner') {
    renderPartner();
    setTab(PS.firstRun ? 'time' : UI.tab, { keepScroll: true });
    if (!PS.me.id) toast('Open the invite link Jan sent you to set this up.');
    syncChannel();
    return;
  }
  renderAll();
  syncTeam();
  if (UI.edId && S.invoices[UI.edId]) openEditor(UI.edId);
  else setTab(UI.tab, { keepScroll: true });
  if (payrollWaiting()) toast('Your Payroll data can come across into Work Hub.', { label: 'Open Payroll', run: () => setTab('payroll') });
}

wire();
GJCore.start({
  ns: 'gjr-invoices', // the storage and sync names stay as they were, so nothing has to move
  name: 'Work Hub',
  kind: 'gj-invoices',
  gistFile: 'genestjan-invoices-sync.json',
  gistDesc: 'Work Hub sync (encrypted)',
  text: {
    create: ['Create your password', 'It locks everything on this device: your business, clients, invoices, time and payroll. Nobody can open it without it.', 'Create password'],
    unlock: ['Work Hub', 'Type your password to open Work Hub.', 'Unlock'],
    join: ['Set up this device', 'Type your invite code, or the password you use on your other device.', 'Continue'],
  },
  load, dump, payload, merge,
  normalize: p => (p && p.role === 'partner' ? p : normalize(p)),
  isEmpty: () => MODE === 'owner' && isEmpty(),
  syncAllowed: () => MODE === 'owner', // a partner's device never touches Jan's own sync
  // Jan's device locks after 3 minutes unused; a partner's after 8 hours, and never while their timer runs
  idleMs: () => (MODE === 'partner' ? (PS.log.timer.startedAt ? 7 * 24 * 3600000 : 8 * 3600000) : 3 * 60000),
  // Jan's own sync never goes to the team account: partners hold its token
  refuseSyncLogin: login => (login && S.team.login && login.toLowerCase() === S.team.login.toLowerCase()
    ? `That token is for the team account (${login}), which your partners can use. Sync needs your own GitHub account.` : ''),
  // a new invite opened on a partner's device: it now opens with the invite code, so they choose their own password again
  afterJoin: s => { if (s && s.kind === 'team-invite' && MODE === 'partner') { PS.firstRun = true; save(); } },
  // a partner's invite opened on Jan's own device must not take it over (or change its password)
  refuseLink: s => (s && (s.kind === 'team-invite' || s.kind === 'team-device') && ((MODE === 'owner' && !ownerEmpty()) || (MODE === 'partner' && PS.me.id && s.partnerId !== PS.me.id))
    ? `That's ${s.name || 'a partner'}'s invite. Open it on their own phone or computer, not on this one.` : ''),
  render: renderAll,
  onUnlock,
  setupPayload: () => (MODE === 'partner'
    ? { kind: 'team-device', partnerId: PS.me.id, name: PS.me.name, key: PS.key, token: PS.token, gistId: PS.gistId }
    : { business: S.business, clients: Object.values(S.clients) }),
  applySetup,
  describeSetup,
});
setInterval(() => { if (GJCore.unlocked()) refreshRates(); }, 30 * 60 * 1000);
})();
