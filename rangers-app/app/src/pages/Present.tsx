import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { put, useAppState } from '../lib/store';
import { onField, clockSeconds } from '../lib/matchClock';
import { placeLineup, usePlan } from '../lib/lineup';
import { PRESETS } from '../lib/presets';
import { SLIDES, SlideView, type SlideData } from '../components/Slides';
import { cloudEnabled, sb } from '../lib/cloud';
import type { BoardDoc } from '../lib/board';

export default function Present() {
  const { id } = useParams(); const s = useAppState();
  const m = s.matches.find((x) => x.id === id);
  const [i, setI] = useState(0); const [now, setNow] = useState(Date.now()); const [code, setCode] = useState('');
  const chan = useRef<{ send: (m: unknown) => unknown; unsubscribe: () => unknown } | null>(null);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    let lock: { release: () => Promise<void> } | undefined;
    (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<typeof lock> } }).wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {});
    const key = (e: KeyboardEvent) => { if (e.key === 'ArrowRight' || e.key === ' ') setI((x) => Math.min(SLIDES.length - 1, x + 1)); if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1)); };
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('keydown', key); void lock?.release(); };
  }, []);

  const plan = usePlan(m, s.players, s.blocked);
  const data = useMemo<SlideData | null>(() => {
    if (!m || !plan) return null;
    const squad = s.players.filter((p) => m.availableIds.includes(p.id) && !s.blocked.includes(p.id));
    const live = onField(m.log); const sec = clockSeconds(m.log, now);
    const wi = Math.floor(sec / 60 / m.windowMinutes);
    const win = plan.windows[Math.min(wi, plan.windows.length - 1)]; const nextWin = plan.windows[Math.min(wi + 1, plan.windows.length - 1)];
    if (!win) return null;
    const onPlayers = live.size ? squad.filter((p) => live.has(p.id)) : squad.filter((p) => win.roles[p.id] && win.roles[p.id] !== 'BENCH');
    const gk = Object.entries(win.roles).find(([, r]) => r === 'GK')?.[0];
    const kid = (p: { id: string; firstName: string; number?: number }) => ({ id: p.id, name: p.firstName, number: p.number });
    const custom = s.strategies.find((x) => x.id === m.moveKey)?.doc as BoardDoc | undefined;
    return {
      teamName: s.teams.find((t) => t.id === m.teamId)?.name ?? 'Rangers', placed: placeLineup(m, onPlayers, gk).map((p) => ({ ...kid(p.player), x: p.x, y: p.y })),
      bench: squad.filter((p) => !onPlayers.includes(p)).map(kid), keys: m.keys, doc: custom ?? PRESETS.find((p) => p.id === m.moveKey) ?? PRESETS[0], focusValue: m.focusValue,
      halftimeGood: m.halftimeGood, halftimeChange: m.halftimeChange, celebrate: m.celebrate,
      comingOn: squad.filter((p) => nextWin.roles[p.id] !== 'BENCH' && !onPlayers.includes(p)).map(kid), goingOff: onPlayers.filter((p) => nextWin.roles[p.id] === 'BENCH').map(kid), clockSec: sec,
    };
  }, [m, plan, s.players, s.blocked, s.strategies, s.teams, now]);

  // TV link: kid-facing data only (first names, numbers, slide text), sent over a short-lived broadcast channel.
  const link = async () => {
    const c = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
    const client = await sb(); const ch = client.channel('tv-' + c); await new Promise<void>((r) => ch.subscribe((st) => st === 'SUBSCRIBED' && r())); chan.current = ch as never; setCode(c);
  };
  useEffect(() => { if (code && chan.current && data) void chan.current.send({ type: 'broadcast', event: 'slide', payload: { i, data } }); }, [code, i, data]);
  useEffect(() => () => { void chan.current?.unsubscribe(); }, []);

  if (!m || !data) return <div className="p-6"><Link to="/" className="btn">Home</Link><p className="mt-3">Add players and set up the match first.</p></div>;
  const edit = (p: Partial<typeof m>) => put('matches', { ...m, ...p });
  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex gap-2"><Link to={`/match/${m.id}`} className="btn ghost">Close</Link>{cloudEnabled && (code ? <span className="btn ghost">TV code {code}</span> : <button className="btn ghost" onClick={link}>TV link</button>)}</div>
        <div className="display text-4xl">{SLIDES[i]}</div>
        <div className="flex gap-1">{SLIDES.map((_, k) => <button key={k} aria-label={`Slide ${k + 1}`} onClick={() => setI(k)} className={`h-4 w-4 rounded-full ${k === i ? 'bg-red' : 'bg-[var(--line)]'}`} />)}</div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4"><SlideView d={data} i={i} edit={edit} /></div>
      <div className="flex gap-3 p-4"><button className="btn ghost h-16 flex-1 text-xl" disabled={i === 0} onClick={() => setI(i - 1)}>Back</button><button className="btn h-16 flex-1 text-xl" disabled={i === SLIDES.length - 1} onClick={() => setI(i + 1)}>Next</button></div>
    </div>
  );
}
