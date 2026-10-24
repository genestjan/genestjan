import { useSyncExternalStore } from 'react';
import type { SupabaseClient, Session } from '@supabase/supabase-js';
import { applyRows, isUuid, rowJson, toRows, type RowIn } from './syncMap';
import { getState, migrate, onChange, update, type AppState } from './store';
import type { Player } from './model';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const cloudEnabled = Boolean(URL && KEY);

export type CloudStatus = 'off' | 'loading' | 'signed-out' | 'no-role' | 'pending' | 'ready';
export interface CloudState { status: CloudStatus; role: 'admin' | 'coach' | 'parent' | null; email: string; userId: string; error: string; syncing: boolean; lastSync: number; offline: boolean }
let cs: CloudState = { status: cloudEnabled ? 'loading' : 'off', role: null, email: '', userId: '', error: '', syncing: false, lastSync: 0, offline: false };
const subs = new Set<() => void>();
const set = (p: Partial<CloudState>) => { cs = { ...cs, ...p }; subs.forEach((f) => f()); };
export const useCloud = () => useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => cs);

let client: SupabaseClient | null = null;
export async function sb(): Promise<SupabaseClient> {
  if (client) return client;
  const { createClient } = await import('@supabase/supabase-js');
  client = createClient(URL!, KEY!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } });
  return client;
}

const SNAP_KEY = 'rangers-sync-snap', CUR_KEY = 'rangers-sync-cursor';
let snap = new Map<string, string>();
let cursor = '';
try { snap = new Map(JSON.parse(localStorage.getItem(SNAP_KEY) ?? '[]')); cursor = localStorage.getItem(CUR_KEY) ?? ''; } catch { /* first run */ }
const saveSnap = () => { try { localStorage.setItem(SNAP_KEY, JSON.stringify([...snap])); localStorage.setItem(CUR_KEY, cursor); } catch { /* ignore */ } };

export async function init() {
  if (!cloudEnabled) return;
  const c = await sb();
  const { data } = await c.auth.getSession();
  await onSession(data.session);
  c.auth.onAuthStateChange((_e, session) => { void onSession(session); });
  window.addEventListener('online', () => { set({ offline: false }); void syncNow(); });
  window.addEventListener('offline', () => set({ offline: true }));
  onChange((_p, _n, origin) => { if (origin === 'local') schedulePush(); });
}

async function onSession(session: Session | null) {
  if (!session) { set({ status: 'signed-out', role: null, email: '', userId: '' }); return; }
  const c = await sb();
  const { data, error } = await c.rpc('my_role');
  const role = (data as string | null) ?? null;
  const base = { email: session.user.email ?? '', userId: session.user.id, error: error?.message ?? '' };
  if (!role) { set({ ...base, status: 'no-role', role: null }); return; }
  if (role === 'pending') { set({ ...base, status: 'pending', role: null }); return; }
  // Never show one person's data to another on a shared phone: a different account, or a parent signing in
  // on a phone that still holds coach data from local-only mode, starts from an empty device.
  const prev = getState().me.userId;
  if ((prev && prev !== session.user.id) || (!prev && role === 'parent')) wipeLocal();
  set({ ...base, status: 'ready', role: role as CloudState['role'] });
  const fallback = (session.user.user_metadata?.full_name as string | undefined) ?? (session.user.email ?? 'Me').split('@')[0];
  update((s) => ({ ...s, me: { ...s.me, userId: session.user.id, name: s.me.name === 'Coach' || !s.me.userId ? fallback : s.me.name } }), 'remote');
  await syncNow(); void subscribeRealtime();
}

/* ---------- auth ---------- */
export async function signInGoogle() { const c = await sb(); await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + (import.meta.env.BASE_URL ?? '/') } }); }
export async function sendCode(email: string) { const c = await sb(); const { error } = await c.auth.signInWithOtp({ email, options: { shouldCreateUser: true } }); if (error) throw error; }
export async function verifyCode(email: string, token: string) { const c = await sb(); const { error } = await c.auth.verifyOtp({ email, token, type: 'email' }); if (error) throw error; }
export async function signOut() { const c = await sb(); await c.auth.signOut(); wipeLocal(); }
/** Clears everything stored on this phone for the signed-in person (keeps only the display mode). */
export function wipeLocal() {
  snap = new Map(); cursor = ''; saveSnap();
  update((s) => ({ ...migrate({}), mode: s.mode }), 'remote');
}

