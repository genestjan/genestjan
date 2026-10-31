import { create } from 'zustand';
import { processCapture, type CaptureContext, type CaptureItem } from './capture';
import {
  clearInbox, cloudConfig, changeLogin, currentUserId, fetchInbox, fetchVault, newDropToken, remoteFor,
  resetWithRecovery, saveVault, sb, signIn, signOut, signUp, watch,
} from './cloud';
import {
  b64, createVault, dataKey, deriveMaster, newCaptureKeys, openCapture, openWithPassword, openWithRecovery,
  recoveryProof, rewrap, unb64, type VaultBoxes,
} from './crypto';
import { idbDB, memoryDB, type LocalDB } from './db';
import { Ledger, type Snapshot } from './ledger';
import { defaultCategories, defaultSettings, type AnyRecord, type Settings } from './model';
import { native, on, platform, type BioStatus } from './native';
import { reminderSettings, scheduleOnDevice, syncCalendar, upcomingReminders } from './reminders';
import { todayISO } from './dates';

// The app's life: welcome, create or sign in, locked, unlocked. Also the background work an
// unlocked app does: syncing, taking in captured notifications and locking itself when idle.

export type Phase = 'boot' | 'welcome' | 'cloud' | 'create' | 'signin' | 'confirm-email' | 'locked' | 'recovery' | 'forgot' | 'ready';

export interface VaultMeta { mode: 'cloud' | 'local'; email: string; userId?: string; boxes: VaultBoxes }

export interface SyncState { state: 'off' | 'idle' | 'syncing' | 'error' | 'offline'; at?: number; detail?: string }

export interface AppState {
  phase: Phase;
  meta: VaultMeta | null;
  snap: Snapshot | null;
  demo: boolean;
  busy: string | null;
  error: string | null;
  toast: string | null;
  recoveryKey: string | null;
  pendingEmail: string | null;
  /** Where the cloud screen goes after Connect: create an account or sign in. */
  afterCloud: 'create' | 'signin';
  sync: SyncState;
  bio: BioStatus;
  /** Last Google Calendar problem on this device (not synced). */
  calendarError: string | null;
}

export const useApp = create<AppState>(() => ({
  phase: 'boot', meta: null, snap: null, demo: false, busy: null, error: null, toast: null,
  recoveryKey: null, pendingEmail: null, afterCloud: 'create', sync: { state: 'off' }, bio: { available: false, enrolled: false, label: '' },
  calendarError: null,
}));

const set = useApp.setState;
const get = useApp.getState;

// Opened on first use, so importing this module needs no IndexedDB (tests, previews).
let store: LocalDB | null = null;
const db = (): LocalDB => (store ??= idbDB());
let ledger: Ledger | null = null;
let dek: Uint8Array | null = null;
let stopWatch: (() => void) | null = null;
let syncTimer: ReturnType<typeof setTimeout> | undefined;
let lastActive = Date.now();

export const getLedger = () => ledger;

export function toast(message: string) {
  set({ toast: message });
  setTimeout(() => { if (get().toast === message) set({ toast: null }); }, 3500);
}

async function work<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
  set({ busy: label, error: null });
  try {
    return await fn();
  } catch (e) {
    set({ error: (e as Error).message || 'Something went wrong.' });
    return undefined;
  } finally {
    set({ busy: null });
  }
}

const localSalt = (email: string) => email.trim() || 'this-device';

// ---- Start-up ------------------------------------------------------------------------------

export async function boot(opts: { demo?: boolean } = {}) {
  armIdleLock();
  if (opts.demo) return startDemo();
  const meta = (await db().meta<VaultMeta>('vault')) ?? null;
  const bio = await native.bioStatus().catch(() => get().bio);
  set({ meta, bio, phase: meta ? 'locked' : 'welcome' });
  if (meta && bio.enrolled) void unlockWithBio();
}

export function go(phase: Phase) {
  set({ phase, error: null });
}

// ---- Creating, signing in, unlocking --------------------------------------------------------

