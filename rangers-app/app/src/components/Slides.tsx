import { BoardView } from './BoardView';
import { Pitch } from './ui';
import type { BoardDoc } from '../lib/board';
import { formatClock } from '../lib/fairShare';

export const SLIDES = ['Lineup', 'Our 3 keys', 'The move', 'Our values', 'Half-time', 'Next on', 'Celebrate'] as const;
export interface Kid { id: string; name: string; number?: number }
export interface SlideData {
  teamName: string; placed: (Kid & { x: number; y: number })[]; bench: Kid[]; keys: string[]; doc: BoardDoc;
  focusValue: string; halftimeGood: string; halftimeChange: string; celebrate: string; comingOn: Kid[]; goingOff: Kid[]; clockSec: number;
}
const big = 'display leading-none';
export function SlideView({ d, i, edit }: { d: SlideData; i: number; edit?: (p: Partial<Pick<SlideData, 'halftimeGood' | 'halftimeChange' | 'celebrate'>>) => void }) {
  const s = SLIDES[i];
  if (s === 'Lineup') return (
    <div className="flex h-full w-full max-w-5xl items-center gap-6">
      <div className="flex h-full min-h-0 flex-1 justify-center"><Pitch format="v" className="h-full max-h-full w-auto">
        {d.placed.map((p) => <g key={p.id}><circle cx={p.x * 100} cy={(1 - p.y) * 150 + 5} r="7.5" fill="#C31E24" stroke="#fff" strokeWidth="1" /><text x={p.x * 100} y={(1 - p.y) * 150 + 9} textAnchor="middle" fontFamily="Bebas Neue" fontSize="12" fill="#fff">{p.number}</text><text x={p.x * 100} y={(1 - p.y) * 150 + 18} textAnchor="middle" fontFamily="Barlow" fontWeight="600" fontSize="6" fill="var(--text)">{p.name}</text></g>)}
      </Pitch></div>
      <div className="w-1/4"><h3 className="mb-2 text-3xl">Bench</h3>{d.bench.map((p) => <div key={p.id} className={`${big} mb-2 text-4xl`}>{p.number} {p.name}</div>)}</div>
    </div>);
  if (s === 'Our 3 keys') return <ol className="space-y-6">{d.keys.map((k, n) => <li key={k} className={`${big} text-7xl`}><span className="text-red">{n + 1}</span> {k}</li>)}</ol>;
  if (s === 'The move') return <div className="w-full max-w-4xl"><BoardView doc={d.doc} /><p className="mt-4 text-center text-3xl font-semibold">{d.doc.whyKids}</p></div>;
  if (s === 'Our values') return <div className="text-center"><div className="muted mb-2 text-2xl">Today we focus on</div><div className={`${big} text-8xl text-red`}>{d.focusValue}</div><div className="mt-8 text-3xl">Mistake? Tap the badge. Play with your heart. Next play.</div></div>;
  if (s === 'Half-time') return (
    <div className="w-full max-w-3xl space-y-4"><div className="text-center text-3xl text-red">Ask them first: what is working?</div>
      {edit ? <><label className="block text-2xl">One thing going well<input className="field mt-1 text-2xl" value={d.halftimeGood} onChange={(e) => edit({ halftimeGood: e.target.value })} /></label><label className="block text-2xl">One thing to change<input className="field mt-1 text-2xl" value={d.halftimeChange} onChange={(e) => edit({ halftimeChange: e.target.value })} /></label></>
        : <><div className={`${big} text-6xl`}>Going well: {d.halftimeGood}</div><div className={`${big} text-6xl`}>Change: {d.halftimeChange}</div></>}</div>);
  if (s === 'Next on') return (
    <div className="text-center"><div className={`${big} text-8xl tabular-nums`}>{formatClock(d.clockSec)}</div>
      <div className="mt-6 grid grid-cols-2 gap-10 text-4xl"><div><div className="muted">Coming on</div>{d.comingOn.map((p) => <div key={p.id} className={`${big} text-6xl`}>{p.number} {p.name}</div>)}</div><div><div className="muted">Coming off</div>{d.goingOff.map((p) => <div key={p.id} className={`${big} text-6xl`}>{p.number} {p.name}</div>)}</div></div></div>);
  return (
    <div className="w-full max-w-3xl space-y-4 text-center"><div className="text-3xl text-red">One team moment, win or lose</div>
      {edit && <input className="field text-3xl" placeholder="e.g. Great teamwork on the third goal" value={d.celebrate} onChange={(e) => edit({ celebrate: e.target.value })} />}
      <div className={`${big} text-6xl`}>{d.celebrate}</div></div>);
}
