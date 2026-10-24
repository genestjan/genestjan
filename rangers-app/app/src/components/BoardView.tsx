import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { resolveAt, toView, totalMs, type BoardDoc, type Ink, type Orient, type Piece, type Pt, type Stroke } from '../lib/board';
import { Pitch } from './ui';

/** Line colours on the board (CSS variables, so sun mode can change them). */
export const INK: Record<Ink, string> = { white: 'var(--ink-white)', yellow: 'var(--gold)', red: 'var(--ink-red)', blue: 'var(--ink-blue)' };

/** A small player: head, shirt with the number, shorts and legs. Drawn around the chest, upright on any pitch. */
export function Figure({ at, piece, active }: { at: Pt; piece: Piece; active?: boolean }) {
  const shirt = piece.gk ? 'var(--kit-gk)' : piece.kind === 'us' ? 'var(--kit-us)' : 'var(--kit-them)';
  const shorts = piece.kind === 'us' ? 'var(--kit-us-shorts)' : 'var(--kit-them-shorts)';
  const num = piece.gk || piece.kind === 'them' ? 'var(--kit-num-dark)' : 'var(--kit-num-light)';
  return (
    <g transform={`translate(${at.x} ${at.y})`}>
      <ellipse cx="0" cy="6.4" rx={active ? 4.2 : 3.1} ry={active ? 1.5 : 1} fill={active ? 'var(--gold)' : '#000'} opacity={active ? 0.9 : 0.3} />
      <path d="M-1.2 2.8 L-1.4 5.9 M1.2 2.8 L1.4 5.9" stroke="var(--skin)" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M-1.4 5.4 L-1.5 6.3 M1.4 5.4 L1.5 6.3" stroke={shorts} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M-2.7 -2.3 L-3.6 1 M2.7 -2.3 L3.6 1" stroke={shirt} strokeWidth="1.35" strokeLinecap="round" />
      <circle cx="-3.65" cy="1.45" r=".6" fill="var(--skin)" /><circle cx="3.65" cy="1.45" r=".6" fill="var(--skin)" />
      <rect x="-2.5" y="1.3" width="5" height="2.2" rx=".6" fill={shorts} />
      <path d="M-3 -2.9 Q0 -3.9 3 -2.9 L2.5 1.8 L-2.5 1.8 Z" fill={shirt} stroke="rgba(0,0,0,.4)" strokeWidth=".3" />
      <circle cx="0" cy="-5.5" r="2.15" fill="var(--skin)" />
      <path d="M-2.15 -5.6 Q-2.1 -7.95 0 -7.8 Q2.1 -7.95 2.15 -5.6 Q1 -6.75 -2.15 -5.6 Z" fill="var(--hair)" />
      {piece.label && <text x="0" y=".75" textAnchor="middle" fontSize="3.3" fontWeight="700" fill={num} fontFamily="Barlow, sans-serif" style={{ pointerEvents: 'none' }}>{piece.label}</text>}
    </g>
  );
}

/** Where the ball sits: at the feet of the player who has it (drawing units). */
export const ballAt = (chest: Pt): Pt => ({ x: chest.x + 3.4, y: chest.y + 4.9 });
export function Ball({ at }: { at: Pt }) {
  return <g transform={`translate(${at.x} ${at.y})`}><circle r="1.6" fill="#fff" stroke="#0a1f44" strokeWidth=".35" /><path d="M0 -.75 L.7 -.2 L.45 .6 L-.45 .6 L-.7 -.2 Z" fill="#0a1f44" /></g>;
}

/** Faint mowing stripes, so the pitch looks like grass. */
export function Stripes({ orient }: { orient: Orient }) {
  const w = orient === 'v' ? 100 : 160, h = orient === 'v' ? 160 : 100; const n = 8;
  return <g fill="var(--text)" opacity=".035">{Array.from({ length: n / 2 }, (_, i) => orient === 'v' ? <rect key={i} x="0" y={(i * 2 + 1) * h / n} width={w} height={h / n} /> : <rect key={i} x={(i * 2 + 1) * w / n} y="0" width={w / n} height={h} />)}</g>;
}

const smooth = (v: Pt[]) => {
  if (v.length < 3) return v.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  let d = `M${v[0].x.toFixed(1)} ${v[0].y.toFixed(1)}`;
  for (let i = 1; i < v.length - 1; i++) { const m = { x: (v[i].x + v[i + 1].x) / 2, y: (v[i].y + v[i + 1].y) / 2 }; d += ` Q${v[i].x.toFixed(1)} ${v[i].y.toFixed(1)} ${m.x.toFixed(1)} ${m.y.toFixed(1)}`; }
  const last = v[v.length - 1]; return d + ` L${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
};

/** Arrow heads, one per colour (marker colours cannot follow the line in every browser). */
export function InkMarkers({ id }: { id: string }) {
  return <defs>{(Object.keys(INK) as Ink[]).map((k) => <marker key={k} id={`${id}-${k}`} markerWidth="5" markerHeight="5" refX="3.6" refY="2.5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L5,2.5 L0,5 z" fill={INK[k]} /></marker>)}</defs>;
}
export function StrokePath({ s, orient, id, faint }: { s: Stroke; orient: Orient; id: string; faint?: boolean }) {
  return <path d={smooth(s.pts.map((p) => toView(p, orient)))} fill="none" stroke={INK[s.ink]} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={s.kind === 'pass' ? '3 2.2' : undefined} markerEnd={s.kind === 'line' ? undefined : `url(#${id}-${s.ink})`} opacity={faint ? 0.6 : 0.95} />;
}
/** The older straight arrows from ready-made moves. */
export function OldArrows({ arrows, orient, id }: { arrows: BoardDoc['steps'][number]['arrows']; orient: Orient; id: string }) {
  return <>{arrows.map((a, i) => { const f = toView(a.from, orient), t = toView(a.to, orient); return <line key={i} x1={f.x} y1={f.y} x2={t.x} y2={t.y} stroke={INK.white} strokeWidth="1.1" strokeLinecap="round" strokeDasharray={a.type === 'pass' ? '3 2.2' : a.type === 'dribble' ? '1 1.6' : undefined} markerEnd={`url(#${id}-white)`} opacity=".9" />; })}</>;
}

/** Plays a move: players walk from step to step, lines appear with each step. Loops. */
export function BoardView({ doc, playing = true, orient = 'h', className, style, children }: { doc: BoardDoc; playing?: boolean; orient?: Orient; className?: string; style?: React.CSSProperties; children?: ReactNode }) {
  const [t, setT] = useState(0);
  const raf = useRef(0); const id = 'bv' + useId().replace(/:/g, '');
  useEffect(() => {
    if (!playing) return;
    const start = performance.now();
    const loop = (now: number) => { setT((now - start) % (totalMs(doc) + 600)); raf.current = requestAnimationFrame(loop); };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [doc, playing]);

  const r = resolveAt(doc, t);
  const carrier = r.ballWith && r.positions[r.ballWith];
  return (
    <Pitch format={orient} className={className} style={style}>
      <Stripes orient={orient} />
      <InkMarkers id={id} />
      <OldArrows arrows={r.arrows} orient={orient} id={id} />
      {r.strokes.map((s, i) => <StrokePath key={i} s={s} orient={orient} id={id} />)}
      {doc.pieces.filter((pc) => r.positions[pc.id]).map((pc) => <Figure key={pc.id} at={toView(r.positions[pc.id], orient)} piece={pc} />)}
      {carrier && <Ball at={ballAt(toView(carrier, orient))} />}
      {children}
    </Pitch>
  );
}
