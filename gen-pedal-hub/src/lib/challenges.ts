import type { Ride } from '../types.ts';

export type MonthChallenge = { key: string; title: string; unit: string; target: number; value: number; done: boolean };

export function monthStart(t: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function monthName(t: number): string {
  return MONTHS[new Date(t).getMonth()];
}

/** Days left in the month, counting today. */
export function daysLeftInMonth(t: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate() + 1;
}

/**
 * This month's personal challenges, worked out on the phone so they need no
 * account. The distance target is the rider's own monthly goal; the other two
 * scale with it so a beginner and a racer both get something reachable.
 */
export function monthChallenges(rides: Ride[], monthlyGoalKm: number, now: number): MonthChallenge[] {
  const start = monthStart(now);
  let m = 0;
  let climb = 0;
  let count = 0;
  let longest = 0;
  for (const r of rides) {
    if (r.startedAt < start || r.startedAt > now) continue;
    m += r.distanceM;
    climb += r.elevGainM;
    count += 1;
    longest = Math.max(longest, r.distanceM);
  }
  const km = m / 1000;
  const goal = Math.max(20, monthlyGoalKm);
  const ridesTarget = Math.min(20, Math.max(4, Math.round(goal / 25)));
  const climbTarget = Math.max(200, Math.round((goal * 5) / 100) * 100);
  const longTarget = Math.max(10, Math.round(goal / 4 / 5) * 5);
  const mk = (key: string, title: string, unit: string, target: number, value: number): MonthChallenge => ({
    key,
    title,
    unit,
    target,
    value,
    done: value >= target,
  });
  return [
    mk('distance', `Ride ${goal} km this month`, 'km', goal, km),
    mk('rides', `Go out ${ridesTarget} times`, 'rides', ridesTarget, count),
    mk('climb', `Climb ${climbTarget.toLocaleString('en-GB')} m`, 'm', climbTarget, climb),
    mk('long', `Do one ride of ${longTarget} km`, 'km', longTarget, longest / 1000),
  ];
}
