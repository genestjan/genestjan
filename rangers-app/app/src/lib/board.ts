export interface Pt { x: number; y: number }          // metres on a horizontal pitch
export interface Step { positions: Record<string, Pt>; ballWith?: string; arrows: { type: 'run' | 'pass' | 'dribble'; from: Pt; to: Pt }[] }
export interface BoardDoc {
  id: string; name: string; format: string; whyKids: string; moveMs: number; holdMs: number;
  pieces: { id: string; kind: 'us' | 'them'; label: string }[]; steps: Step[];
}

const ease = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const lerp = (a: Pt, b: Pt, u: number): Pt => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });

export function stepTimings(doc: BoardDoc) { return doc.steps.map((_, i) => (i === 0 ? doc.holdMs : doc.moveMs + doc.holdMs)); }
export const totalMs = (doc: BoardDoc) => stepTimings(doc).reduce((a, b) => a + b, 0);

/** Pure: positions, carrier and visible arrows at time t (ms). Clamped, loops handled by the caller. */
export function resolveAt(doc: BoardDoc, tMs: number) {
  const t = Math.max(0, Math.min(tMs, totalMs(doc)));
  let acc = 0;
  for (let i = 0; i < doc.steps.length; i++) {
    const dur = stepTimings(doc)[i];
    if (t <= acc + dur || i === doc.steps.length - 1) {
      const local = t - acc;
      const to = doc.steps[i];
      const from = doc.steps[Math.max(0, i - 1)];
      const u = i === 0 ? 1 : Math.min(1, local / doc.moveMs);
      const positions: Record<string, Pt> = {};
      for (const k of Object.keys(to.positions)) positions[k] = lerp(from.positions[k] ?? to.positions[k], to.positions[k], ease(u));
      return { index: i, u, positions, ballWith: u < 1 && from.ballWith ? from.ballWith : to.ballWith, arrows: to.arrows };
    }
    acc += dur;
  }
  throw new Error('unreachable');
}
