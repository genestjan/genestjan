/* Jan's app core: the password lock, staying unlocked, fingerprint unlock, encrypted sync between
   devices and locked backups. It started life inside the Partner Payroll app. Each app calls
   GJCore.start({...}) with its own names and data hooks; nothing personal is written in here.

   What an app passes to start():
     ns            storage prefix, e.g. 'gjr-invoices'
     name          shown on the lock screen and as the passkey name
     kind          tag written into the sync file
     gistFile      sync file name inside the secret gist
     gistDesc      gist description
     text          { create, unlock }: [title, message, button] for the lock screen
     load(data)    put saved data (from dump) back into the app; {} on a new device
     dump()        everything the app wants kept on this device
     payload()     what travels between devices, in a fixed (normalized) form
     normalize(p)  turn a payload from another device into that same form
     merge(p, opts) bring another device's payload in (the newer copy of each record wins);
                   opts.first=true on this device's first sync with a gist; opts.restore=true for a
                   backup, which may bring back records deleted since
     applySetup(s, opts) opts.unlocked=true for a link anyone could have made: it counts as oldest
     text.join     optional [title, message, button] for the screen that opens a locked link
     isEmpty()     true while the app holds nothing yet (an unlocked setup link only works then)
     render()      draw everything again (after a merge from another device, a restore, a link)
     onUnlock()    the app is open: draw it and pick the starting screen
     setupPayload() settings a setup link carries; applySetup(s) and describeSetup(s) use them */
(() => {
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const on = (sel, ev, fn) => { const el = $(sel); if (el) el.addEventListener(ev, fn); };
function readJSON(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

const ITER = 600000;
const IDLE_MS = 3 * 60 * 1000;
// how long this device may sit unused before it locks: 3 minutes unless the app says otherwise
// (a partner's device tracking time stays open much longer)
const idleLimit = () => { const n = A && A.idleMs ? +A.idleMs() : IDLE_MS; return n > 0 ? n : IDLE_MS; };
const recLimit = v => (v && +v.limit > 0 ? +v.limit : IDLE_MS);
let A = null; // the app
let K = null; // storage names
let vault = null; // { key, raw, salt, password } while unlocked; password is null after a refresh
let sync = null; // { token, gistId, login, lastSyncAt, adopt, rotate }

/* ------------------------------------------------------------------ toast */

let toastTimer = 0;
function toast(msg, action) {
  const t = $('#toast');
  if (!t) return;
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

/* ------------------------------------------------------------------ encryption */

// Everything personal is stored encrypted with AES-256-GCM, using a key made from Jan's password
// (PBKDF2-SHA256, 600,000 rounds). The page itself is public, but without the password there is
// nothing in it to read.
function bytesToB64(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let out = '';
  for (let i = 0; i < b.length; i += 0x8000) out += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(out);
}
const b64ToBytes = str => Uint8Array.from(atob(str), c => c.charCodeAt(0));
const randomBytes = n => crypto.getRandomValues(new Uint8Array(n));
const isBox = b => !!(b && typeof b === 'object' && typeof b.salt === 'string' && typeof b.iv === 'string' && typeof b.data === 'string');
async function deriveKey(password, salt, iter = ITER) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
// the vault key plus its raw bytes, which this window keeps (wrapped) to survive a refresh;
// the same key deriveKey() makes, since an AES key from PBKDF2 is the first 256 derived bits
async function newVault(password, salt, iter = ITER) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const raw = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, 256));
  const key = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  return { key, raw, salt, password };
}
async function seal(key, salt, text) {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
  return { v: 1, iter: ITER, salt: bytesToB64(salt), iv: bytesToB64(iv), data: bytesToB64(ct) };
}
async function unseal(key, box) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(box.iv) }, key, b64ToBytes(box.data));
  return JSON.parse(new TextDecoder().decode(pt));
}
// a random AES key, as base64, and sealing with one (no password involved)
const newRawKey = () => bytesToB64(randomBytes(32));
const rawKeyCache = new Map();
async function importRaw(b64) {
  if (!rawKeyCache.has(b64)) rawKeyCache.set(b64, await crypto.subtle.importKey('raw', b64ToBytes(b64), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']));
  return rawKeyCache.get(b64);
}
async function sealRaw(b64, text) {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await importRaw(b64), new TextEncoder().encode(text));
  return { v: 1, iv: bytesToB64(iv), data: bytesToB64(ct) };
}
async function openRaw(b64, box) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(box.iv) }, await importRaw(b64), b64ToBytes(box.data));
  return JSON.parse(new TextDecoder().decode(pt));
}
// a box locked with a password of its own (an invite code), opened the usual way by the join screen
async function sealWithPassword(password, text) {
  const salt = randomBytes(16);
  return seal(await deriveKey(password, salt), salt, text);
}
// open a locked setup link, backup or sync copy; throws when it can't
async function unsealWith(password, box) {
  if (vault && box.salt === bytesToB64(vault.salt)) {
    try { return await unseal(vault.key, box); } catch (e) { /* locked with another password: try the one given */ }
  }
  if (!password) throw new Error('password needed');
  return unseal(await deriveKey(password, b64ToBytes(box.salt), box.iter || ITER), box);
}
// another app's locked data on this site (the old Payroll app): with a password typed for it,
// or with this app's own password when both use the same one
const openBox = async (password, box) => unseal(await deriveKey(password, b64ToBytes(box.salt), box.iter || ITER), box);
async function openWithCurrent(box) {
  if (!vault || !isBox(box)) return null;
  try { return await unsealWith(vault.password, box); } catch (e) { return null; }
}
// the app can say this device mustn't use the owner's sync (a partner's device)
const syncAllowed = () => !(A && A.syncAllowed) || A.syncAllowed();

