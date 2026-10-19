/* Time tracking in Work Hub, for Jan and, in partner mode, for each partner.
   - durations and dates
   - time entries and the running timer: cleaning, a fixed form for syncing, merging
   - team channels: one secret gist per partner on the team GitHub account, holding the partner's
     entries (entries.json, written by the partner, editable by Jan) and the work Jan assigned to
     them (workspace.json, written by Jan). Both files are sealed with a key only Jan and that
     partner have, so GitHub, and the other partner, only ever see scrambled text.
   - the Time screen: timer, week chart, entries by day, and the add/edit sheet
   Nothing personal is written here. */
(() => {
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const str = (v, max) => (typeof v === 'string' ? v : v == null ? '' : String(v)).slice(0, max);
const validId = v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v);
const uid = p => p + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 8);
const pad = n => String(n).padStart(2, '0');
const byStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// the colours a project can take: tones of the logo's gold and charcoal, plus a few muted hues
const COLORS = ['#b8873a', '#5b6b7a', '#7a5c8e', '#4f7a5a', '#a0563f', '#3f6f8f', '#8a7a3a', '#6b6b6b'];

/* ------------------------------------------------------------------ durations and dates */

// 1:30, 1h 30m, 90m and 1.5 are all an hour and a half
function parseDur(raw) {
  const t = String(raw ?? '').trim().toLowerCase().replace(/,/g, '.');
  if (!t) return null;
  let m = t.match(/^(\d+)\s*h(?:ours?|rs?)?\s*(?:(\d+)\s*m(?:ins?|inutes?)?)?$/) || t.match(/^(\d*):(\d{1,2})$/);
  if (m) {
    const min = +(m[2] || 0);
    if (min > 59) return { error: 'Minutes go up to 59' };
    return { minutes: +(m[1] || 0) * 60 + min };
  }
  m = t.match(/^(\d+)\s*m(?:ins?|inutes?)?$/);
  if (m) return { minutes: +m[1] };
  if (/^\d*\.?\d+$/.test(t)) return { minutes: Math.round(Number(t) * 60) };
  return { error: 'Type it as 1:30, 1h 30m or 1.5' };
}
const fmtHM = minutes => { const t = Math.max(0, Math.round(minutes)); return `${Math.floor(t / 60)}:${pad(t % 60)}`; };
const fmtHMS = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`; };
const fmtLong = minutes => { const t = Math.max(0, Math.round(minutes)); return `${Math.floor(t / 60)}h ${pad(t % 60)}m`; };
// decimal hours as on the timesheet: hours + minutes / 60, to 2 places
const decimal = minutes => { const t = Math.max(0, Math.round(minutes)); return Number((Math.floor(t / 60) + (t % 60) / 60).toFixed(2)); };
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseIso = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const isoOk = s => (parseIso(s) ? s : '');
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const today = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
const shortDate = d => (d ? `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}` : '');
const dayLabel = d => `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
const weekStart = d => addDays(d, -((d.getDay() + 6) % 7)); // Monday
const clock = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const clockOk = s => (/^([01]\d|2[0-3]):[0-5]\d$/.test(s || '') ? s : '');
const clock12 = s => { if (!clockOk(s)) return ''; const [h, m] = s.split(':').map(Number); return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`; };
// minutes from start to end, past midnight when the end is earlier
const spanMinutes = (a, b) => { const [ah, am] = a.split(':').map(Number), [bh, bm] = b.split(':').map(Number); let d = bh * 60 + bm - (ah * 60 + am); if (d <= 0) d += 1440; return d; };

/* ------------------------------------------------------------------ entries and the timer */

function cleanEntry(x, i) {
  if (!x || typeof x !== 'object') return null;
  const minutes = Math.round(+x.minutes);
  if (!validId(x.id) || !isoOk(x.date) || !(minutes > 0 && minutes <= 24 * 60)) return null;
  return {
    id: x.id, projectId: validId(x.projectId) ? x.projectId : '', date: x.date, minutes,
    start: clockOk(x.start), end: clockOk(x.end), note: str(x.note, 1000),
    source: x.source === 'timer' ? 'timer' : 'manual', edited: x.edited ? 1 : 0,
    createdAt: +x.createdAt || 0, updatedAt: +x.updatedAt || 0,
  };
}
function cleanTimer(x) {
  const o = x && typeof x === 'object' ? x : {};
  const startedAt = +o.startedAt || 0;
  return { projectId: startedAt && validId(o.projectId) ? o.projectId : '', note: startedAt ? str(o.note, 1000) : '', startedAt, updatedAt: +o.updatedAt || 0 };
}
const newer = (a, b) => a.updatedAt > b.updatedAt || (a.updatedAt === b.updatedAt && JSON.stringify(a) > JSON.stringify(b));
// the fixed form of a log (entries + deletions + timer): the same log always gives the same text
function normalizeLog(p) {
  const o = p && typeof p === 'object' ? p : {};
  const del = {};
  for (const d of Array.isArray(o.deleted) ? o.deleted : []) if (Array.isArray(d) && validId(d[0]) && +d[1] > 0) del[d[0]] = Math.max(del[d[0]] || 0, +d[1]);
  const m = {};
  for (const x of Array.isArray(o.entries) ? o.entries : []) {
    const c = cleanEntry(x);
    if (c && !(del[c.id] >= c.updatedAt) && (!m[c.id] || newer(c, m[c.id]))) m[c.id] = c;
  }
  return {
    v: 1,
    entries: Object.values(m).sort((a, b) => byStr(a.id, b.id)),
    deleted: Object.entries(del).sort((a, b) => byStr(a[0], b[0])),
    timer: cleanTimer(o.timer),
  };
}
// a log kept as maps while the app runs
const emptyLog = () => ({ entries: {}, deleted: {}, timer: cleanTimer(null) });
function logFrom(p) {
  const n = normalizeLog(p);
  return { entries: Object.fromEntries(n.entries.map(e => [e.id, e])), deleted: Object.fromEntries(n.deleted), timer: n.timer };
}
const logDoc = L => normalizeLog({ entries: Object.values(L.entries), deleted: Object.entries(L.deleted), timer: L.timer });
// bring another copy of a log in: the newer copy of each entry wins, deletions stay deleted
// (restoring a backup brings back entries deleted since it was made)
function mergeLog(L, p, restore) {
  const r = normalizeLog(p);
  for (const [id, t] of r.deleted) L.deleted[id] = Math.max(L.deleted[id] || 0, t);
  for (const x of r.entries) {
    if (restore && !L.entries[x.id] && L.deleted[x.id] >= x.updatedAt) { L.entries[x.id] = { ...x, updatedAt: L.deleted[x.id] + 1 }; continue; }
    if (!L.entries[x.id] || newer(x, L.entries[x.id])) L.entries[x.id] = x;
  }
  for (const id of Object.keys(L.entries)) if (L.deleted[id] >= L.entries[id].updatedAt) delete L.entries[id];
  if (newer(r.timer, L.timer)) L.timer = r.timer;
}
const stamp = x => Math.max(Date.now(), ((x && x.updatedAt) || 0) + 1);

// what Jan shares with a partner: who they are, and the clients and projects they work on (no rates)
function cleanWorkspace(x) {
  const o = x && typeof x === 'object' ? x : {};
  const p = o.partner && typeof o.partner === 'object' ? o.partner : {};
  return {
    v: 1,
    partner: { id: validId(p.id) ? p.id : '', name: str(p.name, 80) },
    clients: (Array.isArray(o.clients) ? o.clients : []).filter(c => c && validId(c.id)).map(c => ({ id: c.id, name: str(c.name, 120) })).sort((a, b) => byStr(a.id, b.id)),
    projects: (Array.isArray(o.projects) ? o.projects : []).filter(c => c && validId(c.id)).map(c => ({ id: c.id, clientId: validId(c.clientId) ? c.clientId : '', name: str(c.name, 120), color: COLORS.includes(c.color) ? c.color : COLORS[0], archived: !!c.archived })).sort((a, b) => byStr(a.id, b.id)),
  };
}

/* ------------------------------------------------------------------ team channels */

const FILES = { entries: 'entries.json', workspace: 'workspace.json' };
const envelope = async (key, kind, doc) => JSON.stringify({ app: 'gj-team', kind, v: 1, box: await GJCore.sealRaw(key, JSON.stringify(doc)) });
async function openFile(key, f, token) {
  if (!f) return null;
  let text = f.content;
  if (f.truncated && f.raw_url) { const r = await fetch(f.raw_url, { cache: 'no-store' }); text = await r.text(); }
  try {
    const j = JSON.parse(text);
    if (!j || !j.box || typeof j.box.iv !== 'string') return null;
    return await GJCore.openRaw(key, j.box);
  } catch (e) { return { unreadable: true }; }
}
// { exists, entries, workspace }: each the opened document, null when missing, {unreadable} when the key doesn't fit
async function readChannel(token, gistId, key) {
  const g = await GJCore.github(token, '/gists/' + gistId);
  if (!g) return { exists: false, entries: null, workspace: null };
  const files = g.files || {};
  return { exists: true, entries: await openFile(key, files[FILES.entries], token), workspace: await openFile(key, files[FILES.workspace], token) };
}
async function writeChannel(token, gistId, key, docs) {
  const files = {};
  for (const [kind, doc] of Object.entries(docs)) files[FILES[kind]] = { content: await envelope(key, kind, doc) };
  return GJCore.github(token, '/gists/' + gistId, { method: 'PATCH', body: { files } });
}
async function createChannel(token, key, workspace) {
  const g = await GJCore.github(token, '/gists', { method: 'POST', body: {
    description: 'Team time (encrypted)', public: false,
    files: { [FILES.workspace]: { content: await envelope(key, 'workspace', workspace) }, [FILES.entries]: { content: await envelope(key, 'entries', normalizeLog({})) } },
  } });
  if (!g || !g.id) throw new Error('no gist');
  return g.id;
}
const deleteChannel = (token, gistId) => GJCore.github(token, '/gists/' + gistId, { method: 'DELETE' });

/* ------------------------------------------------------------------ the Time screen */

// One view, used by both apps. The app passes hooks:
//   me                 who this device's timer belongs to ('me' in Jan's app, the partner's id in theirs)
//   people()           [{ id, name, color }] when Jan can see everyone, [] in the partner app
//   projects()         [{ id, clientId, clientName, name, color, archived }]
//   entries()          [{ ...entry, who }] for everything this screen may show
//   timer()            this device's own timer
//   setTimer(t)        save it (t is a full timer, or a stopped one)
//   save(who, entry)   add or update an entry; remove(who, id) deletes one
//   working()          [{ name, project, note, since }] others' running timers (Jan's app only)
//   onChange()         redraw the rest of the app after an edit
function view(H) {
  const root = H.root;
  let week = weekStart(today());
  let who = 'all';
  let tick = 0;
  root.innerHTML = `
    <div class="tbar card" id="tmBar">
      <input id="tmNote" class="in" placeholder="What are you working on?" maxlength="1000" autocomplete="off" aria-label="What are you working on?">
      <select id="tmProject" class="in" aria-label="Project"></select>
      <div class="tclock" id="tmClock" aria-live="off">0:00:00</div>
      <button id="tmBtn" class="btn gold tm-btn" type="button">Start</button>
      <p id="tmWarn" class="warn-text small tm-warn" hidden></p>
    </div>
    <div id="tmWorking" class="working" hidden></div>
    <div class="t-tools">
      <div class="weeknav">
        <button class="icon-btn" type="button" data-week="-1" aria-label="Previous week">‹</button>
        <div class="wk-label"><strong id="wkLabel"></strong><span id="wkTotal" class="muted"></span></div>
        <button class="icon-btn" type="button" data-week="1" aria-label="Next week">›</button>
        <button class="link small" type="button" data-week="0">This week</button>
      </div>
      <div class="filters" id="tmWho" role="group" aria-label="Whose time"></div>
      <button id="tmAdd" class="btn btn-sm" type="button">+ Add time</button>
    </div>
    <div class="card wk-card"><div class="wkbars" id="wkBars" role="img"></div></div>
    <div id="tmDays" class="tdays"></div>`;
  if (!$('#entrySheet')) document.body.insertAdjacentHTML('beforeend', sheetHtml());

  const projById = () => Object.fromEntries(H.projects().map(p => [p.id, p]));
  function projectOptions(sel, value, includeArchived) {
    const ps = H.projects().filter(p => includeArchived || !p.archived || p.id === value);
    const byClient = {};
    for (const p of ps) (byClient[p.clientName] = byClient[p.clientName] || []).push(p);
    const html = '<option value="">Choose a project</option>' + Object.keys(byClient).sort().map(c =>
      `<optgroup label="${esc(c)}">${byClient[c].sort((a, b) => byStr(a.name.toLowerCase(), b.name.toLowerCase())).map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</optgroup>`).join('');
    if (sel.dataset.html !== html) { sel.innerHTML = html; sel.dataset.html = html; }
    sel.value = value || '';
  }

  /* ---- the timer */
  function renderTimer() {
    const t = H.timer();
    const running = !!t.startedAt;
    const note = $('#tmNote');
    if (document.activeElement !== note) note.value = running ? t.note : note.value;
    if (document.activeElement !== $('#tmProject')) projectOptions($('#tmProject'), running ? t.projectId : $('#tmProject').value, false);
    $('#tmBtn').textContent = running ? 'Stop' : 'Start';
    $('#tmBtn').classList.toggle('gold', !running);
    $('#tmBtn').classList.toggle('stop', running);
    $('#tmBar').classList.toggle('running', running);
    tickClock();
  }
  function tickClock() {
    const t = H.timer();
    const ms = t.startedAt ? Date.now() - t.startedAt : 0;
    $('#tmClock').textContent = fmtHMS(ms);
    const long = ms > (H.longHours ? H.longHours() : 6) * 3600000;
    $('#tmWarn').hidden = !long;
    if (long) $('#tmWarn').textContent = `This timer has been running ${fmtHM(ms / 60000)}. Still working? If not, stop it and fix the time.`;
  }
  async function startStop() {
    const t = H.timer();
    if (t.startedAt) {
      const end = new Date();
      const started = new Date(t.startedAt);
      const minutes = Math.round((end - started) / 60000);
      H.setTimer({ projectId: '', note: '', startedAt: 0, updatedAt: stamp(t) });
      if (minutes < 1) { GJCore.toast('Less than a minute, so nothing was saved.'); renderAll(); return; }
      // the id comes from when the timer started, so stopping it on two devices makes one entry
      const e = cleanEntry({
        id: 'e' + t.startedAt.toString(36), projectId: t.projectId, date: iso(started), minutes: Math.min(minutes, 1440),
        start: clock(started), end: clock(end), note: t.note, source: 'timer', createdAt: Date.now(), updatedAt: Date.now(),
      });
      H.save(H.me, e); // saved straight away, even a long one: closing the check below never loses it
      if (minutes > (H.longHours ? H.longHours() : 6) * 60) { $('#tmNote').value = ''; renderAll(); openSheet(e, H.me, false, true); return; }
      GJCore.toast(`Saved ${fmtHM(e.minutes)} on ${projectLabel(e.projectId)}.`);
      $('#tmNote').value = '';
      renderAll();
      return;
    }
    const projectId = $('#tmProject').value;
    if (!projectId) { GJCore.toast('Choose a project first.'); $('#tmProject').focus(); return; }
    H.setTimer({ projectId, note: $('#tmNote').value.trim(), startedAt: Date.now(), updatedAt: stamp(t) });
    renderAll();
  }
  function timerEdit() { // changing the project or note while it runs
    const t = H.timer();
    if (!t.startedAt) return;
    const projectId = $('#tmProject').value || t.projectId;
    H.setTimer({ ...t, projectId, note: $('#tmNote').value.trim(), updatedAt: stamp(t) });
  }
  const projectLabel = id => { const p = projById()[id]; return p ? `${p.clientName} · ${p.name}` : 'a removed project'; };

  /* ---- the week */
  const visible = () => H.entries().filter(e => who === 'all' || e.who === who);
  function renderWeek() {
    const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
    const first = iso(days[0]), last = iso(days[6]);
    const list = visible().filter(e => e.date >= first && e.date <= last);
    const perDay = days.map(d => list.filter(e => e.date === iso(d)).reduce((t, e) => t + e.minutes, 0));
    const total = perDay.reduce((a, b) => a + b, 0);
    const thisWeek = +week === +weekStart(today());
    $('#wkLabel').textContent = thisWeek ? 'This week' : `${MONTHS[days[0].getMonth()].slice(0, 3)} ${days[0].getDate()} - ${MONTHS[days[6].getMonth()].slice(0, 3)} ${days[6].getDate()}`;
    $('#wkTotal').textContent = ` · ${fmtHM(total)}`;
    root.querySelector('[data-week="0"]').hidden = thisWeek;
    // the chart: one gold column per day, the busiest one labelled, every day's total on hover and in the list below
    const max = Math.max(...perDay, 60);
    const peak = perDay.indexOf(Math.max(...perDay));
    $('#wkBars').setAttribute('aria-label', `Hours per day: ${days.map((d, i) => `${dayLabel(d)} ${fmtHM(perDay[i])}`).join(', ')}`);
    $('#wkBars').innerHTML = days.map((d, i) => {
      const h = perDay[i] ? Math.max(2, Math.round((perDay[i] / max) * 100)) : 0;
      const isToday = iso(d) === iso(today());
      return `<div class="wkcol${isToday ? ' today' : ''}" tabindex="0" data-tip="${esc(dayLabel(d))} · ${fmtHM(perDay[i])}">
        <div class="wkplot">${i === peak && perDay[i] ? `<span class="wkval">${fmtHM(perDay[i])}</span>` : ''}<div class="wkbar" style="height:${h}%"></div></div>
        <div class="wkday">${DAYS[d.getDay()]}<br><span>${d.getDate()}</span></div>
      </div>`;
    }).join('');
    // the entries, a day at a time
    const people = Object.fromEntries((H.people ? H.people() : []).map(p => [p.id, p]));
    const projects = projById();
    const byDay = {};
    for (const e of list) (byDay[e.date] = byDay[e.date] || []).push(e);
    const dates = Object.keys(byDay).sort().reverse();
    $('#tmDays').innerHTML = dates.length ? dates.map(dt => {
      const es = byDay[dt].sort((a, b) => byStr(b.start || '', a.start || '') || b.createdAt - a.createdAt);
      const sum = es.reduce((t, e) => t + e.minutes, 0);
      return `<section class="tday card"><div class="tday-hd"><h3>${esc(dayLabel(parseIso(dt)))}</h3><span class="mono">${fmtHM(sum)}</span></div>` +
        es.map(e => {
          const p = projects[e.projectId];
          const person = people[e.who];
          const canEdit = !H.canEdit || H.canEdit(e.who);
          return `<div class="tentry">
            <span class="tdot" style="background:${esc(p ? p.color : '#9a9a9a')}" aria-hidden="true"></span>
            <button class="tentry-main" type="button" data-edit="${esc(e.who)}|${esc(e.id)}"${canEdit ? '' : ' disabled'}>
              <span class="tproj">${esc(p ? `${p.clientName} · ${p.name}` : 'Removed project')}${person ? ` <span class="pbadge" style="--pc:${esc(person.color || '#6b6b6b')}">${esc(person.name)}</span>` : ''}${e.source === 'manual' ? ' <span class="tflag" title="Typed in, not timed">typed</span>' : ''}${e.edited ? ' <span class="tflag" title="Changed after timing">edited</span>' : ''}</span>
              <span class="tnote">${e.note ? esc(e.note) : '<span class="muted">No description</span>'}</span>
            </button>
            <span class="ttime">${e.start && e.end ? `<span class="muted small">${esc(clock12(e.start))} - ${esc(clock12(e.end))}</span>` : ''}<b class="mono">${fmtHM(e.minutes)}</b></span>
            ${e.who === H.me ? `<button class="icon-btn tplay" type="button" data-again="${esc(e.id)}" title="Start again" aria-label="Start this again">▶</button>` : '<span></span>'}
          </div>`;
        }).join('') + '</section>';
    }).join('') : `<div class="inv-empty">${esc(H.emptyText ? H.emptyText() : H.projects().length ? 'No time this week yet.' : 'Add a project under Clients first, then start the timer.')}</div>`;
  }
  function renderWho() {
    const people = H.people ? H.people() : [];
    const box = $('#tmWho');
    box.hidden = people.length < 2;
    if (box.hidden) return;
    box.innerHTML = [{ id: 'all', name: 'Everyone' }, ...people].map(p => `<button class="fchip" type="button" data-who="${esc(p.id)}" aria-pressed="${who === p.id}">${esc(p.name)}</button>`).join('');
  }
  function renderWorking() {
    const w = H.working ? H.working() : [];
    const box = $('#tmWorking');
    box.hidden = !w.length;
    box.innerHTML = w.map(x => `<span class="wnow"><span class="live" aria-hidden="true"></span><b>${esc(x.name)}</b> ${esc(x.project)}${x.note ? ` · ${esc(x.note)}` : ''} <span class="mono muted">${fmtHM((Date.now() - x.since) / 60000)}</span></span>`).join('');
  }
  function renderAll() { renderTimer(); renderWho(); renderWorking(); renderWeek(); }

  /* ---- the add / edit sheet */
  let editing = null; // { who, entry, isNew }
  // check = a long timer just stopped (already saved): fix it, or delete it if it was left running
  function openSheet(entry, whoFor, isNew, check) {
    const people = H.people ? H.people() : [];
    editing = { who: whoFor, entry, isNew: !!isNew };
    $('#esTitle').textContent = check ? 'Check this time' : isNew ? 'Add time' : 'Edit time';
    const wsel = $('#esWho');
    $('#esWhoWrap').hidden = people.length < 2 || !isNew;
    if (people.length > 1) { wsel.innerHTML = people.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join(''); wsel.value = whoFor; }
    projectOptions($('#esProject'), entry.projectId, true);
    $('#esDate').value = entry.date;
    $('#esStart').value = entry.start;
    $('#esEnd').value = entry.end;
    $('#esDur').value = entry.minutes ? fmtHM(entry.minutes) : '';
    $('#esNote').value = entry.note;
    $('#esDel').hidden = !!isNew;
    $('#esDelConfirm').hidden = true;
    $('#esEcho').textContent = check ? `Timed ${fmtHM(entry.minutes)}, which is longer than usual. It's saved; fix it here if the timer was left running.` : '';
    $('#entrySheet').hidden = false;
    document.body.classList.add('sheet-open');
    // unless a field in it already has the cursor (typing must never jump to another field)
    setTimeout(() => { if (!$('#entrySheet').contains(document.activeElement)) (entry.projectId ? $('#esNote') : $('#esProject')).focus(); }, 30);
  }
  function closeSheet() {
    $('#entrySheet').hidden = true;
    if (!$$('.sheet').some(s => !s.hidden)) document.body.classList.remove('sheet-open');
    editing = null;
  }
  // start and end fill the duration; a duration typed in clears them
  function sheetInput(e) {
    if (e.target.id === 'esStart' || e.target.id === 'esEnd') {
      const a = clockOk($('#esStart').value), b = clockOk($('#esEnd').value);
      if (a && b) $('#esDur').value = fmtHM(spanMinutes(a, b));
    }
    if (e.target.id === 'esDur') {
      const d = parseDur($('#esDur').value);
      $('#esEcho').textContent = d && d.error ? d.error : d ? `= ${fmtHM(d.minutes)} (${decimal(d.minutes).toFixed(2)} hours)` : '';
      if (clockOk($('#esStart').value) && d && d.minutes) {
        const [h, m] = $('#esStart').value.split(':').map(Number);
        const end = (h * 60 + m + d.minutes) % 1440;
        $('#esEnd').value = `${pad(Math.floor(end / 60))}:${pad(end % 60)}`;
      }
    }
  }
  function saveSheet() {
    if (!editing) return;
    const d = parseDur($('#esDur').value);
    if (!d || d.error || !(d.minutes > 0)) { GJCore.toast(d && d.error ? d.error : 'Type how long, like 1:30.'); $('#esDur').focus(); return; }
    if (d.minutes > 1440) { GJCore.toast('One entry can be up to 24 hours.'); return; }
    if (!$('#esProject').value) { GJCore.toast('Choose a project.'); $('#esProject').focus(); return; }
    if (!isoOk($('#esDate').value)) { GJCore.toast('Choose the date.'); return; }
    const old = editing.entry;
    const whoFor = editing.isNew && !$('#esWhoWrap').hidden ? $('#esWho').value : editing.who;
    const e = cleanEntry({
      ...old, projectId: $('#esProject').value, date: $('#esDate').value, minutes: d.minutes,
      start: clockOk($('#esStart').value), end: clockOk($('#esEnd').value), note: $('#esNote').value.trim(),
      createdAt: old.createdAt || Date.now(), updatedAt: stamp(old),
    });
    // a timed entry whose time is changed is marked, so the team report can show it
    if (old.source === 'timer' && (old.minutes !== e.minutes || old.date !== e.date || old.start !== e.start || old.end !== e.end)) e.edited = 1;
    H.save(whoFor, e);
    closeSheet();
    renderAll();
    if (H.onChange) H.onChange();
  }

  /* ---- wiring */
  root.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('#tmBtn')) { startStop(); return; }
    if (t.closest('#tmAdd')) {
      // today when the week shown is this one, else that week's Monday
      const d = today() >= week && today() < addDays(week, 7) ? today() : week;
      openSheet({ id: uid('e'), projectId: $('#tmProject').value, date: iso(d), minutes: 0, start: '', end: '', note: '', source: 'manual', edited: 0, createdAt: 0, updatedAt: 0 }, H.me, true);
      return;
    }
    const wk = t.closest('[data-week]');
    if (wk) { const n = +wk.dataset.week; week = n === 0 ? weekStart(today()) : addDays(week, 7 * n); renderWeek(); return; }
    const w = t.closest('[data-who]');
    if (w) { who = w.dataset.who; renderWho(); renderWeek(); return; }
    const ed = t.closest('[data-edit]');
    if (ed) {
      const [wh, id] = ed.dataset.edit.split('|');
      const e0 = H.entries().find(x => x.who === wh && x.id === id);
      if (e0) { const { who: _w, ...entry } = e0; openSheet(entry, wh, false); }
      return;
    }
    const ag = t.closest('[data-again]');
    if (ag) {
      const e0 = H.entries().find(x => x.who === H.me && x.id === ag.dataset.again);
      if (!e0) return;
      const tm = H.timer();
      if (tm.startedAt) { GJCore.toast('Stop the timer that is running first.'); return; }
      projectOptions($('#tmProject'), e0.projectId, false);
      $('#tmNote').value = e0.note;
      startStop();
    }
  });
  root.addEventListener('change', e => { if (e.target.id === 'tmProject') timerEdit(); });
  root.addEventListener('input', e => { if (e.target.id === 'tmNote') { clearTimeout(tick); tick = setTimeout(timerEdit, 600); } });
  root.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'tmNote') { e.preventDefault(); if (!H.timer().startedAt) startStop(); else timerEdit(); } });
  // the day chart's tooltip: hover or focus a day
  const tip = document.createElement('div');
  tip.className = 'ctip'; tip.hidden = true; document.body.appendChild(tip);
  let tipTimer = 0;
  // on a phone a tap never "leaves" the bar, so the tip also hides by itself and on scrolling
  const showTip = el => { const r = el.getBoundingClientRect(); tip.textContent = el.dataset.tip; tip.hidden = false; tip.style.left = `${r.left + r.width / 2 + window.scrollX}px`; tip.style.top = `${r.top + window.scrollY - 8}px`; clearTimeout(tipTimer); tipTimer = setTimeout(() => { tip.hidden = true; }, 2500); };
  window.addEventListener('scroll', () => { tip.hidden = true; }, { passive: true });
  root.addEventListener('pointerover', e => { const c = e.target.closest('.wkcol'); if (c) showTip(c); });
  root.addEventListener('pointerout', e => { if (e.target.closest('.wkcol')) tip.hidden = true; });
  root.addEventListener('focusin', e => { const c = e.target.closest('.wkcol'); if (c) showTip(c); });
  root.addEventListener('focusout', () => { tip.hidden = true; });

  const sheet = $('#entrySheet');
  sheet.addEventListener('input', sheetInput);
  $('#esSave').addEventListener('click', saveSheet);
  $('#esClose').addEventListener('click', closeSheet);
  $('#esDel').addEventListener('click', () => { $('#esDelConfirm').hidden = false; });
  $('#esDelNo').addEventListener('click', () => { $('#esDelConfirm').hidden = true; });
  $('#esDelYes').addEventListener('click', () => {
    if (!editing) return;
    H.remove(editing.who, editing.entry.id);
    closeSheet();
    renderAll();
    if (H.onChange) H.onChange();
    GJCore.toast('Time entry deleted.');
  });
  let downOnBackdrop = false;
  sheet.addEventListener('pointerdown', e => { downOnBackdrop = e.target === sheet; });
  sheet.addEventListener('click', e => { if (e.target === sheet && downOnBackdrop) closeSheet(); downOnBackdrop = false; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });
  setInterval(() => { if (!root.offsetParent) return; if (H.timer().startedAt) tickClock(); if (H.working && H.working().length) renderWorking(); }, 1000);

  return { render: renderAll, openNew: () => $('#tmAdd').click() };
}

