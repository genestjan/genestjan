import { useEffect, useRef, useState } from 'react';
import { resolveAt, totalMs, type BoardDoc } from '../lib/board';
import { Pitch } from './ui';

const PITCH_W = 64, PITCH_H = 45; // metres, 8v8 default

export function BoardView({ doc, playing = true }: { doc: BoardDoc; playing?: boolean }) {
  const [t, setT] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (!playing) return;
    const start = performance.now();
    const loop = (now: number) => { setT((now - start) % (totalMs(doc) + 600)); raf.current = requestAnimationFrame(loop); };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [doc, playing]);

  const r = resolveAt(doc, t);
  const sx = 160 / PITCH_W, sy = 100 / PITCH_H;
  const P = (p: { x: number; y: number }) => ({ x: p.x * sx, y: p.y * sy });
  const dash = { run: undefined, pass: '3 2', dribble: '1 1.5' } as const;
  return (
    <Pitch format="h">
      <defs><marker id="ah" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#F9F6EF" /></marker></defs>
      {r.arrows.map((a, i) => { const f = P(a.from), to = P(a.to); return <line key={i} x1={f.x} y1={f.y} x2={to.x} y2={to.y} stroke="#F9F6EF" strokeWidth="1" strokeDasharray={dash[a.type]} markerEnd="url(#ah)" opacity=".85" />; })}
      {doc.pieces.map((pc) => {
        const p = P(r.positions[pc.id]);
        return pc.kind === 'us'
          ? <g key={pc.id}><circle cx={p.x} cy={p.y} r="4.6" fill="#C31E24" stroke="#fff" strokeWidth=".8" /><text x={p.x} y={p.y + 2.2} textAnchor="middle" fontSize="6" fill="#fff" fontFamily="Bebas Neue">{pc.label}</text></g>
          : <rect key={pc.id} x={p.x - 4} y={p.y - 4} width="8" height="8" rx="2" fill="#F9F6EF" stroke="#051A31" strokeWidth=".8" />;
      })}
      {r.ballWith && r.positions[r.ballWith] && (() => { const p = P(r.positions[r.ballWith!]); return <circle cx={p.x + 5} cy={p.y - 4} r="2" fill="#fff" stroke="#051A31" strokeWidth=".6" />; })()}
    </Pitch>
  );
}

export function useBoardKey(initial: string) { return useState(initial); }
