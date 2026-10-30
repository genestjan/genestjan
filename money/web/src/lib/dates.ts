// Dates are local calendar dates ("2026-10-30"); months are "2026-10". The phone and laptop
// both run on Philippine time, so local time is the right clock.

export const pad = (n: number) => String(n).padStart(2, '0');

export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const isoTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const todayISO = () => isoDate(new Date());

export const monthOf = (iso: string) => iso.slice(0, 7);
export const thisMonth = () => monthOf(todayISO());

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function monthsBetween(from: string, to: string): number {
  const [a, b] = [from, to].map((s) => s.split('-').map(Number));
  return (b[0] - a[0]) * 12 + (b[1] - a[1]);
}

export const daysInMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};

/** The date a bill falls due in a month, clamping 31 to the month's last day. */
export const dueDate = (month: string, day: number) =>
  `${month}-${pad(Math.min(Math.max(1, day), daysInMonth(month)))}`;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const monthLabel = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};
export const shortMonth = (month: string) => MONTHS[Number(month.slice(5, 7)) - 1].slice(0, 3);

export const fromISO = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export function shortDate(iso: string): string {
  const d = fromISO(iso);
  return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`;
}

export function dayHeading(iso: string, today = todayISO()): string {
  const diff = Math.round((fromISO(today).getTime() - fromISO(iso).getTime()) / 86_400_000);
  if (diff === 0) return `Today, ${shortDate(iso)}`;
  if (diff === 1) return `Yesterday, ${shortDate(iso)}`;
  return `${DAYS[fromISO(iso).getDay()]}, ${shortDate(iso)}`;
}

export function timeLabel(hhmm?: string): string {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${pad(h12)}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
}

export function daysUntil(iso: string, today = todayISO()): number {
  return Math.round((fromISO(iso).getTime() - fromISO(today).getTime()) / 86_400_000);
}

export function ago(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86_400)} d ago`;
}
