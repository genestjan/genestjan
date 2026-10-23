import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Page } from '../components/ui';
import { update, useAppState, type Match, type MatchEvent } from '../lib/store';
import { clockSeconds, isEnded, isRunning, onField, playedFor, windowIndexAt } from '../lib/matchClock';
import { formatClock, owedSeconds } from '../lib/fairShare';
import { planFor } from '../lib/lineup';
import { FORMATS } from '../lib/types';

export default function Live() {
  const { id } = useParams();
  const { matches, players, blocked } = useAppState();
  const m = matches.find((x) => x.id === id);
  const [now, setNow] = useState(Date.now());
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  const lastWin = useRef(-1);
  const squad = useMemo(() => (m ? players.filter((p) => m.availableIds.includes(p.id) && !blocked.includes(p.id)) : []), [m, players, blocked]);
  const plan = useMemo(() => (m ? planFor({ ...m, availableIds: squad.map((p) => p.id) }, players) : null), [m, squad, players]);

  const log = m?.log ?? [];
  const sec = clockSeconds(log, now);
  const running = isRunning(log), ended = isEnded(log), started = log.some((e) => e.type === 'start');
  const wi = m ? windowIndexAt(m, sec) : 0;

  useEffect(() => { // buzz when a new sub window begins
    if (running && wi !== lastWin.current) { if (lastWin.current >= 0) navigator.vibrate?.([300, 120, 300]); lastWin.current = wi; }
  }, [wi, running]);

  if (!m || !plan) return <Page title="Match"><Link to="/" className="btn">Home</Link></Page>;
  const fmt = FORMATS[m.format];
  const add = (...evs: MatchEvent[]) => update((s) => ({ ...s, matches: s.matches.map((x) => (x.id === m.id ? { ...x, log: [...x.log, ...evs] } : x)) }));
  const T = Date.now();
  const on = onField(log);
  const present = squad.length;
  const win = plan.windows[Math.min(wi, plan.windows.length - 1)];
  const diff = (target: Record<string, string>) => {
    const offs = [...on].filter((pid) => target[pid] === 'BENCH' || !(pid in target));
    const ons = Object.entries(target).filter(([pid, r]) => r !== 'BENCH' && !on.has(pid)).map(([pid]) => pid);
    return { offs, ons };
  };
  const d = diff(win.roles);
  const nameOf = (pid: string) => players.find((p) => p.id === pid)?.firstName ?? '?';
  const kickoff = () => {
    const first = plan.windows[0].roles;
    add({ t: T, type: 'start' }, ...Object.entries(first).filter(([, r]) => r !== 'BENCH').map(([playerId]) => ({ t: T, type: 'on' as const, playerId })));
  };
  const applyPlan = () => add(...d.offs.map((playerId) => ({ t: T, type: 'off' as const, playerId })), ...d.ons.map((playerId) => ({ t: T, type: 'on' as const, playerId })));
  const tap = (pid: string) => {
    if (!running) return;
    if (!sel) { setSel(pid); return; }
    if (sel === pid) { setSel(null); return; }
    const a = on.has(sel), b = on.has(pid);
    if (a !== b) { const [out, inn] = a ? [sel, pid] : [pid, sel]; add({ t: T, type: 'off', playerId: out }, { t: T, type: 'on', playerId: inn }); }
    setSel(null);
  };
  const head = (pid: string) => {
    if (!confirm(`Suspected head injury for ${nameOf(pid)}? They come off now and stay out of lineups until a head coach clears them. If in doubt, sit them out.`)) return;
    add({ t: T, type: 'injury', playerId: pid, head: true }, ...(on.has(pid) ? [{ t: T, type: 'off' as const, playerId: pid }] : []));
    update((s) => ({ ...s, blocked: [...new Set([...s.blocked, pid])] }));
  };
  const field = squad.filter((p) => on.has(p.id)), bench = squad.filter((p) => !on.has(p.id))
    .sort((a, b) => owedSeconds(playedFor(log, b.id, now), sec, fmt.slots, present) - owedSeconds(playedFor(log, a.id, now), sec, fmt.slots, present));
  const nextBoundary = (wi + 1) * m.windowMinutes * 60;

  const Row = ({ pid, bench: isBench }: { pid: string; bench?: boolean }) => {
    const played = playedFor(log, pid, now), owed = owedSeconds(played, sec, fmt.slots, present);
    return (
      <div className={`card flex items-center gap-2 p-2 ${sel === pid ? 'ring-4 ring-red' : ''}`}>
        <button className="flex min-h-[56px] flex-1 items-center gap-3 text-left" onClick={() => tap(pid)}>
          <span className="display w-9 text-center text-3xl">{players.find((p) => p.id === pid)?.number}</span>
          <span className="flex-1 text-lg">{nameOf(pid)}</span>
          <span className="tabular-nums">{formatClock(played)}</span>
          {isBench && owed >= 60 && <span className="rounded-full bg-red px-2 text-sm text-white">owed {Math.floor(owed / 60)}m</span>}
        </button>
        <button className="btn ghost min-h-[56px] px-3" aria-label={`Head injury ${nameOf(pid)}`} onClick={() => head(pid)}>Head</button>
      </div>
    );
  };

  if (ended) {
    const rows = squad.map((p) => ({ name: p.firstName, min: Math.round(playedFor(log, p.id, now) / 60) }));
    const csv = ['Player,Minutes', ...rows.map((r) => `${r.name},${r.min}`)].join('\n');
    return (
      <Page title="Full time" back={<Link to="/" className="btn ghost">Home</Link>}>
        <div className="card mb-4 p-4">{rows.map((r) => <div key={r.name} className="flex justify-between py-1"><span>{r.name}</span><b>{r.min} min</b></div>)}</div>
        <div className="flex gap-2">
          <button className="btn flex-1" onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `${m.name}.csv`; a.click(); }}>Export CSV</button>
          <Link to={`/match/${m.id}/present`} className="btn ghost flex-1">Celebrate</Link>
        </div>
      </Page>
    );
  }

  return (
    <Page title={m.name} back={<Link to={`/match/${m.id}`} className="btn ghost">Setup</Link>}>
      <div className="card mb-3 flex items-center justify-between p-4">
        <span className="display text-7xl tabular-nums">{formatClock(sec)}</span>
        <div className="text-right"><div className="muted">Window {wi + 1} of {plan.windows.length}</div>{running && <div>Next change in {formatClock(Math.max(0, nextBoundary - sec))}</div>}</div>
      </div>
      {!started ? <button className="btn mb-3 h-16 w-full text-xl" onClick={kickoff}>Kick off</button> : (
        <div className="mb-3 grid grid-cols-2 gap-2">
          <button className="btn ghost h-14" onClick={() => add({ t: T, type: running ? 'pause' : 'resume' })}>{running ? 'Pause (break)' : 'Resume'}</button>
          <button className="btn ghost h-14" onClick={() => confirm('End the match?') && add({ t: T, type: 'end' })}>End match</button>
        </div>
      )}
      {running && (d.offs.length > 0 || d.ons.length > 0) && (
        <div className="card mb-3 border-red p-3">
          <div className="mb-1 font-semibold">Plan says:</div>
          <div>Off: {d.offs.map(nameOf).join(', ') || 'nobody'}</div><div>On: {d.ons.map(nameOf).join(', ') || 'nobody'}</div>
          <button className="btn mt-2 h-14 w-full" onClick={applyPlan}>Do these subs</button>
        </div>
      )}
      {started && <p className="muted mb-2 text-sm">Tap a player on the pitch, then a player on the bench to swap them.</p>}
      <h2 className="mb-1 text-2xl">On the pitch ({field.length})</h2>
      <div className="mb-3 grid gap-2">{field.map((p) => <Row key={p.id} pid={p.id} />)}</div>
      <h2 className="mb-1 text-2xl">Bench ({bench.length})</h2>
      <div className="mb-4 grid gap-2">{bench.map((p) => <Row key={p.id} pid={p.id} bench />)}</div>
      <Link to={`/match/${m.id}/present`} className="btn ghost w-full">Show the kids (half-time, lineup)</Link>
    </Page>
  );
}
