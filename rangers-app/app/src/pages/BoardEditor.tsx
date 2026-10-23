import { useMemo, useRef, useState } from 'react';
import { Back, Card, Chip, H2, Page, Pitch } from '../components/ui';
import { BoardView } from '../components/BoardView';
import { del, put, uid, useAppState } from '../lib/store';
import { PRESETS } from '../lib/presets';
import type { BoardDoc, Pt, Step } from '../lib/board';

const SX = 160 / 64, SY = 100 / 45; // pitch metres -> svg units
type Tool = 'move' | 'run' | 'pass' | 'dribble' | 'ball' | 'erase';
const blank = (): BoardDoc => ({ id: uid(), name: 'My move', format: '8v8', whyKids: '', moveMs: 1200, holdMs: 1400, pieces: [{ id: 'u1', kind: 'us', label: '1' }, { id: 'u2', kind: 'us', label: '2' }, { id: 't1', kind: 'them', label: '' }],
  steps: [{ positions: { u1: { x: 20, y: 22 }, u2: { x: 32, y: 14 }, t1: { x: 28, y: 22 } }, ballWith: 'u1', arrows: [] }] });
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

export default function BoardEditor() {
  const s = useAppState(); const [doc, setDoc] = useState<BoardDoc>(blank()); const [si, setSi] = useState(0); const [tool, setTool] = useState<Tool>('move'); const [play, setPlay] = useState(false);
  const [coachNote, setCoachNote] = useState(''); const [drag, setDrag] = useState<{ id: string } | null>(null); const [draft, setDraft] = useState<{ from: Pt; to: Pt } | null>(null);
  const [hist, setHist] = useState<BoardDoc[]>([]); const svg = useRef<SVGSVGElement>(null);
  const step = doc.steps[Math.min(si, doc.steps.length - 1)];
  const commit = (next: BoardDoc, record = true) => { if (record) setHist((h) => [...h.slice(-30), doc]); setDoc(next); };
  const edit = (f: (st: Step) => void, record = true) => { const n = clone(doc); f(n.steps[si]); commit(n, record); };
  const toPt = (e: React.PointerEvent): Pt => { const el = svg.current!; const p = el.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(el.getScreenCTM()!.inverse()); return { x: Math.max(1, Math.min(63, q.x / SX)), y: Math.max(1, Math.min(44, q.y / SY)) }; };
  const nearest = (pt: Pt) => { let best: string | null = null, d = 5; for (const pc of doc.pieces) { const p = step.positions[pc.id]; const dd = Math.hypot(p.x - pt.x, p.y - pt.y); if (dd < d) { d = dd; best = pc.id; } } return best; };
  const down = (e: React.PointerEvent) => {
    if (play) return; (e.target as Element).setPointerCapture?.(e.pointerId); const pt = toPt(e); const hit = nearest(pt);
    if (tool === 'move' && hit) setDrag({ id: hit });
    else if (tool === 'ball' && hit) edit((st) => { st.ballWith = hit; });
    else if (tool === 'erase') { if (hit) { const n = clone(doc); n.pieces = n.pieces.filter((p) => p.id !== hit); n.steps.forEach((st) => { delete st.positions[hit]; if (st.ballWith === hit) st.ballWith = undefined; }); commit(n); } else if (step.arrows.length) edit((st) => { st.arrows.pop(); }); }
    else if (tool === 'run' || tool === 'pass' || tool === 'dribble') setDraft({ from: hit ? step.positions[hit] : pt, to: pt });
  };
  const move = (e: React.PointerEvent) => { const pt = toPt(e); if (drag) { const n = clone(doc); n.steps[si].positions[drag.id] = pt; setDoc(n); } else if (draft) setDraft({ ...draft, to: pt }); };
  const up = () => { if (drag) { setHist((h) => [...h.slice(-30), doc]); setDrag(null); } if (draft) { if (Math.hypot(draft.to.x - draft.from.x, draft.to.y - draft.from.y) > 2 && (tool === 'run' || tool === 'pass' || tool === 'dribble')) edit((st) => { st.arrows.push({ type: tool, from: draft.from, to: draft.to }); }); setDraft(null); } };
  const addPiece = (kind: 'us' | 'them') => { const n = clone(doc); const count = n.pieces.filter((p) => p.kind === kind).length + 1; const id = `${kind === 'us' ? 'u' : 't'}${Date.now() % 100000}`; n.pieces.push({ id, kind, label: kind === 'us' ? String(count) : '' }); n.steps.forEach((st) => { st.positions[id] = { x: 32, y: 22 }; }); commit(n); };
  const addStep = () => { const n = clone(doc); const copy = clone(n.steps[si]); copy.arrows = []; n.steps.splice(si + 1, 0, copy); commit(n); setSi(si + 1); };
  const delStep = () => { if (doc.steps.length < 2) return; const n = clone(doc); n.steps.splice(si, 1); commit(n); setSi(Math.max(0, si - 1)); };
  const save = () => { put('strategies', { id: doc.id, name: doc.name, whyKids: doc.whyKids, coachNote, doc }); };
  const dash = { run: undefined, pass: '3 2', dribble: '1 1.5' } as const;
  const pts = useMemo(() => doc.pieces, [doc.pieces]);
  const saved = s.strategies;
  return (
    <Page title="Tactics board" back={<Back to="/more" />}>
      <div className="mb-2 flex flex-wrap gap-2">{(['move', 'run', 'pass', 'dribble', 'ball', 'erase'] as Tool[]).map((t) => <Chip key={t} on={tool === t} onClick={() => setTool(t)}>{t === 'move' ? 'Move' : t === 'run' ? 'Run' : t === 'pass' ? 'Pass' : t === 'dribble' ? 'Dribble' : t === 'ball' ? 'Give ball' : 'Erase'}</Chip>)}</div>
      {play ? <BoardView doc={doc} /> : (
        <Pitch format="h" svgRef={svg} onPointerDown={down} onPointerMove={move} onPointerUp={up}>
          <defs><marker id="ah2" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#F9F6EF" /></marker></defs>
          {step.arrows.map((a, i) => <line key={i} x1={a.from.x * SX} y1={a.from.y * SY} x2={a.to.x * SX} y2={a.to.y * SY} stroke="#F9F6EF" strokeWidth="1" strokeDasharray={dash[a.type]} markerEnd="url(#ah2)" />)}
          {draft && <line x1={draft.from.x * SX} y1={draft.from.y * SY} x2={draft.to.x * SX} y2={draft.to.y * SY} stroke="#C31E24" strokeWidth="1" strokeDasharray={dash[tool as 'run']} markerEnd="url(#ah2)" />}
          {pts.map((pc) => { const p = step.positions[pc.id]; if (!p) return null; const x = p.x * SX, y = p.y * SY; return pc.kind === 'us'
            ? <g key={pc.id}><circle cx={x} cy={y} r="4.6" fill="#C31E24" stroke="#fff" strokeWidth=".8" /><text x={x} y={y + 2.2} textAnchor="middle" fontSize="6" fill="#fff" fontFamily="Bebas Neue" style={{ pointerEvents: 'none' }}>{pc.label}</text></g>
            : <rect key={pc.id} x={x - 4} y={y - 4} width="8" height="8" rx="2" fill="#F9F6EF" stroke="#051A31" strokeWidth=".8" />; })}
          {step.ballWith && step.positions[step.ballWith] && <circle cx={step.positions[step.ballWith].x * SX + 5} cy={step.positions[step.ballWith].y * SY - 4} r="2" fill="#fff" stroke="#051A31" strokeWidth=".6" />}
        </Pitch>)}
      <p className="muted mt-2 text-xs">Solid arrow = run. Dashed = pass. Dotted = dribble. Red circles are us, cream squares are them. Drag an arrow from a player or from empty space.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {doc.steps.map((_, i) => <button key={i} className={`btn min-h-[44px] px-4 ${i === si ? '' : 'ghost'}`} onClick={() => { setSi(i); setPlay(false); }}>Step {i + 1}</button>)}
        <button className="btn ghost min-h-[44px]" onClick={addStep}>+ Step</button><button className="btn ghost min-h-[44px]" disabled={doc.steps.length < 2} onClick={delStep}>Delete step</button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2"><button className="btn ghost min-h-[44px]" onClick={() => addPiece('us')}>+ Our player</button><button className="btn ghost min-h-[44px]" onClick={() => addPiece('them')}>+ Opponent</button><button className="btn ghost min-h-[44px]" disabled={!hist.length} onClick={() => { setDoc(hist[hist.length - 1]); setHist(hist.slice(0, -1)); }}>Undo</button><button className="btn min-h-[44px]" onClick={() => setPlay(!play)}>{play ? 'Edit' : 'Play'}</button></div>
      <Card className="mt-4 grid gap-2">
        <input className="field" aria-label="Name" value={doc.name} onChange={(e) => setDoc({ ...doc, name: e.target.value })} />
        <input className="field" aria-label="Why it works (for the kids, 2 sentences)" placeholder="Why it works, in words for the kids" value={doc.whyKids} onChange={(e) => setDoc({ ...doc, whyKids: e.target.value })} />
        <input className="field" aria-label="Coach note" placeholder="Coach note (private)" value={coachNote} onChange={(e) => setCoachNote(e.target.value)} />
        <button className="btn h-14" disabled={!doc.name} onClick={save}>Save to my library</button>
      </Card>
      <H2>Start from</H2>
      <div className="flex flex-wrap gap-2">{PRESETS.map((p) => <button key={p.id} className="btn ghost min-h-[44px] px-4" onClick={() => { setDoc({ ...clone(p), id: uid(), name: p.name + ' (mine)' }); setSi(0); setHist([]); }}>{p.name}</button>)}<button className="btn ghost min-h-[44px] px-4" onClick={() => { setDoc(blank()); setSi(0); }}>Blank</button></div>
      <H2>My library</H2>
      {saved.length === 0 ? <p className="muted">Nothing saved yet.</p> : <ul className="grid gap-2">{saved.map((x) => <li key={x.id} className="card flex items-center justify-between gap-2 p-3"><button className="flex-1 text-left text-lg font-semibold" onClick={() => { setDoc(clone(x.doc)); setCoachNote(x.coachNote); setSi(0); }}>{x.name}</button><button className="btn ghost min-h-[44px]" onClick={() => confirm('Delete this move?') && del('strategies', x.id)}>Delete</button></li>)}</ul>}
    </Page>
  );
}
