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
type Score = [number, number];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * Plans who plays each sub window so minutes are as equal as possible.
 * Two candidate plans are built (a greedy "most owed first" plan and a round-robin bench rotation),
 * both are improved by local search, and the better one is returned. Deterministic for the same input.
 */
export function planRotation(inp: RotationInput): RotationPlan {
  const { format, periods, periodMinutes, windowMinutes } = inp;
  const off = new Set(inp.locks?.off ?? []);
  const squad = inp.players.filter((p) => !off.has(p.id));
  const ids = squad.map((p) => p.id);
  const seed = inp.seed ?? 'rangers';
  const carry = inp.carryOver === 'strong' ? 0.5 : inp.carryOver === 'gentle' ? 0.25 : 0;
  const slots = Math.min(format.slots, squad.length);
  const onLock = (w: number, id: string) => inp.locks?.on?.[w]?.includes(id) ?? false;

  // Window layout and one keeper per period (keepers change only at breaks).
  const layout: { period: number; minutes: number }[] = [];
  for (let per = 0; per < periods; per++) for (let st = 0; st < periodMinutes; st += windowMinutes) layout.push({ period: per, minutes: Math.min(windowMinutes, periodMinutes - st) });
  const keepers: (string | undefined)[] = [];
  const gkCount: Record<string, number> = {};
  for (let per = 0; per < periods; per++) {
    let k: string | undefined;
    if (format.hasKeeper && squad.length) {
      k = inp.locks?.gk?.[per];
      if (!k || off.has(k)) {
        const pool = squad.some((p) => p.gkWilling) ? squad.filter((p) => p.gkWilling) : squad;
        k = [...pool].sort((a, b) => (gkCount[a.id] ?? 0) - (gkCount[b.id] ?? 0) || hash(seed + a.id) - hash(seed + b.id))[0].id;
      }
      gkCount[k] = (gkCount[k] ?? 0) + 1;
    }
    keepers.push(k);
  }

  const build = (pickBench: (w: number, pool: string[], benchCount: number, prevBench: Set<string>, planned: Record<string, number>) => string[]) => {
    const planned: Record<string, number> = Object.fromEntries(inp.players.map((p) => [p.id, 0]));
    const windows: Window[] = []; let prevBench = new Set<string>();
    layout.forEach((l, w) => {
      const keeper = keepers[l.period];
      const fixed = new Set<string>([...(keeper ? [keeper] : []), ...ids.filter((id) => onLock(w, id))]);
      const pool = ids.filter((id) => !fixed.has(id));
      const benchCount = Math.max(0, ids.length - Math.max(slots, fixed.size));
      const bench = new Set(pickBench(w, pool, benchCount, prevBench, planned));
      const roles: Record<string, Role> = {};
      for (const p of inp.players) roles[p.id] = !ids.includes(p.id) || bench.has(p.id) ? 'BENCH' : p.id === keeper ? 'GK' : 'FIELD';
      for (const id of ids) if (roles[id] !== 'BENCH') planned[id] += l.minutes;
      prevBench = bench; windows.push({ index: w, period: l.period, minutes: l.minutes, roles });
    });
    improve(windows, ids, planned, onLock);
    return { windows, planned };
  };

  const target = squad.length ? (periods * periodMinutes * slots) / squad.length : 0;
  const owed = (id: string) => carry * Math.min(squad.find((p) => p.id === id)?.owedMin ?? 0, 20);

  // A: greedy. Bench the children furthest ahead of their fair share, never twice in a row if avoidable.
  const greedy = build((w, pool, k, prev, planned) => [...pool]
    .sort((a, b) => Number(prev.has(a)) - Number(prev.has(b)) || (planned[b] - target - owed(b)) - (planned[a] - target - owed(a)) || hash(seed + w + a) - hash(seed + w + b))
    .slice(0, k));

  // B: round robin. Walk a circle of children; each window benches the next ones in the circle.
  // A few different circles are tried because local search can get stuck; the best plan wins.
  let best = greedy;
  for (let attempt = 0; attempt < 6; attempt++) {
    const circle = [...ids].sort((a, b) => owed(b) - owed(a) || hash(seed + attempt + a) - hash(seed + attempt + b));
    let ptr = 0;
    const robin = build((_w, pool, k) => {
      const out: string[] = []; let steps = 0;
      while (out.length < k && steps < circle.length * 2) { const id = circle[ptr % circle.length]; ptr++; steps++; if (pool.includes(id) && !out.includes(id)) out.push(id); }
      return out;
    });
    if (better(scoreOf(robin.windows, ids, robin.planned), scoreOf(best.windows, ids, best.planned))) best = robin;
  }
  const vals = ids.map((id) => best.planned[id]);
  return { windows: best.windows, minutes: best.planned, spread: vals.length ? Math.max(...vals) - Math.min(...vals) : 0 };
}

function scoreOf(windows: Window[], ids: string[], planned: Record<string, number>): Score {
  let doubles = 0;
  for (let w = 1; w < windows.length; w++) for (const id of ids) if (windows[w].roles[id] === 'BENCH' && windows[w - 1].roles[id] === 'BENCH') doubles++;
  const v = ids.map((id) => planned[id]); const mean = v.reduce((a, b) => a + b, 0) / (v.length || 1);
  const unit = Math.max(...windows.map((w) => w.minutes)) ** 2;   // one back-to-back bench spell costs about one window of unevenness
  return [v.length ? Math.max(...v) - Math.min(...v) : 0, v.reduce((a, b) => a + (b - mean) ** 2, 0) + unit * doubles];
}
/** Lower is better: smallest gap between most and least minutes first; then minutes as even as possible,
 *  with each back-to-back bench spell counted as a cost. */
const better = (a: Score, b: Score) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1] - 1e-9);

/** Local search: swap one outfield child with one bench child inside a window while that improves the score.
 *  Keepers and locked children never move. */
function improve(windows: Window[], ids: string[], planned: Record<string, number>, locked: (w: number, id: string) => boolean) {
  if (ids.length < 2 || windows.length === 0) return;
  let best = scoreOf(windows, ids, planned);
  for (let guard = 0; guard < 400; guard++) {
    let moved = false;
    outer: for (const w of windows) {
      const field = ids.filter((id) => w.roles[id] === 'FIELD' && !locked(w.index, id));
      const bench = ids.filter((id) => w.roles[id] === 'BENCH');
      for (const a of field) for (const b of bench) {
        w.roles[a] = 'BENCH'; w.roles[b] = 'FIELD'; planned[a] -= w.minutes; planned[b] += w.minutes;
        const sc = scoreOf(windows, ids, planned);
        if (better(sc, best)) { best = sc; moved = true; break outer; }
        w.roles[a] = 'FIELD'; w.roles[b] = 'BENCH'; planned[a] += w.minutes; planned[b] -= w.minutes;
      }
    }
    if (!moved) return;
  }
}
