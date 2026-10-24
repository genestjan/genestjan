import type { Attendance, AttendanceStatus, ClubEvent, Player } from './model';

export const STATUSES: { id: AttendanceStatus; label: string }[] = [
  { id: 'present', label: 'Present' }, { id: 'late', label: 'Late' }, { id: 'absent', label: 'Absent' }, { id: 'excused', label: 'Excused' },
];
/** Older records only had present true/false. */
export const statusOf = (a: Attendance): AttendanceStatus => a.status ?? (a.present ? 'present' : 'absent');
export const isThere = (s: AttendanceStatus) => s === 'present' || s === 'late';

export interface Summary { recorded: number; present: number; late: number; absent: number; excused: number; rate: number | null }
/** Rate = came (present or late) out of the sessions that counted (excused ones do not count against the child). */
export function summarise(list: Attendance[]): Summary {
  const s: Summary = { recorded: list.length, present: 0, late: 0, absent: 0, excused: 0, rate: null };
  for (const a of list) s[statusOf(a)]++;
  const counted = s.recorded - s.excused;
  s.rate = counted > 0 ? Math.round(((s.present + s.late) / counted) * 100) : null;
  return s;
}
export const LOW_ATTENDANCE = 60;   // below this, check in kindly with the family

/** One row per child, in name order (never ranked), for events from `from` onwards. */
export function report(players: Player[], attendance: Attendance[], events: ClubEvent[], from: string) {
  const ids = new Set(events.filter((e) => e.startsAt >= from && !e.cancelled).map((e) => e.id));
  return [...players].sort((a, b) => a.firstName.localeCompare(b.firstName)).map((p) => {
    const mine = attendance.filter((a) => a.playerId === p.id && ids.has(a.eventId));
    return { player: p, ...summarise(mine) };
  });
}
/** Spreadsheet text for the school or coordinator. */
export function reportCsv(rows: ReturnType<typeof report>, title: string) {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['Player', 'Shirt', 'Present', 'Late', 'Absent', 'Excused', 'Attendance %'];
  return [esc(title), head.map(esc).join(','), ...rows.map((r) => [r.player.firstName + (r.player.lastName ? ' ' + r.player.lastName : ''), r.player.number ?? '', r.present, r.late, r.absent, r.excused, r.rate ?? ''].map(esc).join(','))].join('\n');
}
/** The event attendance is usually taken for: today's, else the most recent one that has started. */
export function defaultEvent(events: ClubEvent[], teamId: string, now = new Date()) {
  const mine = events.filter((e) => e.teamId === teamId && !e.cancelled).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const today = now.toDateString();   // the phone's own date (Manila), not UTC
  return mine.find((e) => new Date(e.startsAt).toDateString() === today) ?? [...mine].reverse().find((e) => Date.parse(e.startsAt) <= now.getTime());
}