/* ------------------------------------------------------------------ saving */

const payloadKey = () => JSON.stringify(A.payload());
let cleanKey = null; // the payload at the last save, so switching screens doesn't count as an edit
const markClean = () => { cleanKey = payloadKey(); };
let saveTimer = 0;
let writing = Promise.resolve();
function saveNow() {
  clearTimeout(saveTimer);
  if (!vault) return writing;
  const now = payloadKey();
  if (cleanKey !== null && now !== cleanKey) scheduleSync();
  cleanKey = now;
  const text = JSON.stringify({ app: A.dump(), sync });
  const v = vault;
  writing = writing.then(() => seal(v.key, v.salt, text)).then(box => { writeJSON(K.vault, box); }).catch(() => {});
  return writing;
}
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 200); }
function loadVault(data) {
  const d = data && typeof data === 'object' ? data : {};
  sync = cleanSync(d.sync);
  A.load(d.app && typeof d.app === 'object' ? d.app : {});
}

/* ------------------------------------------------------------------ sync between devices */

// Each device keeps its own locked copy. With sync on, the same locked copy is also kept in a
// secret gist on Jan's GitHub account, sealed with the same key, so GitHub only ever holds
// scrambled text.
const GH = 'https://api.github.com';
let syncState = 'idle'; // idle | syncing | ok | offline | busy | token | scope | password | error
let syncDetail = '';
let syncTimer = 0;
let syncRunning = null;
let syncQueued = false;
let syncDirty = false;
let pendingRemote = null; // a sync copy locked with a password this device doesn't have yet

class SyncError extends Error { constructor(code, detail) { super(detail || code); this.code = code; } }

function cleanSync(x) {
  if (!x || typeof x !== 'object' || typeof x.token !== 'string' || !x.token.trim()) return null;
  return {
    token: x.token.trim(),
    gistId: typeof x.gistId === 'string' && /^[0-9a-f]{20,64}$/i.test(x.gistId) ? x.gistId : '',
    login: typeof x.login === 'string' ? x.login.slice(0, 60) : '',
    lastSyncAt: +x.lastSyncAt || 0,
    adopt: !!x.adopt, // true until this device's first sync: the copy already on GitHub wins
    rotate: !!x.rotate, // true after a password change until a fresh gist holds the re-locked copy
  };
}

