import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAppState, update } from '../lib/store';
import { onField, clockSeconds } from '../lib/matchClock';
import { placeLineup, planFor } from '../lib/lineup';
import { PRESETS } from '../lib/presets';
import { BoardView } from '../components/BoardView';
import { Pitch } from '../components/ui';
import { formatClock } from '../lib/fairShare';
import { FORMATS } from '../lib/types';

const SLIDES = ['Lineup', 'Our 3 keys', 'The move', 'Our values', 'Half-time', 'Next on', 'Celebrate'] as const;

export default function Present() {
  const { id } = useParams();
  const { matches, players, blocked } = useAppState();
  const m = matches.find((x) => x.id === id);
  const [i, setI] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    let lock: { release: () => Promise<void> } | undefined;
    (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<typeof lock> } }).wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {});
    const key = (e: KeyboardEvent) => { if (e.key === 'ArrowRight' || e.key === ' ') setI((x) => Math.min(SLIDES.length - 1, x + 1)); if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1)); };
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('keydown', key); void lock?.release(); };
  }, []);
  if (!m) return <Link to="/" className="btn">Home</Link>;
  const squad = players.filter((p) => m.availableIds.includes(p.id) && !blocked.includes(p.id));
  const plan = planFor({ ...m, availableIds: squad.map((p) => p.id) }, players);
  const live = onField(m.log);
  const sec = clockSeconds(m.log, now);
  const win = plan.windows[Math.min(Math.floor(sec / 60 / m.windowMinutes), plan.windows.length - 1)];
  const nextWin = plan.windows[Math.min(Math.floor(sec / 60 / m.windowMinutes) + 1, plan.windows.length - 1)];
  const onPlayers = live.size ? squad.filter((p) => live.has(p.id)) : squad.filter((p) => win.roles[p.id] && win.roles[p.id] !== 'BENCH');
  const gk = Object.entries(win.roles).find(([, r]) => r === 'GK')?.[0];
  const placed = placeLineup(m, onPlayers, gk);
  const bench = squad.filter((p) => !onPlayers.includes(p));
  const doc = PRESETS.find((p) => p.id === m.moveKey) ?? PRESETS[0];
  const set = (patch: Partial<typeof m>) => update((s) => ({ ...s, matches: s.matches.map((x) => (x.id === m.id ? { ...x, ...patch } : x)) }));
  const comingOn = squad.filter((p) => nextWin.roles[p.id] !== 'BENCH' && !onPlayers.includes(p));
  const goingOff = onPlayers.filter((p) => nextWin.roles[p.id] === 'BENCH');
  const big = 'display leading-none';

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="flex items-center justify-between px-6 py-3">
        <Link to={`/match/${m.id}`} className="btn ghost">Close</Link>
        <div className={`${big} text-4xl`}>{SLIDES[i]}</div>
        <div className="flex gap-1">{SLIDES.map((_, k) => <button key={k} aria-label={`Slide ${k + 1}`} onClick={() => setI(k)} className={`h-4 w-4 rounded-full ${k === i ? 'bg-red' : 'bg-[var(--line)]'}`} />)}</div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4">
        {SLIDES[i] === 'Lineup' && (
          <div className="flex h-full w-full max-w-5xl items-center gap-6">
            <div className="flex h-full min-h-0 flex-1 justify-center"><Pitch format="v" className="h-full max-h-full w-auto">
              {placed.map((s) => <g key={s.player.id}><circle cx={s.x * 100} cy={(1 - s.y) * 150 + 5} r="7.5" fill="#C31E24" stroke="#fff" strokeWidth="1" /><text x={s.x * 100} y={(1 - s.y) * 150 + 9} textAnchor="middle" fontFamily="Bebas Neue" fontSize="12" fill="#fff">{s.player.number}</text><text x={s.x * 100} y={(1 - s.y) * 150 + 18} textAnchor="middle" fontFamily="Barlow" fontWeight="600" fontSize="6" fill="var(--text)">{s.player.firstName}</text></g>)}
            </Pitch></div>
            <div className="w-1/4"><h3 className="mb-2 text-3xl">Bench</h3>{bench.map((p) => <div key={p.id} className={`${big} mb-2 text-4xl`}>{p.number} {p.firstName}</div>)}</div>
          </div>
        )}
        {SLIDES[i] === 'Our 3 keys' && <ol className="space-y-6">{m.keys.map((k, n) => <li key={k} className={`${big} text-7xl`}><span className="text-red">{n + 1}</span> {k}</li>)}</ol>}
        {SLIDES[i] === 'The move' && <div className="w-full max-w-4xl"><BoardView doc={doc} /><p className="mt-4 text-center text-3xl font-semibold">{doc.whyKids}</p></div>}
        {SLIDES[i] === 'Our values' && <div className="text-center"><div className="muted mb-2 text-2xl">Today we focus on</div><div className={`${big} text-8xl text-red`}>{m.focusValue}</div><div className="mt-8 text-3xl">Mistake? Tap the badge. Play with your heart. Next play.</div></div>}
        {SLIDES[i] === 'Half-time' && (
          <div className="w-full max-w-3xl space-y-4">
            <div className="text-center text-3xl text-red">Ask them first: what is working?</div>
            <label className="block text-2xl">One thing going well<input className="field mt-1 text-2xl" value={m.halftimeGood} onChange={(e) => set({ halftimeGood: e.target.value })} /></label>
            <label className="block text-2xl">One thing to change<input className="field mt-1 text-2xl" value={m.halftimeChange} onChange={(e) => set({ halftimeChange: e.target.value })} /></label>
          </div>
        )}
        {SLIDES[i] === 'Next on' && (
          <div className="text-center"><div className={`${big} text-8xl tabular-nums`}>{formatClock(sec)}</div>
            <div className="mt-6 grid grid-cols-2 gap-10 text-4xl"><div><div className="muted">Coming on</div>{comingOn.map((p) => <div key={p.id} className={`${big} text-6xl`}>{p.number} {p.firstName}</div>)}</div><div><div className="muted">Coming off</div>{goingOff.map((p) => <div key={p.id} className={`${big} text-6xl`}>{p.number} {p.firstName}</div>)}</div></div></div>
        )}
        {SLIDES[i] === 'Celebrate' && (
          <div className="w-full max-w-3xl space-y-4 text-center"><div className="text-3xl text-red">One team moment, win or lose</div>
            <input className="field text-3xl" placeholder="e.g. Great teamwork on the third goal" value={m.celebrate} onChange={(e) => set({ celebrate: e.target.value })} />
            <div className={`${big} text-6xl`}>{m.celebrate}</div></div>
        )}
      </div>
      <div className="flex gap-3 p-4"><button className="btn ghost h-16 flex-1 text-xl" disabled={i === 0} onClick={() => setI(i - 1)}>Back</button><button className="btn h-16 flex-1 text-xl" disabled={i === SLIDES.length - 1} onClick={() => setI(i + 1)}>Next</button></div>
      <span className="sr-only">{FORMATS[m.format].label}</span>
    </div>
  );
}