function sheetHtml() {
  return `<div id="entrySheet" class="sheet small-sheet" role="dialog" aria-modal="true" aria-labelledby="esTitle" hidden>
  <div class="sheet-card">
    <div class="card-hd"><h2 id="esTitle">Add time</h2><button id="esClose" class="link" type="button">Close</button></div>
    <div class="field" id="esWhoWrap" hidden><label for="esWho">Whose time</label><select id="esWho" class="in"></select></div>
    <div class="field"><label for="esProject">Project</label><select id="esProject" class="in"></select></div>
    <div class="fields two">
      <div class="field"><label for="esDate">Date</label><input id="esDate" class="in" type="date"></div>
      <div class="field"><label for="esDur">How long</label><input id="esDur" class="in mono" placeholder="1:30" autocomplete="off"></div>
      <div class="field"><label for="esStart">Started (optional)</label><input id="esStart" class="in" type="time"></div>
      <div class="field"><label for="esEnd">Ended (optional)</label><input id="esEnd" class="in" type="time"></div>
    </div>
    <p id="esEcho" class="muted small"></p>
    <div class="field"><label for="esNote">What was done</label><textarea id="esNote" class="in" rows="4" maxlength="1000" placeholder="e.g. Scheduled 5 posts and replied to comments"></textarea></div>
    <div class="card-ft">
      <button id="esSave" class="btn gold" type="button">Save</button>
      <button id="esDel" class="btn ghost" type="button">Delete</button>
      <div id="esDelConfirm" class="confirm" hidden><span>Delete this time?</span><button id="esDelYes" class="btn btn-sm" type="button">Yes, delete</button><button id="esDelNo" class="link" type="button">Cancel</button></div>
    </div>
  </div>
</div>`;
}

window.TimeKit = {
  COLORS, parseDur, fmtHM, fmtLong, fmtHMS, decimal, clock12, dayLabel, weekStart, spanMinutes,
  cleanEntry, cleanTimer, normalizeLog, emptyLog, logFrom, logDoc, mergeLog, stamp, newer, cleanWorkspace,
  readChannel, writeChannel, createChannel, deleteChannel, view, uid,
};
})();