// a GitHub API call with a given token; the app's own sync uses gh() below, the team time channels
// (another GitHub account) call this directly
async function ghWith(token, path, opts = {}) {
  let r;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    r = await fetch(GH + path, {
      method: opts.method || 'GET',
      cache: 'no-store',
      signal: ctl.signal,
      headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, ...(opts.body ? { 'Content-Type': 'application/json' } : {}) },
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
const gh = (path, opts) => ghWith(sync.token, path, opts);
async function findGist() {
  const list = await gh('/gists?per_page=100');
  const g = Array.isArray(list) ? list.find(x => x && x.files && x.files[A.gistFile]) : null;
  return g ? g.id : '';
}
// { exists, copy, movedTo }: copy is the parsed sync file, or null when missing or unreadable
async function readGist(id) {
  const g = await gh('/gists/' + id);
  if (!g) return { exists: false, copy: null };
  const f = g.files && g.files[A.gistFile];
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

// Bring the sync copy into this device. Returns the remote payload as a comparable string,
// 'password' when it is locked with a password this device doesn't have, or 'locked'.
async function mergeRemote(copy) {
  if (!vault) return 'locked';
  const box = copy.box;
  let data = null;
  if (box.salt === bytesToB64(vault.salt)) { try { data = await unseal(vault.key, box); } catch (e) { data = null; } }
  if (!data) {
    if (!vault.password) { pendingRemote = box; return 'password'; }
    try {
      const next = await newVault(vault.password, b64ToBytes(box.salt), box.iter || ITER);
      data = await unseal(next.key, box);
      if (!vault) return 'locked';
      vault = next; // same password, other devices' key: share it from now on
      await rememberSession();
    } catch (e) { pendingRemote = box; return 'password'; }
  }
  if (!vault) return 'locked';
  pendingRemote = null;
  const remote = data && typeof data === 'object' ? data : {};
  const before = payloadKey();
  A.merge(remote, { first: !!(sync && sync.adopt) });
  if (sync) sync.adopt = false; // taken once, even if this round's upload fails
  markClean(); // what came from the other device isn't an edit made here
  if (payloadKey() !== before) refreshFromRemote();
  return JSON.stringify(A.normalize(remote));
}
function refreshFromRemote() {
  const a = document.activeElement;
  const typing = a && a.id && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) ? a.id : '';
  A.render();
  if (typing && document.getElementById(typing)) document.getElementById(typing).focus();
  toast('Updated with changes from your other device.');
}

async function syncNow(opts = {}) {
  if (!vault || !sync || !syncAllowed()) return;
  if (syncRunning) { syncQueued = true; return syncRunning; }
  clearTimeout(syncTimer);
  syncDirty = false;
  syncRunning = (async () => {
    if (!opts.quiet) setSync('syncing');
    try {
      const s = sync;
      const sealed = async () => {
        const text = payloadKey();
        return { text, content: JSON.stringify({ app: A.kind, kind: 'sync', v: 1, box: await seal(vault.key, vault.salt, text) }) };
      };
      const create = async content => {
        const g = await gh('/gists', { method: 'POST', body: { description: A.gistDesc, public: false, files: { [A.gistFile]: { content } } } });
        if (!g || !g.id) throw new SyncError('scope');
        return g.id;
      };
      if (s.rotate) {
        // new password: a fresh gist holds the copy locked with it, and the old gist (whose earlier
        // revisions were locked with the old password) first points to the new one, then is deleted
        const { content } = await sealed();
        const id = await create(content);
        const old = s.gistId;
        s.gistId = id;
        s.rotate = false;
        if (old && old !== id) {
          try {
            await gh('/gists/' + old, { method: 'PATCH', body: { files: { [A.gistFile]: { content: JSON.stringify({ app: A.kind, kind: 'moved', movedTo: id }) } } } });
            await gh('/gists/' + old, { method: 'DELETE' });
          } catch (e) { /* the pointer or the new gist is enough for the other devices */ }
        }
      } else {
        let found = s.gistId ? await readGist(s.gistId) : { exists: false, copy: null };
        if (found.movedTo) { s.gistId = found.movedTo; found = await readGist(s.gistId); }
        if (!found.exists) { // first time on this device, or the gist was deleted on GitHub
          s.gistId = await findGist();
          found = s.gistId ? await readGist(s.gistId) : { exists: false, copy: null };
          if (found.movedTo) { s.gistId = found.movedTo; found = await readGist(s.gistId); }
        }
        let remoteKey = null;
        if (found.copy) {
          const r = await mergeRemote(found.copy);
          if (r === 'locked') return;
          if (r === 'password') { setSync('password'); return; }
          remoteKey = r;
        }
        if (!vault) return; // locked meanwhile: nothing more to send
        const { text, content } = await sealed();
        if (text !== remoteKey) {
          if (found.exists && !found.movedTo) await gh('/gists/' + s.gistId, { method: 'PATCH', body: { files: { [A.gistFile]: { content } } } });
          else s.gistId = await create(content);
        }
      }
      if (sync) { sync.lastSyncAt = Date.now(); sync.adopt = false; }
      if (sync && !sync.login) { try { const me = await gh('/user'); if (me && sync) sync.login = me.login || ''; } catch (e) { /* only for the label */ } }
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
  if (!sync || !syncAllowed()) return;
  syncDirty = true;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncNow({ quiet: true }), 2500);
}

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
  const isOn = !!sync;
  const [label, tone] = SYNC_LABEL[syncState] || SYNC_LABEL.idle;
  const chip = $('#syncChip');
  if (chip) {
    chip.hidden = !isOn || !vault;
    chip.className = 'chip mast-chip' + (tone ? ' ' + tone : '');
    chip.textContent = label;
  }
  if (!$('#syncOff')) return;
  $('#syncOff').hidden = isOn;
  $('#syncOnBox').hidden = !isOn;
  const cc = $('#syncCardChip');
  cc.className = 'chip' + (isOn && tone ? ' ' + tone : '');
  cc.textContent = isOn ? label : 'Off';
  if (!isOn) return;
  const who = sync.login ? ` to GitHub as ${sync.login}` : ' to GitHub';
  $('#syncText').textContent = {
    idle: `Connected${who}.`,
    syncing: `Connected${who}. Syncing now...`,
    ok: `Connected${who}. Last synced ${ago(sync.lastSyncAt)}.`,
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

const looksLikeToken = t => /^(gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})$/.test(t);
async function connectToken(token, keepGist) {
  await syncIdle(); // a sync still running keeps the old token to the end
  const prev = sync;
  sync = { token, gistId: keepGist && prev ? prev.gistId : '', login: '', lastSyncAt: 0, adopt: keepGist && prev ? prev.adopt : true, rotate: false };
  try {
    const me = await gh('/user');
    if (!me) throw new SyncError('token');
    sync.login = me.login || '';
  } catch (e) {
    sync = prev;
    renderSync();
    toast(e.code === 'offline' ? "Couldn't reach GitHub. Check your connection and try again." : "GitHub didn't accept that token. Copy it again and paste it here.");
    return false;
  }
  // an account the app keeps apart from this sync (the team account partners hold a token for)
  const refused = A.refuseSyncLogin ? A.refuseSyncLogin(sync.login) : '';
  if (refused) { sync = prev; renderSync(); toast(refused); return false; }
  await saveNow();
  renderSync();
  await syncNow();
  if (syncState === 'ok') toast('Sync is on. Copy your setup link to add your phone.');
  return true;
}

/* ------------------------------------------------------------------ setup links */

// settings (and the sync connection, when sync is on), locked with the password and packed into
// the part after #, which browsers never send to a server
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
  const linkSync = sync && syncAllowed() ? { token: sync.token, gistId: sync.gistId } : null;
  const box = await seal(vault.key, vault.salt, JSON.stringify({ s: A.setupPayload(), sync: linkSync }));
  return location.origin + location.pathname + '#setup=' + b64url(JSON.stringify(box));
}
function parseSetup(text) {
  const m = /#setup=([A-Za-z0-9_-]+)/.exec(String(text || ''));
  if (!m) return null;
  try { const j = JSON.parse(unb64url(m[1])); return j && (j.s || isBox(j)) ? j : null; } catch (e) { return null; }
}
let pendingSetup = null; // { s, sync, login } waiting for Load settings
// the GitHub account a token belongs to, or '' when it can't be checked
async function loginOf(token) {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 15000);
    const r = await fetch(GH + '/user', { cache: 'no-store', signal: ctl.signal, headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token } });
    clearTimeout(timer);
    if (!r.ok) return '';
    const me = await r.json();
    return me && typeof me.login === 'string' ? me.login.slice(0, 60) : '';
  } catch (e) { return ''; }
}
// unlocked = the link wasn't locked with the password, so anyone could have made it
async function offerSetup(s, linkSync, unlocked) {
  const offer = { s, sync: linkSync || null, login: '', unlocked: !!unlocked };
  pendingSetup = offer;
  const parts = [];
  if (s) parts.push(A.describeSetup(s));
  if (linkSync) {
    // Load waits until the account is named
    $('#setupYes').disabled = true;
    $('#setupBannerText').textContent = [...parts, 'Checking the GitHub account in this link...'].join(' ');
    $('#setupBanner').hidden = false;
    const login = await loginOf(linkSync.token);
    if (pendingSetup !== offer) return;
    offer.login = login;
    parts.push(login
      ? `It turns on sync with the GitHub account "${login}"${sync && sync.login && sync.login !== login ? ` instead of "${sync.login}"` : ''}. Only load it if that account is yours.`
      : "It turns on sync with a GitHub account that couldn't be checked right now. Only load it if you made this link yourself.");
  }
  $('#setupYes').disabled = false;
  $('#setupBannerText').textContent = parts.join(' ');
  $('#setupBanner').hidden = false;
}
// wait for a sync that is running (and any it hands on to) to finish
async function syncIdle() { while (syncRunning) { try { await syncRunning; } catch (e) { /* it reports its own errors */ } } }
// what a setup link brings: settings, and the sync connection when sync was on. A brand new device
// takes it straight away; a device that already has data asks first.
function applyLink(payload, fresh) {
  const s = payload && payload.s && typeof payload.s === 'object' ? payload.s : null;
  const linkSync = cleanSync(payload && payload.sync);
  if (fresh) {
    if (s) A.applySetup(s);
    if (linkSync && syncAllowed()) { sync = { ...linkSync, adopt: true }; return 'sync'; }
    return 'settings';
  }
  const same = linkSync && sync && sync.token === linkSync.token;
  if (same && linkSync.gistId && !sync.gistId) sync.gistId = linkSync.gistId;
  if (s || (linkSync && !same)) offerSetup(s, same ? null : linkSync);
  return 'offered';
}
// a setup link opened while unlocked: use it if the current key or password opens it, else ask
async function handleLink(link) {
  if (!link || !vault) return;
  if (link.s) { // an unlocked link, for a first setup only: it could come from anyone
    if (A.isEmpty && A.isEmpty()) offerSetup(link.s, null, true);
    else toast("That setup link isn't locked with your password, so it can only set up an empty app. Use Copy setup link on your other device instead.");
    return;
  }
  let payload = null;
  try { payload = await unsealWith(vault.password, link); } catch (e) { payload = null; }
  if (!payload) { pendingLink = link; showLock('join'); return; }
  if (link.salt !== bytesToB64(vault.salt)) { // same password, made on another device: share its key from now on
    vault = await newVault(vault.password, b64ToBytes(link.salt), link.iter || ITER);
    await rememberSession();
  }
  applyLink(payload, false);
  await saveNow();
}

