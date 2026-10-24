import type { FormatId, Player as BasePlayer } from './types';

export type AgeBand = 'U8' | 'U10' | 'U12' | 'U14' | 'U16';
export type Programme = 'rangers' | 'newmabu' | 'gila';
export type Role = 'admin' | 'coach' | 'parent';

export interface Team { id: string; name: string; programme: Programme; ageBand: AgeBand; defaultFormat: FormatId }
/** Family-entered details. Stored in the private table: only the child's coaches and own parents can read it. */
export interface Emergency {
  contacts: { name: string; phone: string }[]; allergies: string; inhaler: boolean; note: string;
  fullName?: string; birthDate?: string; address?: string; phone?: string; medication?: string; other?: string;   // note = health condition
  docs?: { studentId?: DocRef; birthCert?: DocRef };   // photos of ID papers that tournament organisers ask to see
}
export interface DocRef { path: string; at: string }
export interface Player extends BasePlayer {
  teamId: string; lastName?: string; birthDate?: string; photoConsent: boolean; videoConsent?: boolean; emergency?: Emergency; left?: boolean; leftAt?: string;
}
export type EventType = 'training' | 'match' | 'tournament' | 'meet' | 'festival' | 'meeting' | 'other';
/** DepEd school sports ladder ("Road to Palaro"), lowest to highest. */
export type MeetLevel = 'intramurals' | 'district' | 'gscaa' | 'sraa' | 'palaro';
export type MeetOutcome = '' | 'qualified' | 'champion' | 'placed' | 'eliminated';
export interface ClubEvent {
  id: string; teamId: string; type: EventType; title: string; startsAt: string; endsAt: string;
  venue: string; mapUrl: string; lat?: number; lng?: number; hospital: string; bring: string; opponent: string; notes: string;
  goingByDefault: boolean; cancelled?: boolean;
  meetLevel?: MeetLevel; category?: string; outcome?: MeetOutcome; resultNote?: string;   // school meets only
  squad?: string[]; squadAnnounced?: string[];   // players picked, and those whose families were already told
}
export interface Availability { id: string; eventId: string; playerId: string; status: 'going' | 'no' | 'maybe'; by: string; at: string }
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';
/** present stays for older saved data: true for present or late. */
export interface Attendance { id: string; eventId: string; playerId: string; present: boolean; status?: AttendanceStatus }
/** School-team settings (one per team). Kept as a team record so the team's coaches can edit it. */
export interface TeamInfo {
  id: string; teamId: string; kind: 'club' | 'school'; mixedAges: boolean;
  schoolName: string; district: string; coordinator: string; coordinatorPhone: string;
  categories: string[]; cutoffs: Record<string, string>;   // category -> 'born on or after' date (from the current DepEd memo)
}
/** A child's school-competition paperwork and category. Statuses only: the documents themselves are never stored. */
export interface Eligibility { id: string; playerId: string; category: string; docs: Record<string, boolean>; selectedFor: MeetLevel[]; note: string }
export interface Announcement { id: string; scope: 'team' | 'club'; teamId?: string; title: string; body: string; at: string; by: string; pinned?: boolean; seenBy: string[] }
export interface Message { id: string; threadId: string; playerId: string; teamId: string; from: 'coach' | 'parent'; byName: string; body: string; at: string; readBy: string[] }
export interface SessionBlock { slot: string; drillId: string; minutes: number }
export interface TrainingSession { id: string; teamId: string; eventId?: string; date: string; band: AgeBand; minutes: number; theme: string; blocks: SessionBlock[]; reflection?: { energy: 'low' | 'ok' | 'high'; fun: 'yes' | 'partly' | 'no'; note: string } }
export interface Assessment { id: string; playerId: string; teamId: string; term: string; ratings: Record<string, number>; strength: string; working: string; familyComment: string; coachNote: string; publishedAt?: string; selfRatings?: Record<string, number>; fromPub?: boolean }
/** One assignment for one child. A group of children sent the same assignment share a groupId. */
export interface AssignTask { id: string; text: string }
export interface Assignment { id: string; groupId: string; playerId: string; teamId: string; title: string; why: string; tasks: AssignTask[]; photoPath?: string; youtubeId?: string; templateId?: string; dueOn?: string; at: string; by: string }
export type SubmissionStatus = 'submitted' | 'approved' | 'redo';
/** A child's proof (a photo) for one task. */
export interface Submission { id: string; assignmentId: string; taskId: string; playerId: string; teamId: string; mediaPath: string; mediaType: 'image'; at: string; status: SubmissionStatus; feedback: string; reviewedAt?: string }
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
