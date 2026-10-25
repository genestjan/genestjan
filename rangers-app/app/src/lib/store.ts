import { useSyncExternalStore } from 'react';
import Dexie, { type Table } from 'dexie';
import { z } from 'zod';
import type { FormatId } from './types';
import type { Locks } from './rotation';
import type * as M from './model';

export type MatchEvent =
  | { t: number; type: 'start' | 'pause' | 'resume' | 'end' }
  | { t: number; type: 'on' | 'off'; playerId: string }
  | { t: number; type: 'mark'; playerId: string; mark: 'star' | 'shy' | 'help' }
  | { t: number; type: 'injury'; playerId: string; head: boolean };

export interface Match {
  id: string; teamId: string; eventId?: string; name: string; format: FormatId; periods: number; periodMinutes: number; windowMinutes: number;
  availableIds: string[]; locks: Locks; carryOver: 'off' | 'gentle' | 'strong'; keys: string[]; moveKey: string; focusValue: string;
  halftimeGood: string; halftimeChange: string; celebrate: string; log: MatchEvent[]; createdAt: number;
}

export interface Me { name: string; userId?: string }
export interface AppState {
  v: 2;
  mode: 'club' | 'sun';
  me: Me;
  activeTeamId: string;
  previewChildId?: string;           // local "see what parents see" preview
  teams: M.Team[]; players: M.Player[]; matches: Match[]; events: M.ClubEvent[]; availability: M.Availability[]; attendance: M.Attendance[];
  announcements: M.Announcement[]; messages: M.Message[]; sessions: M.TrainingSession[]; assessments: M.Assessment[]; goals: M.Goal[];
  recognitions: M.Recognition[]; badges: M.BadgeAward[]; growth: M.Growth[]; injuries: M.Injury[]; wellness: M.Wellness[];
  funds: M.FundCampaign[]; equipment: M.EquipmentItem[]; bootRequests: M.BootRequest[]; charges: M.Charge[]; chargeRefs: ChargeRef[];
  seen: { id: string; playerId: string; ref: string; by: string }[]; assignments: M.Assignment[]; submissions: M.Submission[]; videos: M.ClubVideo[]; drills: M.CustomDrill[]; teamInfo: M.TeamInfo[]; eligibility: M.Eligibility[]; minutes: M.MinutesLog[]; strategies: M.CustomStrategy[]; stories: { id: string; text: string }[];
  settings: M.ClubSettings; blocked: string[];
  myStaff: { teamId: string; head: boolean }[];   // cloud only: teams this login coaches
}
export interface ChargeRef { id: string; chargeId: string; playerId: string; reference: string; at: string }
export type CollKey = { [K in keyof AppState]-?: AppState[K] extends { id: string }[] ? K : never }[keyof AppState];

export const uid = () => crypto.randomUUID();
const defaultTeam: M.Team = { id: '10000000-0000-4000-8000-000000000001', name: 'Rangers U10', programme: 'rangers', ageBand: 'U10', defaultFormat: '8v8' };
const emptyState = (): AppState => ({
  v: 2, mode: 'club', me: { name: 'Coach' }, activeTeamId: defaultTeam.id, teams: [defaultTeam], players: [], matches: [], events: [], availability: [], attendance: [],
  announcements: [], messages: [], sessions: [], assessments: [], goals: [], recognitions: [], badges: [], growth: [], injuries: [], wellness: [], funds: [],
  equipment: [], bootRequests: [], charges: [], chargeRefs: [], seen: [], assignments: [], submissions: [], videos: [], drills: [], teamInfo: [], eligibility: [], minutes: [], strategies: [], stories: [],
  settings: { gcashNumber: '', contributionsOn: false, heatAction: true, concussionMinDays: 21, goingDefaultTraining: true, headCoachPin: '' }, blocked: [], myStaff: [],
});

export const blockedIds = (s: Pick<AppState, 'injuries'>) => [...new Set(s.injuries.filter((i) => i.head && !i.clearedOn).map((i) => i.playerId))];