/* ------------------------------------------------------------------ staying unlocked */

// A refresh keeps Jan in: IndexedDB holds this window's copy of the key, wrapped with a secret that
// lives only in this window's sessionStorage. Closing the app or tab drops the secret, so what is
// left in IndexedDB is useless, and other pages of the site (another tab, a tracking script) never
// see the secret. The copy is also refused after 3 minutes without use, and wiped on Lock.
let idbOpen = null;
function idb(mode, fn) {
  idbOpen = idbOpen || new Promise((resolve, reject) => {
    const r = indexedDB.open(K.idb, 1);
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
function windowSecret(create) {
  let w = null;
  try { w = JSON.parse(sessionStorage.getItem(K.window) || 'null'); } catch (e) { w = null; }
  if ((!w || typeof w.id !== 'string' || typeof w.secret !== 'string') && create) {
    w = { id: bytesToB64(randomBytes(9)).replace(/[^A-Za-z0-9]/g, ''), secret: bytesToB64(randomBytes(32)) };
    try { sessionStorage.setItem(K.window, JSON.stringify(w)); } catch (e) { return null; }
  }
  return w && typeof w.id === 'string' && typeof w.secret === 'string' ? w : null;
}
const secretKey = w => crypto.subtle.importKey('raw', b64ToBytes(w.secret), 'AES-GCM', false, ['encrypt', 'decrypt']);
function sessionDrop() {
  const w = windowSecret(false);
  try { sessionStorage.removeItem(K.window); } catch (e) { /* ignore */ }
  return w ? idb('readwrite', st => st.delete('session:' + w.id)).catch(() => {}) : Promise.resolve();
}
// clear copies from windows that were closed or left idle
function sessionSweep() {
  return idb('readwrite', st => {
    const req = st.openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return;
      const v = c.value;
      if (String(c.key).startsWith('session') && !(v && Date.now() - (+v.at || 0) <= recLimit(v))) c.delete();
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
      const iv = randomBytes(12);
      const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await secretKey(w), vault.raw));
      if (!vault) return;
      wrapped = { salt: bytesToB64(vault.salt), iv: bytesToB64(iv), data: bytesToB64(data), forKey: vault.key };
    }
    const rec = { salt: wrapped.salt, iv: wrapped.iv, data: wrapped.data, at: lastActive, limit: idleLimit() };
    await idb('readwrite', st => st.put(rec, 'session:' + w.id));
  } catch (e) { /* a refresh then asks for the password */ }
}
async function sessionRestore(box) {
  const w = windowSecret(false);
  if (!w) return null;
  const rec = await idb('readonly', st => st.get('session:' + w.id)).catch(() => null);
  if (!rec || rec.salt !== box.salt || !(Date.now() - (+rec.at || 0) <= recLimit(rec))) return null;
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
async function lockNow() {
  if ($('#lock')) {
    $('#lockMsg').textContent = 'Locking...';
    $('#lockFields').hidden = true;
    $('#lock').hidden = false;
    $('.mast').inert = true;
    $('main').inert = true;
    for (const el of document.querySelectorAll('.sheet, .banner')) el.hidden = true;
  }
  await saveNow();
  if (vault && sync && syncDirty) { // an edit made just before locking still reaches the other devices
    await Promise.race([syncNow({ quiet: true }), new Promise(r => setTimeout(r, 4000))]);
  }
  await sessionDrop();
  vault = null; // stops the page from writing the key back while it unloads
  location.reload();
}
const idleTooLong = () => vault && Date.now() - lastActive > idleLimit();

/* ------------------------------------------------------------------ fingerprint unlock */

// A passkey on this device with the WebAuthn PRF extension: the fingerprint releases a secret that
// only that passkey can produce, and the secret opens a copy of the password kept on this device.
let bioSupport = null;
async function bioAvailable() { // only a yes is remembered: a sensor that wasn't ready may be now
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
  const b = readJSON(K.bio);
  return b && typeof b.cred === 'string' && typeof b.prfSalt === 'string' && isBox(b.box) ? b : null;
}
async function prfKey(secret) {
  const base = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: new TextEncoder().encode(K.ns + ' fingerprint unlock') },
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
    rp: { name: A.name, id: location.hostname },
    user: { id: randomBytes(16), name: A.name, displayName: A.name },
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
  writeJSON(K.bio, { cred: credB64, prfSalt: bytesToB64(prfSalt), box });
}
const dropBio = () => { try { localStorage.removeItem(K.bio); } catch (x) { /* ignore */ } };
async function renderBio() {
  if (!$('#bioChip')) return;
  const isOn = !!bioSaved();
  const ok = await bioAvailable();
  $('#bioChip').className = 'chip' + (isOn ? ' ok' : '');
  $('#bioChip').textContent = isOn ? 'On' : 'Off';
  $('#bioOn').hidden = isOn;
  $('#bioOn').classList.toggle('gold', ok);
  $('#bioOff').hidden = !isOn;
  if (isOn) $('#bioPwWrap').hidden = true;
  $('#bioText').textContent = isOn
    ? 'On for this device. The lock screen asks for your fingerprint first, and your password still works too.'
    : ok ? 'Unlock with your fingerprint instead of typing your password. It uses a passkey saved on this device.'
      : "This browser can't do fingerprint unlock for web apps. Chrome can still fill in your password with your fingerprint: in Chrome open Settings, Password Manager, and turn on Use screen lock.";
}
async function maybeOfferBio() {
  if (!$('#bioBanner') || bioSaved() || readJSON(K.bioAsked) || !(await bioAvailable())) return;
  $('#bioBanner').hidden = false;
}
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
      dropBio();
      btn.hidden = true;
      $('#lockBtn').classList.add('gold');
      err.textContent = 'Your password was changed, so fingerprint unlock needs turning on again. Type your password.';
    } else if (!(e && e.name === 'NotAllowedError')) {
      err.textContent = "Fingerprint didn't work this time. Try again, or type your password.";
    } else if (!auto) {
      err.textContent = "Fingerprint didn't open it. If this keeps happening, type your password, then turn fingerprint unlock off and on again in Settings.";
    }
  } finally {
    bioBusy = false;
    btn.disabled = false;
    btn.textContent = 'Unlock with fingerprint';
  }
}

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
    create: A.text.create,
    unlock: A.text.unlock,
    join: A.text.join || ['Set up this device', 'Type the password you use on your other device. This device will use it too.', 'Set up'],
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
// open this device's copy with a password; false when it's the wrong one
async function openWithPassword(pw) {
  const box = readJSON(K.vault);
  const next = await newVault(pw, b64ToBytes(box.salt), box.iter || ITER);
  let data;
  try { data = await unseal(next.key, box); } catch (x) { return false; }
  vault = next;
  loadVault(data);
  return true;
}
async function submitLock(e) {
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
      vault = await newVault(pw, randomBytes(16));
      loadVault({});
      cleanKey = null;
      await saveNow();
    } else if (lockMode === 'join') {
      const link = pendingLink;
      const next = await newVault(pw, b64ToBytes(link.salt), link.iter || ITER);
      let payload;
      try { payload = await unseal(next.key, link); } catch (x) { err.textContent = "That password doesn't open this setup link."; return; }
      const fresh = !vault;
      // a link this device mustn't take (someone else's invite): it keeps its own password and data
      const refusal = !fresh && A.refuseLink ? A.refuseLink(payload && payload.s) : '';
      if (refusal) { pendingLink = null; $('#lockPw').value = ''; hideLock(); toast(refusal); return; }
      if (fresh) loadVault({});
      vault = next;
      pendingLink = null;
      if (!fresh && A.afterJoin) A.afterJoin(payload && payload.s); // this device now opens with that link's password
      joinedSync = applyLink(payload, fresh) === 'sync';
      cleanKey = null;
      await saveNow();
    } else if (lockMode === 'repass') {
      const box = pendingRemote;
      const next = await newVault(pw, b64ToBytes(box.salt), box.iter || ITER);
      try { await unseal(next.key, box); } catch (x) { err.textContent = "That password isn't right."; return; }
      vault = next; // this device now uses the same password as the others
      pendingRemote = null;
      await saveNow();
      if (bioSaved()) dropBio(); // it held the old password
    }
    await afterUnlock();
    if (joinedSync) bootSync.then(() => { if (syncState === 'ok') toast('This device is set up and syncing.'); });
    maybeOfferBio();
  } finally {
    btn.disabled = false;
    if (lockMode === startMode) btn.textContent = label; // another screen may have taken over meanwhile
  }
}
async function afterUnlock() {
  lastActive = Date.now();
  await rememberSession();
  hideLock();
  // ask Chrome not to clear this site's data when the phone runs low on space
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (x) { /* ignore */ }
  await boot();
}
let bootSync = Promise.resolve();
async function boot() {
  A.onUnlock();
  renderSync();
  renderBio();
  markClean();
  if (pendingLink) { const link = pendingLink; pendingLink = null; await handleLink(link); }
  bootSync = sync && vault ? syncNow() : Promise.resolve();
}

