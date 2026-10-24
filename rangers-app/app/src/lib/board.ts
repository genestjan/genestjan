import { FORMATIONS } from './presets';

export interface Pt { x: number; y: number }          // metres on a horizontal pitch: x along (0 = our goal), y across
/** A line the coach drew with a finger. run = solid with an arrow, pass = dashed with an arrow, line = plain. */
export type Ink = 'white' | 'yellow' | 'red' | 'blue';
export type LineKind = 'run' | 'pass' | 'line';
export interface Stroke { pts: Pt[]; ink: Ink; kind: LineKind }
export interface Step { positions: Record<string, Pt>; ballWith?: string; arrows: { type: 'run' | 'pass' | 'dribble'; from: Pt; to: Pt }[]; strokes?: Stroke[] }
export interface Piece { id: string; kind: 'us' | 'them'; label: string; gk?: boolean }
export interface BoardDoc {
  id: string; name: string; format: string; whyKids: string; moveMs: number; holdMs: number;
  pieces: Piece[]; steps: Step[];
  /** free = one picture to draw on; steps = a move that plays step by step */
  mode?: 'free' | 'steps';
}

export const PITCH = { w: 64, h: 45 };   // metres, 8v8 default
export type Orient = 'v' | 'h';         // v = upright on a phone (our goal at the bottom), h = sideways (TV)

const ease = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const lerp = (a: Pt, b: Pt, u: number): Pt => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

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
      return { index: i, u, positions, ballWith: u < 1 && from.ballWith ? from.ballWith : to.ballWith, arrows: to.arrows, strokes: to.strokes ?? [] };
    }
    acc += dur;
  }
  throw new Error('unreachable');
}

/** Pitch metres to drawing units: the upright pitch is 100 x 160, the sideways one 160 x 100. */
export function toView(p: Pt, o: Orient): Pt {
  return o === 'h' ? { x: p.x * 160 / PITCH.w, y: p.y * 100 / PITCH.h } : { x: p.y * 100 / PITCH.h, y: (PITCH.w - p.x) * 160 / PITCH.w };
}
/** Drawing units back to pitch metres, kept just inside the lines. */
export function fromView(v: Pt, o: Orient): Pt {
  const p = o === 'h' ? { x: v.x * PITCH.w / 160, y: v.y * PITCH.h / 100 } : { x: PITCH.w - v.y * PITCH.w / 160, y: v.x * PITCH.h / 100 };
  return { x: clamp(p.x, 1, PITCH.w - 1), y: clamp(p.y, 1, PITCH.h - 1) };
}

/** Thins a finger stroke: keeps points at least `min` metres apart (and the last one), rounded to 10 cm, so saved moves stay small. */
export function simplify(pts: Pt[], min = 0.7): Pt[] {
  if (pts.length < 2) return pts.map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }));
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) if (dist(pts[i], out[out.length - 1]) >= min) out.push(pts[i]);
  out.push(pts[pts.length - 1]);
  return out.map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }));
}
export const strokeLength = (pts: Pt[]) => pts.reduce((s, p, i) => (i ? s + dist(pts[i - 1], p) : 0), 0);

/** Shortest distance from a point to a drawn line (metres). */
export function distToLine(pt: Pt, pts: Pt[]): number {
  if (pts.length === 1) return dist(pt, pts[0]);
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]; const dx = b.x - a.x, dy = b.y - a.y; const len2 = dx * dx + dy * dy;
    const u = len2 ? clamp(((pt.x - a.x) * dx + (pt.y - a.y) * dy) / len2, 0, 1) : 0;
    best = Math.min(best, dist(pt, { x: a.x + u * dx, y: a.y + u * dy }));
  }
  return best;
}

/** The player nearest to a touch, if one is close enough to be what the finger meant. */
export function nearestPiece(step: Step, pt: Pt, within = 4.5): string | null {
  let best: string | null = null, d = within;
  for (const [id, p] of Object.entries(step.positions)) { const dd = dist(p, pt); if (dd < d) { d = dd; best = id; } }
  return best;
}

export type Setup = 'empty' | '2v1' | '4v4' | 'full';
/** Ready starting pictures, so a coach does not have to add players one by one. Teams stand in their own half, facing each other. */
export function setup(kind: Setup, format = '8v8'): { pieces: Piece[]; step: Step } {
  if (kind === 'empty') return { pieces: [], step: { positions: {}, arrows: [], strokes: [] } };
  if (kind === '2v1') return {
    pieces: [{ id: 'u1', kind: 'us', label: '1' }, { id: 'u2', kind: 'us', label: '2' }, { id: 't1', kind: 'them', label: '' }],
    step: { positions: { u1: { x: 20, y: 22 }, u2: { x: 32, y: 14 }, t1: { x: 28, y: 22 } }, ballWith: 'u1', arrows: [], strokes: [] },
  };
  const slots = FORMATIONS[kind === '4v4' ? '4v4' : format] ?? FORMATIONS['8v8'];
  const pieces: Piece[] = []; const positions: Record<string, Pt> = {};
  slots.forEach((s, i) => {
    const across = 3 + s.x * (PITCH.h - 6), along = 2 + s.y * (PITCH.w / 2 - 6);
    const gk = s.code === 'GK';
    pieces.push({ id: `u${i + 1}`, kind: 'us', label: String(i + 1), gk }); positions[`u${i + 1}`] = { x: along, y: across };
    pieces.push({ id: `t${i + 1}`, kind: 'them', label: '', gk }); positions[`t${i + 1}`] = { x: PITCH.w - along, y: PITCH.h - across };
  });
  const striker = [...slots.keys()].sort((a, b) => slots[b].y - slots[a].y)[0];
  return { pieces, step: { positions, ballWith: `u${striker + 1}`, arrows: [], strokes: [] } };
}
