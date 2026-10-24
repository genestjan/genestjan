import type { ClubEvent } from './model';
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-PH', { weekday: 'short', day: 'numeric', month: 'short' });
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
export const fmtDateTime = (iso: string) => `${fmtDate(iso)}, ${fmtTime(iso)}`;
export const today = () => new Date().toISOString().slice(0, 10);
export const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
export const ageOf = (birth?: string) => (birth ? Math.floor((Date.now() - Date.parse(birth)) / (365.25 * 86400000)) : undefined);
export function eventShareText(e: ClubEvent, teamName: string, link: string) {
  return [`${teamName}: ${e.title}`, `${fmtDateTime(e.startsAt)} to ${fmtTime(e.endsAt)}`, e.venue && `Where: ${e.venue}`, e.mapUrl && `Map: ${e.mapUrl}`, e.bring && `Bring: ${e.bring}`, e.opponent && `Against: ${e.opponent}`, `Please tap Going or Not going in the app: ${link}`].filter(Boolean).join('\n');
}
export async function share(text: string, title = 'Rangers FC') {
  try { if (navigator.share) { await navigator.share({ title, text }); return 'shared'; } } catch { return 'cancelled'; }
  try { await navigator.clipboard.writeText(text); return 'copied'; } catch { return 'failed'; }
}
export const unique = <T,>(a: T[]) => [...new Set(a)];
export const sortBy = <T,>(a: T[], f: (x: T) => string | number) => [...a].sort((x, y) => (f(x) < f(y) ? -1 : f(x) > f(y) ? 1 : 0));
export const download = (name: string, text: string, type = 'application/json') => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); };
/** A calendar file (.ics) for one event, so families can add it to their phone's calendar. */
export function icsFor(e: { id: string; title: string; startsAt: string; endsAt: string; venue: string; bring?: string }, link: string) {
  const t = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (v: string) => v.replace(/\\/g, '\\\\').replace(/[,;]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Rangers FC//Rangers App//EN', 'BEGIN:VEVENT', `UID:${e.id}@rangersfc.net`, `DTSTAMP:${t(new Date().toISOString())}`,
    `DTSTART:${t(e.startsAt)}`, `DTEND:${t(e.endsAt)}`, `SUMMARY:${esc(e.title)}`, e.venue ? `LOCATION:${esc(e.venue)}` : '', `DESCRIPTION:${esc((e.bring ? `Bring: ${e.bring}\n` : '') + link)}`,
    'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
}
