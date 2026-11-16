import type { Bike, CheckKey, Ride } from '../types.ts';

const DAY = 86400000;

/** Start of the week (Monday, local time) that contains `t`. */
export function weekStart(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

export type Week = { distanceM: number; movingMs: number; rides: number; days: number[] };

/** Totals for the week containing `now`. `days` is metres per day, Monday first. */
export function weekOf(rides: Ride[], now: number): Week {
  const start = weekStart(now);
  const end = weekStart(start + 7 * DAY + DAY / 2);
  const w: Week = { distanceM: 0, movingMs: 0, rides: 0, days: [0, 0, 0, 0, 0, 0, 0] };
  for (const r of rides) {
    if (r.startedAt < start || r.startedAt >= end) continue;
    w.distanceM += r.distanceM;
    w.movingMs += r.movingMs;
    w.rides += 1;
    const d = new Date(r.startedAt);
    w.days[(d.getDay() + 6) % 7] += r.distanceM;
  }
  return w;
}

/**
 * Weeks in a row with at least one ride. The current week does not break the
 * streak while it is still empty, so nobody loses a streak on a Monday.
 */
export function streakWeeks(rides: Ride[], now: number): number {
  const weeks = new Set(rides.map((r) => weekStart(r.startedAt)));
  let cursor = weekStart(now);
  if (!weeks.has(cursor)) cursor = weekStart(cursor - DAY);
  let n = 0;
  while (weeks.has(cursor)) {
    n += 1;
    cursor = weekStart(cursor - DAY);
  }
  return n;
}

export function totals(rides: Ride[]) {
  let distanceM = 0;
  let movingMs = 0;
  let elevGainM = 0;
  for (const r of rides) {
    distanceM += r.distanceM;
    movingMs += r.movingMs;
    elevGainM += r.elevGainM;
  }
  return { distanceM, movingMs, elevGainM, rides: rides.length };
}

export type Badge = { key: string; title: string; hint: string; earned: boolean };

export function badges(rides: Ride[], now: number): Badge[] {
  const t = totals(rides);
  const km = t.distanceM / 1000;
  const longest = rides.reduce((m, r) => Math.max(m, r.distanceM), 0) / 1000;
  const streak = streakWeeks(rides, now);
  return [
    { key: 'first', title: 'First ride', hint: 'Record one ride', earned: t.rides >= 1 },
    { key: 'five', title: '5 rides', hint: 'Record five rides', earned: t.rides >= 5 },
    { key: 'r25', title: '25 km ride', hint: 'Ride 25 km in one go', earned: longest >= 25 },
    { key: 'r50', title: '50 km ride', hint: 'Ride 50 km in one go', earned: longest >= 50 },
    { key: 'r100', title: 'Century', hint: 'Ride 100 km in one go', earned: longest >= 100 },
    { key: 't100', title: '100 km total', hint: 'Reach 100 km in total', earned: km >= 100 },
    { key: 't500', title: '500 km total', hint: 'Reach 500 km in total', earned: km >= 500 },
    { key: 't1000', title: '1,000 km total', hint: 'Reach 1,000 km in total', earned: km >= 1000 },
    { key: 's4', title: '4 week streak', hint: 'Ride every week for 4 weeks', earned: streak >= 4 },
    { key: 'climb', title: '1,000 m climbed', hint: 'Climb 1,000 m in total', earned: t.elevGainM >= 1000 },
  ];
}

/** What made this ride a personal best, compared with every earlier ride. */
export function bests(ride: Ride, all: Ride[]): string[] {
  const earlier = all.filter((r) => r.id !== ride.id && r.startedAt < ride.startedAt);
  if (earlier.length === 0) return [];
  const out: string[] = [];
  if (earlier.every((r) => r.distanceM < ride.distanceM)) out.push('Longest ride yet');
  if (earlier.every((r) => r.elevGainM < ride.elevGainM) && ride.elevGainM >= 50) out.push('Most climbing yet');
  const avg = (r: Ride) => (r.movingMs > 0 ? r.distanceM / r.movingMs : 0);
  if (ride.distanceM >= 5000 && earlier.every((r) => r.distanceM < 5000 || avg(r) < avg(ride))) {
    out.push('Fastest average yet');
  }
  return out;
}

export const CHECKS: { key: CheckKey; title: string; everyKm: number }[] = [
  { key: 'chain', title: 'Clean and oil the chain', everyKm: 300 },
  { key: 'tyres', title: 'Check tyres and brake pads', everyKm: 1000 },
  { key: 'service', title: 'Full service', everyKm: 3000 },
];

export function bikeKm(bike: Bike, rides: Ride[]): number {
  let m = 0;
  for (const r of rides) if (r.bikeId === bike.id) m += r.distanceM;
  return bike.startKm + m / 1000;
}

export type CheckState = { key: CheckKey; title: string; everyKm: number; sinceKm: number; due: boolean };

export function bikeChecks(bike: Bike, rides: Ride[]): CheckState[] {
  const km = bikeKm(bike, rides);
  return CHECKS.map((c) => {
    const sinceKm = Math.max(0, km - (bike.doneAtKm[c.key] ?? bike.startKm));
    return { ...c, sinceKm, due: sinceKm >= c.everyKm };
  });
}