/* ---------- RPCs ---------- */
export async function claimAdmin() { const c = await sb(); const { error } = await c.rpc('claim_admin'); if (error) throw error; await onSession((await c.auth.getSession()).data.session); }
export async function redeemInvite(token: string): Promise<string> { const c = await sb(); const { data, error } = await c.rpc('redeem_invite', { t: token }); if (error) throw error; await onSession((await c.auth.getSession()).data.session); return data as string; }
export async function createFamilyInvite(playerId: string): Promise<string> { await pushNow(); const c = await sb(); const { data, error } = await c.rpc('create_family_invite', { p: playerId }); if (error) throw error; return data as string; }
export async function createCoachInvite(): Promise<string> { const c = await sb(); const { data, error } = await c.rpc('create_coach_invite'); if (error) throw error; return data as string; }
export async function approveMember(u: string, ok: boolean) { const c = await sb(); const { error } = await c.rpc('approve_member', { u, approve: ok }); if (error) throw error; }
export async function assignStaff(u: string, t: string, head: boolean) { const c = await sb(); const { error } = await c.rpc('assign_staff', { u, t, is_head: head }); if (error) throw error; }
export interface Member { user_id: string; role: string; status: string; name: string }
export async function listMembers(): Promise<Member[]> {
  const c = await sb();
  const [{ data: m }, { data: p }] = await Promise.all([c.from('memberships').select('*'), c.from('profiles').select('id, display_name')]);
  const names = new Map(((p ?? []) as { id: string; display_name: string }[]).map((x) => [x.id, x.display_name]));
  return ((m ?? []) as Omit<Member, 'name'>[]).map((x) => ({ ...x, name: names.get(x.user_id) || x.user_id.slice(0, 8) }));
}
export async function setConsent(playerId: string, kind: 'data' | 'photo' | 'video' | 'teamphoto', granted: boolean, version: string) {
  const c = await sb(); const { error } = await c.rpc('set_consent', { p: playerId, k: kind, granted, version }); if (error) throw error;
}
/** The app's own address (e.g. https://rangersfc.net/app/). Screens are addressed after a #, so every link works on first open. */
export const appUrl = (route = '/') => `${location.origin}${import.meta.env.BASE_URL ?? '/'}#${route}`;
export const inviteLink = (token: string) => appUrl(`/join/${token}`);

/* ---------- sync ---------- */
const playerRow = (p: Player) => ({ id: p.id, team_id: p.teamId, first_name: p.firstName, last_name: p.lastName ?? null, shirt_number: p.number ?? null, birth_date: p.birthDate || null, gk_willing: p.gkWilling, photo_consent: p.photoConsent, left_at: p.left ? p.leftAt ?? '2000-01-01T00:00:00Z' : null });
/** What each role may save. The database enforces the same rules; this just avoids sending what it would refuse. */
function canWrite(kind: string) {
  if (cs.role === 'admin') return true;
  if (cs.role === 'coach') return kind !== 'settings';
  return ['availability', 'message', 'charge_ref', 'seen'].includes(kind);
}
const friendly = (kind: string, msg: string) => (/head injury/.test(msg) ? 'only a head coach can clear a head injury' : /row-level security|42501|permission/i.test(msg) ? `not allowed to change this ${kind}` : msg);
let pushTimer: ReturnType<typeof setTimeout> | undefined; let pushing = false; let again = false;
const schedulePush = () => { clearTimeout(pushTimer); pushTimer = setTimeout(() => void pushNow(), 1500); };

