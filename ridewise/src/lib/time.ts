// Time helpers. Plans store a local wall-clock departure plus an IANA time
// zone, so a plan made on a phone set to another zone still means
// "6:00 AM in General Santos".

/** Offset in minutes of a zone at a given instant, e.g. +480 for Asia/Manila. */
export function zoneOffsetMin(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - at.getTime()) / 60000);
}

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** Parse "YYYY-MM-DDTHH:mm" in a zone to epoch ms. Returns null if invalid. */
export function parseLocal(local: string, timeZone: string): number | null {
  const m = LOCAL_RE.exec(local ?? '');
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // Validate the calendar date (e.g. reject Feb 31).
  const check = new Date(guess);
  if (check.getUTCDate() !== d || check.getUTCMonth() !== mo - 1) return null;
  const off = zoneOffsetMin(timeZone, new Date(guess));
  return guess - off * 60000;
}

export function formatTime(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-PH', { timeZone, hour: 'numeric', minute: '2-digit', hour12: true }).format(ms);
}

export function formatDateTime(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(ms);
}

/** Local calendar day key, used to flag arrivals on a later day. */
export function localDayKey(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms);
}

/** Minutes since local midnight and ISO weekday (0 = Monday) in a zone. */
export function localClock(ms: number, timeZone: string): { minutes: number; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(ms);
  const h = Number(parts.find((p) => p.type === 'hour')?.value);
  const m = Number(parts.find((p) => p.type === 'minute')?.value);
  const wd = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(wd);
  return { minutes: (h % 24) * 60 + m, weekday };
}

export function formatDuration(min: number): string {
  if (!Number.isFinite(min)) return '—';
  const total = Math.max(0, Math.round(min));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function formatKm(km: number, digits = 1): string {
  if (!Number.isFinite(km)) return '—';
  return `${km.toFixed(digits)} km`;
}

/** Current wall clock in a zone as "YYYY-MM-DDTHH:mm" (for form defaults). */
export function nowLocal(timeZone: string, now = Date.now()): string {
  const d = new Date(now + zoneOffsetMin(timeZone, new Date(now)) * 60000);
  return d.toISOString().slice(0, 16);
}

export function hhmmToMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '');
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 24 || mi > 59) return null;
  return h * 60 + mi;
}
