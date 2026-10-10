/* Partner Payroll · Genest Jan Ramirez
   Plain JavaScript, no build step. Everything is kept in this browser (localStorage);
   the only thing that goes over the network is the request for today's exchange rates. */
(() => {
'use strict';

/* ------------------------------------------------------------------ constants */

const KEY = 'gjr-payroll-v1';           // settings, current pay run, timesheet, tab
const HKEY = 'gjr-payroll-history-v1';  // saved pay runs
const RKEY = 'gjr-payroll-rates-v1';    // last mid-market rates fetched

const CUR = {
  USD: { sym: '$', name: 'US dollar' },
  GBP: { sym: '£', name: 'UK pound' },
  AUD: { sym: 'A$', name: 'Australian dollar' },
};
const CODES = Object.keys(CUR);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const TABS = ['payroll', 'timesheet', 'history', 'settings'];

// The first feed is the one ppcurrencyconverter.com itself calls, so the mid-market rate
// here is the one Jan sees there. The second is the same provider's other free endpoint,
// only used when the first is down.
const FEEDS = [
  { name: 'exchangerate-api.com', url: c => `https://api.exchangerate-api.com/v4/latest/${c}`, date: j => j.date || '' },
  { name: 'open.er-api.com', url: c => `https://open.er-api.com/v6/latest/${c}`,
    date: j => (j.time_last_update_unix ? new Date(j.time_last_update_unix * 1000).toISOString().slice(0, 10) : '') },
];

const DEFAULT_SETTINGS = { preparedBy: 'Genest Jan Ramirez', location: '', feePct: 4, split: 3, partners: [], clients: [] };

/* ------------------------------------------------------------------ small helpers */

const $ = (s, r = document) => r.querySelector(s);
if (document.getElementById('lockFields')) document.getElementById('lockFields').hidden = true;
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const uid = p => p + Math.random().toString(36).slice(2, 8);
const safeId = (v, p) => (/^[A-Za-z0-9_-]{1,40}$/.test(String(v || '')) ? String(v) : uid(p));
const pad = n => String(n).padStart(2, '0');

function readJSON(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

/* ------------------------------------------------------------------ money */

// Round to centavos, half up, without floating point noise (291.6 x 60.3 is 17583.479999...).
const round2 = x => Math.round(Number((x * 100).toPrecision(12))) / 100;
// A number typed by a person: commas, spaces and currency signs are ignored.
function num(v) {
  const s = String(v ?? '').replace(/[^\d.]/g, '');
  if (!s) return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
// ppcurrencyconverter.com: amount x mid-market rate, minus that amount x 4% rounded to
// centavos. For 1 unit that is the PayPal rate, which Jan then reads to 2 decimals.
const paypalFromMid = (mid, pct) => round2(mid - round2(mid * pct / 100));
const money = x => Number(x).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const peso = x => (x == null ? '–' : '₱' + money(x));
const usdRate = r => '$' + (Number.isInteger(r) ? String(r) : money(r));
const midTxt = r => Number(r).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const addUp = arr => (arr.some(v => v == null) ? null : round2(arr.reduce((a, v) => a + v, 0)));

/* ------------------------------------------------------------------ time, the Miracle Salad way */

// A duration such as 94:36. Rules copied from miraclesalad.com/webtools/timesheet.php:
// a period works like a colon (7.15 = 7:15, 12.8 = 12:08), 3 or 4 digits with no
// separator are H:MM (130 = 1:30), 1 or 2 digits are whole hours, seconds are ignored,
// and decimal hours = hours + minutes / 60 rounded to 2 places. "94h 36m" also works.
function parseDuration(raw) {
  let t = String(raw ?? '').trim().toLowerCase();
  if (!t) return null;
  let m = t.match(/^(\d+)\s*h(?:ours?|rs?)?\s*(?:(\d+)\s*m(?:ins?|inutes?)?)?$/);
  if (m) return dur(+m[1], +(m[2] || 0), false);
  m = t.match(/^(\d+)\s*m(?:ins?|inutes?)?$/);
  if (m) return dur(0, +m[1], false);
  const dot = t.includes('.');
  t = t.replace(/^(\d{1,2})(\d\d)$/, '$1:$2').replace('.', ':');
  m = t.match(/^(\d*):(\d{0,2})(?::\d{0,2})?$/);
  if (m && (m[1] || m[2])) return dur(+(m[1] || 0), +(m[2] || 0), dot);
  if (/^\d+$/.test(t)) return dur(+t, 0, false);
  return { error: 'Type it as H:MM, like 94:36' };
}
function dur(h, min, dot) {
  return { h, m: min, minutes: h * 60 + min, decimal: Number((h + min / 60).toFixed(2)), dot };
}
const fmtHM = minutes => { const t = Math.round(minutes); return `${Math.floor(t / 60)}:${pad(t % 60)}`; };
const decimalOf = minutes => { const t = Math.round(minutes); return Number((Math.floor(t / 60) + (t % 60) / 60).toFixed(2)); };

// A clock time for the Calculate Hours table: 8, 8:30, 8.30, 830, 17:30, 5:30p, 5:30 pm.
function parseClock(raw) {
  let t = String(raw ?? '').trim().toLowerCase().replace(/\s+/g, '');
  if (!t) return null;
  let ap = '';
  const s = t.match(/([ap])\.?(?:m\.?)?$/);
  if (s) { ap = s[1]; t = t.slice(0, s.index); }
  t = t.replace(/^(\d{1,2})(\d\d)$/, '$1:$2').replace('.', ':');
  const m = t.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!m) return { error: 'Not a time' };
  let h = +m[1];
  const min = +(m[2] || 0);
  if (min > 59 || h > 24 || (ap && (h < 1 || h > 12))) return { error: 'Not a time' };
  if (ap) h = (h % 12) + (ap === 'p' ? 12 : 0);
  return { minutes: h * 60 + min };
}
const snap = (min, step) => (step > 1 ? Math.round(min / step) * step : min);
// An end time earlier than its start gets 12 hours added until it is later
// (12:10 to 3 = 2:50, 22:00 to 2:00 = 4:00), the same as the Miracle Salad tool.
function blockMinutes(start, end, step) {
  const a = snap(start, step);
  let b = snap(end, step);
  while (b < a) b += 720;
  return b - a;
}

/* ------------------------------------------------------------------ dates */

const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseIso = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const today = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
const longDate = d => (d ? `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` : '');
const shortDate = d => (d ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '');
function periodText(s, e, sep) {
  if (!s || !e) return '';
  if (s.getFullYear() === e.getFullYear()) return `${MONTHS[s.getMonth()]} ${s.getDate()}${sep}${MONTHS[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
  return `${longDate(s)}${sep}${longDate(e)}`;
}
const isoDateText = s => longDate(parseIso(s));

/* ------------------------------------------------------------------ state */

function cleanSettings(x) {
  const s = clone(DEFAULT_SETTINGS);
  if (!x || typeof x !== 'object') return s;
  if (typeof x.preparedBy === 'string') s.preparedBy = x.preparedBy.slice(0, 80);
  if (typeof x.location === 'string') s.location = x.location.slice(0, 80);
  const fee = num(x.feePct);
  if (fee >= 0 && fee < 50) s.feePct = fee;
  if (parseInt(x.split, 10) >= 1) s.split = parseInt(x.split, 10);
  if (Array.isArray(x.partners)) {
    s.partners = x.partners.filter(p => p && typeof p.name === 'string').slice(0, 30)
      .map(p => ({ id: safeId(p.id, 'p'), name: p.name.slice(0, 80) }));
  }
  if (Array.isArray(x.clients)) {
    s.clients = x.clients.filter(c => c && typeof c.name === 'string').slice(0, 30).map(c => ({
      id: safeId(c.id, 'c'),
      name: c.name.slice(0, 60),
      about: typeof c.about === 'string' ? c.about.slice(0, 60) : '',
      currency: CODES.includes(c.currency) ? c.currency : 'USD',
      rate: num(c.rate) > 0 ? num(c.rate) : 0,
      commission: !!c.commission,
    }));
  }
  return s;
}

function defaultRun() {
  const end = addDays(today(), -1);
  return { start: iso(addDays(end, -12)), end: iso(end), payDate: iso(today()), hours: {}, commission: {}, rateOverride: {}, frozen: null };
}
function cleanRun(x) {
  const r = defaultRun();
  if (!x || typeof x !== 'object') return r;
  for (const k of ['start', 'end', 'payDate']) if (parseIso(x[k])) r[k] = x[k];
  const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  for (const [k, v] of Object.entries(obj(x.hours))) if (typeof v === 'string') r.hours[k] = v.slice(0, 20);
  for (const [k, v] of Object.entries(obj(x.commission))) {
    if (!v || typeof v !== 'object') continue;
    r.commission[k] = { on: !!v.on, amount: String(v.amount ?? '').slice(0, 20), currency: CODES.includes(v.currency) ? v.currency : '',
      split: String(v.split ?? '').slice(0, 3), include: obj(v.include) };
  }
  for (const c of CODES) if (typeof obj(x.rateOverride)[c] === 'string') r.rateOverride[c] = x.rateOverride[c].slice(0, 12);
  if (x.frozen && typeof x.frozen === 'object') r.frozen = x.frozen;
  return r;
}
function defaultSheet() {
  return { calc: [{ s: '', e: '' }, { s: '', e: '' }, { s: '', e: '' }], step: 1, sums: Array(14).fill(''), title: 'Sum Hours', sendPid: '', sendCid: '' };
}
function cleanSheet(x) {
  const d = defaultSheet();
  if (!x || typeof x !== 'object') return d;
  if (Array.isArray(x.calc) && x.calc.length) d.calc = x.calc.slice(0, 40).map(r => ({ s: String(r?.s ?? '').slice(0, 8), e: String(r?.e ?? '').slice(0, 8) }));
  if ([1, 5, 6, 7, 10, 15, 30, 60].includes(+x.step)) d.step = +x.step;
  if (Array.isArray(x.sums) && x.sums.length) d.sums = x.sums.slice(0, 62).map(v => String(v ?? '').slice(0, 10));
  if (typeof x.title === 'string') d.title = x.title.slice(0, 60);
  if (typeof x.sendPid === 'string') d.sendPid = x.sendPid;
  if (typeof x.sendCid === 'string') d.sendCid = x.sendCid;
  return d;
}

const S = { settings: cleanSettings(null), run: cleanRun(null), sheet: cleanSheet(null), tab: 'payroll', sync: null, updatedAt: 0, deleted: [] };
let payRuns = [];
let rateCache = (() => { const r = readJSON(RKEY); return r && typeof r === 'object' ? r : {}; })();

const cleanHistory = list => (Array.isArray(list) ? list.filter(x => x && typeof x.id === 'string' && x.run && typeof x.run === 'object') : []);
function cleanSync(x) {
  if (!x || typeof x !== 'object' || typeof x.token !== 'string' || !x.token.trim()) return null;
  return {
    token: x.token.trim(),
    gistId: typeof x.gistId === 'string' && /^[0-9a-f]{20,64}$/i.test(x.gistId) ? x.gistId : '',
    login: typeof x.login === 'string' ? x.login.slice(0, 60) : '',
    lastSyncAt: +x.lastSyncAt || 0,
    adopt: !!x.adopt, // true until this device's first sync: the copy already on GitHub wins
    rotate: !!(x.rotate || x.pushNext), // true after a password change until a fresh gist holds the re-locked copy
  };
}
function loadState(data) {
  const d = data && typeof data === 'object' ? data : {};
  S.settings = cleanSettings(d.settings);
  S.run = cleanRun(d.run);
  S.sheet = cleanSheet(d.sheet);
  S.tab = TABS.includes(d.tab) ? d.tab : 'payroll';
  S.sync = cleanSync(d.sync);
  S.updatedAt = +d.updatedAt || 0;
  S.deleted = mergeDeleted([], d.deleted);
  payRuns = cleanHistory(d.history);
}

/* ------------------------------------------------------------------ password lock */

// Everything personal (partners, clients, rates, hours, history) is stored encrypted with
// AES-256-GCM, using a key made from Jan's password (PBKDF2-SHA256, 600,000 rounds). The
// page itself is public, but without the password there is nothing in it to read.
const VKEY = 'gjr-payroll-vault-v1';
const ITER = 600000;
let vault = null; // { key, raw, salt, password } while unlocked; password is null after a refresh

function bytesToB64(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let out = '';
  for (let i = 0; i < b.length; i += 0x8000) out += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(out);
}
const b64ToBytes = str => Uint8Array.from(atob(str), c => c.charCodeAt(0));
const isBox = b => !!(b && typeof b === 'object' && typeof b.salt === 'string' && typeof b.iv === 'string' && typeof b.data === 'string');
async function deriveKey(password, salt, iter = ITER) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function seal(key, salt, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
  return { v: 1, iter: ITER, salt: bytesToB64(salt), iv: bytesToB64(iv), data: bytesToB64(ct) };
}
async function unseal(key, box) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(box.iv) }, key, b64ToBytes(box.data));
  return JSON.parse(new TextDecoder().decode(pt));
}
// the vault key plus its raw bytes, which this window keeps (wrapped) to survive a refresh;
// the same key deriveKey() makes, since an AES key from PBKDF2 is the first 256 derived bits
async function deriveVault(password, salt, iter = ITER) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const raw = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, 256));
  const key = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  return { key, raw };
}
async function newVault(password, salt, iter) {
  const d = await deriveVault(password, salt, iter);
  return { key: d.key, raw: d.raw, salt, password };
}
// open a locked setup link, backup or sync copy; throws when it can't
async function unsealWith(password, box) {
  if (vault && box.salt === bytesToB64(vault.salt)) {
    try { return await unseal(vault.key, box); } catch (e) { /* locked with another password: try the one given */ }
  }
  if (!password) throw new Error('password needed');
  return unseal(await deriveKey(password, b64ToBytes(box.salt), box.iter || ITER), box);
}

// What travels between devices. The open tab and the sync connection stay on each device.
function syncPayload(st) {
  return { settings: st.settings, run: st.run, sheet: st.sheet, history: st.history, deleted: st.deleted, updatedAt: st.updatedAt };
}
const currentState = () => ({ settings: S.settings, run: S.run, sheet: S.sheet, history: payRuns, deleted: S.deleted, updatedAt: S.updatedAt });
const contentKey = () => JSON.stringify(syncPayload({ ...currentState(), updatedAt: 0 }));
let cleanKey = null; // contentKey() at the last save, so switching tabs doesn't count as an edit
const markClean = () => { cleanKey = contentKey(); };

let saveTimer = 0;
let writing = Promise.resolve();
function saveNow() {
  clearTimeout(saveTimer);
  if (!vault) return writing;
  const now = contentKey();
  if (cleanKey !== null && now !== cleanKey) { S.updatedAt = Date.now(); scheduleSync(); }
  cleanKey = now;
  const text = JSON.stringify({ ...syncPayload(currentState()), tab: S.tab, sync: S.sync });
  const v = vault;
  writing = writing.then(() => seal(v.key, v.salt, text)).then(box => { writeJSON(VKEY, box); }).catch(() => {});
  return writing;
}
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 200); }
const saveHistory = () => save();
window.addEventListener('pagehide', () => { saveNow(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow(); });

/* ------------------------------------------------------------------ rates */

let live = {};            // code -> { mid, date, feed, fresh }
let rateState = 'loading'; // loading | live | partial | saved | none
for (const c of CODES) if (rateCache[c] && rateCache[c].mid > 0) live[c] = { ...rateCache[c], fresh: false };

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

async function refreshRates() {
  rateState = 'loading';
  renderRates();
  const got = await Promise.all(CODES.map(fetchMid));
  CODES.forEach((c, i) => {
    if (got[i]) { live[c] = { ...got[i], fresh: true }; rateCache[c] = { ...got[i], at: Date.now() }; }
  });
  writeJSON(RKEY, rateCache);
  const n = got.filter(Boolean).length;
  rateState = n === CODES.length ? 'live' : n > 0 ? 'partial' : CODES.some(c => live[c]) ? 'saved' : 'none';
  renderRates();
  update();
}

// The PayPal rate used for a currency: rates saved with a past pay run first, then a rate
// Jan typed in, then today's mid-market rate less the PayPal cut.
function rateInfo(code, run = S.run, settings = S.settings) {
  const fz = run.frozen && run.frozen[code];
  if (fz && fz.rate > 0) return { ...fz, code, frozen: true };
  const raw = run.rateOverride && run.rateOverride[code];
  const ov = num(raw);
  if (raw && ov > 0) return { code, rate: round2(ov), manual: true, date: run.payDate };
  const L = live[code];
  if (!L) return null;
  const pct = settings.feePct;
  return { code, rate: paypalFromMid(L.mid, pct), mid: L.mid, cut: round2(L.mid * pct / 100), pct, date: L.date, feed: L.feed, fresh: L.fresh };
}

/* ------------------------------------------------------------------ the sums */

function compute(settings = S.settings, run = S.run) {
  const usd = rateInfo('USD', run, settings);
  const used = new Set();
  const slips = settings.partners.map(p => {
    const blocks = [];
    const issues = [];
    for (const c of settings.clients) {
      const key = p.id + '|' + c.id;
      const t = parseDuration(run.hours[key]);
      const b = { client: c, key };
      if (t && t.error) issues.push(`Check ${c.name} hours`);
      else if (t && t.minutes > 0) {
        used.add('USD');
        const fx = usd ? usd.rate : null;
        b.hourly = { hm: fmtHM(t.minutes), hours: t.decimal, rate: c.rate, usd: round2(t.decimal * c.rate), fx,
          php: fx != null ? round2(t.decimal * c.rate * fx) : null };
        if (fx == null) issues.push('Needs the USD rate');
        if (!(c.rate > 0)) issues.push(`${c.name} has no hourly rate`);
      }
      const share = commissionShare(c, run, settings);
      if (share && share.include[p.id] !== false) {
        used.add(share.cur);
        b.commission = share;
        if (share.php == null) issues.push(`Needs the ${share.cur} rate`);
      }
      if (b.hourly || b.commission) {
        b.subtotal = addUp([b.hourly && b.hourly.php, b.commission && b.commission.php].filter(v => v !== undefined && v !== false));
        blocks.push(b);
      }
    }
    const hourlyBlocks = blocks.filter(b => b.hourly);
    const commBlocks = blocks.filter(b => b.commission);
    const total = blocks.length ? addUp(blocks.map(b => b.subtotal)) : null;
    return {
      partner: p, blocks, issues: [...new Set(issues)], total,
      hours: round2(hourlyBlocks.reduce((a, b) => a + b.hourly.hours, 0)),
      usdPay: round2(hourlyBlocks.reduce((a, b) => a + b.hourly.usd, 0)),
      hourlyPhp: addUp(hourlyBlocks.map(b => b.hourly.php)),
      commPhp: addUp(commBlocks.map(b => b.commission.php)),
      ready: blocks.length > 0 && total != null && !issues.length,
    };
  });
  const active = slips.filter(s => s.blocks.length);
  return {
    slips, active,
    grand: active.length ? addUp(active.map(s => s.total)) : 0,
    hours: round2(active.reduce((a, s) => a + s.hours, 0)),
    used: CODES.filter(c => used.has(c)),
    ready: active.length > 0 && active.every(s => s.ready),
  };
}

// One person's share of a client's commission: total x PayPal rate / number of people.
function commissionShare(c, run = S.run, settings = S.settings) {
  const cm = run.commission[c.id];
  const amount = num(cm && cm.amount);
  if (!c.commission || !cm || !cm.on || !(amount > 0)) return null;
  const cur = CODES.includes(cm.currency) ? cm.currency : c.currency;
  const split = parseInt(cm.split, 10) >= 1 ? parseInt(cm.split, 10) : settings.split;
  const ri = rateInfo(cur, run, settings);
  return { amount, cur, split, fx: ri ? ri.rate : null, php: ri ? round2(ri.rate * amount / split) : null, include: cm.include || {} };
}

function ctxFor(settings = S.settings, run = S.run) {
  const R = compute(settings, run);
  const rates = {};
  for (const c of R.used) rates[c] = rateInfo(c, run, settings);
  return { R, settings, run, rates, generatedAt: new Date() };
}

/* ------------------------------------------------------------------ text for chat */

function chatText(slip, run) {
  const per = periodText(parseIso(run.start), parseIso(run.end), ' - ');
  const out = [`${slip.partner.name} | Salary for ${per}`, ''];
  for (const b of slip.blocks) {
    out.push(`${b.client.name} | ${per}${b.commission ? ' with Commission' : ''}`);
    if (b.hourly) out.push(`${b.hourly.hours.toFixed(2)} hours x ${usdRate(b.hourly.rate)}/hr x ₱${money(b.hourly.fx)}/USD = ${peso(b.hourly.php)}`);
    if (b.commission) {
      const c = b.commission;
      if (b.hourly) out.push('');
      out.push('Commission', `₱${money(c.fx)}/${c.cur} x ${CUR[c.cur].sym}${money(c.amount)} / ${c.split} = ${peso(c.php)}`);
    }
    out.push('');
  }
  out.push(`Total = ${peso(slip.total)}`);
  return out.join('\n');
}

/* ------------------------------------------------------------------ toast */

let toastTimer = 0;
function toast(msg, action) {
  const t = $('#toast');
  $('#toastText').textContent = msg;
  const a = $('#toastAction');
  if (action) {
    a.textContent = action.label;
    a.hidden = false;
    a.onclick = () => { t.hidden = true; action.run(); };
  } else a.hidden = true;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, action ? 12000 : 3600);
}

/* ------------------------------------------------------------------ tabs */

function setTab(name, focus) {
  if (!TABS.includes(name)) name = 'payroll';
  S.tab = name;
  for (const t of TABS) {
    const on = t === name;
    const b = $('#tab-' + t);
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
    $('#panel-' + t).hidden = !on;
  }
  if (focus) $('#tab-' + name).focus();
  save();
}
$('.tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.id.slice(4)); });
$('.tabs').addEventListener('keydown', e => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault();
  const i = TABS.indexOf(S.tab);
  const n = e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
  setTab(TABS[n], true);
});
document.addEventListener('click', e => { const g = e.target.closest('[data-goto]'); if (g) setTab(g.dataset.goto); });

/* ------------------------------------------------------------------ masthead, welcome, period */

const isSetUp = () => S.settings.partners.length > 0 && S.settings.clients.length > 0;

function renderMast() {
  const pd = parseIso(S.run.payDate);
  $('#mastDate').textContent = pd ? 'Salary day · ' + shortDate(pd) : 'Salary day';
}
function renderWelcome() {
  $('#welcome').hidden = isSetUp();
  $('#work').hidden = !isSetUp();
}
function renderPeriod() {
  $('#pStart').value = S.run.start;
  $('#pEnd').value = S.run.end;
  $('#pPay').value = S.run.payDate;
  const s = parseIso(S.run.start), e = parseIso(S.run.end);
  const chip = $('#periodDays');
  if (s && e && e >= s) {
    chip.className = 'chip';
    chip.textContent = `${Math.round((e - s) / 86400000) + 1} days`;
  } else {
    chip.className = 'chip warn';
    chip.textContent = 'End is before start';
  }
  $('#slipPeriod').textContent = periodText(s, e, ' – ');
  renderMast();
}
for (const [id, k] of [['pStart', 'start'], ['pEnd', 'end'], ['pPay', 'payDate']]) {
  $('#' + id).addEventListener('change', e => { if (parseIso(e.target.value)) { S.run[k] = e.target.value; save(); renderPeriod(); update(); } });
}
$('#newRun').addEventListener('click', () => { $('#newRunConfirm').hidden = false; $('#newRun').hidden = true; });
$('#newRunNo').addEventListener('click', () => { $('#newRunConfirm').hidden = true; $('#newRun').hidden = false; });
$('#newRunYes').addEventListener('click', () => {
  const prevEnd = parseIso(S.run.end) || addDays(today(), -1);
  const start = addDays(prevEnd, 1);
  let end = addDays(today(), -1);
  if (end < start) end = addDays(start, 13);
  S.run = { start: iso(start), end: iso(end), payDate: iso(addDays(end, 1)), hours: {}, commission: {}, rateOverride: {}, frozen: null };
  $('#newRunConfirm').hidden = true;
  $('#newRun').hidden = false;
  save();
  renderPeriod(); renderRates(); renderClients(); update();
  toast('New pay run started: ' + periodText(start, end, ' – '));
});

/* ------------------------------------------------------------------ rates panel */

function renderRates() {
  const chip = $('#rateChip');
  const note = $('#rateNote');
  const pct = S.settings.feePct;
  const frozen = !!S.run.frozen;
  const dates = [...new Set(CODES.map(c => live[c] && live[c].date).filter(Boolean))];
  const when = dates.length ? dates.map(isoDateText).join(', ') : 'an earlier day';
  $('#rateUnfreeze').hidden = !frozen;
  if (frozen) {
    chip.className = 'chip gold'; chip.textContent = 'Saved with this run';
    note.textContent = 'These are the rates saved with this pay run, so the payslips match what was paid.';
  } else if (rateState === 'loading') {
    chip.className = 'chip'; chip.textContent = 'Checking';
    note.textContent = "Getting today's mid-market rates...";
  } else if (rateState === 'live') {
    chip.className = 'chip ok'; chip.innerHTML = '<span class="dot"></span>Live';
    note.textContent = `Mid-market rates of ${when} from the same feed ppcurrencyconverter.com uses, less your ${pct}% PayPal cut. Type over a rate to use your own.`;
  } else if (rateState === 'partial') {
    chip.className = 'chip warn'; chip.textContent = 'Partly live';
    note.textContent = "Some rates didn't load, so the last saved ones are shown for those. Refresh, or type the rate from ppcurrencyconverter.com.";
  } else if (rateState === 'saved') {
    chip.className = 'chip warn'; chip.textContent = 'Saved rates';
    note.textContent = `Couldn't reach the rate feed, so these are the last rates fetched (${when}). Refresh, or type today's rate from ppcurrencyconverter.com.`;
  } else {
    chip.className = 'chip bad'; chip.textContent = 'No rates';
    note.textContent = "Couldn't reach the rate feed. On ppcurrencyconverter.com enter 1, pick the currency and Philippines Pesos, and type the PayPal Conversion figure below.";
  }
  const box = $('#rateRows');
  if (!box.children.length) {
    box.innerHTML = CODES.map(c => `<div class="rate-row">
      <div class="rate-cur"><b>1 ${c}</b> <span class="small muted" data-rate-use="${c}"></span>
        <button class="link small" type="button" data-rate-reset="${c}" hidden>Use live rate</button></div>
      <div class="rate-calc mono" data-rate-calc="${c}"></div>
      <div><label class="sr" for="r_${c}">PayPal rate, pesos per ${c}</label>
        <input id="r_${c}" class="in rate-in" data-rate="${c}" inputmode="decimal" autocomplete="off" placeholder="0.00"></div>
    </div>`).join('');
  }
  for (const c of CODES) {
    const ri = rateInfo(c);
    const L = live[c];
    const calc = $(`[data-rate-calc="${c}"]`);
    if (ri && ri.frozen) calc.textContent = ri.mid ? `${midTxt(ri.mid)} − ${ri.pct}%` : 'Typed in';
    else if (ri && ri.manual) calc.textContent = L ? `Live: ${money(paypalFromMid(L.mid, pct))}` : 'Typed in';
    else if (L) calc.textContent = `${midTxt(L.mid)} − ${pct}% (${money(round2(L.mid * pct / 100))}) =`;
    else calc.textContent = rateState === 'loading' ? '...' : 'No live rate';
    const inp = $(`[data-rate="${c}"]`);
    inp.readOnly = frozen;
    if (document.activeElement !== inp) inp.value = ri ? ri.rate.toFixed(2) : '';
    $(`[data-rate-reset="${c}"]`).hidden = !(ri && ri.manual && !frozen && L);
  }
}
$('#rateRows').addEventListener('input', e => {
  const c = e.target.dataset.rate;
  if (!c || S.run.frozen) return;
  S.run.rateOverride[c] = e.target.value.trim();
  if (!S.run.rateOverride[c]) delete S.run.rateOverride[c];
  save(); update();
  $(`[data-rate-reset="${c}"]`).hidden = !S.run.rateOverride[c] || !live[c];
});
$('#rateRows').addEventListener('focusout', () => renderRates());
$('#rateRows').addEventListener('click', e => {
  const c = e.target.dataset.rateReset;
  if (!c) return;
  delete S.run.rateOverride[c];
  save(); renderRates(); update();
});
$('#rateRefresh').addEventListener('click', refreshRates);
$('#rateUnfreeze').addEventListener('click', () => { S.run.frozen = null; save(); renderRates(); update(); toast("Using today's rates."); });

/* ------------------------------------------------------------------ client cards */

const commOf = cid => (S.run.commission[cid] = S.run.commission[cid] || { on: false, amount: '', currency: '', split: '', include: {} });

function renderClients() {
  const { partners, clients } = S.settings;
  const box = $('#clientCards');
  if (!isSetUp()) { box.innerHTML = ''; return; }
  box.innerHTML = clients.map(c => {
    const rows = partners.map(p => {
      const key = p.id + '|' + c.id;
      const id = `h_${p.id}_${c.id}`;
      return `<div class="prow">
        <label class="pname" for="${id}">${esc(p.name)}</label>
        <input id="${id}" class="in time" data-hours="${key}" value="${esc(S.run.hours[key] || '')}" placeholder="H:MM"
          inputmode="decimal" autocomplete="off" spellcheck="false" aria-describedby="${id}_e">
        <span class="echo" id="${id}_e" data-echo="${key}"></span>
        <span class="amt" data-amt="${key}"></span>
      </div>`;
    }).join('');
    return `<section class="card client" aria-labelledby="ch_${c.id}">
      <div class="client-hd">
        <div><h3 id="ch_${c.id}">${esc(c.name)}</h3><p class="sub">${esc([c.about, 'pays in ' + c.currency].filter(Boolean).join(' · '))}</p></div>
        <span class="chip gold">${esc(usdRate(c.rate))}/hr</span>
      </div>
      <div>${rows}</div>
      ${c.commission ? commissionHtml(c) : ''}
    </section>`;
  }).join('');
}

function commissionHtml(c) {
  const cm = S.run.commission[c.id] || {};
  const cur = CODES.includes(cm.currency) ? cm.currency : c.currency;
  const split = cm.split !== undefined && cm.split !== '' ? cm.split : S.settings.split;
  const inc = cm.include || {};
  const shares = S.settings.partners.map(p => `<label><input type="checkbox" data-c-inc="${c.id}" data-pid="${p.id}" ${inc[p.id] === false ? '' : 'checked'}> ${esc(p.name)}</label>`).join('');
  return `<div class="comm">
    <label class="switch"><input type="checkbox" data-c-on="${c.id}" ${cm.on ? 'checked' : ''}> Commission this period</label>
    <div class="comm-body" data-c-body="${c.id}" ${cm.on ? '' : 'hidden'}>
      <div class="comm-fields">
        <div class="field"><label for="camt_${c.id}">Total commission</label>
          <div class="money">
            <select class="in" data-c-cur="${c.id}" aria-label="Commission currency">${CODES.map(k => `<option value="${k}" ${k === cur ? 'selected' : ''}>${k}</option>`).join('')}</select>
            <input id="camt_${c.id}" class="in mono" data-c-amt="${c.id}" value="${esc(cm.amount || '')}" inputmode="decimal" placeholder="0.00" autocomplete="off">
          </div>
        </div>
        <div class="field"><label for="csplit_${c.id}">Split between</label>
          <div class="affix"><input id="csplit_${c.id}" class="in mono" data-c-split="${c.id}" value="${esc(split)}" inputmode="numeric" autocomplete="off"><span>people</span></div>
        </div>
      </div>
      <fieldset class="shares"><legend>Shares go to</legend>${shares}</fieldset>
      <p class="comm-out" data-c-out="${c.id}"></p>
    </div>
  </div>`;
}

$('#clientCards').addEventListener('input', e => {
  const t = e.target, d = t.dataset;
  if (d.hours) { if (t.value.trim()) S.run.hours[d.hours] = t.value; else delete S.run.hours[d.hours]; }
  else if (d.cAmt) commOf(d.cAmt).amount = t.value;
  else if (d.cSplit) commOf(d.cSplit).split = t.value;
  else return;
  save(); update();
});
$('#clientCards').addEventListener('change', e => {
  const t = e.target, d = t.dataset;
  if (d.cOn) { commOf(d.cOn).on = t.checked; $(`[data-c-body="${d.cOn}"]`).hidden = !t.checked; if (t.checked) $('#camt_' + d.cOn).focus(); }
  else if (d.cCur) commOf(d.cCur).currency = t.value;
  else if (d.cInc) { const cm = commOf(d.cInc); cm.include = cm.include || {}; cm.include[d.pid] = t.checked; }
  else return;
  save(); update();
});

function durEcho(t) {
  if (t.dot) return `Read as ${fmtHM(t.minutes)} = ${t.decimal.toFixed(2)} hours`;
  return `${fmtHM(t.minutes)} = ${t.decimal.toFixed(2)} hours`;
}

/* ------------------------------------------------------------------ live update */

function update() {
  const R = compute();
  const hourlyByKey = {};
  R.slips.forEach(s => s.blocks.forEach(b => { if (b.hourly) hourlyByKey[b.key] = b.hourly; }));

  $$('[data-echo]').forEach(el => {
    const key = el.dataset.echo;
    const t = parseDuration(S.run.hours[key]);
    const inp = $(`[data-hours="${key}"]`);
    el.className = 'echo';
    if (!t) el.textContent = '';
    else if (t.error) { el.textContent = t.error; el.classList.add('bad'); }
    else { el.textContent = durEcho(t); if (t.dot) el.classList.add('warn'); }
    if (inp) inp.classList.toggle('bad', !!(t && t.error));
  });
  $$('[data-amt]').forEach(el => {
    const h = hourlyByKey[el.dataset.amt];
    el.textContent = h ? peso(h.php) : '–';
    el.classList.toggle('none', !h || h.php == null);
  });
  for (const c of S.settings.clients) {
    const out = $(`[data-c-out="${c.id}"]`);
    if (!out) continue;
    const sh = commissionShare(c);
    const cm = S.run.commission[c.id] || {};
    if (!sh) out.textContent = cm.amount && !(num(cm.amount) > 0) ? 'Type the amount as a number, like 250.00' : 'Type the total commission paid by ' + c.name + '.';
    else if (sh.php == null) out.textContent = `Needs the ${sh.cur} rate.`;
    else out.textContent = `${CUR[sh.cur].sym}${money(sh.amount)} × ₱${money(sh.fx)} ÷ ${sh.split} = ${peso(sh.php)} each`;
  }
  // which currencies matter this run
  for (const code of CODES) {
    const el = $(`[data-rate-use="${code}"]`);
    if (!el) continue;
    const uses = [];
    if (code === 'USD') uses.push('hourly pay');
    for (const c of S.settings.clients) { const sh = commissionShare(c); if (sh && sh.cur === code) uses.push(c.name + ' commission'); }
    el.textContent = uses.length ? uses.join(', ') : 'not used this run';
  }
  renderSlips(R);
}

function renderSlips(R) {
  const box = $('#slips');
  const share = canShareFiles();
  if (!R.slips.length) { box.innerHTML = ''; }
  else box.innerHTML = R.slips.map(s => {
    if (!s.blocks.length) {
      return `<article class="slip empty"><div class="slip-hd"><div class="slip-name">${esc(s.partner.name)}</div><span class="muted small">No hours yet</span></div></article>`;
    }
    const lines = s.blocks.map(b => {
      const out = [];
      if (b.hourly) out.push(`<li><span>${esc(b.client.name)} · ${b.hourly.hours.toFixed(2)} h × ${esc(usdRate(b.hourly.rate))} × ${b.hourly.fx != null ? '₱' + money(b.hourly.fx) : '?'}</span><b>${b.hourly.php != null ? money(b.hourly.php) : '–'}</b></li>`);
      if (b.commission) { const c = b.commission; out.push(`<li class="c"><span>${esc(b.client.name)} · ${CUR[c.cur].sym}${money(c.amount)} × ${c.fx != null ? '₱' + money(c.fx) : '?'} ÷ ${c.split}</span><b>${c.php != null ? money(c.php) : '–'}</b></li>`); }
      return out.join('');
    }).join('');
    const issues = s.issues.length ? `<div class="slip-issues">${s.issues.map(i => `<span class="chip warn">${esc(i)}</span>`).join('')}</div>` : '';
    const dis = s.ready ? '' : 'disabled';
    const pid = esc(s.partner.id);
    return `<article class="slip" data-pid="${pid}">
      <div class="slip-hd"><div class="slip-name">${esc(s.partner.name)}</div><div class="slip-total">${peso(s.total)}</div></div>
      <ul class="slip-lines">${lines}</ul>
      ${issues}
      <div class="slip-actions">
        <button class="btn gold" type="button" data-pdf="${pid}" ${dis}>Download PDF</button>
        ${share ? `<button class="btn" type="button" data-share="${pid}" ${dis}>Share PDF</button>` : ''}
        <button class="btn" type="button" data-copy="${pid}" ${dis}>Copy for chat</button>
      </div>
      <textarea class="in mono out" rows="9" readonly hidden aria-label="Text for chat"></textarea>
    </article>`;
  }).join('');
  $('#grandTotal').textContent = peso(R.grand);
  $('#grandNote').textContent = R.active.length
    ? `${R.active.length} ${R.active.length === 1 ? 'partner' : 'partners'} · ${R.hours.toFixed(2)} hours`
    : 'Type hours on the left and each payslip appears here.';
  $('#pdfAll').disabled = !R.ready;
  $('#saveRun').disabled = !R.ready;
}

/* ------------------------------------------------------------------ PDFs */

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
  if (!window.PayrollPDF) await loadScript('pdf.js');
  return window.PayrollPDF;
}
function canShareFiles() {
  try {
    return !!(navigator.canShare && matchMedia('(pointer: coarse)').matches &&
      navigator.canShare({ files: [new File(['x'], 'x.pdf', { type: 'application/pdf' })] }));
  } catch (e) { return false; }
}
const fileSafe = s => String(s).normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'Partner';

async function deliver(doc, filename, how) {
  const blob = doc.output('blob');
  if (how === 'share') {
    try { await navigator.share({ files: [new File([blob], filename, { type: 'application/pdf' })], title: filename }); }
    catch (e) { if (e && e.name !== 'AbortError') toast("Couldn't share. Use Download PDF instead."); }
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  toast('Saved ' + filename);
}

async function partnerPdf(pid, how, settings = S.settings, run = S.run) {
  try {
    const kit = await pdfKit();
    const ctx = ctxFor(settings, run);
    const slip = ctx.R.slips.find(s => s.partner.id === pid);
    if (!slip || !slip.ready) { toast('This payslip still has something to fix.'); return; }
    const doc = await kit.partner(slip, ctx, helpers);
    await deliver(doc, `Payslip-${fileSafe(slip.partner.name)}-${run.payDate}.pdf`, how);
  } catch (e) { toast("Couldn't make the PDF. Check your connection and try again."); console.error(e); }
}
async function allPdf(settings = S.settings, run = S.run) {
  try {
    const kit = await pdfKit();
    const ctx = ctxFor(settings, run);
    if (!ctx.R.ready) { toast('A payslip still has something to fix.'); return; }
    const doc = await kit.all(ctx, helpers);
    await deliver(doc, `Payroll-${run.payDate}.pdf`);
  } catch (e) { toast("Couldn't make the PDF. Check your connection and try again."); console.error(e); }
}
// shared with pdf.js so both write numbers and dates the same way
const helpers = { money, peso, usdRate, midTxt, fmtHM, periodText, longDate, parseIso, CUR };

$('#slips').addEventListener('click', async e => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  if (b.dataset.pdf) partnerPdf(b.dataset.pdf);
  else if (b.dataset.share) partnerPdf(b.dataset.share, 'share');
  else if (b.dataset.copy) {
    const slip = compute().slips.find(s => s.partner.id === b.dataset.copy);
    if (!slip) return;
    const text = chatText(slip, S.run);
    try { await navigator.clipboard.writeText(text); toast('Copied. Paste it in your chat.'); }
    catch (err) {
      const ta = b.closest('.slip').querySelector('textarea');
      ta.value = text; ta.hidden = false; ta.focus(); ta.select();
      toast('Select all and copy the text below.');
    }
  }
});
$('#pdfAll').addEventListener('click', () => allPdf());

/* ------------------------------------------------------------------ history */

function snapshot() {
  const ctx = ctxFor();
  return {
    id: uid('run'),
    savedAt: Date.now(),
    settings: clone(S.settings),
    run: clone({ ...S.run, frozen: null }),
    rates: clone(ctx.rates),
    totals: ctx.R.active.map(s => ({ name: s.partner.name, hours: s.hours, total: s.total })),
    grand: ctx.R.grand,
  };
}
$('#saveRun').addEventListener('click', () => {
  const snap = snapshot();
  const i = payRuns.findIndex(h => h.run.start === snap.run.start && h.run.end === snap.run.end);
  if (i >= 0) { snap.id = payRuns[i].id; payRuns[i] = snap; } else payRuns.unshift(snap);
  payRuns.sort((a, b) => (b.run.end || '').localeCompare(a.run.end || ''));
  saveHistory();
  renderHistory();
  toast(i >= 0 ? 'Updated this pay run in history.' : 'Saved to history.', { label: 'View', run: () => setTab('history') });
});

function histRun(h) { return { ...cleanRun(h.run), frozen: h.rates || {} }; }

function renderHistory() {
  const box = $('#histList');
  if (!payRuns.length) { box.innerHTML = '<p class="empty-note">No saved pay runs yet. After you pay your partners, tap Save to history on the Payroll tab.</p>'; return; }
  box.innerHTML = payRuns.map(h => {
    const per = periodText(parseIso(h.run.start), parseIso(h.run.end), ' – ');
    const who = (h.totals || []).map(t => `${esc(t.name)} ${peso(t.total)}`).join(' · ');
    return `<div class="hist" data-hid="${esc(h.id)}">
      <div class="hist-main"><span class="hist-period">${esc(per)}</span><span class="hist-sub">Paid ${esc(isoDateText(h.run.payDate))} · ${who}</span></div>
      <div class="hist-total">${peso(h.grand)}</div>
      <div class="hist-actions">
        <button class="btn btn-sm gold" type="button" data-h-pdf="${esc(h.id)}">Payslips PDF</button>
        <button class="btn btn-sm" type="button" data-h-open="${esc(h.id)}">Open in payroll</button>
        <button class="btn btn-sm ghost" type="button" data-h-del="${esc(h.id)}">Delete</button>
        <span class="confirm" data-h-confirm="${esc(h.id)}" hidden>Delete this pay run?
          <button class="btn btn-sm" type="button" data-h-yes="${esc(h.id)}">Yes, delete</button>
          <button class="link" type="button" data-h-no="${esc(h.id)}">Cancel</button></span>
      </div>
    </div>`;
  }).join('');
}
$('#histList').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset;
  const find = id => payRuns.find(h => h.id === id);
  if (d.hPdf) { const h = find(d.hPdf); if (h) allPdf(cleanSettings(h.settings), histRun(h)); }
  else if (d.hOpen) {
    const h = find(d.hOpen);
    if (!h) return;
    S.run = histRun(h);
    save(); renderPeriod(); renderRates(); renderClients(); update(); setTab('payroll');
    toast('Opened ' + periodText(parseIso(S.run.start), parseIso(S.run.end), ' – ') + ' with the rates saved then.');
  } else if (d.hDel) { $(`[data-h-confirm="${d.hDel}"]`).hidden = false; b.hidden = true; }
  else if (d.hNo) { $(`[data-h-confirm="${d.hNo}"]`).hidden = true; $(`[data-h-del="${d.hNo}"]`).hidden = false; }
  else if (d.hYes) { payRuns = payRuns.filter(h => h.id !== d.hYes); S.deleted = mergeDeleted(S.deleted, [d.hYes]); saveHistory(); renderHistory(); toast('Deleted.'); }
});

$('#exportBtn').addEventListener('click', async () => {
  if (!vault) return;
  const locked = await seal(vault.key, vault.salt, JSON.stringify({ settings: S.settings, history: payRuns }));
  const data = { app: 'partner-payroll', version: 2, exportedAt: new Date().toISOString(), locked };
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `payroll-backup-${iso(today())}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  toast('Backup downloaded. It only opens with your password, so it is safe in Google Drive.');
});
let pendingBackup = null;
async function restoreFrom(data, password) {
  const content = data.version >= 2 ? await unsealWith(password, data.locked) : data;
  if (content.settings) S.settings = cleanSettings(content.settings);
  const incoming = cleanHistory(content.history);
  const back = new Set(incoming.map(h => h.id));
  S.deleted = S.deleted.filter(id => !back.has(id)); // restoring brings deleted runs back
  payRuns = mergeHistory(payRuns, incoming, S.deleted);
  await saveNow();
  renderAll();
  toast(`Restored settings and ${incoming.length} pay ${incoming.length === 1 ? 'run' : 'runs'}.`);
}
$('#importFile').addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!f || !vault) return;
  let data = null;
  try { data = JSON.parse(await f.text()); } catch (err) { /* not JSON */ }
  if (!data || data.app !== 'partner-payroll') { toast("That file isn't a payroll backup."); return; }
  try { await restoreFrom(data, vault.password); $('#restorePw').hidden = true; }
  catch (err) {
    pendingBackup = data;
    $('#restorePw').hidden = false;
    $('#restorePwIn').focus();
    toast('This backup was locked with a different password. Type that password to open it.');
  }
});
$('#restorePwBtn').addEventListener('click', async () => {
  if (!pendingBackup) return;
  try {
    await restoreFrom(pendingBackup, $('#restorePwIn').value);
    pendingBackup = null;
    $('#restorePwIn').value = '';
    $('#restorePw').hidden = true;
  } catch (err) { toast("That password doesn't open this backup."); }
});

