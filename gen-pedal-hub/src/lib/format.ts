import type { Units } from '../types.ts';

const KM_PER_MI = 1.609344;

export function distValue(m: number, units: Units): number {
  return units === 'mi' ? m / 1000 / KM_PER_MI : m / 1000;
}

export function fmtDist(m: number, units: Units): string {
  const v = distValue(m, units);
  return v >= 100 ? v.toFixed(0) : v.toFixed(1);
}

export function fmtSpeed(ms: number, units: Units): string {
  const v = distValue(ms * 3600, units);
  return v.toFixed(1);
}

export function speedUnit(units: Units): string {
  return units === 'mi' ? 'mph' : 'km/h';
}

/** 3725000 -> "1:02:05", 125000 -> "2:05" */
export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** 3725000 -> "1 h 2 min", 125000 -> "2 min" */
export function fmtHours(ms: number): string {
  const min = Math.round(ms / 60000);
  const h = Math.floor(min / 60);
  return h > 0 ? `${h} h ${min % 60} min` : `${min} min`;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDate(t: number): string {
  const d = new Date(t);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtTime(t: number): string {
  const d = new Date(t);
  const h = d.getHours();
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

export function rideTitle(t: number): string {
  const h = new Date(t).getHours();
  const part = h < 5 ? 'Night' : h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : h < 21 ? 'Evening' : 'Night';
  return `${part} ride`;
}

/** "just now", "5 min ago", "3 h ago", "2 days ago", then the date. */
export function fmtAgo(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  const min = Math.floor((now - t) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} day${d === 1 ? '' : 's'} ago`;
  return fmtDate(t);
}

export function fmtDateTime(iso: string): string {
  const t = new Date(iso).getTime();
  return `${fmtDate(t)}, ${fmtTime(t)}`;
}
