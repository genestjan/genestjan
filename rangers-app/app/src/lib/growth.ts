import type { Growth } from './model';
export interface GrowthResult { status: 'not-enough-data' | 'ok' | 'spurt' | 'remeasure'; cmPerYear?: number }
/** Latest measurement vs the most recent earlier one at least 56 days before it. */
export function growthVelocity(ms: Growth[], spurtAt = 7.2): GrowthResult {
  const s = [...ms].sort((a, b) => a.date.localeCompare(b.date));
  if (s.length < 2) return { status: 'not-enough-data' };
  const last = s[s.length - 1];
  const ts = (d: string) => Date.parse(d + 'T00:00:00Z');
  const prev = [...s.slice(0, -1)].reverse().find((m) => (ts(last.date) - ts(m.date)) / 86400000 >= 56);
  if (!prev) return { status: 'not-enough-data' };
  const days = (ts(last.date) - ts(prev.date)) / 86400000;
  const v = (last.heightCm - prev.heightCm) / (days / 365.25);
  if (v < -1 || v > 15) return { status: 'remeasure', cmPerYear: v };
  return { status: v >= spurtAt ? 'spurt' : 'ok', cmPerYear: v };
}
