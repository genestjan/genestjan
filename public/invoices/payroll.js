/* Payroll inside Work Hub: paying the partners on salary day.
   Ported from the Partner Payroll app with the same sums: hours (in decimal, as on the timesheet) x the
   client's partner rate in US dollars x the PayPal rate (mid-market less the PayPal cut), plus a
   share of a client's commission. What's new: each partner's hours for each client come from the
   time they tracked in the pay period, and can still be typed over.
   app.js keeps the data (and syncs it); this file draws the Payroll tab and does the sums.
   Nothing personal is written here. */
(() => {
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const pad = n => String(n).padStart(2, '0');
const validId = v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v);

// the same currencies as the invoices; USD, GBP and AUD always have a rate row, others when used
const CUR = {
  USD: { sym: '$', name: 'US dollar' },
  GBP: { sym: '£', name: 'UK pound' },
  AUD: { sym: 'A$', name: 'Australian dollar' },
  EUR: { sym: '€', name: 'Euro' },
  CAD: { sym: 'C$', name: 'Canadian dollar' },
  NZD: { sym: 'NZ$', name: 'New Zealand dollar' },
  SGD: { sym: 'S$', name: 'Singapore dollar' },
  PHP: { sym: '₱', name: 'Philippine peso' },
};
const CODES = Object.keys(CUR);
const BASE = ['USD', 'GBP', 'AUD'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/* ------------------------------------------------------------------ money */

// Round to centavos, half up, without floating point noise (291.6 x 60.3 is 17583.479999...).
const round2 = x => Math.round(Number((x * 100).toPrecision(12))) / 100;
function num(v) {
  const s = String(v ?? '').replace(/[^\d.]/g, '');
  if (!s) return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
// ppcurrencyconverter.com: amount x mid-market rate, minus that amount x 4% rounded to centavos
const paypalFromMid = (mid, pct) => round2(mid - round2(mid * pct / 100));
const money = x => Number(x).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const peso = x => (x == null ? '–' : '₱' + money(x));
const usdRate = r => '$' + (Number.isInteger(r) ? String(r) : money(r));
const midTxt = r => Number(r).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const addUp = arr => (arr.some(v => v == null) ? null : round2(arr.reduce((a, v) => a + v, 0)));

/* ------------------------------------------------------------------ time, as on the timesheet */

// 94:36; a period works like a colon (7.15 = 7:15, 12.8 = 12:08), 130 = 1:30, 8 = 8:00, "94h 36m" works
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
function dur(h, min, dot) { return { h, m: min, minutes: h * 60 + min, decimal: Number((h + min / 60).toFixed(2)), dot }; }
const fmtHM = minutes => { const t = Math.round(minutes); return `${Math.floor(t / 60)}:${pad(t % 60)}`; };
const decimalOf = minutes => { const t = Math.round(minutes); return Number((Math.floor(t / 60) + (t % 60) / 60).toFixed(2)); };
// a clock time for the Calculate Hours table: 8, 8:30, 8.30, 830, 17:30, 5:30p, 5:30 pm
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
// an end time earlier than its start gets 12 hours added until it is later (12:10 to 3 = 2:50)
function blockMinutes(start, end, step) { const a = snap(start, step); let b = snap(end, step); while (b < a) b += 720; return b - a; }

/* ------------------------------------------------------------------ dates */

const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseIso = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const today = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
const longDate = d => (d ? `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` : '');
function periodText(s, e, sep) {
  if (!s || !e) return '';
  if (s.getFullYear() === e.getFullYear()) return `${MONTHS[s.getMonth()]} ${s.getDate()}${sep}${MONTHS[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
  return `${longDate(s)}${sep}${longDate(e)}`;
}
const isoDateText = s => longDate(parseIso(s));

/* ------------------------------------------------------------------ data (kept and synced by app.js) */

const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
function defaultRun() {
  const end = addDays(today(), -1);
  return { start: iso(addDays(end, -12)), end: iso(end), payDate: iso(today()), hours: {}, commission: {}, rateOverride: {}, frozen: null, saved: false };
}
const KEY = /^[A-Za-z0-9_-]{1,40}\|[A-Za-z0-9_-]{1,40}$/;
function cleanRates(x) {
  const out = {};
  for (const c of CODES) {
    const r = obj(x)[c];
    if (!r || !(+r.rate > 0)) continue;
    out[c] = { rate: +r.rate, mid: +r.mid || 0, pct: +r.pct || 0, date: String(r.date || '').slice(0, 10), manual: !!r.manual };
  }
  return out;
}
// a pay run; with given dates nothing here depends on today, so the same run always cleans the same
function cleanRun(x) {
  const r = defaultRun();
  const o = obj(x);
  for (const k of ['start', 'end', 'payDate']) if (parseIso(o[k])) r[k] = o[k];
  for (const [k, v] of Object.entries(obj(o.hours)).sort()) if (KEY.test(k) && typeof v === 'string' && v.trim()) r.hours[k] = v.slice(0, 20);
  for (const [k, v] of Object.entries(obj(o.commission)).sort()) {
    if (!validId(k) || !v || typeof v !== 'object') continue;
    const inc = {};
    for (const [p, on] of Object.entries(obj(v.include)).sort()) if (validId(p)) inc[p] = !!on;
    r.commission[k] = { on: !!v.on, amount: String(v.amount ?? '').slice(0, 20), currency: CODES.includes(v.currency) ? v.currency : '', split: String(v.split ?? '').slice(0, 3), include: inc };
  }
  for (const c of CODES) if (typeof obj(o.rateOverride)[c] === 'string' && o.rateOverride[c].trim()) r.rateOverride[c] = o.rateOverride[c].slice(0, 12);
  r.frozen = o.frozen && typeof o.frozen === 'object' ? cleanRates(o.frozen) : null;
  r.saved = !!o.saved;
  return r;
}
function defaultSheet() { return { calc: [{ s: '', e: '' }, { s: '', e: '' }, { s: '', e: '' }], step: 1, sums: Array(14).fill(''), title: 'Sum Hours', sendPid: '', sendCid: '' }; }
function cleanSheet(x) {
  const d = defaultSheet();
  if (!x || typeof x !== 'object') return d;
  if (Array.isArray(x.calc) && x.calc.length) d.calc = x.calc.slice(0, 40).map(r => ({ s: String((r && r.s) ?? '').slice(0, 8), e: String((r && r.e) ?? '').slice(0, 8) }));
  if ([1, 5, 6, 7, 10, 15, 30, 60].includes(+x.step)) d.step = +x.step;
  if (Array.isArray(x.sums) && x.sums.length) d.sums = x.sums.slice(0, 62).map(v => String(v ?? '').slice(0, 10));
  if (typeof x.title === 'string') d.title = x.title.slice(0, 60);
  if (validId(x.sendPid)) d.sendPid = x.sendPid;
  if (validId(x.sendCid)) d.sendCid = x.sendCid;
  return d;
}
// the Payroll tab's own state: null until something is changed, so an untouched app syncs nothing.
// Its parts sync on their own (at = when each was last changed), so an edit to one part on one device
// never undoes an edit to another part on another device.
const PARTS = ['settings', 'run', 'sheet'];
function cleanPayroll(x) {
  if (!x || typeof x !== 'object') return null;
  const s = obj(x.settings), at = obj(x.at), u = +x.updatedAt || 0;
  return {
    settings: { preparedBy: String(s.preparedBy ?? 'Genest Jan Ramirez').slice(0, 80), location: String(s.location ?? '').slice(0, 80), split: parseInt(s.split, 10) >= 1 ? parseInt(s.split, 10) : 3 },
    run: cleanRun(x.run), sheet: cleanSheet(x.sheet), updatedAt: u,
    at: Object.fromEntries(PARTS.map(k => [k, +at[k] > 0 ? +at[k] : u])),
  };
}
const blankPayroll = () => ({ settings: { preparedBy: 'Genest Jan Ramirez', location: '', split: 3 }, run: defaultRun(), sheet: defaultSheet(), updatedAt: 0, at: { settings: 0, run: 0, sheet: 0 } });
// a saved pay run keeps the partners, clients, rates and hours of that day, so its payslips never change
function cleanSnapSettings(x) {
  const o = obj(x);
  return {
    preparedBy: String(o.preparedBy ?? '').slice(0, 80), location: String(o.location ?? '').slice(0, 80),
    feePct: num(o.feePct) >= 0 && num(o.feePct) < 50 ? num(o.feePct) : 4, split: parseInt(o.split, 10) >= 1 ? parseInt(o.split, 10) : 3,
    partners: (Array.isArray(o.partners) ? o.partners : []).filter(p => p && validId(p.id)).slice(0, 30).map(p => ({ id: p.id, name: String(p.name ?? '').slice(0, 80) })),
    clients: (Array.isArray(o.clients) ? o.clients : []).filter(c => c && validId(c.id)).slice(0, 30).map(c => ({
      id: c.id, name: String(c.name ?? '').slice(0, 60), about: String(c.about ?? '').slice(0, 60),
      currency: CODES.includes(c.currency) ? c.currency : 'USD', rate: num(c.rate) > 0 ? num(c.rate) : 0, commission: !!c.commission,
    })),
  };
}
function cleanPayRun(x) {
  if (!x || typeof x !== 'object' || !validId(x.id) || !x.run || typeof x.run !== 'object' || !parseIso(x.run.start) || !parseIso(x.run.end)) return null;
  return {
    id: x.id, savedAt: +x.savedAt || 0, settings: cleanSnapSettings(x.settings), run: { ...cleanRun(x.run), frozen: null, saved: false }, rates: cleanRates(x.rates),
    totals: (Array.isArray(x.totals) ? x.totals : []).slice(0, 30).map(t => ({ name: String((t && t.name) ?? '').slice(0, 80), hours: +(t && t.hours) || 0, total: +(t && t.total) || 0 })),
    grand: +x.grand || 0, updatedAt: +x.updatedAt || +x.savedAt || 0,
  };
}

/* ------------------------------------------------------------------ the sums */

function rateInfo(code, run, settings, live) {
  if (code === 'PHP') return { code, rate: 1, fixed: true }; // already pesos
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
function commissionShare(c, run, settings, live) {
  const cm = run.commission[c.id];
  const amount = num(cm && cm.amount);
  if (!c.commission || !cm || !cm.on || !(amount > 0)) return null;
  const cur = CODES.includes(cm.currency) ? cm.currency : c.currency;
  const split = parseInt(cm.split, 10) >= 1 ? parseInt(cm.split, 10) : settings.split;
  const ri = rateInfo(cur, run, settings, live);
  return { amount, cur, split, fx: ri ? ri.rate : null, php: ri ? round2(ri.rate * amount / split) : null, include: cm.include || {} };
}
function compute(settings, run, live) {
  const usd = rateInfo('USD', run, settings, live);
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
        b.hourly = { hm: fmtHM(t.minutes), hours: t.decimal, rate: c.rate, usd: round2(t.decimal * c.rate), fx, php: fx != null ? round2(t.decimal * c.rate * fx) : null };
        if (fx == null) issues.push('Needs the USD rate');
        if (!(c.rate > 0)) issues.push(`${c.name} has no partner rate`);
      }
      const share = commissionShare(c, run, settings, live);
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

/* ------------------------------------------------------------------ the Payroll tab */

// Hooks from app.js:
//   state()            the payroll state (a blank one until first changed); change(fn) edits it and saves
//   runs()             saved pay runs, newest first; saveRun(rec), deleteRun(id)
//   partners()         [{ id, name }] who gets paid
//   clients()          [{ id, name, about, currency, rate, commission }] with a partner rate or commission
//   tracked(from, to)  { 'partner|client': minutes } from the time partners tracked
//   feePct()           the PayPal cut, %
//   live()             { CODE: { mid, date, feed, at } }; setLive(code, rate) keeps a fetched rate
//   goto(tab)          another tab of the app
function mount(H) {
  const root = H.root;
  let view = 'run';
  let rateState = 'saved';
  const live = () => { const L = H.live(); const out = {}; for (const c of CODES) if (L[c] && L[c].mid > 0) out[c] = { ...L[c], fresh: Date.now() - (L[c].at || 0) < 6 * 3600000 }; return out; };
  // rate rows: USD, GBP and AUD as always, plus another currency when a commission this run uses it
  function rateCodes() {
    const run = P().run, extra = new Set();
    for (const c of H.clients()) if (c.commission) { const cm = run.commission[c.id]; extra.add(cm && CODES.includes(cm.currency) ? cm.currency : c.currency); }
    return [...BASE, ...CODES.filter(c => !BASE.includes(c) && c !== 'PHP' && extra.has(c))];
  }
  const P = () => H.state();
  const settings = () => ({ ...P().settings, feePct: H.feePct(), partners: H.partners(), clients: H.clients() });
  // the run with each partner's hours filled in: typed hours first, else the time they tracked
  function effectiveRun(run = P().run) {
    if (run.saved) return run; // a saved run reopened: its hours as saved
    const t = H.tracked(run.start, run.end);
    const hours = {};
    for (const p of H.partners()) for (const c of H.clients()) {
      const k = p.id + '|' + c.id;
      if (run.hours[k]) hours[k] = run.hours[k];
      else if (t[k] > 0) hours[k] = fmtHM(t[k]);
    }
    return { ...run, hours };
  }
  const isSetUp = () => H.partners().length > 0 && H.clients().length > 0;
  const commOf = (run, cid) => (run.commission[cid] = run.commission[cid] || { on: false, amount: '', currency: '', split: '', include: {} });

  root.innerHTML = `
    <div class="filters pr-views" role="group" aria-label="Payroll">
      <button class="fchip" type="button" data-prview="run" aria-pressed="true">Pay run</button>
      <button class="fchip" type="button" data-prview="history" aria-pressed="false">History</button>
      <button class="fchip" type="button" data-prview="calc" aria-pressed="false">Hours calculator</button>
    </div>
    <section id="prWelcome" class="card welcome" hidden>
      <h2>Set up payroll</h2>
      <p>Payroll pays your partners for the clients they work on. Add your partners under Settings, Team, and give each client a partner rate (US dollars an hour) under Clients.</p>
      <div class="welcome-actions"><button class="btn gold" type="button" data-goto="clients">Set partner rates</button><button class="btn" type="button" data-goto="settings">Add partners</button></div>
    </section>
    <div id="prRun" class="work">
      <div class="col-in stack">
        <section class="card" aria-labelledby="pr-h-period">
          <div class="card-hd"><h2 id="pr-h-period">Pay period</h2><span class="chip" id="prDays"></span></div>
          <div class="fields three">
            <div class="field"><label for="prStart">From</label><input type="date" id="prStart" class="in"></div>
            <div class="field"><label for="prEnd">To</label><input type="date" id="prEnd" class="in"></div>
            <div class="field"><label for="prPay">Pay date</label><input type="date" id="prPay" class="in"></div>
          </div>
          <p class="note" id="prPeriodNote"></p>
          <div class="card-ft">
            <button id="prNew" class="btn ghost" type="button">Start next pay run</button>
            <div id="prNewConfirm" class="confirm" hidden><span>This clears typed hours, commission and typed rates.</span><button id="prNewYes" class="btn btn-sm" type="button">Yes, start it</button><button id="prNewNo" class="link" type="button">Cancel</button></div>
          </div>
        </section>
        <section class="card" aria-labelledby="pr-h-rates">
          <div class="card-hd"><h2 id="pr-h-rates">PayPal rates</h2><span id="prRateChip" class="chip"></span></div>
          <p id="prRateNote" class="note"></p>
          <div id="prRateRows" class="rate-rows"></div>
          <div class="card-ft">
            <button id="prRateRefresh" class="btn ghost" type="button">Refresh rates</button>
            <button id="prRateUnfreeze" class="btn ghost" type="button" hidden>Use today's rates</button>
            <a class="link" href="https://ppcurrencyconverter.com/" target="_blank" rel="noopener">Check on ppcurrencyconverter.com</a>
          </div>
        </section>
        <div id="prCards" class="stack"></div>
        <section class="card" aria-labelledby="pr-h-details">
          <div class="card-hd"><h2 id="pr-h-details">Payslip details</h2></div>
          <div class="fields three">
            <div class="field"><label for="prBy">Prepared by</label><input id="prBy" class="in" autocomplete="off"></div>
            <div class="field"><label for="prLoc">Location</label><input id="prLoc" class="in" autocomplete="off" placeholder="City, Philippines"></div>
            <div class="field"><label for="prSplitDef">Usual commission split</label><div class="affix"><input id="prSplitDef" class="in mono" inputmode="numeric" autocomplete="off"><span>people</span></div></div>
          </div>
        </section>
      </div>
      <aside class="col-out" aria-labelledby="pr-h-slips">
        <div class="aside-in">
          <div class="card-hd"><h2 id="pr-h-slips">Payslips</h2><span class="muted small" id="prSlipPeriod"></span></div>
          <div id="prSlips" class="stack"></div>
          <section class="grand" aria-label="Total payroll">
            <div class="grand-top"><span class="eyebrow">Total payroll</span><strong id="prGrand" class="big">₱0.00</strong><span id="prGrandNote" class="muted small"></span></div>
            <div class="grand-actions"><button id="prPdfAll" class="btn gold" type="button">Download all payslips</button><button id="prSave" class="btn" type="button">Save to history</button></div>
          </section>
        </div>
      </aside>
    </div>
    <section id="prHistory" class="card" aria-labelledby="pr-h-hist" hidden>
      <div class="card-hd"><h2 id="pr-h-hist">Pay history</h2><span class="muted small">Synced with your other devices</span></div>
      <div id="prHistList" class="hist-list"></div>
    </section>
    <div id="prCalc" hidden>
      <div class="ts-grid">
        <section class="card" aria-labelledby="pr-h-calc">
          <div class="card-hd"><h2 id="pr-h-calc">Calculate hours</h2></div>
          <p class="note">Type the start and end time of each block worked.</p>
          <div class="table-wrap"><table class="calc"><thead><tr><th scope="col">Start time</th><th scope="col">End time</th><th scope="col" class="r">Hours</th><th scope="col"><span class="sr">Remove</span></th></tr></thead><tbody id="prCalcRows"></tbody></table></div>
          <div class="card-ft">
            <button id="prCalcAdd" class="btn ghost" type="button">Add row</button>
            <div class="field inline-field"><label for="prCalcStep">Round before calculating</label>
              <select id="prCalcStep" class="in"><option value="1">No rounding</option><option value="5">Nearest 5-minute mark</option><option value="6">Nearest 6-minute mark</option><option value="7">Nearest 7-minute mark</option><option value="10">Nearest 10-minute mark</option><option value="15">Nearest 15-minute mark</option><option value="30">Nearest 30-minute mark</option><option value="60">Nearest 60-minute mark</option></select></div>
          </div>
          <div class="result"><span class="eyebrow">Total</span><strong id="prCalcTotal" class="big mono">0:00</strong><span id="prCalcDec" class="muted">0.00 hours</span></div>
          <div class="card-ft"><button id="prCalcMove" class="btn gold" type="button">Move to Sum</button><button id="prCalcClear" class="btn" type="button">Clear all</button></div>
        </section>
        <section class="card" aria-labelledby="prSumTitleLbl">
          <div class="card-hd"><label id="prSumTitleLbl" class="sr" for="prSumTitle">Title</label><input id="prSumTitle" class="title-in" value="Sum Hours" autocomplete="off"></div>
          <p class="note">Type each day's hours, like 6:35 or 8.15. The total adds the minutes first, then converts once.</p>
          <div id="prSumRows" class="sum-rows"></div>
          <div class="card-ft"><button id="prSumAdd" class="btn ghost" type="button">Add slot</button><button id="prSumClear" class="btn ghost" type="button">Clear all</button></div>
          <div class="result"><span class="eyebrow">Total</span><strong id="prSumTotal" class="big mono">0:00</strong><span id="prSumDec" class="muted">0.00 hours</span></div>
          <div class="send">
            <span class="eyebrow">Use this total in payroll</span>
            <div class="send-row">
              <label class="sr" for="prSendPartner">Partner</label><select id="prSendPartner" class="in"></select>
              <label class="sr" for="prSendClient">Client</label><select id="prSendClient" class="in"></select>
              <button id="prSendBtn" class="btn gold" type="button">Add to payroll</button>
            </div>
          </div>
        </section>
      </div>
      <details class="card tips">
        <summary>How times are read</summary>
        <ul>
          <li>A period works like a colon: 7.15 is 7:15, and 12.8 is 12:08.</li>
          <li>3 or 4 digits with no colon become H:MM: 130 is 1:30, 1207 is 12:07. 1 or 2 digits are whole hours: 8 is 8:00.</li>
          <li>If an end time is earlier than its start, 12 hours are added, so 12:10 to 3 is 2:50. For long blocks use 24-hour time, or am and pm, like 8a or 5:30p.</li>
          <li>Decimal hours are hours plus minutes divided by 60, rounded to 2 places: 94:36 is 94.60.</li>
        </ul>
      </details>
    </div>`;

  /* ---- period */
  function renderPeriod() {
    const run = P().run;
    setVal('prStart', run.start); setVal('prEnd', run.end); setVal('prPay', run.payDate);
    $('#prPeriodNote').textContent = run.saved
      ? 'This is a saved pay run, with the hours as saved. Time tracked since then is not added unless you change the dates.'
      : 'Hours fill in from the time your partners tracked in this period. Type over any of them to use your own.';
    const ps = P().settings;
    setVal('prBy', ps.preparedBy); setVal('prLoc', ps.location); setVal('prSplitDef', String(ps.split));
    const s = parseIso(run.start), e = parseIso(run.end);
    const chip = $('#prDays');
    if (s && e && e >= s) { chip.className = 'chip'; chip.textContent = `${Math.round((e - s) / 86400000) + 1} days`; }
    else { chip.className = 'chip warn'; chip.textContent = 'End is before start'; }
    $('#prSlipPeriod').textContent = periodText(s, e, ' – ');
  }
  function setVal(id, v) { const el = document.getElementById(id); if (el && document.activeElement !== el && el.value !== v) el.value = v; }

  /* ---- rates */
  function renderRates() {
    const run = P().run;
    const chip = $('#prRateChip'), note = $('#prRateNote');
    const pct = H.feePct();
    const L = live();
    const frozen = !!(run.frozen && Object.keys(run.frozen).length);
    const shown = rateCodes();
    const dates = [...new Set(shown.map(c => L[c] && L[c].date).filter(Boolean))];
    const when = dates.length ? dates.map(isoDateText).join(', ') : 'an earlier day';
    $('#prRateUnfreeze').hidden = !frozen;
    if (frozen) { chip.className = 'chip gold'; chip.textContent = 'Saved with this run'; note.textContent = 'These are the rates saved with this pay run, so the payslips match what was paid.'; }
    else if (rateState === 'loading') { chip.className = 'chip'; chip.textContent = 'Checking'; note.textContent = "Getting today's mid-market rates..."; }
    else if (shown.every(c => L[c] && L[c].fresh)) { chip.className = 'chip ok'; chip.innerHTML = '<span class="dot"></span>Live'; note.textContent = `Mid-market rates of ${when} from the same feed ppcurrencyconverter.com uses, less your ${pct}% PayPal cut. Type over a rate to use your own.`; }
    else if (shown.some(c => L[c])) { chip.className = 'chip warn'; chip.textContent = 'Saved rates'; note.textContent = `These are the last rates fetched (${when}). Refresh, or type today's rate from ppcurrencyconverter.com.`; }
    else { chip.className = 'chip bad'; chip.textContent = 'No rates'; note.textContent = "Couldn't reach the rate feed. On ppcurrencyconverter.com enter 1, pick the currency and Philippines Pesos, and type the PayPal Conversion figure below."; }
    const box = $('#prRateRows');
    if (box.dataset.codes !== shown.join()) {
      box.dataset.codes = shown.join();
      box.innerHTML = shown.map(c => `<div class="rate-row">
        <div class="rate-cur"><b>1 ${c}</b> <span class="small muted" data-rate-use="${c}"></span><button class="link small" type="button" data-rate-reset="${c}" hidden>Use live rate</button></div>
        <div class="rate-calc mono" data-rate-calc="${c}"></div>
        <div><label class="sr" for="pr_r_${c}">PayPal rate, pesos per ${c}</label><input id="pr_r_${c}" class="in rate-in" data-rate="${c}" inputmode="decimal" autocomplete="off" placeholder="0.00"></div>
      </div>`).join('');
    }
    const st = settings();
    for (const c of shown) {
      const ri = rateInfo(c, run, st, L);
      const Lc = L[c];
      const calc = $(`[data-rate-calc="${c}"]`);
      if (ri && ri.frozen) calc.textContent = ri.mid ? `${midTxt(ri.mid)} − ${ri.pct}%` : 'Typed in';
      else if (ri && ri.manual) calc.textContent = Lc ? `Live: ${money(paypalFromMid(Lc.mid, pct))}` : 'Typed in';
      else if (Lc) calc.textContent = `${midTxt(Lc.mid)} − ${pct}% (${money(round2(Lc.mid * pct / 100))}) =`;
      else calc.textContent = rateState === 'loading' ? '...' : 'No live rate';
      const inp = $(`[data-rate="${c}"]`);
      inp.readOnly = frozen;
      if (document.activeElement !== inp) inp.value = ri ? ri.rate.toFixed(2) : '';
      $(`[data-rate-reset="${c}"]`).hidden = !(ri && ri.manual && !frozen && Lc);
    }
  }
  async function refreshRates() {
    rateState = 'loading';
    renderRates();
    await H.refreshRates(rateCodes());
    rateState = 'saved';
    renderRates();
    update();
  }

  /* ---- client cards */
  function renderCards() {
    const box = $('#prCards');
    if (!isSetUp()) { box.innerHTML = ''; return; }
    const run = P().run;
    const partners = H.partners();
    box.innerHTML = H.clients().map(c => {
      const rows = partners.map(p => {
        const key = p.id + '|' + c.id;
        const id = `prh_${p.id}_${c.id}`;
        return `<div class="prow">
          <label class="pname" for="${id}">${esc(p.name)}</label>
          <input id="${id}" class="in time" data-hours="${key}" value="${esc(run.hours[key] || '')}" placeholder="0:00" inputmode="decimal" autocomplete="off" spellcheck="false" aria-describedby="${id}_e">
          <span class="echo" id="${id}_e" data-echo="${key}"></span>
          <span class="amt" data-amt="${key}"></span>
        </div>`;
      }).join('');
      return `<section class="card client" aria-labelledby="prch_${c.id}">
        <div class="client-hd"><div><h3 id="prch_${c.id}">${esc(c.name)}</h3><p class="sub">${esc([c.about, 'pays in ' + c.currency].filter(Boolean).join(' · '))}</p></div><span class="chip gold">${esc(usdRate(c.rate))}/hr</span></div>
        <div>${rows}</div>
        ${c.commission ? commissionHtml(c) : ''}
      </section>`;
    }).join('');
  }
  function commissionHtml(c) {
    const st = P();
    const cm = st.run.commission[c.id] || {};
    const cur = CODES.includes(cm.currency) ? cm.currency : c.currency;
    const split = cm.split !== undefined && cm.split !== '' ? cm.split : st.settings.split;
    const inc = cm.include || {};
    const shares = H.partners().map(p => `<label><input type="checkbox" data-c-inc="${c.id}" data-pid="${p.id}" ${inc[p.id] === false ? '' : 'checked'}> ${esc(p.name)}</label>`).join('');
    return `<div class="comm">
      <label class="switch"><input type="checkbox" data-c-on="${c.id}" ${cm.on ? 'checked' : ''}> Commission this period</label>
      <div class="comm-body" data-c-body="${c.id}" ${cm.on ? '' : 'hidden'}>
        <div class="comm-fields">
          <div class="field"><label for="prcamt_${c.id}">Total commission</label>
            <div class="money"><select class="in" data-c-cur="${c.id}" aria-label="Commission currency">${CODES.map(k => `<option value="${k}" ${k === cur ? 'selected' : ''}>${k}</option>`).join('')}</select>
            <input id="prcamt_${c.id}" class="in mono" data-c-amt="${c.id}" value="${esc(cm.amount || '')}" inputmode="decimal" placeholder="0.00" autocomplete="off"></div></div>
          <div class="field"><label for="prcsplit_${c.id}">Split between</label><div class="affix"><input id="prcsplit_${c.id}" class="in mono" data-c-split="${c.id}" value="${esc(split)}" inputmode="numeric" autocomplete="off"><span>people</span></div></div>
        </div>
        <fieldset class="shares"><legend>Shares go to</legend>${shares}</fieldset>
        <p class="comm-out" data-c-out="${c.id}"></p>
      </div>
    </div>`;
  }

  /* ---- live update */
  function update() {
    const st = P();
    const run = effectiveRun(st.run);
    const s = settings();
    const L = live();
    const R = compute(s, run, L);
    const tracked = H.tracked(st.run.start, st.run.end);
    const hourlyByKey = {};
    R.slips.forEach(sl => sl.blocks.forEach(b => { if (b.hourly) hourlyByKey[b.key] = b.hourly; }));
    $$('[data-echo]', root).forEach(el => {
      const key = el.dataset.echo;
      const typed = st.run.hours[key];
      const t = parseDuration(typed);
      const inp = $(`[data-hours="${key}"]`, root);
      const tr = tracked[key] || 0;
      if (inp) inp.placeholder = tr ? fmtHM(tr) : '0:00';
      el.className = 'echo';
      if (t && t.error) { el.textContent = t.error; el.classList.add('bad'); }
      else if (t) { el.textContent = `Typed: ${fmtHM(t.minutes)} = ${t.decimal.toFixed(2)} hours` + (tr ? ` (tracked ${fmtHM(tr)})` : ''); el.classList.add('warn'); }
      else if (tr) el.textContent = `Tracked: ${fmtHM(tr)} = ${decimalOf(tr).toFixed(2)} hours`;
      else el.textContent = '';
      if (inp) inp.classList.toggle('bad', !!(t && t.error));
    });
    $$('[data-amt]', root).forEach(el => {
      const h = hourlyByKey[el.dataset.amt];
      el.textContent = h ? peso(h.php) : '–';
      el.classList.toggle('none', !h || h.php == null);
    });
    for (const c of s.clients) {
      const out = $(`[data-c-out="${c.id}"]`, root);
      if (!out) continue;
      const sh = commissionShare(c, run, s, L);
      const cm = run.commission[c.id] || {};
      if (!sh) out.textContent = cm.amount && !(num(cm.amount) > 0) ? 'Type the amount as a number, like 250.00' : 'Type the total commission paid by ' + c.name + '.';
      else if (sh.php == null) out.textContent = `Needs the ${sh.cur} rate.`;
      else out.textContent = `${CUR[sh.cur].sym}${money(sh.amount)} × ₱${money(sh.fx)} ÷ ${sh.split} = ${peso(sh.php)} each`;
    }
    for (const code of CODES) {
      const el = $(`[data-rate-use="${code}"]`, root);
      if (!el) continue;
      const uses = [];
      if (code === 'USD') uses.push('hourly pay');
      for (const c of s.clients) { const sh = commissionShare(c, run, s, L); if (sh && sh.cur === code) uses.push(c.name + ' commission'); }
      el.textContent = uses.length ? uses.join(', ') : 'not used this run';
    }
    renderSlips(R);
  }
  function renderSlips(R) {
    const box = $('#prSlips');
    const share = H.canShareFiles();
    box.innerHTML = R.slips.map(s => {
      if (!s.blocks.length) return `<article class="slip empty"><div class="slip-hd"><div class="slip-name">${esc(s.partner.name)}</div><span class="muted small">No hours yet</span></div></article>`;
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
          <button class="btn" type="button" data-chat="${pid}" ${dis}>Copy for chat</button>
        </div>
        <textarea class="in mono out" rows="9" readonly hidden aria-label="Text for chat"></textarea>
      </article>`;
    }).join('') || '<p class="empty-note">Add partners and partner rates to see payslips here.</p>';
    $('#prGrand').textContent = peso(R.grand);
    $('#prGrandNote').textContent = R.active.length ? `${R.active.length} ${R.active.length === 1 ? 'partner' : 'partners'} · ${R.hours.toFixed(2)} hours` : 'Tracked or typed hours show here as payslips.';
    $('#prPdfAll').disabled = !R.ready;
    $('#prSave').disabled = !R.ready;
  }

  /* ---- PDFs */
  const helpers = { money, peso, usdRate, midTxt, fmtHM, periodText, longDate, parseIso, CUR };
  function ctxFor(s, run) {
    const L = live();
    const R = compute(s, run, L);
    const rates = {};
    for (const c of R.used) rates[c] = rateInfo(c, run, s, L);
    return { R, settings: s, run, rates, generatedAt: new Date() };
  }
  const fileSafe = s => String(s).normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'Partner';
  async function partnerPdf(pid, how, s = settings(), run = effectiveRun()) {
    try {
      const kit = await H.payslipKit();
      const ctx = ctxFor(s, run);
      const slip = ctx.R.slips.find(x => x.partner.id === pid);
      if (!slip || !slip.ready) { H.toast('This payslip still has something to fix.'); return; }
      const doc = await kit.partner(slip, ctx, helpers);
      await H.deliver(doc, `Payslip-${fileSafe(slip.partner.name)}-${run.payDate}.pdf`, how);
    } catch (e) { H.toast("Couldn't make the PDF. Check your connection and try again."); console.error(e); }
  }
  async function allPdf(s = settings(), run = effectiveRun()) {
    try {
      const kit = await H.payslipKit();
      const ctx = ctxFor(s, run);
      if (!ctx.R.ready) { H.toast('A payslip still has something to fix.'); return; }
      const doc = await kit.all(ctx, helpers);
      await H.deliver(doc, `Payroll-${run.payDate}.pdf`);
    } catch (e) { H.toast("Couldn't make the PDF. Check your connection and try again."); console.error(e); }
  }

  /* ---- history */
  function snapshot() {
    const s = settings();
    const run = effectiveRun();
    const ctx = ctxFor(s, run);
    return {
      id: 'run' + run.start.replace(/-/g, '') + run.end.replace(/-/g, ''), savedAt: Date.now(),
      settings: clone({ preparedBy: s.preparedBy, location: s.location, feePct: s.feePct, split: s.split, partners: s.partners, clients: s.clients }),
      run: clone({ ...run, frozen: null, saved: false }), rates: clone(ctx.rates),
      totals: ctx.R.active.map(x => ({ name: x.partner.name, hours: x.hours, total: x.total })), grand: ctx.R.grand,
    };
  }
  const histRun = h => ({ ...cleanRun(h.run), frozen: h.rates || {}, saved: true });
  function renderHistory() {
    const box = $('#prHistList');
    const runs = H.runs();
    if (!runs.length) { box.innerHTML = '<p class="empty-note">No saved pay runs yet. After you pay your partners, tap Save to history on the pay run.</p>'; return; }
    box.innerHTML = runs.map(h => {
      const per = periodText(parseIso(h.run.start), parseIso(h.run.end), ' – ');
      const who = (h.totals || []).map(t => `${esc(t.name)} ${peso(t.total)}`).join(' · ');
      return `<div class="hist">
        <div class="hist-main"><span class="hist-period">${esc(per)}</span><span class="hist-sub">Paid ${esc(isoDateText(h.run.payDate))} · ${who}</span></div>
        <div class="hist-total">${peso(h.grand)}</div>
        <div class="hist-actions">
          <button class="btn btn-sm gold" type="button" data-h-pdf="${esc(h.id)}">Payslips PDF</button>
          <button class="btn btn-sm" type="button" data-h-open="${esc(h.id)}">Open in payroll</button>
          <button class="btn btn-sm ghost" type="button" data-h-del="${esc(h.id)}">Delete</button>
          <span class="confirm" data-h-oconfirm="${esc(h.id)}" hidden>This replaces the pay run you're working on, with its typed hours and commission.<button class="btn btn-sm" type="button" data-h-oyes="${esc(h.id)}">Open it</button><button class="link" type="button" data-h-ono="${esc(h.id)}">Cancel</button></span>
          <span class="confirm" data-h-confirm="${esc(h.id)}" hidden>Delete this pay run?<button class="btn btn-sm" type="button" data-h-yes="${esc(h.id)}">Yes, delete</button><button class="link" type="button" data-h-no="${esc(h.id)}">Cancel</button></span>
        </div>
      </div>`;
    }).join('');
  }

  /* ---- hours calculator */
  function renderSheet() {
    const sh = P().sheet;
    $('#prCalcStep').value = String(sh.step);
    setVal('prSumTitle', sh.title);
    $('#prCalcRows').innerHTML = sh.calc.map((r, i) => `<tr>
      <td><label class="sr" for="prcs_${i}">Start time, row ${i + 1}</label><input id="prcs_${i}" class="in time" data-cs="${i}" value="${esc(r.s)}" placeholder="HH:MM" inputmode="decimal" autocomplete="off"></td>
      <td><label class="sr" for="prce_${i}">End time, row ${i + 1}</label><input id="prce_${i}" class="in time" data-ce="${i}" value="${esc(r.e)}" placeholder="HH:MM" inputmode="decimal" autocomplete="off"></td>
      <td class="dur r" data-cd="${i}"></td>
      <td class="r">${sh.calc.length > 1 ? `<button class="icon-btn" type="button" data-cdel="${i}" aria-label="Remove row ${i + 1}">×</button>` : ''}</td>
    </tr>`).join('');
    $('#prSumRows').innerHTML = sh.sums.map((v, i) => `<div class="sum-slot"><label for="prsh_${i}">Hours ${i + 1}</label><input id="prsh_${i}" class="in time" data-sum="${i}" value="${esc(v)}" placeholder="H:MM" inputmode="decimal" autocomplete="off"><span class="echo" data-sum-e="${i}"></span></div>`).join('');
    const ps = H.partners(), cs = H.clients();
    $('#prSendPartner').innerHTML = ps.map(p => `<option value="${esc(p.id)}" ${p.id === sh.sendPid ? 'selected' : ''}>${esc(p.name)}</option>`).join('') || '<option value="">No partners yet</option>';
    $('#prSendClient').innerHTML = cs.map(c => `<option value="${esc(c.id)}" ${c.id === sh.sendCid ? 'selected' : ''}>${esc(c.name)}</option>`).join('') || '<option value="">No clients yet</option>';
    updateSheet();
  }
  function calcResult() {
    const sh = P().sheet;
    let total = 0;
    const per = sh.calc.map(r => {
      const a = parseClock(r.s), b = parseClock(r.e);
      if (!a && !b) return { empty: true };
      if (!a || !b) return { waiting: true };
      if (a.error || b.error) return { error: true };
      const m = blockMinutes(a.minutes, b.minutes, sh.step);
      total += m;
      return { minutes: m };
    });
    return { total, per };
  }
  function sumResult() {
    let total = 0;
    const per = P().sheet.sums.map(v => { const t = parseDuration(v); if (t && !t.error) total += t.minutes; return t; });
    return { total, per };
  }
  function updateSheet() {
    const c = calcResult();
    c.per.forEach((r, i) => {
      const cell = $(`[data-cd="${i}"]`, root);
      cell.textContent = r.minutes != null ? fmtHM(r.minutes) : r.error ? 'Check' : '';
      cell.style.color = r.error ? 'var(--bad)' : '';
      for (const sel of [`[data-cs="${i}"]`, `[data-ce="${i}"]`]) { const inp = $(sel, root); const p = parseClock(inp.value); inp.classList.toggle('bad', !!(p && p.error)); }
    });
    $('#prCalcTotal').textContent = fmtHM(c.total);
    $('#prCalcDec').textContent = decimalOf(c.total).toFixed(2) + ' hours';
    $('#prCalcMove').disabled = !(c.total > 0);
    const s = sumResult();
    s.per.forEach((t, i) => {
      const el = $(`[data-sum-e="${i}"]`, root);
      el.className = 'echo';
      if (!t) el.textContent = '';
      else if (t.error) { el.textContent = 'Check this'; el.classList.add('bad'); }
      else el.textContent = `${t.decimal.toFixed(2)} ${t.decimal === 1 ? 'hour' : 'hours'}`;
      $(`[data-sum="${i}"]`, root).classList.toggle('bad', !!(t && t.error));
    });
    $('#prSumTotal').textContent = fmtHM(s.total);
    $('#prSumDec').textContent = decimalOf(s.total).toFixed(2) + ' hours';
    $('#prSendBtn').disabled = !(s.total > 0) || !isSetUp();
  }

  /* ---- drawing it all */
  function setView(v) {
    view = v;
    for (const b of $$('[data-prview]', root)) b.setAttribute('aria-pressed', String(b.dataset.prview === v));
    render();
  }
  function render() {
    const ok = isSetUp();
    $('#prWelcome').hidden = ok || view !== 'run';
    $('#prRun').hidden = view !== 'run' || !ok;
    $('#prHistory').hidden = view !== 'history';
    $('#prCalc').hidden = view !== 'calc';
    if (view === 'run' && ok) { renderPeriod(); renderRates(); renderCards(); update(); }
    if (view === 'history') renderHistory();
    if (view === 'calc') renderSheet();
  }

  /* ---- wiring */
  root.addEventListener('click', async e => {
    const t = e.target;
    const v = t.closest('[data-prview]');
    if (v) { setView(v.dataset.prview); return; }
    const b = t.closest('button');
    if (!b || b.disabled) return;
    const d = b.dataset;
    if (b.id === 'prNew') { $('#prNewConfirm').hidden = false; b.hidden = true; return; }
    if (b.id === 'prNewNo') { $('#prNewConfirm').hidden = true; $('#prNew').hidden = false; return; }
    if (b.id === 'prNewYes') {
      const prevEnd = parseIso(P().run.end) || addDays(today(), -1);
      const start = addDays(prevEnd, 1);
      let end = addDays(today(), -1);
      if (end < start) end = addDays(start, 13);
      H.change(st => { st.run = { start: iso(start), end: iso(end), payDate: iso(addDays(end, 1)), hours: {}, commission: {}, rateOverride: {}, frozen: null, saved: false }; });
      $('#prNewConfirm').hidden = true; $('#prNew').hidden = false;
      render();
      H.toast('New pay run started: ' + periodText(start, end, ' – '));
      return;
    }
    if (b.id === 'prRateRefresh') { refreshRates(); return; }
    if (b.id === 'prRateUnfreeze') { H.change(st => { st.run.frozen = null; }); renderRates(); update(); H.toast("Using today's rates."); return; }
    if (d.rateReset) { H.change(st => { delete st.run.rateOverride[d.rateReset]; }); renderRates(); update(); return; }
    if (d.pdf) { partnerPdf(d.pdf); return; }
    if (d.share) { partnerPdf(d.share, 'share'); return; }
    if (d.chat) {
      const slip = compute(settings(), effectiveRun(), live()).slips.find(x => x.partner.id === d.chat);
      if (!slip) return;
      const text = chatText(slip, P().run);
      try { await navigator.clipboard.writeText(text); H.toast('Copied. Paste it in your chat.'); }
      catch (err) { const ta = b.closest('.slip').querySelector('textarea'); ta.value = text; ta.hidden = false; ta.focus(); ta.select(); H.toast('Select all and copy the text below.'); }
      return;
    }
    if (b.id === 'prPdfAll') { allPdf(); return; }
    if (b.id === 'prSave') {
      const snap = snapshot();
      const had = H.runs().some(h => h.id === snap.id || (h.run.start === snap.run.start && h.run.end === snap.run.end));
      H.saveRun(snap);
      H.toast(had ? 'Updated this pay run in history.' : 'Saved to history.', { label: 'View', run: () => setView('history') });
      return;
    }
    const find = id => H.runs().find(h => h.id === id);
    if (d.hPdf) { const h = find(d.hPdf); if (h) allPdf(cleanSnapSettings(h.settings), histRun(h)); return; }
    // opening a saved run replaces the current one: asked first when something was typed in it
    const typed = r => Object.keys(r.hours).length > 0 || Object.values(r.commission).some(c => c && c.on) || Object.keys(r.rateOverride).length > 0;
    if (d.hOpen && typed(P().run) && !P().run.saved) { $(`[data-h-oconfirm="${d.hOpen}"]`, root).hidden = false; b.hidden = true; return; }
    if (d.hOno) { $(`[data-h-oconfirm="${d.hOno}"]`, root).hidden = true; $(`[data-h-open="${d.hOno}"]`, root).hidden = false; return; }
    if (d.hOpen || d.hOyes) {
      const h = find(d.hOpen || d.hOyes);
      if (!h) return;
      H.change(st => { st.run = histRun(h); });
      setView('run');
      H.toast('Opened ' + periodText(parseIso(h.run.start), parseIso(h.run.end), ' – ') + ' with the hours and rates saved then.');
      return;
    }
    if (d.hDel) { $(`[data-h-confirm="${d.hDel}"]`, root).hidden = false; b.hidden = true; return; }
    if (d.hNo) { $(`[data-h-confirm="${d.hNo}"]`, root).hidden = true; $(`[data-h-del="${d.hNo}"]`, root).hidden = false; return; }
    if (d.hYes) { H.deleteRun(d.hYes); renderHistory(); H.toast('Deleted.'); return; }
    // calculator
    if (d.cdel !== undefined) { H.change(st => { st.sheet.calc.splice(+d.cdel, 1); }); renderSheet(); return; }
    if (b.id === 'prCalcAdd') { H.change(st => { st.sheet.calc.push({ s: '', e: '' }); }); renderSheet(); $(`#prcs_${P().sheet.calc.length - 1}`).focus(); return; }
    if (b.id === 'prCalcClear') { H.change(st => { st.sheet.calc = defaultSheet().calc; }); renderSheet(); $('#prcs_0').focus(); return; }
    if (b.id === 'prCalcMove') {
      const total = calcResult().total;
      if (!(total > 0)) return;
      let i = P().sheet.sums.findIndex(x => !String(x).trim());
      H.change(st => { if (i < 0) { st.sheet.sums.push(''); i = st.sheet.sums.length - 1; } st.sheet.sums[i] = fmtHM(total); st.sheet.calc = defaultSheet().calc; });
      renderSheet();
      H.toast(`Moved ${fmtHM(total)} to Hours ${i + 1}.`);
      $('#prcs_0').focus();
      return;
    }
    if (b.id === 'prSumAdd') { H.change(st => { st.sheet.sums.push(''); }); renderSheet(); $(`#prsh_${P().sheet.sums.length - 1}`).focus(); return; }
    if (b.id === 'prSumClear') { H.change(st => { st.sheet.sums = Array(14).fill(''); }); renderSheet(); return; }
    if (b.id === 'prSendBtn') {
      const total = sumResult().total;
      const sh = P().sheet;
      const p = H.partners().find(x => x.id === ($('#prSendPartner').value || sh.sendPid));
      const c = H.clients().find(x => x.id === ($('#prSendClient').value || sh.sendCid));
      if (!(total > 0) || !p || !c) return;
      const key = p.id + '|' + c.id;
      const before = P().run.hours[key];
      H.change(st => { st.run.hours[key] = fmtHM(total); });
      setView('run');
      const inp = $(`[data-hours="${key}"]`, root);
      if (inp) { inp.scrollIntoView({ block: 'center', behavior: 'smooth' }); inp.focus({ preventScroll: true }); }
      H.toast(before ? `Replaced ${before} with ${fmtHM(total)} for ${p.name}, ${c.name}.` : `Added ${fmtHM(total)} for ${p.name}, ${c.name}.`);
    }
  });
  root.addEventListener('input', e => {
    const t = e.target, d = t.dataset;
    if (t.id === 'prStart' || t.id === 'prEnd' || t.id === 'prPay') {
      if (!parseIso(t.value)) return;
      const k = { prStart: 'start', prEnd: 'end', prPay: 'payDate' }[t.id];
      H.change(st => { st.run[k] = t.value; if (k !== 'payDate') st.run.saved = false; }); // other dates: tracked time counts again
      renderPeriod(); update();
      return;
    }
    if (d.rate) {
      if (P().run.frozen && Object.keys(P().run.frozen).length) return;
      H.change(st => { const v = t.value.trim(); if (v) st.run.rateOverride[d.rate] = v; else delete st.run.rateOverride[d.rate]; });
      update();
      $(`[data-rate-reset="${d.rate}"]`, root).hidden = !P().run.rateOverride[d.rate] || !live()[d.rate];
      return;
    }
    if (d.hours) { H.change(st => { if (t.value.trim()) st.run.hours[d.hours] = t.value; else delete st.run.hours[d.hours]; }); update(); return; }
    if (d.cAmt) { H.change(st => { commOf(st.run, d.cAmt).amount = t.value; }); update(); return; }
    if (d.cSplit) { H.change(st => { commOf(st.run, d.cSplit).split = t.value; }); update(); return; }
    if (d.cOn) { H.change(st => { commOf(st.run, d.cOn).on = t.checked; }); $(`[data-c-body="${d.cOn}"]`, root).hidden = !t.checked; if (t.checked) $('#prcamt_' + d.cOn).focus(); renderRates(); update(); return; }
    if (d.cCur) {
      H.change(st => { commOf(st.run, d.cCur).currency = t.value; });
      renderRates(); update();
      if (t.value !== 'PHP' && !live()[t.value]) refreshRates(); // a currency without a rate yet
      return;
    }
    // payslip details
    if (t.id === 'prBy' || t.id === 'prLoc') { H.change(st => { st.settings[t.id === 'prBy' ? 'preparedBy' : 'location'] = t.value.slice(0, 80); }); return; }
    if (t.id === 'prSplitDef') { const n = parseInt(t.value, 10); if (n >= 1 && n <= 99) { H.change(st => { st.settings.split = n; }); update(); } return; }
    if (d.cInc) { H.change(st => { const cm = commOf(st.run, d.cInc); cm.include = cm.include || {}; cm.include[d.pid] = t.checked; }); update(); return; }
    // calculator
    if (d.cs !== undefined) { H.change(st => { st.sheet.calc[+d.cs].s = t.value; }); updateSheet(); return; }
    if (d.ce !== undefined) { H.change(st => { st.sheet.calc[+d.ce].e = t.value; }); updateSheet(); return; }
    if (d.sum !== undefined) { H.change(st => { st.sheet.sums[+d.sum] = t.value; }); updateSheet(); return; }
    if (t.id === 'prCalcStep') { H.change(st => { st.sheet.step = +t.value; }); updateSheet(); return; }
    if (t.id === 'prSumTitle') { H.change(st => { st.sheet.title = t.value; }); return; }
    if (t.id === 'prSendPartner') { H.change(st => { st.sheet.sendPid = t.value; }); return; }
    if (t.id === 'prSendClient') { H.change(st => { st.sheet.sendCid = t.value; }); }
  });
  root.addEventListener('focusout', e => { if (e.target.dataset.rate) renderRates(); });

  return {
    render, refreshRates,
    update: () => { if (view === 'run' && isSetUp()) update(); },
    rates: () => { if (view === 'run' && isSetUp()) { renderRates(); update(); } },
    codes: () => rateCodes(),
  };
}

window.PayrollKit = {
  mount, cleanPayroll, blankPayroll, PARTS, BASE, cleanPayRun, cleanRun, cleanSheet, parseDuration, fmtHM, compute, rateInfo, CODES,
};
})();