/** Sends only what changed since the last successful sync. Safe to call any time; offline just waits. */
export async function pushNow() {
  if (cs.status !== 'ready' || !navigator.onLine) return;
  if (pushing) { again = true; return; }
  pushing = true; set({ syncing: true });
  try {
    const c = await sb(); const s = getState();
    // teams and players (admin and coaches; parents can only change private info for their own child)
    const isCoach = cs.role === 'admin' || cs.role === 'coach';
    if (cs.role === 'admin') {
      const teams = s.teams.filter((t) => isUuid(t.id)).map((t) => ({ id: t.id, name: t.name, programme: t.programme, age_band: t.ageBand, default_format: t.defaultFormat }));
      const changed = teams.filter((t) => snap.get('team:' + t.id) !== JSON.stringify(t));
      if (changed.length) { const { error } = await c.from('teams').upsert(changed); if (error) throw error; changed.forEach((t) => snap.set('team:' + t.id, JSON.stringify(t))); }
    }
    if (isCoach) {
      const players = s.players.filter((p) => isUuid(p.id) && isUuid(p.teamId)).map(playerRow);
      const ch = players.filter((p) => snap.get('player:' + p.id) !== JSON.stringify(p));
      if (ch.length) { const { error } = await c.from('players').upsert(ch); if (error) throw error; ch.forEach((p) => snap.set('player:' + p.id, JSON.stringify(p))); }
    }
    const priv = s.players.filter((p) => isUuid(p.id) && p.emergency).map((p) => ({ player_id: p.id, data: p.emergency }));
    const chp = priv.filter((p) => snap.get('priv:' + p.player_id) !== JSON.stringify(p));
    for (const p of chp) { const { error } = await c.from('player_private').upsert(p); if (!error) snap.set('priv:' + p.player_id, JSON.stringify(p)); }
    // records
    const rows = toRows(s); const now = new Map(rows.map((r) => [r.id, r]));
    const changed = rows.filter((r) => snap.get(r.id) !== rowJson(r) && canWrite(r.kind));
    const failed: string[] = [];
    for (let i = 0; i < changed.length; i += 100) {
      const batch = changed.slice(i, i + 100);
      const { error } = await c.from('records').upsert(batch.map((r) => ({ ...r, deleted_at: null })));
      if (!error) { batch.forEach((r) => snap.set(r.id, rowJson(r))); continue; }
      // One refused row must not hold back the rest: retry this batch row by row.
      for (const r of batch) {
        const { error: e1 } = await c.from('records').upsert({ ...r, deleted_at: null });
        if (e1) failed.push(friendly(r.kind, e1.message)); else snap.set(r.id, rowJson(r));
      }
    }
    const gone = [...snap.keys()].filter((k) => !k.includes(':') && !now.has(k));
    if (gone.length && isCoach) {
      for (const k of gone) { const { error } = await c.from('records').update({ deleted_at: new Date().toISOString() }).eq('id', k); if (!error) snap.delete(k); else failed.push(friendly('delete', error.message)); }
    }
    saveSnap(); set({ error: failed.length ? `${failed.length} change(s) were not accepted: ${[...new Set(failed)].join('; ')}` : '', lastSync: Date.now() });
  } catch (e) { set({ error: (e as Error).message }); }
  finally { pushing = false; set({ syncing: false }); if (again) { again = false; schedulePush(); } }
}