export async function createAccount(email: string, password: string, useCloud: boolean) {
  await work('Locking your vault with your password…', async () => {
    const master = await deriveMaster(password, useCloud ? email : localSalt(email));
    if (!useCloud) {
      const v = await createVault(master);
      await saveMeta({ mode: 'local', email: email.trim(), boxes: v.boxes });
      await openLedger(v.dek, true);
      set({ recoveryKey: v.recoveryKey, phase: 'recovery' });
      return;
    }
    const c = sb();
    if (!c) throw new Error('Connect your cloud first.');
    const res = await signUp(c, email, master.auth);
    if (res === 'confirm-email') {
      set({ pendingEmail: email.trim(), phase: 'confirm-email' });
      return;
    }
    await finishSignIn(res.userId, email, master);
  });
}

export async function signInAccount(email: string, password: string) {
  await work('Signing in…', async () => {
    const c = sb();
    if (!c) throw new Error('Connect your cloud first.');
    const master = await deriveMaster(password, email);
    const userId = await signIn(c, email, master.auth);
    await finishSignIn(userId, email, master);
  });
}

async function finishSignIn(userId: string, email: string, master: Awaited<ReturnType<typeof deriveMaster>>) {
  const c = sb()!;
  let boxes = await fetchVault(c);
  let recoveryKey: string | null = null;
  let key: Uint8Array;
  if (!boxes) {
    const v = await createVault(master);
    await saveVault(c, userId, v.boxes);
    boxes = v.boxes;
    key = v.dek;
    recoveryKey = v.recoveryKey;
  } else {
    key = await openWithPassword(master, boxes);
  }
  await saveMeta({ mode: 'cloud', email: email.trim(), userId, boxes });
  await openLedger(key, !!recoveryKey);
  set(recoveryKey ? { recoveryKey, phase: 'recovery' } : { phase: 'ready' });
  void syncNow();
}

export async function unlockWithPassword(password: string) {
  const meta = get().meta;
  if (!meta) return;
  await work('Unlocking…', async () => {
    const master = await deriveMaster(password, meta.mode === 'cloud' ? meta.email : localSalt(meta.email));
    let key: Uint8Array | null = null;
    try {
      key = await openWithPassword(master, meta.boxes);
    } catch (e) {
      // The password may have been changed on another device: ask the cloud for the new lock.
      if (meta.mode !== 'cloud') throw e;
      const c = sb()!;
      const userId = await signIn(c, meta.email, master.auth);
      const boxes = await fetchVault(c);
      if (!boxes) throw e;
      key = await openWithPassword(master, boxes);
      await saveMeta({ ...meta, userId, boxes });
    }
    if (meta.mode === 'cloud') {
      const c = sb();
      if (c && !(await currentUserId(c).catch(() => null))) await signIn(c, meta.email, master.auth).catch(() => undefined);
    }
    await openLedger(key, false);
    set({ phase: 'ready' });
    void syncNow();
  });
}

export async function unlockWithBio() {
  if (get().phase !== 'locked') return;
  try {
    const { secret } = await native.bioUnlock();
    await openLedger(unb64(secret), false);
    set({ phase: 'ready', error: null });
    void syncNow();
  } catch (e) {
    const msg = (e as Error).message;
    if (!/cancel/i.test(msg)) set({ error: msg });
  }
}

export async function enableBio(): Promise<boolean> {
  if (!dek) return false;
  try {
    await native.bioEnroll(b64(dek));
    set({ bio: await native.bioStatus() });
    toast(`${get().bio.label || 'Fingerprint'} unlock is on for this device.`);
    return true;
  } catch (e) {
    set({ error: (e as Error).message });
    return false;
  }
}

export async function disableBio() {
  await native.bioClear().catch(() => undefined);
  set({ bio: await native.bioStatus() });
}