/* ------------------------------------------------------------------ timesheet */

function renderSheet() {
  $('#calcStep').value = String(S.sheet.step);
  $('#sumTitle').value = S.sheet.title;
  $('#calcRows').innerHTML = S.sheet.calc.map((r, i) => `<tr>
    <td><label class="sr" for="cs_${i}">Start time, row ${i + 1}</label><input id="cs_${i}" class="in time" data-cs="${i}" value="${esc(r.s)}" placeholder="HH:MM" inputmode="decimal" autocomplete="off"></td>
    <td><label class="sr" for="ce_${i}">End time, row ${i + 1}</label><input id="ce_${i}" class="in time" data-ce="${i}" value="${esc(r.e)}" placeholder="HH:MM" inputmode="decimal" autocomplete="off"></td>
    <td class="dur r" data-cd="${i}"></td>
    <td class="r">${S.sheet.calc.length > 1 ? `<button class="icon-btn" type="button" data-cdel="${i}" aria-label="Remove row ${i + 1}">×</button>` : ''}</td>
  </tr>`).join('');
  $('#sumRows').innerHTML = S.sheet.sums.map((v, i) => `<div class="sum-slot">
    <label for="sh_${i}">Hours ${i + 1}</label>
    <input id="sh_${i}" class="in time" data-sum="${i}" value="${esc(v)}" placeholder="H:MM" inputmode="decimal" autocomplete="off">
    <span class="echo" data-sum-e="${i}"></span>
  </div>`).join('');
  renderSendSelects();
  updateSheet();
}
function renderSendSelects() {
  const ps = S.settings.partners, cs = S.settings.clients;
  if (!ps.some(p => p.id === S.sheet.sendPid)) S.sheet.sendPid = ps[0] ? ps[0].id : '';
  if (!cs.some(c => c.id === S.sheet.sendCid)) S.sheet.sendCid = cs[0] ? cs[0].id : '';
  $('#sendPartner').innerHTML = ps.map(p => `<option value="${esc(p.id)}" ${p.id === S.sheet.sendPid ? 'selected' : ''}>${esc(p.name)}</option>`).join('') || '<option value="">No partners yet</option>';
  $('#sendClient').innerHTML = cs.map(c => `<option value="${esc(c.id)}" ${c.id === S.sheet.sendCid ? 'selected' : ''}>${esc(c.name)}</option>`).join('') || '<option value="">No clients yet</option>';
}
function calcResult() {
  let total = 0;
  const per = S.sheet.calc.map(r => {
    const a = parseClock(r.s), b = parseClock(r.e);
    if (!a && !b) return { empty: true };
    if (!a || !b) return { waiting: true };
    if (a.error || b.error) return { error: true };
    const m = blockMinutes(a.minutes, b.minutes, S.sheet.step);
    total += m;
    return { minutes: m };
  });
  return { total, per };
}
function sumResult() {
  let total = 0;
  const per = S.sheet.sums.map(v => { const t = parseDuration(v); if (t && !t.error) total += t.minutes; return t; });
  return { total, per };
}
function updateSheet() {
  const c = calcResult();
  c.per.forEach((r, i) => {
    const cell = $(`[data-cd="${i}"]`);
    cell.textContent = r.minutes != null ? fmtHM(r.minutes) : r.error ? 'Check' : '';
    cell.style.color = r.error ? 'var(--bad)' : '';
    for (const sel of [`[data-cs="${i}"]`, `[data-ce="${i}"]`]) {
      const inp = $(sel); const p = parseClock(inp.value); inp.classList.toggle('bad', !!(p && p.error));
    }
  });
  $('#calcTotal').textContent = fmtHM(c.total);
  $('#calcDec').textContent = decimalOf(c.total).toFixed(2) + ' hours';
  $('#calcMove').disabled = !(c.total > 0);

  const s = sumResult();
  s.per.forEach((t, i) => {
    const el = $(`[data-sum-e="${i}"]`);
    el.className = 'echo';
    if (!t) el.textContent = '';
    else if (t.error) { el.textContent = 'Check this'; el.classList.add('bad'); }
    else el.textContent = `${t.decimal.toFixed(2)} ${t.decimal === 1 ? 'hour' : 'hours'}`;
    $(`[data-sum="${i}"]`).classList.toggle('bad', !!(t && t.error));
  });
  $('#sumTotal').textContent = fmtHM(s.total);
  $('#sumDec').textContent = decimalOf(s.total).toFixed(2) + ' hours';
  $('#sendBtn').disabled = !(s.total > 0) || !isSetUp();
}
$('#calcRows').addEventListener('input', e => {
  const d = e.target.dataset;
  if (d.cs !== undefined) S.sheet.calc[+d.cs].s = e.target.value;
  else if (d.ce !== undefined) S.sheet.calc[+d.ce].e = e.target.value;
  else return;
  save(); updateSheet();
});
$('#calcRows').addEventListener('click', e => {
  const b = e.target.closest('[data-cdel]');
  if (!b) return;
  S.sheet.calc.splice(+b.dataset.cdel, 1);
  save(); renderSheet();
});
$('#calcAdd').addEventListener('click', () => { S.sheet.calc.push({ s: '', e: '' }); save(); renderSheet(); $(`#cs_${S.sheet.calc.length - 1}`).focus(); });
$('#calcStep').addEventListener('change', e => { S.sheet.step = +e.target.value; save(); updateSheet(); });
$('#calcClear').addEventListener('click', () => { S.sheet.calc = defaultSheet().calc; save(); renderSheet(); $('#cs_0').focus(); });
$('#calcMove').addEventListener('click', () => {
  const total = calcResult().total;
  if (!(total > 0)) return;
  let i = S.sheet.sums.findIndex(v => !String(v).trim());
  if (i < 0) { S.sheet.sums.push(''); i = S.sheet.sums.length - 1; }
  S.sheet.sums[i] = fmtHM(total);
  S.sheet.calc = defaultSheet().calc;
  save(); renderSheet();
  toast(`Moved ${fmtHM(total)} to Hours ${i + 1}.`);
  $('#cs_0').focus();
});
$('#sumRows').addEventListener('input', e => {
  const i = e.target.dataset.sum;
  if (i === undefined) return;
  S.sheet.sums[+i] = e.target.value;
  save(); updateSheet();
});
$('#sumAdd').addEventListener('click', () => { S.sheet.sums.push(''); save(); renderSheet(); $(`#sh_${S.sheet.sums.length - 1}`).focus(); });
$('#sumClear').addEventListener('click', () => { S.sheet.sums = Array(14).fill(''); save(); renderSheet(); });
$('#sumTitle').addEventListener('input', e => { S.sheet.title = e.target.value; save(); });
$('#sendPartner').addEventListener('change', e => { S.sheet.sendPid = e.target.value; save(); });
$('#sendClient').addEventListener('change', e => { S.sheet.sendCid = e.target.value; save(); });
$('#sendBtn').addEventListener('click', () => {
  const total = sumResult().total;
  const p = S.settings.partners.find(x => x.id === S.sheet.sendPid);
  const c = S.settings.clients.find(x => x.id === S.sheet.sendCid);
  if (!(total > 0) || !p || !c) return;
  const key = p.id + '|' + c.id;
  const before = S.run.hours[key];
  S.run.hours[key] = fmtHM(total);
  save(); renderClients(); update(); setTab('payroll');
  const inp = $(`[data-hours="${key}"]`);
  if (inp) { inp.scrollIntoView({ block: 'center', behavior: 'smooth' }); inp.focus({ preventScroll: true }); }
  toast(before ? `Replaced ${before} with ${fmtHM(total)} for ${p.name}, ${c.name}.` : `Added ${fmtHM(total)} for ${p.name}, ${c.name}.`);
});

