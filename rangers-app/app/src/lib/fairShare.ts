/** Seconds each child should have played so far, if time were shared equally. */
export function fairSeconds(elapsedSec: number, slots: number, presentCount: number): number {
  if (presentCount <= 0) return 0;
  return (elapsedSec * Math.min(slots, presentCount)) / presentCount;
}

/** Positive means the child is owed time. */
export function owedSeconds(playedSec: number, elapsedSec: number, slots: number, presentCount: number): number {
  return fairSeconds(elapsedSec, slots, presentCount) - playedSec;
}

export interface Interval { on: number; off?: number }

/** Seconds on the pitch at `now` from on/off timestamps (ms). */
export function playedSeconds(intervals: Interval[], now: number): number {
  return intervals.reduce((s, i) => s + Math.max(0, (Math.min(i.off ?? now, now) - i.on) / 1000), 0);
}

export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