/* ------------------------------------------------------------------ backups */

async function exportBackup() {
  if (!vault) return;
  const locked = await seal(vault.key, vault.salt, payloadKey());
  const data = { app: A.kind, kind: 'backup', version: 1, exportedAt: new Date().toISOString(), locked };
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${A.kind}-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  toast('Backup downloaded. It only opens with your password, so it is safe in Google Drive.');
}
let pendingBackup = null;
async function restoreFrom(data, password) {
  const payload = await unsealWith(password, data.locked);
  A.merge(payload, { restore: true });
  await saveNow();
  A.render();
  toast('Backup restored. Anything newer on this device was kept.');
}

/* ------------------------------------------------------------------ changing the password */

async function changePassword(pw, again) {
  if (!vault) return false;
  if (pw.length < 8) { toast('Use at least 8 characters.'); return false; }
  if (pw !== again) { toast("The two passwords don't match."); return false; }
  if (sync) {
    // bring in the other devices' changes first, while their copy still opens with the old password
    await syncNow();
    if (syncState === 'password') { toast('Sync needs your current password first. Tap Type password under Sync.'); return false; }
    if (syncState !== 'ok') { toast("Sync can't reach GitHub right now. Change the password when you're back online, so your other devices get it."); return false; }
    sync.rotate = true; // the next sync moves to a fresh gist locked with the new password, even if this one fails
  }
  vault = await newVault(pw, randomBytes(16));
  await saveNow();
  await rememberSession();
  if (sync) await syncNow();
  const hadBio = !!bioSaved();
  if (hadBio) { dropBio(); renderBio(); }
  toast('Password changed.' + (sync ? ' Your other devices open with the old password (or fingerprint) one more time, then ask for the new one.' : '') + (hadBio ? ' Turn fingerprint unlock on again below.' : ''));
  return true;
}