export async function recoverAccount(email: string, recoveryKey: string, newPassword: string) {
  await work('Checking your recovery key…', async () => {
    const meta = get().meta;
    const local = meta?.mode === 'local';
    const master = await deriveMaster(newPassword, local ? localSalt(meta!.email) : email);
    if (local) {
      const key = await openWithRecovery(recoveryKey, meta!.boxes);
      await saveMeta({ ...meta!, boxes: { ...meta!.boxes, pw: await rewrap(key, master) } });
      await openLedger(key, false);
      set({ phase: 'ready' });
      toast('New password set.');
      return;
    }
    const c = sb();
    if (!c) throw new Error('Connect your cloud first.');
    await resetWithRecovery(c, email, await recoveryProof(recoveryKey), master.auth);
    const userId = await signIn(c, email, master.auth);
    const boxes = await fetchVault(c);
    if (!boxes) throw new Error('No vault found for that account.');
    const key = await openWithRecovery(recoveryKey, boxes);
    const moved = { ...boxes, pw: await rewrap(key, master) };
    await saveVault(c, userId, moved);
    await saveMeta({ mode: 'cloud', email: email.trim(), userId, boxes: moved });
    await openLedger(key, false);
    set({ phase: 'ready' });
    toast('New password set. Use it on your other devices too.');
    void syncNow();
  });
}

export async function changePassword(current: string, next: string): Promise<boolean> {
  const meta = get().meta;
  if (!meta || !dek) return false;
  const ok = await work('Changing your password…', async () => {
    const salt = meta.mode === 'cloud' ? meta.email : localSalt(meta.email);
    await openWithPassword(await deriveMaster(current, salt), meta.boxes);
    const master = await deriveMaster(next, salt);
    const boxes = { ...meta.boxes, pw: await rewrap(dek!, master) };
    if (meta.mode === 'cloud') {
      const c = sb()!;
      await changeLogin(c, master.auth);
      await saveVault(c, meta.userId!, boxes);
    }
    await saveMeta({ ...meta, boxes });
    return true;
  });
  if (ok) toast('Password changed.');
  return !!ok;
}

async function saveMeta(meta: VaultMeta) {
  await db().setMeta('vault', meta);
  set({ meta });
}

// ---- The open ledger ------------------------------------------------------------------------

async function openLedger(key: Uint8Array, fresh: boolean) {
  dek = key;
  ledger?.close();
  ledger = new Ledger(db(), await dataKey(key));
  const { unreadable } = await ledger.load();
  if (unreadable) toast(`${unreadable} saved item${unreadable > 1 ? 's' : ''} could not be opened and were skipped.`);
  // Defaults are stamped as the oldest possible version, so on a second device the real
  // categories and settings from the cloud always win over them.
  const snap = ledger.snapshot();
  const seed: AnyRecord[] = [];
  if (!snap.categories.length) seed.push(...defaultCategories(1));
  if (fresh || !ledger.get('settings')) seed.push({ ...defaultSettings(1), ...(ledger.get<Settings>('settings') ?? {}) });
  if (seed.length) await ledger.put(seed, 1);
  ledger.subscribe(() => {
    set({ snap: ledger!.snapshot() });
    if (ledger!.dirty().length) syncSoon();
    remindersSoon();
  });
  set({ snap: ledger.snapshot() });
  lastActive = Date.now();
  set({ bio: await native.bioStatus().catch(() => get().bio) });
  startBackground();
}

export async function save(records: AnyRecord[]) {
  if (!ledger) return;
  await ledger.put(records);
}

export async function removeRecords(ids: string[]) {
  if (!ledger) return;
  await ledger.remove(ids);
}

export function lock() {
  if (get().demo || !ledger) return;
  stopBackground();
  ledger.close();
  ledger = null;
  dek?.fill(0);
  dek = null;
  set({ phase: 'locked', snap: null, recoveryKey: null, error: null });
}

export async function signOutEverywhereOnThisDevice() {
  const c = sb();
  if (c) await signOut(c).catch(() => undefined);
  await disableBio();
  lock();
  await db().wipe();
  localStorage.removeItem('mh-drop');
  set({ meta: null, phase: 'welcome' });
}

// ---- Background work while unlocked ---------------------------------------------------------

let interval: ReturnType<typeof setInterval> | undefined;

function startBackground() {
  stopBackground();
  interval = setInterval(() => { void syncNow().then(() => setUpCapture()).then(() => takeCaptures()).then(() => refreshReminders()); }, 60_000);
  const meta = get().meta;
  const c = sb();
  if (meta?.mode === 'cloud' && c && meta.userId) {
    stopWatch = watch(c, meta.userId, () => syncSoon(800), () => void takeCaptures());
  }
  // Settings only change after the first sync, so a fresh device never replaces the real ones.
  void syncNow().then(() => setUpCapture()).then(() => takeCaptures()).then(() => refreshRates()).then(() => refreshReminders());
}

