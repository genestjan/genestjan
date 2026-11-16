import type { Ride } from '../types.ts';
import { weekStart } from './stats.ts';

export type Bucket = {
  start: number;
  label: string;
  distanceM: number;
  movingMs: number;
  elevGainM: number;
  rides: number;
  avgSpeedMs: number;
};

export type Metric = 'distance' | 'time' | 'climb' | 'speed';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function empty(start: number, label: string): Bucket {
  return { start, label, distanceM: 0, movingMs: 0, elevGainM: 0, rides: 0, avgSpeedMs: 0 };
}

/** Adds each ride to the bucket it started in. Buckets are sorted by start; `end` closes the last one. */
function fill(buckets: Bucket[], end: number, rides: Ride[]): Bucket[] {
  for (const r of rides) {
    if (r.startedAt < buckets[0].start || r.startedAt >= end) continue;
    let i = buckets.length - 1;
    while (i > 0 && r.startedAt < buckets[i].start) i -= 1;
    const b = buckets[i];
    b.distanceM += r.distanceM;
    b.movingMs += r.movingMs;
    b.elevGainM += r.elevGainM;
    b.rides += 1;
  }
  for (const b of buckets) b.avgSpeedMs = b.movingMs > 0 ? (b.distanceM / b.movingMs) * 1000 : 0;
  return buckets;
}

/** One bucket per week (Monday to Sunday, local time), oldest first, ending with the week of `now`. */
export function weeklySeries(rides: Ride[], now: number, weeks = 12): Bucket[] {
  if (weeks <= 0) return [];
  const current = new Date(weekStart(now));
  const buckets: Bucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    // setDate keeps local midnight even when a week crosses a clock change.
    const d = new Date(current.getFullYear(), current.getMonth(), current.getDate() - 7 * i);
    buckets.push(empty(d.getTime(), `${d.getDate()} ${MONTHS[d.getMonth()]}`));
  }
  const end = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 7).getTime();
  return fill(buckets, end, rides);
}

/** One bucket per calendar month, oldest first, ending with the month of `now`. */
export function monthlySeries(rides: Ride[], now: number, months = 6): Bucket[] {
  if (months <= 0) return [];
  const n = new Date(now);
  const buckets: Bucket[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(n.getFullYear(), n.getMonth() - i, 1);
    buckets.push(empty(d.getTime(), MONTHS[d.getMonth()]));
  }
  const end = new Date(n.getFullYear(), n.getMonth() + 1, 1).getTime();
  return fill(buckets, end, rides);
}

/** Distance and climb in metres, time in ms, speed in m/s. */
export function metricValue(b: Bucket, m: Metric): number {
  switch (m) {
    case 'distance':
      return b.distanceM;
    case 'time':
      return b.movingMs;
    case 'climb':
      return b.elevGainM;
    case 'speed':
      return b.avgSpeedMs;
  }
}

function combine(bs: Bucket[], m: Metric): number {
  if (m === 'speed') {
    let dist = 0;
    let ms = 0;
    for (const b of bs) {
      dist += b.distanceM;
      ms += b.movingMs;
    }
    return ms > 0 ? (dist / ms) * 1000 : 0;
  }
  return bs.reduce((s, b) => s + metricValue(b, m), 0);
}

/** The last 4 buckets compared with the 4 before them. */
export function change(series: Bucket[], m: Metric): { recent: number; before: number; pct: number | null } {
  const recent = combine(series.slice(-4), m);
  const before = combine(series.slice(-8, -4), m);
  const pct = before > 0 ? ((recent - before) / before) * 100 : null;
  return { recent, before, pct };
}

export function records(rides: Ride[]): {
  longest: Ride | null;
  mostClimb: Ride | null;
  fastest: Ride | null;
  longestTime: Ride | null;
} {
  let longest: Ride | null = null;
  let mostClimb: Ride | null = null;
  let fastest: Ride | null = null;
  let longestTime: Ride | null = null;
  const speed = (r: Ride) => (r.movingMs > 0 ? r.distanceM / r.movingMs : 0);
  for (const r of rides) {
    if (!longest || r.distanceM > longest.distanceM) longest = r;
    if (r.elevGainM > 0 && (!mostClimb || r.elevGainM > mostClimb.elevGainM)) mostClimb = r;
    if (!longestTime || r.movingMs > longestTime.movingMs) longestTime = r;
    if (r.distanceM >= 5000 && r.movingMs > 0 && (!fastest || speed(r) > speed(fastest))) fastest = r;
  }
  return { longest, mostClimb, fastest, longestTime };
}
