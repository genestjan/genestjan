import { put, uid, type AppState } from './store';
import type { Announcement, Message } from './model';

/** Read marks are `seen` records so a parent never needs to edit a coach's message (and vice versa). */
export const seenKey = (ref: string, who: string) => `${who}:${ref}`;
export const isSeen = (s: AppState, ref: string, who: string) => s.seen.some((x) => x.ref === ref && x.by === who);
export function markSeen(s: AppState, ref: string, playerId: string, who: string) {
  if (!isSeen(s, ref, who)) put('seen', { id: uid(), playerId, ref, by: who });
}
export const unreadMessages = (s: AppState, who: 'coach' | string, from: 'coach' | 'parent') => s.messages.filter((m) => m.from === from && !isSeen(s, m.id, who));
export function unreadCount(s: AppState, role: 'parent' | 'staff', me: string) {
  if (role === 'staff') return unreadMessages(s, 'coach', 'parent').length;
  return unreadMessages(s, me, 'coach').length + s.announcements.filter((a) => !isSeen(s, a.id, me)).length;
}
export function seenCount(s: AppState, a: Announcement) {
  const teamPlayers = s.players.filter((p) => a.scope === 'club' || p.teamId === a.teamId);
  const done = new Set(s.seen.filter((x) => x.ref === a.id).map((x) => x.playerId));
  return { seen: teamPlayers.filter((p) => done.has(p.id)).length, total: teamPlayers.length };
}
export function threads(s: AppState, teamId?: string) {
  const byPlayer = new Map<string, Message[]>();
  for (const m of s.messages) { if (teamId && m.teamId !== teamId) continue; byPlayer.set(m.playerId, [...(byPlayer.get(m.playerId) ?? []), m]); }
  return [...byPlayer.entries()].map(([playerId, msgs]) => ({ playerId, msgs: msgs.sort((a, b) => a.at.localeCompare(b.at)) })).sort((a, b) => b.msgs[b.msgs.length - 1].at.localeCompare(a.msgs[a.msgs.length - 1].at));
}