function stopBackground() {
  clearInterval(interval);
  clearTimeout(reminderTimer);
  clearTimeout(syncTimer);
  stopWatch?.();
  stopWatch = null;
}

export function syncSoon(ms = 1500) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => void syncNow(), ms);
}

let syncing: Promise<void> | null = null;

export function syncNow(): Promise<void> {
  const meta = get().meta;
  if (!ledger || meta?.mode !== 'cloud' || get().demo) return Promise.resolve();
  if (syncing) return syncing;
  const c = sb();
  if (!c) return Promise.resolve();
  syncing = (async () => {
    set({ sync: { ...get().sync, state: 'syncing' } });
    try {
      const uid = await currentUserId(c);
      if (!uid) throw new Error('Signed out of the cloud. Lock the app and unlock it with your password to sign in again.');
      await ledger!.sync(remoteFor(c, uid));
      set({ sync: { state: 'idle', at: Date.now() } });
    } catch (e) {
      set({ sync: { state: navigator.onLine ? 'error' : 'offline', at: get().sync.at, detail: (e as Error).message } });
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

const syncedOnce = () => get().meta?.mode !== 'cloud' || !!get().sync.at;

async function setUpCapture() {
  if (!ledger || !syncedOnce()) return;
  let s = ledger.snapshot().settings;
  if (!s.capturePublicKey || !s.capturePrivateKey) {
    const keys = await newCaptureKeys();
    await ledger.put([{ ...s, capturePublicKey: keys.publicKey, capturePrivateKey: keys.privateKey }]);
    s = ledger.snapshot().settings;
  }
  if (platform !== 'android') return;
  const meta = get().meta;
  const cfg = cloudConfig();
  const c = sb();
  try {
    if (meta?.mode === 'cloud' && cfg && c && meta.userId) {
      const mark = `${meta.userId}:${s.capturePublicKey!.slice(-16)}`;
      if (localStorage.getItem('mh-drop') !== mark) {
        const token = await newDropToken(c, meta.userId, 'Android phone');
        await native.captureConfigure({ publicKey: s.capturePublicKey!, supabaseUrl: cfg.url, anonKey: cfg.key, dropToken: token });
        localStorage.setItem('mh-drop', mark);
      }
    } else {
      await native.captureConfigure({ publicKey: s.capturePublicKey! });
    }
  } catch {
    // Offline: try again next time the app opens.
  }
}

let capturing = false;

/** Take in notifications the phone captured: from its own queue and from the cloud inbox. */
export async function takeCaptures(): Promise<number> {
  if (!ledger || capturing || get().demo) return 0;
  const priv = ledger.snapshot().settings.capturePrivateKey;
  if (!priv) return 0;
  capturing = true;
  let added = 0;
  try {
    const found: { item?: CaptureItem; queueId?: string; inboxId?: string }[] = [];
    if (platform === 'android') {
      const { items } = await native.captureRead().catch(() => ({ items: [] }));
      for (const q of items) {
        try { found.push({ item: JSON.parse(await openCapture(priv, q.box)), queueId: q.id }); }
        catch { found.push({ queueId: q.id }); } // sealed for an older key: nothing to do with it
      }
    }
    const c = sb();
    if (get().meta?.mode === 'cloud' && c && navigator.onLine) {
      const rows = await fetchInbox(c).catch(() => []);
      for (const r of rows) {
        try { found.push({ item: JSON.parse(await openCapture(priv, r.payload)), inboxId: r.id }); }
        catch { found.push({ inboxId: r.id }); }
      }
    }
    for (const f of found) {
      if (!f.item || !ledger) continue;
      const s = ledger.snapshot();
      const ctx: CaptureContext = { accounts: s.accounts, txns: s.txns, captures: s.captures, rules: s.rules, bills: s.bills, settings: s.settings };
      const out = await processCapture(f.item, ctx);
      const recs: AnyRecord[] = [...(out.capture ? [out.capture] : []), ...out.txns];
      if (recs.length) await ledger.put(recs);
      if (out.capture?.status === 'added') added++;
    }
    const queueIds = found.flatMap((f) => (f.queueId ? [f.queueId] : []));
    if (queueIds.length) await native.captureAck(queueIds).catch(() => undefined);
    const inboxIds = found.flatMap((f) => (f.inboxId ? [f.inboxId] : []));
    if (inboxIds.length && c) await clearInbox(c, inboxIds).catch(() => undefined);
    if (added) toast(`${added} new transaction${added > 1 ? 's' : ''} captured.`);
  } finally {
    capturing = false;
  }
  return added;
}

async function refreshRates() {
  if (!ledger || !syncedOnce()) return;
  const s = ledger.snapshot().settings;
  if (s.ratesUpdatedAt && Date.now() - s.ratesUpdatedAt < 12 * 3600_000) return;
  try {
    const res = await fetch('https://api.frankfurter.dev/v1/latest?base=PHP&symbols=USD,EUR,GBP,AUD,SGD,CAD,JPY');
    if (!res.ok) return;
    const { rates } = (await res.json()) as { rates: Record<string, number> };
    const pesosPer = Object.fromEntries(Object.entries(rates).map(([k, v]) => [k, Math.round((1 / v) * 10000) / 10000]));
    await ledger.put([{ ...ledger.snapshot().settings, rates: { ...s.rates, ...pesosPer }, ratesUpdatedAt: Date.now() }]);
  } catch {
    // Offline: the last rates stay.
  }
}

// ---- Bill reminders ---------------------------------------------------------------------------

let reminderTimer: ReturnType<typeof setTimeout> | undefined;
let reminding = false;

function remindersSoon(ms = 3000) {
  clearTimeout(reminderTimer);
  reminderTimer = setTimeout(() => void refreshReminders(), ms);
}

/** Schedules this device's notifications and updates Google Calendar when the list changed. */
export async function refreshReminders(force = false): Promise<void> {
  if (!ledger || get().demo || !syncedOnce() || reminding) return;
  reminding = true;
  try {
    const s = ledger.snapshot();
    const opts = reminderSettings(s.settings);
    const list = upcomingReminders(s, todayISO(), opts);
    await scheduleOnDevice(list, opts.days).catch(() => undefined);
    const link = opts.calendar;
    if (link && navigator.onLine) {
      try {
        const done = await syncCalendar(link, list, todayISO(), force);
        if (done && ledger) {
          const now = ledger.snapshot().settings;
          await ledger.put([{ ...now, reminders: { ...reminderSettings(now), calendar: { ...link, hash: done.hash, lastSync: Date.now() } } }]);
        }
        set({ calendarError: null });
      } catch (e) {
        set({ calendarError: (e as Error).message });
      }
    }
  } finally {
    reminding = false;
  }
}

// ---- Locking when idle ----------------------------------------------------------------------

let armed = false;

function armIdleLock() {
  if (armed) return;
  armed = true;
  const touch = () => { lastActive = Date.now(); };
  for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(ev, touch, { passive: true });
  const check = () => {
    const s = get();
    if (s.phase !== 'ready' || s.demo || !s.snap) return;
    const limit = Math.max(1, s.snap.settings.lockMinutes || 3) * 60_000;
    if (Date.now() - lastActive > limit) lock();
  };
  setInterval(check, 15_000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { check(); if (get().phase === 'ready') { syncSoon(300); void takeCaptures(); } }
  });
  on('resume', () => { check(); if (get().phase === 'ready') { syncSoon(300); void takeCaptures(); } });
  addEventListener('online', () => syncSoon(300));
}

// ---- Demo -----------------------------------------------------------------------------------

async function startDemo() {
  store = memoryDB();
  const { demoRecords } = await import('./demo');
  dek = crypto.getRandomValues(new Uint8Array(32));
  ledger = new Ledger(db(), await dataKey(dek));
  await ledger.load();
  await ledger.put(demoRecords());
  ledger.subscribe(() => set({ snap: ledger!.snapshot() }));
  set({ demo: true, phase: 'ready', snap: ledger.snapshot(), meta: { mode: 'local', email: 'demo@money.hub', boxes: {} as VaultBoxes } });
}