/* ------------------------------------------------------------------ start */

function wire() {
  on('#lockForm', 'submit', submitLock);
  on('#lockCancel', 'click', () => { pendingLink = null; hideLock(); });
  on('#forgotBtn', 'click', () => { $('#forgotConfirm').hidden = false; $('#forgotBtn').hidden = true; });
  on('#forgotNo', 'click', () => { $('#forgotConfirm').hidden = true; $('#forgotBtn').hidden = false; });
  on('#forgotYes', 'click', async () => {
    try { localStorage.removeItem(K.vault); } catch (x) { /* ignore */ }
    dropBio();
    await sessionDrop();
    showLock(pendingLink && isBox(pendingLink) ? 'join' : 'create');
  });
  on('#bioBtn', 'click', () => unlockWithFingerprint(false));
  on('#lockNowBtn', 'click', lockNow);

  on('#syncOn', 'click', async e => {
    const token = $('#syncToken').value.trim();
    if (!looksLikeToken(token)) { toast("That doesn't look like a GitHub token. It starts with ghp_ or github_pat_."); return; }
    e.target.disabled = true;
    try { if (await connectToken(token, false)) $('#syncToken').value = ''; } finally { e.target.disabled = false; }
  });
  on('#syncTokenSave', 'click', async e => {
    const token = $('#syncToken2').value.trim();
    if (!looksLikeToken(token)) { toast("That doesn't look like a GitHub token. It starts with ghp_ or github_pat_."); return; }
    e.target.disabled = true;
    try { if (await connectToken(token, true)) $('#syncToken2').value = ''; } finally { e.target.disabled = false; }
  });
  on('#syncNowBtn', 'click', () => syncNow());
  on('#syncFix', 'click', () => { if (pendingRemote) showLock('repass'); });
  on('#syncOffBtn', 'click', async () => {
    sync = null;
    setSync('idle');
    await saveNow();
    toast('Sync is off on this device. Your data stays here, and your other devices keep syncing.');
  });

  on('#copySetup', 'click', async () => {
    if (!vault) return;
    const link = await setupLink();
    try {
      await navigator.clipboard.writeText(link);
      toast(sync ? 'Setup link copied. Open it on your phone and it joins sync.' : 'Setup link copied. It only opens with your password.');
    } catch (e) { const o = $('#setupOut'); o.value = link; o.hidden = false; o.focus(); o.select(); toast('Copy the link below.'); }
  });
  for (const [input, button] of [['#setupPaste', '#setupPasteBtn'], ['#setupPaste2', '#setupPasteBtn2']]) {
    on(button, 'click', () => {
      const link = parseSetup($(input).value);
      if (!link) { toast("That doesn't look like a setup link."); return; }
      $(input).value = '';
      handleLink(link);
    });
  }
  on('#setupYes', 'click', async () => {
    const p = pendingSetup;
    pendingSetup = null;
    $('#setupBanner').hidden = true;
    if (!p || !vault) return;
    if (p.unlocked && !(A.isEmpty && A.isEmpty())) { toast("That setup link isn't locked with your password, so it can only set up an empty app."); return; }
    if (p.sync) { await syncIdle(); if (!vault) return; } // a sync still running keeps the old connection to the end
    if (p.s) A.applySetup(p.s, { unlocked: p.unlocked });
    if (p.sync && !syncAllowed()) p.sync = null;
    const refused = p.sync && p.login && A.refuseSyncLogin ? A.refuseSyncLogin(p.login) : '';
    if (refused) { p.sync = null; toast(refused); }
    if (p.sync) {
      const sameAccount = !!(sync && sync.login && p.login && sync.login === p.login);
      // a gist this device hasn't synced with before: its business details fill in what this device lacks
      sync = { ...p.sync, login: p.login || '', lastSyncAt: 0, adopt: !sameAccount, rotate: false };
    }
    await saveNow();
    A.render();
    renderSync();
    if (p.sync) {
      await syncNow();
      toast(syncState === 'ok' ? 'Loaded, and sync is on for this device.' : 'Loaded. Sync is on, but it could not reach GitHub yet.');
    } else toast(refused || 'Settings loaded.');
  });
  on('#setupNo', 'click', () => { pendingSetup = null; $('#setupBanner').hidden = true; });

  on('#pwForm', 'submit', async e => {
    e.preventDefault();
    if (await changePassword($('#pwNew').value, $('#pwNew2').value)) { $('#pwNew').value = ''; $('#pwNew2').value = ''; }
  });

  on('#bioOn', 'click', async () => {
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
      try { await unseal(await deriveKey(pw, vault.salt), readJSON(K.vault)); } catch (e) { toast("That password isn't right."); return; }
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
  on('#bioOff', 'click', () => {
    dropBio();
    renderBio();
    toast(`Fingerprint unlock is off. You can also delete the ${A.name} passkey in Google Password Manager.`);
  });
  on('#bioYes', 'click', () => { $('#bioBanner').hidden = true; $('#bioOn').click(); });
  on('#bioNo', 'click', () => { $('#bioBanner').hidden = true; writeJSON(K.bioAsked, 1); });

  on('#exportBtn', 'click', exportBackup);
  on('#importFile', 'change', async e => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f || !vault) return;
    let data = null;
    try { data = JSON.parse(await f.text()); } catch (err) { /* not JSON */ }
    if (!data || data.app !== A.kind || !isBox(data.locked)) { toast("That file isn't a backup from this app."); return; }
    try { await restoreFrom(data, vault.password); $('#restorePw').hidden = true; }
    catch (err) {
      pendingBackup = data;
      $('#restorePw').hidden = false;
      $('#restorePwIn').focus();
      toast('This backup was locked with a different password. Type that password to open it.');
    }
  });
  on('#restorePwBtn', 'click', async () => {
    if (!pendingBackup) return;
    try {
      await restoreFrom(pendingBackup, $('#restorePwIn').value);
      pendingBackup = null;
      $('#restorePwIn').value = '';
      $('#restorePw').hidden = true;
    } catch (err) { toast("That password doesn't open this backup."); }
  });

  // saving, syncing and locking follow the app being used, hidden or closed
  window.addEventListener('pagehide', () => { saveNow(); rememberSession(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      saveNow();
      rememberSession();
      if (vault && sync && syncDirty) syncNow({ quiet: true }); // send changes before switching device
    } else if (idleTooLong()) lockNow();
    else if (vault && sync) syncNow({ quiet: true });
  });
  // real use only: the page also scrolls by itself when changes arrive from another device
  for (const ev of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart']) document.addEventListener(ev, noteActivity, { passive: true });
  setInterval(() => { if (idleTooLong()) lockNow(); }, 10000);
  setInterval(() => { if (vault && sync && document.visibilityState === 'visible') syncNow({ quiet: true }); }, 60000);
  setInterval(() => { if (sync && syncState === 'ok') renderSync(); }, 30000);
  window.addEventListener('online', () => { if (vault && sync) syncNow({ quiet: true }); });
  window.addEventListener('hashchange', () => {
    const link = takeLinkFromAddress();
    if (!link) return;
    if (vault) handleLink(link);
    else { pendingLink = link; if (!isBox(readJSON(K.vault)) && isBox(link)) showLock('join'); }
  });

  // installing, and new versions of the app
  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; if ($('#installBtn')) $('#installBtn').hidden = false; });
  on('#installBtn', 'click', async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    try { await installPrompt.userChoice; } catch (e) { /* closed */ }
    installPrompt = null;
    $('#installBtn').hidden = true;
  });
  window.addEventListener('appinstalled', () => { if ($('#installBtn')) $('#installBtn').hidden = true; toast(`Installed. Open ${A.name} from your home screen or app list.`); });
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) return;
      if (!vault) location.reload(); // still on the lock screen: nothing to lose
      else toast('A new version of the app is ready.', { label: 'Reload', run: () => lockNow().catch(() => location.reload()) });
    });
  }
}

