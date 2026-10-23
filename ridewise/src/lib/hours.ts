// A deliberately small reader for the OpenStreetMap `opening_hours` tag.
// It understands the common shapes ("24/7", "Mo-Su 06:00-22:00",
// "Mo-Fr 08:00-17:00; Sa 08:00-12:00", "Su off"). Anything else is treated
// as unknown rather than guessed. Even parsed hours are community data and
// are always shown as "listed", never as a confirmed "open now".

import { hhmmToMinutes, localClock } from './time';

export type HoursStatus = 'listed-open' | 'listed-closed' | 'unknown';

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

type Rule = { days: boolean[]; ranges: [number, number][]; off: boolean };

function parseDays(spec: string): boolean[] | null {
  const days = new Array(7).fill(false);
  for (const part of spec.split(',')) {
    const p = part.trim();
    const range = /^(Mo|Tu|We|Th|Fr|Sa|Su)-(Mo|Tu|We|Th|Fr|Sa|Su)$/.exec(p);
    if (range) {
      let i = DAYS.indexOf(range[1]);
      const end = DAYS.indexOf(range[2]);
      for (let n = 0; n < 7; n++) {
        days[i] = true;
        if (i === end) break;
        i = (i + 1) % 7;
      }
      continue;
    }
    const idx = DAYS.indexOf(p);
    if (idx < 0) return null;
    days[idx] = true;
  }
  return days;
}

function parseRanges(spec: string): [number, number][] | null {
  const out: [number, number][] = [];
  for (const part of spec.split(',')) {
    const m = /^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/.exec(part.trim());
    if (!m) return null;
    const a = hhmmToMinutes(m[1]);
    const b = hhmmToMinutes(m[2]);
    if (a === null || b === null) return null;
    out.push([a, b]);
  }
  return out;
}

export function parseOpeningHours(raw: string | undefined): Rule[] | null {
  if (!raw) return null;
  const s = raw.trim().replace(/\s*-\s*/g, '-');
  if (s === '24/7') return [{ days: new Array(7).fill(true), ranges: [[0, 1440]], off: false }];
  const rules: Rule[] = [];
  for (const chunk of s.split(';')) {
    const c = chunk.trim();
    if (!c) continue;
    // Optional day selector, then times or "off"/"closed".
    const m = /^((?:(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?,?)+)?\s*(.*)$/.exec(c);
    if (!m) return null;
    const days = m[1] ? parseDays(m[1].replace(/,$/, '')) : new Array(7).fill(true);
    if (!days) return null;
    const rest = m[2].trim();
    if (rest === 'off' || rest === 'closed') {
      rules.push({ days, ranges: [], off: true });
      continue;
    }
    const ranges = parseRanges(rest);
    if (!ranges) return null; // PH holidays, months, sunrise etc: not guessed
    rules.push({ days, ranges, off: false });
  }
  return rules.length ? rules : null;
}

/** Status at an instant in a zone. Later rules override earlier ones, as in OSM. */
export function hoursStatusAt(raw: string | undefined, atMs: number, timeZone: string): HoursStatus {
  const rules = parseOpeningHours(raw);
  if (!rules) return 'unknown';
  const { minutes, weekday } = localClock(atMs, timeZone);
  const prevDay = (weekday + 6) % 7;
  let status: HoursStatus | null = null;
  for (const r of rules) {
    let applies = false;
    let open = false;
    if (r.days[weekday]) {
      applies = true;
      open = !r.off && r.ranges.some(([a, b]) => (b > a ? minutes >= a && minutes < b : minutes >= a));
    }
    // Overnight ranges from the previous day, e.g. Fr 18:00-02:00.
    if (!open && r.days[prevDay] && !r.off && r.ranges.some(([a, b]) => b <= a && minutes < b)) {
      applies = true;
      open = true;
    }
    if (applies) status = open ? 'listed-open' : 'listed-closed';
  }
  // A day not mentioned by any rule is closed per the OSM spec.
  return status ?? 'listed-closed';
}

export function hoursLabel(status: HoursStatus): string {
  switch (status) {
    case 'listed-open':
      return 'Listed hours say open at ETA (not verified)';
    case 'listed-closed':
      return 'Listed hours say CLOSED at ETA';
    default:
      return 'Hours not verified';
  }
}