export async function pullNow() {
  if (cs.status !== 'ready' || !navigator.onLine) return;
  try {
    const c = await sb(); const since = cursor ? new Date(Date.parse(cursor) - 5000).toISOString() : '1970-01-01T00:00:00Z';
    const [tm, pl, pv, st] = await Promise.all([c.from('teams').select('*').gt('updated_at', since), c.from('players').select('*').gt('updated_at', since), c.from('player_private').select('*').gt('updated_at', since), c.from('team_staff').select('team_id, head').eq('user_id', cs.userId)]);
    const all: RowIn[] = []; let from = 0;
    for (;;) { const { data, error } = await c.from('records').select('*').gt('updated_at', since).order('updated_at').range(from, from + 999); if (error) throw error; all.push(...((data ?? []) as RowIn[])); if (!data || data.length < 1000) break; from += 1000; }
    update((s) => {
      let n: AppState = { ...s };
      for (const t of (tm.data ?? []) as { id: string; name: string; programme: never; age_band: never; default_format: never }[]) {
        const item = { id: t.id, name: t.name, programme: t.programme, ageBand: t.age_band, defaultFormat: t.default_format };
        n.teams = n.teams.some((x) => x.id === t.id) ? n.teams.map((x) => (x.id === t.id ? item : x)) : [...n.teams.filter((x) => isUuid(x.id) || n.teams.length > 1), item];
        snap.set('team:' + t.id, JSON.stringify({ id: t.id, name: t.name, programme: t.programme, age_band: t.age_band, default_format: t.default_format }));
      }
      for (const p of (pl.data ?? []) as Record<string, unknown>[]) {
        const item = { id: p.id as string, teamId: p.team_id as string, firstName: p.first_name as string, lastName: (p.last_name as string) ?? undefined, number: (p.shirt_number as number) ?? undefined, birthDate: (p.birth_date as string) ?? undefined, gkWilling: p.gk_willing as boolean, photoConsent: p.photo_consent as boolean, left: Boolean(p.left_at), leftAt: (p.left_at as string) ?? undefined } as Player;
        const old = n.players.find((x) => x.id === item.id);
        n.players = old ? n.players.map((x) => (x.id === item.id ? { ...old, ...item } : x)) : [...n.players, item];
        snap.set('player:' + item.id, JSON.stringify(playerRow(item)));
      }
      for (const v of (pv.data ?? []) as { player_id: string; data: Player['emergency'] }[]) {
        n.players = n.players.map((x) => (x.id === v.player_id ? { ...x, emergency: v.data } : x));
        snap.set('priv:' + v.player_id, JSON.stringify({ player_id: v.player_id, data: v.data }));
      }
      n = applyRows(n, all);
      n.myStaff = ((st.data ?? []) as { team_id: string; head: boolean }[]).map((x) => ({ teamId: x.team_id, head: x.head }));
      if (cs.role === 'coach') n = adoptServerTeams(n, n.myStaff.map((x) => x.teamId));
      const rowsNow = new Map(toRows(n).map((r) => [r.id, r]));
      for (const a of all) { if (a.deleted_at) snap.delete(a.id); else { const r = rowsNow.get(a.id); if (r) snap.set(a.id, rowJson(r)); } }
      return n;
    }, 'remote');
    const newest = all.reduce((m, r) => (r.updated_at > m ? r.updated_at : m), cursor);
    const newestOther = [...(tm.data ?? []), ...(pl.data ?? []), ...(pv.data ?? [])].reduce((m: string, r: { updated_at: string }) => (r.updated_at > m ? r.updated_at : m), newest);
    cursor = newestOther || cursor; saveSnap(); set({ lastSync: Date.now(), error: '' });
  } catch (e) { set({ error: (e as Error).message }); }
}
export async function syncNow() { await pushNow(); await pullNow(); }

let rt = false;
async function subscribeRealtime() {
  if (rt) return; rt = true;
  const c = await sb(); let t: ReturnType<typeof setTimeout> | undefined;
  c.channel('records-feed').on('postgres_changes', { event: '*', schema: 'public', table: 'records' }, () => { clearTimeout(t); t = setTimeout(() => void pullNow(), 800); }).subscribe();
  setInterval(() => { if (document.visibilityState === 'visible') void pullNow(); }, 60000);
}

/* ---------- web push ---------- */
export async function enablePush(): Promise<string> {
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'This browser cannot receive reminders. On iPhone, tap Share, then Add to Home Screen first.';
  if (!key) return 'Reminders are not set up for this app yet.';
  const perm = await Notification.requestPermission(); if (perm !== 'granted') return 'Reminders are off. You can turn them on in your phone settings.';
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(key) });
  const j = sub.toJSON(); const c = await sb();
  const { error } = await c.from('push_subscriptions').upsert({ endpoint: j.endpoint!, user_id: cs.userId, p256dh: j.keys!.p256dh, auth: j.keys!.auth });
  return error ? error.message : 'Reminders are on.';
}
function urlB64(b: string) { const p = '='.repeat((4 - (b.length % 4)) % 4); const r = atob((b + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...r].map((c) => c.charCodeAt(0))); }

/** A coach's teams come from the club admin. Anything made on this phone before signing in (in a local team)
 *  moves to the coach's first real team so it is not lost or stuck. */
export function adoptServerTeams(s: AppState, staffTeamIds: string[]): AppState {
  const server = s.teams.filter((t) => staffTeamIds.includes(t.id));
  if (!server.length) return s;
  const local = s.teams.filter((t) => !staffTeamIds.includes(t.id)).map((t) => t.id);
  if (!local.length) return s;
  const to = server[0].id; const mv = <T extends { teamId?: string }>(x: T): T => (x.teamId && local.includes(x.teamId) ? { ...x, teamId: to } : x);
  return { ...s, teams: server, activeTeamId: server.some((t) => t.id === s.activeTeamId) ? s.activeTeamId : to,
    players: s.players.map(mv), events: s.events.map(mv), matches: s.matches.map(mv), sessions: s.sessions.map(mv),
    announcements: s.announcements.map(mv), assessments: s.assessments.map(mv), messages: s.messages.map(mv) };
}