/* ------------------------------------------------------------------ settings */

function renderSettings() {
  const s = S.settings;
  $('#sFee').value = s.feePct;
  $('#sSplit').value = s.split;
  $('#sBy').value = s.preparedBy;
  $('#sLoc').value = s.location;
  $('#partnerList').innerHTML = s.partners.length ? s.partners.map((p, i) => `<div class="set-row partner">
      <div class="field"><label for="sp_${p.id}">Partner ${i + 1}</label><input id="sp_${p.id}" class="in" data-sp="${p.id}" value="${esc(p.name)}" placeholder="Full name" autocomplete="off"></div>
      <button class="btn btn-sm ghost" type="button" data-sp-del="${p.id}">Remove</button>
    </div>`).join('') : '<p class="empty-note">No partners yet.</p>';
  $('#clientList').innerHTML = s.clients.length ? s.clients.map(c => `<div class="set-row client">
      <div class="fields">
        <div class="field"><label for="scn_${c.id}">Client</label><input id="scn_${c.id}" class="in" data-sc="${c.id}" data-f="name" value="${esc(c.name)}" placeholder="Name" autocomplete="off"></div>
        <div class="field"><label for="sca_${c.id}">Note</label><input id="sca_${c.id}" class="in" data-sc="${c.id}" data-f="about" value="${esc(c.about)}" placeholder="UK client" autocomplete="off"></div>
        <div class="field"><label for="scc_${c.id}">Pays you in</label><select id="scc_${c.id}" class="in" data-sc="${c.id}" data-f="currency">${CODES.map(k => `<option value="${k}" ${k === c.currency ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
        <div class="field"><label for="scr_${c.id}">Partner rate, USD/hr</label><input id="scr_${c.id}" class="in mono" data-sc="${c.id}" data-f="rate" value="${c.rate || ''}" inputmode="decimal" placeholder="0.00" autocomplete="off"></div>
      </div>
      <div class="row-ft">
        <label class="check"><input type="checkbox" data-sc="${c.id}" data-f="commission" ${c.commission ? 'checked' : ''}> Can pay commission</label>
        <button class="btn btn-sm ghost" type="button" data-sc-del="${c.id}">Remove</button>
      </div>
    </div>`).join('') : '<p class="empty-note">No clients yet.</p>';
}
let settingsTimer = 0;
function settingsChanged() {
  save();
  clearTimeout(settingsTimer);
  settingsTimer = setTimeout(() => { renderWelcome(); renderClients(); renderSendSelects(); renderRates(); update(); updateSheet(); }, 150);
}
$('#partnerList').addEventListener('input', e => {
  const p = S.settings.partners.find(x => x.id === e.target.dataset.sp);
  if (p) { p.name = e.target.value; settingsChanged(); }
});
$('#partnerList').addEventListener('click', e => {
  const id = e.target.dataset.spDel;
  if (!id) return;
  S.settings.partners = S.settings.partners.filter(p => p.id !== id);
  renderSettings(); settingsChanged();
});
$('#addPartner').addEventListener('click', () => {
  const p = { id: uid('p'), name: '' };
  S.settings.partners.push(p);
  renderSettings(); settingsChanged();
  $('#sp_' + p.id).focus();
});
function clientField(e) {
  const c = S.settings.clients.find(x => x.id === e.target.dataset.sc);
  const f = e.target.dataset.f;
  if (!c || !f) return;
  if (f === 'rate') c.rate = num(e.target.value) > 0 ? num(e.target.value) : 0;
  else if (f === 'commission') c.commission = e.target.checked;
  else if (f === 'currency') c.currency = e.target.value;
  else c[f] = e.target.value;
  settingsChanged();
}
$('#clientList').addEventListener('input', clientField);
$('#clientList').addEventListener('change', e => { if (['commission', 'currency'].includes(e.target.dataset.f)) clientField(e); });
$('#clientList').addEventListener('click', e => {
  const id = e.target.dataset.scDel;
  if (!id) return;
  S.settings.clients = S.settings.clients.filter(c => c.id !== id);
  renderSettings(); settingsChanged();
});
$('#addClient').addEventListener('click', () => {
  const c = { id: uid('c'), name: '', about: '', currency: 'USD', rate: 0, commission: false };
  S.settings.clients.push(c);
  renderSettings(); settingsChanged();
  $('#scn_' + c.id).focus();
});
$('#sFee').addEventListener('input', e => { const v = num(e.target.value); if (v >= 0 && v < 50) { S.settings.feePct = v; settingsChanged(); } });
$('#sSplit').addEventListener('input', e => { const v = parseInt(e.target.value, 10); if (v >= 1) { S.settings.split = v; settingsChanged(); } });
$('#sBy').addEventListener('input', e => { S.settings.preparedBy = e.target.value; save(); });
$('#sLoc').addEventListener('input', e => { S.settings.location = e.target.value; save(); });

// setup link: settings (and the sync connection, when sync is on), locked with the password
// and packed into the part after #, which browsers never send to a server
function b64url(str) {
  let bin = '';
  new TextEncoder().encode(str).forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(s) {
  let b = s.replace(/-/g, '+').replace(/_/g, '/');
  while (b.length % 4) b += '=';
  const bin = atob(b);
  return new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0)));
}
async function setupLink() {
  const { preparedBy, location: loc, feePct, split, partners, clients } = S.settings;
  const sync = S.sync ? { token: S.sync.token, gistId: S.sync.gistId } : null;
  const box = await seal(vault.key, vault.salt, JSON.stringify({ s: { preparedBy, location: loc, feePct, split, partners, clients }, sync }));
  return location.origin + location.pathname + '#setup=' + b64url(JSON.stringify(box));
}
function parseSetup(text) {
  const m = /#setup=([A-Za-z0-9_-]+)/.exec(String(text || ''));
  if (!m) return null;
  try { const j = JSON.parse(unb64url(m[1])); return j && (j.s || isBox(j)) ? j : null; } catch (e) { return null; }
}
$('#copySetup').addEventListener('click', async () => {
  if (!vault) return;
  const link = await setupLink();
  try {
    await navigator.clipboard.writeText(link);
    toast(S.sync ? 'Setup link copied. Open it on your phone and it joins sync.' : 'Setup link copied. It only opens with your password.');
  } catch (e) { const o = $('#setupOut'); o.value = link; o.hidden = false; o.focus(); o.select(); toast('Copy the link below.'); }
});
let pendingSetup = null;
function offerSetup(settings) {
  pendingSetup = settings;
  $('#setupBannerText').textContent = `Partners: ${settings.partners.map(p => p.name).join(', ') || 'none'}. Clients: ${settings.clients.map(c => c.name).join(', ') || 'none'}.`;
  $('#setupBanner').hidden = false;
}
$('#setupYes').addEventListener('click', () => {
  if (pendingSetup) S.settings = pendingSetup;
  pendingSetup = null;
  $('#setupBanner').hidden = true;
  save(); renderAll();
  toast('Settings loaded.');
});
$('#setupNo').addEventListener('click', () => { pendingSetup = null; $('#setupBanner').hidden = true; });
$('#setupPasteBtn').addEventListener('click', () => {
  const link = parseSetup($('#setupPaste').value);
  if (!link) { toast("That doesn't look like a setup link."); return; }
  $('#setupPaste').value = '';
  handleLink(link);
});
$('#setupPasteBtn2').addEventListener('click', () => {
  const link = parseSetup($('#setupPaste2').value);
  if (!link) { toast("That doesn't look like a setup link."); return; }
  $('#setupPaste2').value = '';
  handleLink(link);
});
$('#pwForm').addEventListener('submit', async e => {
  e.preventDefault();
  const pw = $('#pwNew').value;
  if (pw.length < 8) { toast('Use at least 8 characters.'); return; }
  if (pw !== $('#pwNew2').value) { toast("The two passwords don't match."); return; }
  if (S.sync) {
    // bring in the other devices' changes first, while their copy still opens with the old password
    await syncNow();
    if (syncState === 'password') { toast('Sync needs your current password first. Tap Type password under Sync.'); return; }
    if (syncState !== 'ok') { toast("Sync can't reach GitHub right now. Change the password when you're back online, so your other devices get it."); return; }
    S.sync.rotate = true; // the next sync moves to a fresh gist locked with the new password, even if this one fails
  }
  vault = await newVault(pw, crypto.getRandomValues(new Uint8Array(16)));
  await saveNow();
  await rememberSession();
  if (S.sync) await syncNow();
  $('#pwNew').value = '';
  $('#pwNew2').value = '';
  const hadBio = !!bioSaved();
  if (hadBio) { try { localStorage.removeItem(BKEY); } catch (x) { /* ignore */ } renderBio(); }
  toast('Password changed.' + (S.sync ? ' Your other devices open with the old password (or fingerprint) one more time, then ask for the new one.' : '') + (hadBio ? ' Turn fingerprint unlock on again below.' : ''));
});
$('#resetBtn').addEventListener('click', () => { $('#resetConfirm').hidden = false; $('#resetBtn').hidden = true; });
$('#resetNo').addEventListener('click', () => { $('#resetConfirm').hidden = true; $('#resetBtn').hidden = false; });
$('#resetYes').addEventListener('click', () => {
  S.settings = cleanSettings(null); S.run = defaultRun(); S.sheet = defaultSheet();
  $('#resetConfirm').hidden = true; $('#resetBtn').hidden = false;
  save(); renderAll(); toast('Reset. History is still there.');
});

/* ------------------------------------------------------------------ sync between devices */

// Each device keeps its own locked copy. With sync on, the same locked copy is also kept in a
// secret gist on Jan's GitHub account, so the laptop and phone show the same payroll. GitHub
// only ever holds scrambled text: it is sealed with the same key as the copy on each device.
const GH = 'https://api.github.com';
const GIST_FILE = 'partner-payroll-sync.json';
const GIST_DESC = 'Partner Payroll sync (encrypted)';
let syncState = 'idle'; // idle | syncing | ok | offline | busy | token | scope | password | error
let syncDetail = '';
let syncTimer = 0;
let syncRunning = null;
let syncQueued = false;
let syncDirty = false;
let pendingRemote = null; // a sync copy locked with a password this device doesn't have yet

class SyncError extends Error { constructor(code, detail) { super(detail || code); this.code = code; } }

function mergeDeleted(a, b) {
  const ids = [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])].filter(x => typeof x === 'string');
  return [...new Set(ids)].sort().slice(-500); // sorted, so both devices write the same list
}
// pay runs from both sides: one per pay period, the most recently saved wins, deletions stick
function mergeHistory(local, remote, deleted) {
  const gone = new Set(deleted || []);
  const byPeriod = new Map();
  for (const h of [...cleanHistory(local), ...cleanHistory(remote)]) {
    if (gone.has(h.id)) continue;
    const k = (h.run.start || '') + '|' + (h.run.end || '');
    const cur = byPeriod.get(k);
    if (!cur || (+h.savedAt || 0) > (+cur.savedAt || 0)) byPeriod.set(k, h);
  }
  return [...byPeriod.values()].sort((a, b) => (b.run.end || '').localeCompare(a.run.end || '') || (+b.savedAt || 0) - (+a.savedAt || 0));
}
function normalizeRemote(d) {
  const deleted = mergeDeleted([], d && d.deleted);
  return {
    settings: cleanSettings(d && d.settings), run: cleanRun(d && d.run), sheet: cleanSheet(d && d.sheet),
    history: mergeHistory([], d && d.history, deleted), deleted, updatedAt: +(d && d.updatedAt) || 0,
  };
}

async function gh(path, opts = {}) {
  let r;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    r = await fetch(GH + path, {
      method: opts.method || 'GET',
      cache: 'no-store',
      signal: ctl.signal,
      headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + S.sync.token, ...(opts.body ? { 'Content-Type': 'application/json' } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch (e) { throw new SyncError('offline'); } finally { clearTimeout(timer); }
  if (r.status === 401) throw new SyncError('token');
  if (r.status === 429 || (r.status === 403 && r.headers.get('x-ratelimit-remaining') === '0')) throw new SyncError('busy');
  if (r.status === 403) throw new SyncError('scope');
  if (r.status === 404) return null;
  if (!r.ok) throw new SyncError('error', 'GitHub answered ' + r.status);
  return r.status === 204 ? {} : r.json();
}
async function findGist() {
  const list = await gh('/gists?per_page=100');
  const g = Array.isArray(list) ? list.find(x => x && x.files && x.files[GIST_FILE]) : null;
  return g ? g.id : '';
}
// { exists, copy } where copy is the parsed sync file, or null when it is missing or unreadable
async function readGist(id) {
  const g = await gh('/gists/' + id);
  if (!g) return { exists: false, copy: null };
  const f = g.files && g.files[GIST_FILE];
  if (!f) return { exists: true, copy: null };
  let text = f.content;
  if (f.truncated && f.raw_url) {
    try { text = await (await fetch(f.raw_url, { cache: 'no-store' })).text(); } catch (e) { throw new SyncError('offline'); }
  }
  try {
    const j = JSON.parse(text);
    if (j && j.kind === 'moved' && typeof j.movedTo === 'string') return { exists: true, copy: null, movedTo: j.movedTo };
    return { exists: true, copy: j && isBox(j.box) ? j : null };
  } catch (e) { return { exists: true, copy: null }; }
}

// Bring the sync copy into this device. Returns the normalized remote, or 'password' when it is
// locked with a password this device doesn't have.
async function mergeRemote(copy) {
  if (!vault) return 'locked';
  const box = copy.box;
  let data = null;
  if (box.salt === bytesToB64(vault.salt)) { try { data = await unseal(vault.key, box); } catch (e) { data = null; } }
  if (!data) {
    if (!vault.password) { pendingRemote = box; return 'password'; }
    try {
      const salt = b64ToBytes(box.salt);
      const next = await newVault(vault.password, salt, box.iter || ITER);
      data = await unseal(next.key, box);
      if (!vault) return 'locked';
      vault = next; // same password, other devices' key: share it from now on
      await rememberSession();
    } catch (e) { pendingRemote = box; return 'password'; }
  }
  if (!vault) return 'locked'; // locked while the copy was being opened
  pendingRemote = null;
  const remote = normalizeRemote(data);
  const before = contentKey();
  const takeRemote = (S.sync && S.sync.adopt) || remote.updatedAt > S.updatedAt;
  if (takeRemote) {
    S.settings = remote.settings; S.run = remote.run; S.sheet = remote.sheet;
    S.updatedAt = remote.updatedAt;
  }
  if (S.sync) S.sync.adopt = false; // taken once; later syncs compare dates, even if this round's upload fails
  S.deleted = mergeDeleted(S.deleted, remote.deleted);
  payRuns = mergeHistory(payRuns, remote.history, S.deleted);
  markClean(); // what came from the other device isn't an edit made here
  if (contentKey() !== before) refreshFromRemote();
  return remote;
}
function refreshFromRemote() {
  const a = document.activeElement;
  const typing = a && a.id && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) ? a.id : '';
  renderAll();
  if (typing && document.getElementById(typing)) document.getElementById(typing).focus();
  toast('Updated with changes from your other device.');
}

async function syncNow(opts = {}) {
  if (!vault || !S.sync) return;
  if (syncRunning) { syncQueued = true; return syncRunning; }
  clearTimeout(syncTimer);
  syncDirty = false;
  syncRunning = (async () => {
    if (!opts.quiet) setSync('syncing');
    try {
      const sync = S.sync;
      const sealed = async () => {
        const text = JSON.stringify(syncPayload(normalizeRemote(currentState())));
        return { text, content: JSON.stringify({ app: 'partner-payroll', kind: 'sync', v: 1, updatedAt: S.updatedAt, box: await seal(vault.key, vault.salt, text) }) };
      };
      if (sync.rotate) {
        // new password: a fresh gist holds the copy locked with it, and the old gist (whose earlier
        // revisions were locked with the old password) first points to the new one, then is deleted
        const { content } = await sealed();
        const g = await gh('/gists', { method: 'POST', body: { description: GIST_DESC, public: false, files: { [GIST_FILE]: { content } } } });
        if (!g || !g.id) throw new SyncError('scope');
        const old = sync.gistId;
        sync.gistId = g.id;
        sync.rotate = false;
        if (old && old !== g.id) {
          try {
            await gh('/gists/' + old, { method: 'PATCH', body: { files: { [GIST_FILE]: { content: JSON.stringify({ app: 'partner-payroll', kind: 'moved', movedTo: g.id }) } } } });
            await gh('/gists/' + old, { method: 'DELETE' });
          } catch (e) { /* the pointer or the new gist is enough for the other devices */ }
        }
      } else {
        let found = sync.gistId ? await readGist(sync.gistId) : { exists: false, copy: null };
        if (found.movedTo) { sync.gistId = found.movedTo; found = await readGist(sync.gistId); }
        if (!found.exists) { // first time on this device, or the gist was deleted on GitHub
          sync.gistId = await findGist();
          found = sync.gistId ? await readGist(sync.gistId) : { exists: false, copy: null };
          if (found.movedTo) { sync.gistId = found.movedTo; found = await readGist(sync.gistId); }
        }
        let remoteKey = null;
        if (found.copy) {
          const remote = await mergeRemote(found.copy);
          if (remote === 'locked') return;
          if (remote === 'password') { setSync('password'); return; }
          remoteKey = JSON.stringify(syncPayload(remote));
        }
        if (!vault) return; // locked meanwhile: nothing more to send
        const { text: localKey, content } = await sealed();
        if (localKey !== remoteKey) {
          if (found.exists && !found.movedTo) {
            await gh('/gists/' + sync.gistId, { method: 'PATCH', body: { files: { [GIST_FILE]: { content } } } });
          } else {
            const g = await gh('/gists', { method: 'POST', body: { description: GIST_DESC, public: false, files: { [GIST_FILE]: { content } } } });
            if (!g || !g.id) throw new SyncError('scope');
            sync.gistId = g.id;
          }
        }
      }
      if (S.sync) { S.sync.lastSyncAt = Date.now(); S.sync.adopt = false; }
      if (S.sync && !S.sync.login) { try { const me = await gh('/user'); if (me && S.sync) S.sync.login = me.login || ''; } catch (e) { /* only for the label */ } }
      setSync('ok');
    } catch (e) {
      setSync(e && e.code ? e.code : 'error', e && e.code === 'error' ? e.message : '');
      if (e && !e.code) console.error(e);
    } finally {
      saveNow(); // keeps the gist id and sync time; not counted as an edit
    }
  })();
  try { await syncRunning; } finally {
    syncRunning = null;
    if (syncQueued) { syncQueued = false; syncNow({ quiet: true }); }
  }
}
function scheduleSync() {
  if (!S.sync) return;
  syncDirty = true;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncNow({ quiet: true }), 2500);
}
setInterval(() => { if (vault && S.sync && document.visibilityState === 'visible') syncNow({ quiet: true }); }, 60000);
document.addEventListener('visibilitychange', () => {
  if (!vault || !S.sync) return;
  if (document.visibilityState === 'visible') syncNow({ quiet: true });
  else if (syncDirty) syncNow({ quiet: true }); // send changes before switching to the other device
});
window.addEventListener('online', () => { if (vault && S.sync) syncNow({ quiet: true }); });

function ago(t) {
  if (!t) return 'not yet';
  const sec = Math.round((Date.now() - t) / 1000);
  if (sec < 45) return 'just now';
  const m = Math.round(sec / 60);
  if (m < 60) return m + (m === 1 ? ' minute ago' : ' minutes ago');
  const h = Math.round(m / 60);
  if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
  return 'on ' + new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
const SYNC_LABEL = {
  idle: ['Sync on', ''], syncing: ['Syncing', ''], ok: ['Synced', 'ok'], offline: ['Offline', 'warn'], busy: ['Sync paused', 'warn'],
  token: ['Sync stopped', 'bad'], scope: ['Sync stopped', 'bad'], password: ['Needs password', 'warn'], error: ['Sync problem', 'bad'],
};
function setSync(state, detail) { syncState = state; syncDetail = detail || ''; renderSync(); }
function renderSync() {
  const on = !!S.sync;
  const [label, tone] = SYNC_LABEL[syncState] || SYNC_LABEL.idle;
  const chip = $('#syncChip');
  chip.hidden = !on || !vault;
  chip.className = 'chip mast-chip' + (tone ? ' ' + tone : '');
  chip.textContent = label;
  $('#syncOff').hidden = on;
  $('#syncOnBox').hidden = !on;
  const cc = $('#syncCardChip');
  cc.className = 'chip' + (on && tone ? ' ' + tone : '');
  cc.textContent = on ? label : 'Off';
  if (!on) return;
  const who = S.sync.login ? ` to GitHub as ${S.sync.login}` : ' to GitHub';
  $('#syncText').textContent = {
    idle: `Connected${who}.`,
    syncing: `Connected${who}. Syncing now...`,
    ok: `Connected${who}. Last synced ${ago(S.sync.lastSyncAt)}.`,
    offline: "GitHub can't be reached right now. Your changes are saved on this device and will sync when you're back online.",
    busy: 'GitHub asked the app to slow down. It tries again in a minute.',
    token: "GitHub didn't accept the token. It may have expired or been deleted. Paste a new one below.",
    scope: "This token can't save gists. Make a new one with the gist box ticked and paste it below.",
    password: 'Your other device uses a different password, or it was changed there. Type that password to keep syncing.',
    error: 'Something went wrong while syncing. It tries again in a minute.' + (syncDetail ? ` (${syncDetail})` : ''),
  }[syncState] || `Connected${who}.`;
  $('#syncFix').hidden = syncState !== 'password';
  $('#syncNewToken').hidden = !['token', 'scope'].includes(syncState);
}
setInterval(() => { if (S.sync && syncState === 'ok') renderSync(); }, 30000);

const looksLikeToken = t => /^(gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})$/.test(t);
async function connectToken(token, keepGist) {
  const prev = S.sync;
  S.sync = { token, gistId: keepGist && prev ? prev.gistId : '', login: '', lastSyncAt: 0, adopt: keepGist && prev ? prev.adopt : true };
  try {
    const me = await gh('/user');
    if (!me) throw new SyncError('token');
    S.sync.login = me.login || '';
  } catch (e) {
    S.sync = prev;
    renderSync();
    toast(e.code === 'offline' ? "Couldn't reach GitHub. Check your connection and try again." : "GitHub didn't accept that token. Copy it again and paste it here.");
    return false;
  }
  await saveNow();
  renderSync();
  await syncNow();
  if (syncState === 'ok') toast('Sync is on. Copy your setup link to add your phone.');
  return true;
}
$('#syncOn').addEventListener('click', async e => {
  const token = $('#syncToken').value.trim();
  if (!looksLikeToken(token)) { toast("That doesn't look like a GitHub token. It starts with ghp_ or github_pat_."); return; }
  e.target.disabled = true;
  try { if (await connectToken(token, false)) $('#syncToken').value = ''; } finally { e.target.disabled = false; }
});
$('#syncTokenSave').addEventListener('click', async e => {
  const token = $('#syncToken2').value.trim();
  if (!looksLikeToken(token)) { toast("That doesn't look like a GitHub token. It starts with ghp_ or github_pat_."); return; }
  e.target.disabled = true;
  try { if (await connectToken(token, true)) $('#syncToken2').value = ''; } finally { e.target.disabled = false; }
});
$('#syncNowBtn').addEventListener('click', () => syncNow());
$('#syncFix').addEventListener('click', () => { if (pendingRemote) showLock('repass'); });
$('#syncOffBtn').addEventListener('click', async () => {
  S.sync = null;
  setSync('idle');
  await saveNow();
  toast('Sync is off on this device. Your data stays here, and your other devices keep syncing.');
});

/* ------------------------------------------------------------------ app shell */

let installPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; $('#installBtn').hidden = false; });
$('#installBtn').addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  try { await installPrompt.userChoice; } catch (e) { /* closed */ }
  installPrompt = null;
  $('#installBtn').hidden = true;
});
window.addEventListener('appinstalled', () => { $('#installBtn').hidden = true; toast('Installed. Open Payroll from your home screen or app list.'); });

if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    if (!vault) location.reload(); // still on the lock screen: nothing to lose
    else toast('A new version of the app is ready.', { label: 'Reload', run: () => lockNow().catch(() => location.reload()) });
  });
}

function renderAll() {
  renderWelcome(); renderPeriod(); renderRates(); renderClients(); renderSheet(); renderSettings(); renderHistory(); renderSync(); renderBio(); update();
}

// for checks in the browser console and automated tests
window.payroll = { parseDuration, parseClock, blockMinutes, paypalFromMid, round2, compute, chatText, state: S, sync: () => ({ state: syncState, gistId: S.sync && S.sync.gistId }) };

/* ------------------------------------------------------------------ staying unlocked */

// A refresh keeps Jan in: IndexedDB holds this window's copy of the key, wrapped with a secret that
// lives only in this window's sessionStorage. Closing the app or tab drops the secret, so what is
// left in IndexedDB is useless, and other pages of the site (another tab, a tracking script) never
// see the secret. The copy is also refused after 3 minutes without use, and wiped on Lock.
const IDLE_MS = 3 * 60 * 1000;
const WKEY = 'gjr-payroll-window';
let idbOpen = null;
function idb(mode, fn) {
  idbOpen = idbOpen || new Promise((resolve, reject) => {
    const r = indexedDB.open('gjr-payroll', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return idbOpen.then(db => new Promise((resolve, reject) => {
    const tx = db.transaction('kv', mode);
    const req = fn(tx.objectStore('kv'));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = tx.onabort = () => reject(tx.error);
  }));
}
// this window's id and secret, made on first use
function windowSecret(create) {
  let w = null;
  try { w = JSON.parse(sessionStorage.getItem(WKEY) || 'null'); } catch (e) { w = null; }
  if ((!w || typeof w.id !== 'string' || typeof w.secret !== 'string') && create) {
    w = { id: bytesToB64(crypto.getRandomValues(new Uint8Array(9))).replace(/[^A-Za-z0-9]/g, ''), secret: bytesToB64(crypto.getRandomValues(new Uint8Array(32))) };
    try { sessionStorage.setItem(WKEY, JSON.stringify(w)); } catch (e) { return null; }
  }
  return w && typeof w.id === 'string' && typeof w.secret === 'string' ? w : null;
}
const secretKey = w => crypto.subtle.importKey('raw', b64ToBytes(w.secret), 'AES-GCM', false, ['encrypt', 'decrypt']);
const sessionGet = w => idb('readonly', st => st.get('session:' + w.id)).catch(() => null);
function sessionDrop() {
  const w = windowSecret(false);
  try { sessionStorage.removeItem(WKEY); } catch (e) { /* ignore */ }
  return w ? idb('readwrite', st => st.delete('session:' + w.id)).catch(() => {}) : Promise.resolve();
}
// clear copies from windows that were closed or left idle (and the older single-key format)
function sessionSweep() {
  return idb('readwrite', st => {
    const req = st.openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return;
      const k = String(c.key);
      const v = c.value;
      if (k === 'session' || (k.startsWith('session:') && !(v && Date.now() - (+v.at || 0) <= IDLE_MS))) c.delete();
      c.continue();
    };
    return null;
  }).catch(() => {});
}
let lastActive = Date.now();
let lastStamp = 0;
let wrapped = null; // { salt, iv, data, forKey } for the key currently in use
async function rememberSession() {
  if (!vault || !vault.raw) return;
  lastStamp = Date.now();
  try {
    const w = windowSecret(true);
    if (!w) return; // sessionStorage blocked: a refresh asks for the password
    if (!wrapped || wrapped.forKey !== vault.key) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await secretKey(w), vault.raw));
      if (!vault) return;
      wrapped = { salt: bytesToB64(vault.salt), iv: bytesToB64(iv), data: bytesToB64(data), forKey: vault.key };
    }
    const rec = { salt: wrapped.salt, iv: wrapped.iv, data: wrapped.data, at: lastActive };
    await idb('readwrite', st => st.put(rec, 'session:' + w.id));
  } catch (e) { /* a refresh then asks for the password */ }
}
// the key from this window's copy, or null
async function sessionRestore(box) {
  const w = windowSecret(false);
  if (!w) return null;
  const rec = await sessionGet(w);
  if (!rec || rec.salt !== box.salt || !(Date.now() - (+rec.at || 0) <= IDLE_MS)) return null;
  try {
    const raw = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(rec.iv) }, await secretKey(w), b64ToBytes(rec.data)));
    const key = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    return { key, raw, salt: b64ToBytes(box.salt), password: null };
  } catch (e) { return null; }
}
function noteActivity() {
  lastActive = Date.now();
  if (vault && lastActive - lastStamp > 10000) rememberSession();
}
for (const ev of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll']) {
  (ev === 'scroll' ? window : document).addEventListener(ev, noteActivity, { passive: true });
}
window.addEventListener('pagehide', () => { rememberSession(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') rememberSession(); });

async function lockNow() {
  await saveNow();
  if (vault && S.sync && syncDirty) { // an edit made just before locking still reaches the other devices
    await Promise.race([syncNow({ quiet: true }), new Promise(r => setTimeout(r, 4000))]);
  }
  await sessionDrop();
  vault = null; // stops the page from writing the key back while it unloads
  location.reload();
}
$('#lockNowBtn').addEventListener('click', lockNow);
const idleTooLong = () => vault && Date.now() - lastActive > IDLE_MS;
setInterval(() => { if (idleTooLong()) lockNow(); }, 10000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && idleTooLong()) lockNow(); });

/* ------------------------------------------------------------------ fingerprint unlock */

// A passkey on this device with the WebAuthn PRF extension: the fingerprint releases a secret that
// only that passkey can produce, and the secret opens a copy of the password kept on this device.
// Without the finger (or the phone's screen lock) the copy can't be read.
const BKEY = 'gjr-payroll-bio-v1';
const BASKED = 'gjr-payroll-bio-asked';
let bioSupport = null;
// only a yes is remembered: a sensor that wasn't ready a moment ago may be now
async function bioAvailable() {
  if (bioSupport) return true;
  let yes = false;
  try {
    if (window.PublicKeyCredential && window.isSecureContext) {
      const caps = PublicKeyCredential.getClientCapabilities ? await PublicKeyCredential.getClientCapabilities() : null;
      yes = !(caps && caps['extension:prf'] === false) && !!(await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
    }
  } catch (e) { yes = false; }
  bioSupport = yes || null;
  return yes;
}
function bioSaved() {
  const b = readJSON(BKEY);
  return b && typeof b.cred === 'string' && typeof b.prfSalt === 'string' && isBox(b.box) ? b : null;
}
const randomBytes = n => crypto.getRandomValues(new Uint8Array(n));
async function prfKey(secret) {
  const base = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: new TextEncoder().encode('partner-payroll fingerprint unlock') },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function bioSecret(credB64, prfSalt) {
  const cred = await navigator.credentials.get({ publicKey: {
    challenge: randomBytes(32),
    rpId: location.hostname,
    allowCredentials: [{ type: 'public-key', id: b64ToBytes(credB64) }],
    userVerification: 'required',
    timeout: 60000,
    extensions: { prf: { eval: { first: prfSalt } } },
  } });
  const r = cred && cred.getClientExtensionResults().prf;
  if (!r || !r.results || !r.results.first) throw new Error('no-prf');
  return new Uint8Array(r.results.first);
}
async function bioEnroll(password) {
  const prfSalt = randomBytes(32);
  const cred = await navigator.credentials.create({ publicKey: {
    rp: { name: 'Partner Payroll', id: location.hostname },
    user: { id: randomBytes(16), name: 'Partner Payroll', displayName: 'Partner Payroll' },
    challenge: randomBytes(32),
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'preferred', userVerification: 'required' },
    timeout: 60000,
    extensions: { prf: { eval: { first: prfSalt } } },
  } });
  const ext = cred.getClientExtensionResults().prf || {};
  if (ext.enabled === false) throw new Error('no-prf');
  const credB64 = bytesToB64(new Uint8Array(cred.rawId));
  // some phones hand the secret back straight away; others need one more touch
  const secret = ext.results && ext.results.first ? new Uint8Array(ext.results.first) : await bioSecret(credB64, prfSalt);
  const box = await seal(await prfKey(secret), prfSalt, JSON.stringify(password));
  writeJSON(BKEY, { cred: credB64, prfSalt: bytesToB64(prfSalt), box });
}
async function renderBio() {
  const on = !!bioSaved();
  const ok = await bioAvailable();
  $('#bioChip').className = 'chip' + (on ? ' ok' : '');
  $('#bioChip').textContent = on ? 'On' : 'Off';
  $('#bioOn').hidden = on;
  $('#bioOn').classList.toggle('gold', ok);
  $('#bioOff').hidden = !on;
  if (on) $('#bioPwWrap').hidden = true;
  $('#bioText').textContent = on
    ? 'On for this device. The lock screen asks for your fingerprint first, and your password still works too.'
    : ok ? 'Unlock with your fingerprint instead of typing your password. It uses a passkey saved on this device.'
      : "This browser can't do fingerprint unlock for web apps. Chrome can still fill in your password with your fingerprint: in Chrome open Settings, Password Manager, and turn on Use screen lock.";
}
$('#bioOn').addEventListener('click', async () => {
  if (!vault) return;
  if (!(await bioAvailable())) {
    renderBio();
    toast("This browser can't do fingerprint unlock for web apps. Chrome can still fill in your password with your fingerprint.");
    return;
  }
  let pw = vault.password;
  if (!pw) { // the app was refreshed since the password was typed
    const wrap = $('#bioPwWrap');
    if (wrap.hidden) { wrap.hidden = false; $('#bioPw').focus(); toast('Type your password once, then tap the button again.'); return; }
    pw = $('#bioPw').value;
    if (!pw) { $('#bioPw').focus(); return; }
    try { await unseal(await deriveKey(pw, vault.salt), JSON.parse(localStorage.getItem(VKEY))); }
    catch (e) { toast("That password isn't right."); return; }
    vault.password = pw;
  }
  try {
    await bioEnroll(pw);
    $('#bioPw').value = '';
    $('#bioPwWrap').hidden = true;
    toast('Fingerprint unlock is on for this device.');
  } catch (e) {
    toast(e && e.message === 'no-prf' ? "This phone or browser can't do fingerprint unlock for web apps yet. Chrome can still fill in your password with your fingerprint."
      : e && e.name === 'NotAllowedError' ? 'Fingerprint setup was cancelled.' : "Couldn't turn on fingerprint unlock. Try again.");
  }
  renderBio();
});
$('#bioOff').addEventListener('click', () => {
  try { localStorage.removeItem(BKEY); } catch (x) { /* ignore */ }
  renderBio();
  toast('Fingerprint unlock is off. You can also delete the Partner Payroll passkey in Google Password Manager.');
});
async function maybeOfferBio() {
  if (bioSaved() || readJSON(BASKED) || !(await bioAvailable())) return;
  $('#bioBanner').hidden = false;
}
$('#bioYes').addEventListener('click', () => { $('#bioBanner').hidden = true; $('#bioOn').click(); });
$('#bioNo').addEventListener('click', () => { $('#bioBanner').hidden = true; writeJSON(BASKED, 1); });

let bioBusy = false;
async function unlockWithFingerprint(auto) {
  const saved = bioSaved();
  if (!saved || bioBusy || lockMode !== 'unlock') return;
  bioBusy = true;
  const err = $('#lockErr');
  const btn = $('#bioBtn');
  err.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Touch the sensor...';
  try {
    const secret = await bioSecret(saved.cred, b64ToBytes(saved.prfSalt));
    let pw;
    try { pw = await unseal(await prfKey(secret), saved.box); } catch (x) { throw new Error('stale'); }
    btn.textContent = 'Opening...';
    if (!(await openWithPassword(pw))) throw new Error('stale');
    await afterUnlock();
  } catch (e) {
    if (e && e.message === 'stale') {
      try { localStorage.removeItem(BKEY); } catch (x) { /* ignore */ }
      btn.hidden = true;
      $('#lockBtn').classList.add('gold');
      err.textContent = 'Your password was changed, so fingerprint unlock needs turning on again. Type your password.';
    } else if (!(e && e.name === 'NotAllowedError')) {
      err.textContent = "Fingerprint didn't work this time. Try again, or type your password.";
    } else if (!auto) {
      err.textContent = 'Fingerprint didn\'t open it. If this keeps happening, type your password, then turn fingerprint unlock off and on again in Settings.';
    }
  } finally {
    bioBusy = false;
    btn.disabled = false;
    btn.textContent = 'Unlock with fingerprint';
  }
}
$('#bioBtn').addEventListener('click', () => unlockWithFingerprint(false));

/* ------------------------------------------------------------------ lock screen */

let lockMode = 'unlock'; // create | unlock | join | repass
let pendingLink = null;
function takeLinkFromAddress() {
  const link = parseSetup(location.hash);
  if (link) { try { window.history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ } }
  return link;
}

function showLock(mode) {
  lockMode = mode;
  const T = {
    create: ['Create your password', 'It locks your partners, rates, hours and pay history on this device. Nobody can open them without it.', 'Create password'],
    unlock: ['Partner Payroll', 'Type your password to open your payroll.', 'Unlock'],
    join: ['Set up this device', 'Type the password you use on your other device. This device will use it too.', 'Set up'],
    repass: ['Type your new password', "Your password was changed on another device. Type the new one to keep syncing; this device will use it too. If you didn't change it, tap Not now and turn sync off in Settings.", 'Continue'],
  }[mode];
  $('#lockTitle').textContent = T[0];
  $('#lockMsg').textContent = T[1];
  $('#lockBtn').textContent = T[2];
  $('#lockFields').hidden = false;
  $('#lockPw2Wrap').hidden = mode !== 'create';
  $('#lockPw').setAttribute('autocomplete', mode === 'create' ? 'new-password' : 'current-password');
  $('#lockNote').hidden = mode !== 'create';
  $('#lockForgot').hidden = mode !== 'unlock';
  $('#lockCancel').hidden = !(vault && (mode === 'join' || mode === 'repass'));
  const bio = mode === 'unlock' && !!bioSaved();
  $('#bioBtn').hidden = !bio;
  $('#lockBtn').classList.toggle('gold', !bio);
  $('#forgotConfirm').hidden = true;
  $('#forgotBtn').hidden = false;
  $('#lockErr').textContent = '';
  $('#lockPw').value = '';
  $('#lockPw2').value = '';
  $('#lockBtn').disabled = false;
  $('#lock').hidden = false;
  $('.mast').inert = true;
  $('main').inert = true;
  setTimeout(() => $('#lockPw').focus(), 30);
}
function hideLock() {
  $('#lock').hidden = true;
  $('.mast').inert = false;
  $('main').inert = false;
}
// data saved before the lock existed moves inside it, then the plain copy goes
function takeLegacy() {
  const legacy = readJSON(KEY) || {};
  const legacyHistory = readJSON(HKEY);
  return { ...legacy, history: Array.isArray(legacyHistory) ? legacyHistory : [] };
}
function dropLegacy() { try { localStorage.removeItem(KEY); localStorage.removeItem(HKEY); } catch (x) { /* ignore */ } }

// what a setup link brings: settings, and the sync connection when sync was on
function applyLink(payload, fresh) {
  const settings = payload && payload.s ? cleanSettings(payload.s) : null;
  const sync = cleanSync(payload && payload.sync);
  if (sync) {
    S.sync = { ...sync, adopt: true }; // this device's first sync takes the other devices' copy
    if (settings && fresh) S.settings = settings;
    return 'sync';
  }
  if (settings) { if (fresh) S.settings = settings; else offerSetup(settings); }
  return 'settings';
}
// a setup link opened while unlocked: use it if the current key or password opens it, else ask
async function handleLink(link) {
  if (!link || !vault) return;
  if (link.s) { offerSetup(cleanSettings(link.s)); return; } // the very first links were not locked
  let payload = null;
  try { payload = await unsealWith(vault.password, link); } catch (e) { payload = null; }
  if (!payload) { pendingLink = link; showLock('join'); return; }
  if (link.salt !== bytesToB64(vault.salt)) { // same password, made on another device: share its key from now on
    vault = await newVault(vault.password, b64ToBytes(link.salt), link.iter || ITER);
    await rememberSession();
  }
  if (applyLink(payload, false) === 'sync') {
    await saveNow();
    renderSync();
    await syncNow();
    if (syncState === 'ok') toast('Sync is on for this device.');
  }
}

// open this device's copy with a password; false when it's the wrong one
async function openWithPassword(pw) {
  const box = readJSON(VKEY);
  const next = await newVault(pw, b64ToBytes(box.salt), box.iter || ITER);
  let data;
  try { data = await unseal(next.key, box); } catch (x) { return false; }
  vault = next;
  loadState(data);
  return true;
}

$('#lockForm').addEventListener('submit', async e => {
  e.preventDefault();
  const pw = $('#lockPw').value;
  const err = $('#lockErr');
  const btn = $('#lockBtn');
  err.textContent = '';
  if (!pw) { err.textContent = 'Type your password.'; return; }
  if (lockMode === 'create') {
    if (pw.length < 8) { err.textContent = 'Use at least 8 characters.'; return; }
    if (pw !== $('#lockPw2').value) { err.textContent = "The two passwords don't match."; return; }
  }
  const label = btn.textContent;
  const startMode = lockMode;
  btn.disabled = true;
  btn.textContent = 'Opening...';
  let joinedSync = false;
  try {
    if (lockMode === 'unlock') {
      if (!(await openWithPassword(pw))) { err.textContent = "That password isn't right. Changed it on another device? Use the old one here once; this device then asks for the new one."; return; }
    } else if (lockMode === 'create') {
      vault = await newVault(pw, crypto.getRandomValues(new Uint8Array(16)));
      loadState(takeLegacy());
      cleanKey = null;
      await saveNow();
      dropLegacy();
    } else if (lockMode === 'join') {
      const link = pendingLink;
      const next = await newVault(pw, b64ToBytes(link.salt), link.iter || ITER);
      let payload;
      try { payload = await unseal(next.key, link); } catch (x) { err.textContent = "That password doesn't open this setup link."; return; }
      const fresh = !vault;
      if (fresh) loadState(takeLegacy());
      vault = next;
      pendingLink = null;
      joinedSync = applyLink(payload, fresh) === 'sync';
      cleanKey = null;
      await saveNow();
      if (fresh) dropLegacy();
    } else if (lockMode === 'repass') {
      const box = pendingRemote;
      const next = await newVault(pw, b64ToBytes(box.salt), box.iter || ITER);
      try { await unseal(next.key, box); } catch (x) { err.textContent = "That password isn't right."; return; }
      vault = next; // this device now uses the same password as the others
      pendingRemote = null;
      await saveNow();
      if (bioSaved()) { try { localStorage.removeItem(BKEY); } catch (x) { /* ignore */ } } // it held the old password
    }
    await afterUnlock();
    if (joinedSync) bootSync.then(() => { if (syncState === 'ok') toast('This device is set up and syncing.'); });
    maybeOfferBio();
  } finally {
    btn.disabled = false;
    if (lockMode === startMode) btn.textContent = label; // another screen may have taken over meanwhile
  }
});
$('#lockCancel').addEventListener('click', () => { pendingLink = null; hideLock(); });
$('#forgotBtn').addEventListener('click', () => { $('#forgotConfirm').hidden = false; $('#forgotBtn').hidden = true; });
$('#forgotNo').addEventListener('click', () => { $('#forgotConfirm').hidden = true; $('#forgotBtn').hidden = false; });
$('#forgotYes').addEventListener('click', async () => {
  try { localStorage.removeItem(VKEY); localStorage.removeItem(BKEY); } catch (x) { /* ignore */ }
  await sessionDrop();
  showLock(pendingLink && isBox(pendingLink) ? 'join' : 'create');
});

async function afterUnlock() {
  lastActive = Date.now();
  await rememberSession();
  hideLock();
  // ask Chrome not to clear this site's data when the phone runs low on space
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (x) { /* ignore */ }
  await boot();
}
async function boot() {
  renderAll();
  const hashTab = location.hash.replace('#', '');
  if (TABS.includes(hashTab)) S.tab = hashTab;
  setTab(isSetUp() ? S.tab : 'payroll');
  markClean();
  if (pendingLink) { const link = pendingLink; pendingLink = null; await handleLink(link); }
  bootSync = S.sync && vault ? syncNow() : Promise.resolve();
}
let bootSync = Promise.resolve();
window.addEventListener('hashchange', () => {
  const link = takeLinkFromAddress();
  if (!link) return;
  if (vault) handleLink(link);
  else { pendingLink = link; if (!isBox(readJSON(VKEY)) && isBox(link)) showLock('join'); }
});

async function start() {
  pendingLink = takeLinkFromAddress();
  const box = readJSON(VKEY);
  if (isBox(box)) {
    const restored = await sessionRestore(box);
    if (restored) {
      try {
        const data = await unseal(restored.key, box);
        vault = restored;
        loadState(data);
        sessionSweep();
        await afterUnlock();
        return;
      } catch (e) { /* the saved key no longer fits: ask for the password */ }
    }
    await sessionDrop();
    sessionSweep();
    showLock('unlock');
    if (bioSaved()) unlockWithFingerprint(true); // ask for the fingerprint straight away
  } else if (pendingLink && isBox(pendingLink)) showLock('join');
  else showLock('create');
}
start();
refreshRates();
})();
