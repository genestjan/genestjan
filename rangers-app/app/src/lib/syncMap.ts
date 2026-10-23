import type { AppState, CollKey } from './store';

export type Vis = 'coach' | 'family' | 'team' | 'club';
export interface RowOut { id: string; kind: string; team_id: string | null; player_id: string | null; visibility: Vis; data: Record<string, unknown> }
export interface RowIn extends RowOut { updated_at: string; deleted_at: string | null }

export const SETTINGS_ID = '00000000-0000-4000-8000-000000000001';
export const isUuid = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/** Deterministic uuid derived from another id (for the family-safe copy of a review). */
export function derivedId(id: string, salt: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57; const str = id + ':' + salt;
  for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  const a = hex(h1) + hex(h2) + hex(h1 ^ h2) + hex(Math.imul(h1, 31) ^ h2);
  return `${a.slice(0, 8)}-${a.slice(8, 12)}-4${a.slice(13, 16)}-8${a.slice(17, 20)}-${a.slice(20, 32)}`;
}

interface Cfg { key: CollKey; kind: string; vis: (i: any) => Vis; team: (i: any, s: AppState) => string | null; player: (i: any) => string | null }
const teamOfPlayer = (i: { playerId: string }, s: AppState) => s.players.find((p) => p.id === i.playerId)?.teamId ?? null;
const fam = (key: CollKey, kind: string): Cfg => ({ key, kind, vis: () => 'family', team: teamOfPlayer, player: (i) => i.playerId });
export const CONFIG: Cfg[] = [
  { key: 'events', kind: 'event', vis: () => 'team', team: (i) => i.teamId, player: () => null },
  fam('availability', 'availability'), fam('attendance', 'attendance'),
  { key: 'announcements', kind: 'announcement', vis: (i) => (i.scope === 'club' ? 'club' : 'team'), team: (i) => (i.scope === 'club' ? null : i.teamId ?? null), player: () => null },
  fam('messages', 'message'),
  { key: 'sessions', kind: 'session', vis: () => 'coach', team: (i) => i.teamId, player: () => null },
  { key: 'matches', kind: 'match', vis: () => 'coach', team: (i) => i.teamId, player: () => null },
  fam('goals', 'goal'), fam('recognitions', 'recognition'), fam('badges', 'badge'), fam('growth', 'growth'), fam('injuries', 'injury'), fam('wellness', 'wellness'),
  { key: 'strategies', kind: 'strategy', vis: () => 'club', team: () => null, player: () => null },
  { key: 'funds', kind: 'fund', vis: () => 'club', team: () => null, player: () => null },
  { key: 'equipment', kind: 'equipment', vis: () => 'club', team: () => null, player: () => null },
  { key: 'stories', kind: 'story', vis: () => 'club', team: () => null, player: () => null },
  fam('bootRequests', 'boot'), fam('minutes', 'minutes'), fam('charges', 'charge'), fam('chargeRefs', 'charge_ref'), fam('seen', 'seen'),
];
const BY_KIND = new Map(CONFIG.map((c) => [c.kind, c]));

/** Every collection item as a `records` row. Reviews also produce a family-safe copy once published. */
export function toRows(s: AppState): RowOut[] {
  const out: RowOut[] = [];
  for (const c of CONFIG) for (const item of s[c.key] as unknown as { id: string }[]) {
    if (!isUuid(item.id)) continue;
    const team = c.team(item, s);
    const player = c.player(item);
    if (c.kind !== 'strategy' && c.kind !== 'fund' && c.kind !== 'equipment' && c.kind !== 'story' && c.kind !== 'announcement' && !team) continue; // orphaned
    if (player && !isUuid(player)) continue;
    out.push({ id: item.id, kind: c.kind, team_id: team, player_id: player, visibility: c.vis(item), data: item as unknown as Record<string, unknown> });
  }
  for (const a of s.assessments) {
    if (!isUuid(a.id) || !isUuid(a.playerId) || !isUuid(a.teamId)) continue;
    out.push({ id: a.id, kind: 'assessment', team_id: a.teamId, player_id: a.playerId, visibility: 'coach', data: a as unknown as Record<string, unknown> });
    if (a.publishedAt) out.push({ id: derivedId(a.id, 'pub'), kind: 'assessment_pub', team_id: a.teamId, player_id: a.playerId, visibility: 'family', data: { ...a, coachNote: '' } as unknown as Record<string, unknown> });
  }
  if (s.settings) out.push({ id: SETTINGS_ID, kind: 'settings', team_id: null, player_id: null, visibility: 'club', data: s.settings as unknown as Record<string, unknown> });
  return out;
}

export const rowJson = (r: RowOut) => JSON.stringify([r.kind, r.team_id, r.player_id, r.visibility, r.data]);

/** Apply pulled rows (including tombstones) to local state. Remote wins. */
export function applyRows(s: AppState, rows: RowIn[]): AppState {
  const next: AppState = { ...s };
  const cols = new Map<CollKey, { id: string }[]>();
  const col = (k: CollKey) => { if (!cols.has(k)) cols.set(k, [...(next[k] as unknown as { id: string }[])]); return cols.get(k)!; };
  for (const r of rows) {
    if (r.kind === 'settings') { if (!r.deleted_at) next.settings = { ...next.settings, ...(r.data as object) } as AppState['settings']; continue; }
    if (r.kind === 'assessment_pub') {
      const id = (r.data as { id: string }).id; const list = col('assessments') as { id: string; publishedAt?: string }[];
      const has = list.findIndex((x) => x.id === id);
      if (r.deleted_at) continue;
      if (has < 0) list.push(r.data as never);          // parents only ever get this copy (no coach note)
      else if (!list[has].publishedAt || (r.data as { coachNote: string }).coachNote === '') list[has] = { ...list[has], publishedAt: (r.data as { publishedAt?: string }).publishedAt } as never;
      continue;
    }
    const c = BY_KIND.get(r.kind) ?? (r.kind === 'assessment' ? { key: 'assessments' as CollKey } : undefined);
    if (!c) continue;
    const list = col(c.key); const i = list.findIndex((x) => x.id === r.id);
    if (r.deleted_at) { if (i >= 0) list.splice(i, 1); continue; }
    const item = { ...(r.data as object), id: r.id } as { id: string };
    if (i >= 0) list[i] = item; else list.push(item);
  }
  for (const [k, v] of cols) (next as unknown as Record<string, unknown>)[k] = v;
  return next;
}
