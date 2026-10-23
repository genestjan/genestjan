import type { FormatSpec, Role } from './types';

export interface RotPlayer { id: string; gkWilling: boolean; owedMin?: number }
export interface Locks {
  off?: string[];                          // never plays
  gk?: Record<number, string>;            // period index -> keeper id
  on?: Record<number, string[]>;          // window index -> must be on the pitch
}
export interface RotationInput {
  players: RotPlayer[];
  format: FormatSpec;
  periods: number;
  periodMinutes: number;
  windowMinutes: number;                  // rolling sub interval; use periodMinutes for "breaks only"
  locks?: Locks;
  carryOver?: 'off' | 'gentle' | 'strong';
  seed?: string;
}
export interface Window { index: number; period: number; minutes: number; roles: Record<string, Role> }
export interface RotationPlan { windows: Window[]; minutes: Record<string, number>; spread: number }

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function planRotation(inp: RotationInput): RotationPlan {
  const { format, periods, periodMinutes, windowMinutes } = inp;
  const off = new Set(inp.locks?.off ?? []);
  const squad = inp.players.filter((p) => !off.has(p.id));
  const seed = inp.seed ?? 'rangers';
  const carry = inp.carryOver === 'strong' ? 0.5 : inp.carryOver === 'gentle' ? 0.25 : 0;
  const slots = Math.min(format.slots, squad.length);
  const totalMin = periods * periodMinutes;
  const target = squad.length ? (totalMin * slots) / squad.length : 0;

  const planned: Record<string, number> = Object.fromEntries(inp.players.map((p) => [p.id, 0]));
  const gkPeriods: Record<string, number> = {};
  const windows: Window[] = [];
  let prevBench = new Set<string>();
  let idx = 0;

  for (let per = 0; per < periods; per++) {
    // keeper for the whole period
    let keeper: string | undefined;
    if (format.hasKeeper && squad.length) {
      keeper = inp.locks?.gk?.[per];
      if (!keeper || off.has(keeper)) {
        const pool = squad.some((p) => p.gkWilling) ? squad.filter((p) => p.gkWilling) : squad;
        keeper = [...pool].sort((a, b) =>
          (gkPeriods[a.id] ?? 0) - (gkPeriods[b.id] ?? 0) ||
          planned[a.id] - planned[b.id] ||
          hash(seed + a.id) - hash(seed + b.id))[0].id;
      }
      gkPeriods[keeper] = (gkPeriods[keeper] ?? 0) + 1;
    }

    for (let start = 0; start < periodMinutes; start += windowMinutes) {
      const minutes = Math.min(windowMinutes, periodMinutes - start);
      const chosen = new Set<string>();
      if (keeper) chosen.add(keeper);
      for (const id of inp.locks?.on?.[idx] ?? []) if (!off.has(id)) chosen.add(id);

      const priority = (p: RotPlayer) =>
        target - planned[p.id] + carry * Math.min(p.owedMin ?? 0, 20) + (prevBench.has(p.id) ? windowMinutes : 0);
      const rest = squad
        .filter((p) => !chosen.has(p.id))
        .sort((a, b) =>
          Number(prevBench.has(b.id)) - Number(prevBench.has(a.id)) || // never bench twice in a row
          priority(b) - priority(a) || hash(seed + idx + a.id) - hash(seed + idx + b.id));
      for (const p of rest) { if (chosen.size >= slots) break; chosen.add(p.id); }

      const roles: Record<string, Role> = {};
      for (const p of inp.players) roles[p.id] = chosen.has(p.id) ? (p.id === keeper ? 'GK' : 'FIELD') : 'BENCH';
      for (const id of chosen) planned[id] += minutes;
      prevBench = new Set(squad.filter((p) => !chosen.has(p.id)).map((p) => p.id));
      windows.push({ index: idx++, period: per, minutes, roles });
    }
  }

  // Balance pass: swap minutes from the most-played child to the least-played one,
  // keeping keepers, locks and the "never benched twice in a row" rule intact.
  const onLock = (w: number, id: string) => inp.locks?.on?.[w]?.includes(id) ?? false;
  const benchedAt = (w: number, id: string) => windows[w]?.roles[id] === 'BENCH';
  for (let guard = 0; guard < 500 && squad.length > 1; guard++) {
    const ranked = [...squad].sort((a, b) => planned[b.id] - planned[a.id]);
    let swapped = false;
    outer: for (const hi of ranked) {
      for (const lo of [...ranked].reverse()) {
        if (planned[hi.id] - planned[lo.id] < windowMinutes) continue;
        for (const w of windows) {
          if (w.roles[hi.id] !== 'FIELD' || w.roles[lo.id] !== 'BENCH' || onLock(w.index, hi.id)) continue;
          if (planned[hi.id] - planned[lo.id] < 2 * w.minutes && planned[hi.id] - planned[lo.id] <= windowMinutes) continue;
          if (benchedAt(w.index - 1, hi.id) || benchedAt(w.index + 1, hi.id)) continue;
          w.roles[hi.id] = 'BENCH'; w.roles[lo.id] = 'FIELD';
          planned[hi.id] -= w.minutes; planned[lo.id] += w.minutes;
          swapped = true; break outer;
        }
      }
    }
    if (!swapped) break;
  }

  const vals = squad.map((p) => planned[p.id]);
  const spread = vals.length ? Math.max(...vals) - Math.min(...vals) : 0;
  return { windows, minutes: planned, spread };
}