/** Brings any saved state (including the Phase 1 shape) up to the current shape. */
export function migrate(raw: unknown): AppState {
  const base = emptyState();
  const r = (raw ?? {}) as Record<string, unknown>;
  const s = { ...base, ...r } as AppState;
  s.settings = { ...base.settings, ...(r.settings as object | undefined) };
  if (!s.teams?.length) s.teams = base.teams;
  if (!s.teams.some((t) => t.id === s.activeTeamId)) s.activeTeamId = s.teams[0].id;
  s.players = (s.players ?? []).map((p) => ({ ...p, photoConsent: p.photoConsent ?? false, teamId: p.teamId ?? s.teams[0].id }));
  s.matches = (s.matches ?? []).map((m) => ({ ...m, teamId: m.teamId ?? s.teams[0].id }));
  const legacy = (r.blocked as string[] | undefined) ?? [];
  s.injuries = [...(s.injuries ?? [])];
  for (const id of legacy) if (!s.injuries.some((i) => i.playerId === id && i.head && !i.clearedOn))
    s.injuries.push({ id: uid(), playerId: id, date: new Date().toISOString().slice(0, 10), kind: 'Head knock', bodyPart: 'Head', notes: 'Migrated from earlier version', head: true, familyNotified: false });
  s.v = 2; s.blocked = blockedIds(s);
  return s;
}

class DB extends Dexie {
  kv!: Table<{ k: string; v: unknown }, string>;
  media!: Table<{ id: string; blob: Blob }, string>;   // photos and videos kept on this phone (local-only mode)
  constructor() { super('rangers-app'); this.version(1).stores({ kv: 'k' }); this.version(2).stores({ kv: 'k', media: 'id' }); }
}
export const db = new DB();

let state: AppState = emptyState();
const subs = new Set<() => void>();
const hooks = new Set<(prev: AppState, next: AppState, origin: 'local' | 'remote') => void>();
let ready = false;

const emit = () => subs.forEach((f) => f());
async function persist() {
  try { await db.kv.put({ k: 'state', v: state }); }
  catch { try { localStorage.setItem('rangers-state', JSON.stringify(state)); } catch { /* private mode */ } }
}
export async function loadState() {
  try { const r = await db.kv.get('state'); if (r) state = migrate(r.v); }
  catch { try { const s = localStorage.getItem('rangers-state'); if (s) state = migrate(JSON.parse(s)); } catch { /* ignore */ } }
  ready = true; applyMode(); emit();
}
export const isReady = () => ready;
export const onChange = (f: (prev: AppState, next: AppState, origin: 'local' | 'remote') => void) => { hooks.add(f); return () => hooks.delete(f); };

export function update(fn: (s: AppState) => AppState, origin: 'local' | 'remote' = 'local') {
  const prev = state; const next = fn(state);
  next.blocked = blockedIds(next);
  state = next; applyMode(); emit(); void persist();
  hooks.forEach((h) => h(prev, next, origin));
}
export function useAppState(): AppState { return useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => state); }
export const getState = () => state;
function applyMode() { if (typeof document !== 'undefined') document.documentElement.dataset.mode = state.mode; }

/** Typed helpers so pages stay short. */
type Item<K extends CollKey> = AppState[K] extends (infer T)[] ? T : never;
export function put<K extends CollKey>(key: K, item: Item<K>) {
  update((s) => {
    const list = s[key] as unknown as { id: string }[]; const it = item as unknown as { id: string };
    const i = list.findIndex((x) => x.id === it.id);
    const next = i >= 0 ? list.map((x, k) => (k === i ? it : x)) : [...list, it];
    return { ...s, [key]: next } as AppState;
  });
}
export function del<K extends CollKey>(key: K, id: string) {
  update((s) => ({ ...s, [key]: (s[key] as unknown as { id: string }[]).filter((x) => x.id !== id) }) as AppState);
}

export const DEMO_PLAYERS: M.Player[] = ['Ana','Ben','Carlo','Dina','Eli','Fe','Gab','Hana','Ian','Jo','Kai','Lia','Mar','Nico']
  .map((n, i) => ({ id: `20000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, teamId: defaultTeam.id, firstName: n, number: i + 1, gkWilling: i < 3, photoConsent: false }));

export function exportBackup(): string { return JSON.stringify(state, null, 2); }
/** Restores a backup file after checking it really is one (a wrong or damaged file is refused, nothing is changed). */
export function importBackup(json: string) {
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { throw new Error('That file is not a Rangers backup (it is not readable).'); }
  const r = BackupShape.safeParse(raw);
  if (!r.success) throw new Error('That file is not a Rangers backup, so nothing was changed.');
  update(() => migrate(r.data));
}
const idList = z.array(z.object({ id: z.string() }).passthrough());
const BackupShape = z.object({
  players: z.array(z.object({ id: z.string(), firstName: z.string() }).passthrough()),
  matches: idList.optional(), teams: idList.optional(), events: idList.optional(), messages: idList.optional(),
}).passthrough();
export const activeTeam = (s: AppState) => s.teams.find((t) => t.id === s.activeTeamId) ?? s.teams[0];
export const teamPlayers = (s: AppState, teamId = s.activeTeamId) => s.players.filter((p) => p.teamId === teamId && !p.left);
