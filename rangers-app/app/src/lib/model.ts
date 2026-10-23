import type { FormatId, Player as BasePlayer } from './types';

export type AgeBand = 'U8' | 'U10' | 'U12' | 'U14' | 'U16';
export type Programme = 'rangers' | 'newmabu' | 'gila';
export type Role = 'admin' | 'coach' | 'parent';

export interface Team { id: string; name: string; programme: Programme; ageBand: AgeBand; defaultFormat: FormatId }
export interface Emergency { contacts: { name: string; phone: string }[]; allergies: string; inhaler: boolean; note: string }
export interface Player extends BasePlayer {
  teamId: string; lastName?: string; birthDate?: string; photoConsent: boolean; videoConsent?: boolean; emergency?: Emergency; left?: boolean;
}
export type EventType = 'training' | 'match' | 'tournament' | 'festival' | 'meeting' | 'other';
export interface ClubEvent {
  id: string; teamId: string; type: EventType; title: string; startsAt: string; endsAt: string;
  venue: string; mapUrl: string; lat?: number; lng?: number; hospital: string; bring: string; opponent: string; notes: string;
  goingByDefault: boolean; cancelled?: boolean;
}
export interface Availability { id: string; eventId: string; playerId: string; status: 'going' | 'no' | 'maybe'; by: string; at: string }
export interface Attendance { id: string; eventId: string; playerId: string; present: boolean }
export interface Announcement { id: string; scope: 'team' | 'club'; teamId?: string; title: string; body: string; at: string; by: string; pinned?: boolean; seenBy: string[] }
export interface Message { id: string; threadId: string; playerId: string; teamId: string; from: 'coach' | 'parent'; byName: string; body: string; at: string; readBy: string[] }
export interface SessionBlock { slot: string; drillId: string; minutes: number }
export interface TrainingSession { id: string; teamId: string; eventId?: string; date: string; band: AgeBand; minutes: number; theme: string; blocks: SessionBlock[]; reflection?: { energy: 'low' | 'ok' | 'high'; fun: 'yes' | 'partly' | 'no'; note: string } }
export interface Assessment { id: string; playerId: string; teamId: string; term: string; ratings: Record<string, number>; strength: string; working: string; familyComment: string; coachNote: string; publishedAt?: string; selfRatings?: Record<string, number> }
export interface Goal { id: string; playerId: string; text: string; status: 'active' | 'done'; at: string }
export interface Recognition { id: string; playerId: string; valueKey: string; note: string; at: string }
export interface BadgeAward { id: string; playerId: string; badgeKey: string; at: string }
export interface Growth { id: string; playerId: string; date: string; heightCm: number }
export interface Injury { id: string; playerId: string; date: string; kind: string; bodyPart: string; notes: string; head: boolean; familyNotified: boolean; clearedOn?: string; clearedNote?: string }
export interface Wellness { id: string; playerId: string; date: string; sleep: number; sore: number; mood: number }
export interface FundCampaign { id: string; tournament: string; target: number; items: { label: string; amount: number }[]; entries: { id: string; label: string; amount: number; date: string }[] }
export interface EquipmentItem { id: string; item: string; size: string; qty: number }
export interface BootRequest { id: string; playerId: string; size: string; status: 'needed' | 'matched' | 'given' }
export interface Charge { id: string; playerId: string; label: string; amount: number; dueOn: string; status: 'due' | 'submitted' | 'paid' | 'waived'; reference?: string }
export interface CustomStrategy { id: string; name: string; whyKids: string; coachNote: string; doc: import('./board').BoardDoc }
export interface ClubSettings { gcashNumber: string; contributionsOn: boolean; heatAction: boolean; concussionMinDays: number; goingDefaultTraining: boolean; headCoachPin: string }

export const AGE_BANDS: AgeBand[] = ['U8', 'U10', 'U12', 'U14', 'U16'];
export const PROGRAMMES: Record<Programme, { name: string; values: string[]; short: string }> = {
  rangers: { name: 'Rangers FC', short: 'Rangers', values: ['Play With Your Heart', 'Teamwork', 'Sportsmanship', 'Perseverance', 'Respect', 'Integrity', 'Discipline', 'Community'] },
  newmabu: { name: 'FC New Mabu', short: 'New Mabu', values: ['Mindset', 'Attitude', 'Belief', 'Unity'] },
  gila: { name: 'Gila Academy', short: 'Gila', values: ['Grind', 'Improve', 'Learn', 'Achieve'] },
};
export const LEVEL_WORDS = ['Not seen', 'Learning it', 'Getting it', 'Got it', 'Can teach it'];

export interface MinutesLog { id: string; playerId: string; matchId: string; name: string; date: string; minutes: number }
