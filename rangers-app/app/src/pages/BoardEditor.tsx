import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Eraser, Hand, Maximize2, Minimize2, Minus, Pencil, Play, Plus, Square, Trash2, Undo2, UserPlus } from 'lucide-react';
import { Back, Card, H2, Page, Pitch, Segmented } from '../components/ui';
import { Ball, ballAt, BoardView, Figure, INK, InkMarkers, OldArrows, Stripes, StrokePath } from '../components/BoardView';
import { activeTeam, del, put, uid, useAppState } from '../lib/store';
import { PRESETS } from '../lib/presets';
import { distToLine, fromView, nearestPiece, setup, simplify, strokeLength, toView, type BoardDoc, type Ink, type LineKind, type Pt, type Setup, type Step } from '../lib/board';

type Tool = 'move' | 'draw' | 'erase';
type Mode = 'free' | 'steps';
const O = 'v' as const;   // upright pitch: our goal at the bottom, as the coach holds the phone
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const fresh = (format: string, kind: Setup, mode: Mode): BoardDoc => {
  const s = setup(kind, format);
  return { id: uid(), name: mode === 'free' ? 'My drawing' : 'My move', format, whyKids: '', moveMs: 1200, holdMs: 1400, pieces: s.pieces, steps: [s.step], mode };
};
const HINT: Record<Tool, string> = {
  move: 'Drag a player or the ball to move it.',
  draw: 'Draw with your finger. Lift it to finish the line.',
  erase: 'Tap a line or a player to remove it.',
};
const TOOLS: [Tool, string, typeof Hand][] = [['move', 'Move', Hand], ['draw', 'Draw', Pencil], ['erase', 'Erase', Eraser]];
const KINDS: [LineKind, string][] = [['run', 'Run'], ['pass', 'Pass'], ['line', 'Line']];
const INKS: [Ink, string][] = [['yellow', 'Yellow'], ['white', 'White'], ['red', 'Red'], ['blue', 'Blue']];
const SETUPS: [Setup, string][] = [['empty', 'Empty pitch'], ['2v1', '2 v 1'], ['4v4', '4 v 4'], ['full', 'Full teams']];

const LineIcon = ({ kind }: { kind: LineKind }) => (
  <svg width="30" height="12" viewBox="0 0 30 12" aria-hidden="true"><line x1="2" y1="6" x2={kind === 'line' ? 28 : 22} y2="6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeDasharray={kind === 'pass' ? '4 3' : undefined} />{kind !== 'line' && <path d="M21 1.5 L28.5 6 L21 10.5 z" fill="currentColor" />}</svg>
);