async function start(app) {
  A = app;
  K = { ns: app.ns, vault: app.ns + '-vault-v1', window: app.ns + '-window', bio: app.ns + '-bio-v1', bioAsked: app.ns + '-bio-asked', idb: app.ns };
  if ($('#lockFields')) $('#lockFields').hidden = true; // until we know which screen to show
  wire();
  pendingLink = takeLinkFromAddress();
  const box = readJSON(K.vault);
  if (isBox(box)) {
    // only a refresh keeps Jan in: Chrome also brings sessionStorage back when a closed tab is reopened
    const nav = performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
    const restored = !nav || nav.type === 'reload' ? await sessionRestore(box) : null;
    if (restored) {
      try {
        const data = await unseal(restored.key, box);
        vault = restored;
        loadVault(data);
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

window.GJCore = {
  start, save, saveNow, toast, lockNow, ago, changePassword,
  syncNow: opts => syncNow(opts),
  unlocked: () => !!vault,
  syncInfo: () => ({ on: !!sync, state: syncState, gistId: sync ? sync.gistId : '', login: sync ? sync.login : '' }),
  // for the team time channels
  github: ghWith, newRawKey, sealRaw, openRaw, sealWithPassword, b64url,
  // for bringing the old Payroll app's data in
  openBox, openWithCurrent,
  randomCode: n => Array.from(randomBytes(n), b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join(''),
};
})();