export default function BoardEditor() {
  const s = useAppState(); const format = activeTeam(s)?.defaultFormat ?? '8v8';
  const [doc, setDoc] = useState<BoardDoc>(() => fresh(format, '2v1', 'free'));
  const [mode, setMode] = useState<Mode>('free');
  const [si, setSi] = useState(0); const [tool, setTool] = useState<Tool>('move');
  const [pen, setPen] = useState<{ kind: LineKind; ink: Ink }>({ kind: 'run', ink: 'yellow' });
  const [play, setPlay] = useState(false); const [coachNote, setCoachNote] = useState(''); const [saved, setSaved] = useState(false);
  const [hist, setHist] = useState<BoardDoc[]>([]);
  const [drag, setDrag] = useState<{ id: string; before: BoardDoc; moved: boolean } | null>(null);
  const [ballDrop, setBallDrop] = useState<Pt | null>(null);   // drawing units, while the ball is being dragged
  const [live, setLive] = useState<Pt[] | null>(null);
  const [full, setFull] = useState(false); const [fit, setFit] = useState<number>();
  const svg = useRef<SVGSVGElement>(null); const spot = useRef<HTMLDivElement>(null); const mid = 'be' + useId().replace(/:/g, '');
  const step = doc.steps[Math.min(si, doc.steps.length - 1)];
  const carrier = step.ballWith ? step.positions[step.ballWith] : undefined;
  const lines = (step.strokes?.length ?? 0) + step.arrows.length;

  const remember = (before: BoardDoc) => { setHist((h) => [...h.slice(-40), before]); setSaved(false); };
  const commit = (next: BoardDoc) => { remember(doc); setDoc(next); };
  const edit = (f: (st: Step, d: BoardDoc) => void) => { const n = clone(doc); f(n.steps[si], n); commit(n); };
  const viewAt = (e: React.PointerEvent): Pt => { const el = svg.current!; const p = el.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(el.getScreenCTM()!.inverse()); return { x: q.x, y: q.y }; };

  const down = (e: React.PointerEvent<SVGSVGElement>) => {
    if (play) return;
    e.preventDefault();   // no text selection or browser drag, which would cancel the line half way
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const v = viewAt(e), pt = fromView(v, O);
    if (tool === 'move') {
      if (carrier) { const b = ballAt(toView(carrier, O)); if (Math.hypot(b.x - v.x, b.y - v.y) < 4.5) { setDrag({ id: 'ball', before: doc, moved: false }); setBallDrop(v); return; } }
      const hit = nearestPiece(step, pt); if (hit) setDrag({ id: hit, before: doc, moved: false });
    } else if (tool === 'draw') setLive([pt]);
    else erase(pt);
  };
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    if (drag) {
      const v = viewAt(e);
      if (drag.id === 'ball') setBallDrop(v);
      else { const n = clone(doc); n.steps[si].positions[drag.id] = fromView(v, O); setDoc(n); }
      if (!drag.moved) setDrag({ ...drag, moved: true });
    } else if (live) {
      const pt = fromView(viewAt(e), O); const last = live[live.length - 1];
      if (Math.hypot(pt.x - last.x, pt.y - last.y) > 0.35) setLive([...live, pt]);
    }
  };
  const up = () => {
    if (drag) {
      if (drag.id === 'ball' && ballDrop) {
        const to = nearestPiece(step, fromView(ballDrop, O), 6);
        if (to && to !== step.ballWith) { remember(drag.before); const n = clone(doc); n.steps[si].ballWith = to; setDoc(n); }
        setBallDrop(null);
      } else if (drag.moved) remember(drag.before);
      setDrag(null);
    }
    if (live) {
      const pts = simplify(live);
      if (strokeLength(pts) >= 2) edit((st) => { st.strokes = [...(st.strokes ?? []), { pts, ink: pen.ink, kind: pen.kind }]; });
      setLive(null);
    }
  };
  const erase = (pt: Pt) => {
    let best: { d: number; run: () => void } | null = null;
    const offer = (d: number, max: number, run: () => void) => { if (d < max && (!best || d < best.d)) best = { d, run }; };
    (step.strokes ?? []).forEach((st, i) => offer(distToLine(pt, st.pts), 2.5, () => edit((x) => { x.strokes!.splice(i, 1); })));
    step.arrows.forEach((a, i) => offer(distToLine(pt, [a.from, a.to]), 2.5, () => edit((x) => { x.arrows.splice(i, 1); })));
    const hit = nearestPiece(step, pt, 3.5);
    if (hit) offer(Math.hypot(step.positions[hit].x - pt.x, step.positions[hit].y - pt.y), 3.5, () => edit((_, d) => {
      d.pieces = d.pieces.filter((p) => p.id !== hit);
      d.steps.forEach((st) => { delete st.positions[hit]; if (st.ballWith === hit) st.ballWith = undefined; });
    }));
    (best as { run: () => void } | null)?.run();
  };
  const addPiece = (kind: 'us' | 'them') => edit((_, d) => {
    const mine = d.pieces.filter((p) => p.kind === kind);
    const id = `${kind === 'us' ? 'u' : 't'}${Date.now() % 1000000}`;
    const label = kind === 'us' ? String(Math.max(0, ...mine.map((p) => Number(p.label) || 0)) + 1) : '';
    d.pieces.push({ id, kind, label });
    const at = { x: kind === 'us' ? 26 : 38, y: 6 + ((mine.length * 7) % 33) };
    d.steps.forEach((st) => { st.positions[id] = { ...at }; if (kind === 'us' && !st.ballWith) st.ballWith = id; });
  });
  const startWith = (k: Setup) => { commit({ ...fresh(format, k, mode), id: doc.id, name: doc.name, whyKids: doc.whyKids }); setSi(0); setPlay(false); };
  const addStep = () => { const n = clone(doc); const copy = clone(n.steps[si]); copy.arrows = []; copy.strokes = []; n.steps.splice(si + 1, 0, copy); commit(n); setSi(si + 1); setPlay(false); setTool('move'); };
  const delStep = () => { if (doc.steps.length < 2) return; const n = clone(doc); n.steps.splice(si, 1); commit(n); setSi(Math.max(0, si - 1)); };
  const undo = () => { if (!hist.length) return; setDoc(hist[hist.length - 1]); setHist(hist.slice(0, -1)); setSi((i) => Math.min(i, hist[hist.length - 1].steps.length - 1)); };
  const switchMode = (m: Mode) => { setMode(m); setPlay(false); if (m === 'free') setSi(Math.min(si, doc.steps.length - 1)); };
  const save = () => { const d = { ...doc, mode }; put('strategies', { id: d.id, name: d.name, whyKids: d.whyKids, coachNote, doc: d }); setSaved(true); };
  const open = (d: BoardDoc, note: string) => { setDoc(clone(d)); setMode(d.mode ?? (d.steps.length > 1 ? 'steps' : 'free')); setSi(0); setHist([]); setPlay(false); setCoachNote(note); setSaved(false); };
  const library = s.strategies;
  const hint = play ? 'Playing the move. Tap Stop to change it.'
    : mode === 'steps' && doc.steps.length < 2 && tool === 'move' ? 'Set where everyone starts. Then tap + for the next step and drag the players to where they go.'
    : mode === 'steps' && tool === 'move' ? `Step ${si + 1}: drag the players to where they go. Then tap Play.` : HINT[tool];
  // The whole pitch fits on the screen (no scrolling to reach our goal); the step buttons get room underneath.
  useLayoutEffect(() => {
    const measure = () => {
      const el = spot.current; if (!el) return;
      const top = el.getBoundingClientRect().top + (full ? 0 : window.scrollY);
      const below = full ? 8 : 76;
      setFit(Math.max(300, Math.min(window.innerHeight - top - below, 640)));
    };
    measure(); window.addEventListener('resize', measure); return () => window.removeEventListener('resize', measure);
  }, [full, mode, tool, play]);
  useEffect(() => { if (!full) return; const esc = (e: KeyboardEvent) => e.key === 'Escape' && setFull(false); window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc); }, [full]);

  return (
    <Page title="Tactics board" back={<Back to="/" />}>
      <div data-tour="board-mode"><Segmented value={mode} onChange={switchMode} label="Board type" options={[['free', 'Free draw'], ['steps', 'Step by step']]} /></div>
      <div className={full ? 'fixed inset-0 z-50 overflow-y-auto px-3 pb-3' : ''} style={full ? { background: 'var(--bg)', paddingTop: 'max(12px, env(safe-area-inset-top))' } : undefined}>
      <div className="grid grid-cols-6 gap-1.5" role="toolbar" aria-label="Board tools" data-tour="board-tools">
        {TOOLS.map(([t, l, Icon]) => <button key={t} className="tool" aria-pressed={tool === t && !play} onClick={() => { setTool(t); setPlay(false); }}><Icon size={22} aria-hidden="true" />{l}</button>)}
        <button className="tool" disabled={!hist.length} onClick={undo}><Undo2 size={22} aria-hidden="true" />Undo</button>
        <button className="tool" disabled={!lines} onClick={() => edit((st) => { st.strokes = []; st.arrows = []; })} aria-label="Clear the lines"><Trash2 size={22} aria-hidden="true" />Clear</button>
        <button className="tool" aria-pressed={full} onClick={() => setFull(!full)} aria-label={full ? 'Exit full screen' : 'Full screen'}>{full ? <Minimize2 size={22} aria-hidden="true" /> : <Maximize2 size={22} aria-hidden="true" />}{full ? 'Exit' : 'Big'}</button>
      </div>
      <div className="mt-1.5 min-h-[52px]">
        {tool === 'draw' && !play ? (
          <div className="grid grid-cols-7 gap-1.5">
            {KINDS.map(([k, l]) => <button key={k} className="tool min-h-[48px] gap-0.5 px-1" aria-pressed={pen.kind === k} onClick={() => setPen({ ...pen, kind: k })} aria-label={`${l} line`}><LineIcon kind={k} />{l}</button>)}
            {INKS.map(([c, l]) => <button key={c} aria-label={`${l} lines`} aria-pressed={pen.ink === c} onClick={() => setPen({ ...pen, ink: c })} className="swatch"><span style={{ background: INK[c] }} /></button>)}
          </div>
        ) : <p className="muted flex min-h-[52px] items-center text-sm" aria-live="polite">{hint}</p>}
      </div>
      {mode === 'steps' && (
        <div className="mb-1.5 flex items-center gap-1.5" role="group" aria-label="Steps">
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
            {doc.steps.map((_, i) => <button key={i} className="tool min-h-[48px] min-w-[48px] text-base" aria-label={`Step ${i + 1}`} aria-pressed={i === si && !play} onClick={() => { setSi(i); setPlay(false); }}>{i + 1}</button>)}
            <button className="tool min-h-[48px] min-w-[48px]" aria-label="Add step" onClick={addStep}><Plus size={22} aria-hidden="true" /></button>
            {doc.steps.length > 1 && <button className="tool min-h-[48px] min-w-[48px]" aria-label="Delete step" onClick={delStep}><Minus size={22} aria-hidden="true" /></button>}
          </div>
          <button className="btn min-h-[48px] shrink-0 px-4" disabled={doc.steps.length < 2} onClick={() => setPlay(!play)}>{play ? <><Square size={18} aria-hidden="true" />Stop</> : <><Play size={18} aria-hidden="true" />Play</>}</button>
        </div>
      )}
      <div ref={spot}>
      {play ? <BoardView doc={doc} orient={O} className="mx-auto block w-auto max-w-full" style={{ height: fit }} /> : (
        <Pitch format={O} svgRef={svg} className="mx-auto block w-auto max-w-full" style={{ height: fit }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label="Tactics board" data-tour="board-pitch">
          <Stripes orient={O} />
          <InkMarkers id={mid} />
          <OldArrows arrows={step.arrows} orient={O} id={mid} />
          {(step.strokes ?? []).map((st, i) => <StrokePath key={i} s={st} orient={O} id={mid} />)}
          {live && <StrokePath s={{ pts: live, ink: pen.ink, kind: pen.kind }} orient={O} id={mid} />}
          {tool === 'draw' && !live && !lines && <text x="50" y="58" textAnchor="middle" fontSize="5" fill="var(--text)" opacity=".55" style={{ pointerEvents: 'none' }}>Draw with your finger</text>}
          {doc.pieces.filter((pc) => step.positions[pc.id]).map((pc) => <Figure key={pc.id} at={toView(step.positions[pc.id], O)} piece={pc} active={drag?.id === pc.id} />)}
          {carrier && <Ball at={ballDrop ?? ballAt(toView(carrier, O))} />}
        </Pitch>)}
      </div>

      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button className="btn ghost min-h-[48px]" onClick={() => addPiece('us')}><UserPlus size={18} aria-hidden="true" />Our player</button>
        <button className="btn ghost min-h-[48px]" onClick={() => addPiece('them')}><UserPlus size={18} aria-hidden="true" />Opponent</button>
      </div>
      <H2>Start with</H2>
      <div className="grid grid-cols-2 gap-2">{SETUPS.map(([k, l]) => <button key={k} className="btn ghost min-h-[48px]" onClick={() => startWith(k)}>{k === 'full' ? `${l} (${format})` : l}</button>)}</div>
      <H2>Ready-made moves</H2>
      <div className="flex flex-wrap gap-2">{PRESETS.map((p) => <button key={p.id} className="btn ghost min-h-[48px] px-4" onClick={() => { open({ ...clone(p), id: uid(), name: p.name + ' (mine)', mode: 'steps' }, ''); }}>{p.name}</button>)}</div>
      <Card className="mt-4 grid gap-2">
        <input className="field" aria-label="Name" value={doc.name} onChange={(e) => { setDoc({ ...doc, name: e.target.value }); setSaved(false); }} />
        <input className="field" aria-label="Why it works (for the kids, 2 sentences)" placeholder="Why it works, in words for the kids" value={doc.whyKids} onChange={(e) => { setDoc({ ...doc, whyKids: e.target.value }); setSaved(false); }} />
        <input className="field" aria-label="Coach note" placeholder="Coach note (private)" value={coachNote} onChange={(e) => setCoachNote(e.target.value)} />
        <button className="btn h-14" disabled={!doc.name} onClick={save}>{saved ? 'Saved to my library' : 'Save to my library'}</button>
      </Card>
      <H2>My library</H2>
      {library.length === 0 ? <p className="muted">Nothing saved yet.</p> : <ul className="grid gap-2">{library.map((x) => (
        <li key={x.id} className="card flex items-center justify-between gap-2 p-3">
          <button className="flex-1 text-left" onClick={() => open(x.doc, x.coachNote)}><span className="block text-lg font-semibold">{x.name}</span><span className="muted text-sm">{(x.doc.mode ?? (x.doc.steps.length > 1 ? 'steps' : 'free')) === 'free' ? 'Free draw' : `Step by step, ${x.doc.steps.length} steps`}</span></button>
          <button className="btn ghost min-h-[44px]" onClick={() => { if (confirm(`Delete "${x.name}"?`)) del('strategies', x.id); }}>Delete</button>
        </li>))}</ul>}
    </Page>
  );
}
