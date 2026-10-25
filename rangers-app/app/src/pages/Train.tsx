import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Back, Card, Chip, Empty, H2, Page, Tone } from '../components/ui';
import { EventWeather } from '../components/Wx';
import { activeTeam, put, teamPlayers, uid, useAppState } from '../lib/store';
import { DRILLS, type Drill } from '../content/drills';
import { THEMES } from '../lib/drills';
import { DrillCard } from './Drills';
import { CURRICULUM } from '../content/curriculum';
import { buildSession, currentTheme, eligible, waterBreaks } from '../lib/sessionBuilder';
import { HEAT_ACTIONS } from '../content/safety';
import type { AgeBand, SessionBlock, TrainingSession } from '../lib/model';
import { AGE_BANDS } from '../lib/model';
import { today } from '../lib/util';
import { formatClock } from '../lib/fairShare';
import { fetchWx, forEvent, YAM1 } from '../lib/weather';
import { heatCategory } from '../lib/heatIndex';

export const drillById = (id: string, custom: Drill[] = []) => [...DRILLS, ...custom].find((d) => d.id === id);

export default function Train() {
  const s = useAppState(); const nav = useNavigate(); const team = activeTeam(s); const kids = teamPlayers(s);
  const weeks = Math.floor((Date.now() - Date.parse(s.sessions.filter((x) => x.teamId === team.id).sort((a, b) => a.date.localeCompare(b.date))[0]?.date ?? today())) / (7 * 86400000));
  const sug = currentTheme(team.ageBand, weeks);
  const [band, setBand] = useState<AgeBand>(team.ageBand); const [players, setPlayers] = useState(Math.max(kids.length, 8)); const [minutes, setMinutes] = useState(75);
  const [theme, setTheme] = useState(sug.theme); const [eq, setEq] = useState({ ball: true, cones: true, bibs: false, goals: false });
  const [seed, setSeed] = useState(0);
  const equipment = useMemo(() => new Set(Object.entries(eq).filter(([, v]) => v).map(([k]) => k)), [eq]);
  const all = useMemo(() => [...DRILLS, ...s.drills], [s.drills]);
  const built = useMemo(() => buildSession({ band, players, minutes, theme, equipment, seed, allDrills: all }), [band, players, minutes, theme, equipment, seed, all]);
  const [blocks, setBlocks] = useState<SessionBlock[] | null>(null);
  const shown = blocks ?? built.blocks;
  const next = s.events.filter((e) => e.teamId === team.id && e.type === 'training' && !e.cancelled && Date.parse(e.endsAt) > Date.now()).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  const save = () => { const id = uid(); put('sessions', { id, teamId: team.id, eventId: next?.id, date: today(), band, minutes, theme, blocks: shown }); nav(`/train/run/${id}`); };
  return (
    <Page title="Train" actions={<Link className="btn ghost px-4" to="/drills">Drills</Link>}>
      <Card className="mb-3"><p className="muted text-sm">Curriculum, {team.ageBand}: block {Math.min(6, Math.floor(weeks / 2) + 1)} of 6</p><p className="text-xl font-semibold">{sug.title}</p></Card>
      {next && <Card className="mb-3"><p className="mb-2 font-semibold">Next training: {next.title}</p><EventWeather e={next} compact /></Card>}
      <Card className="grid gap-3">
        <div className="flex flex-wrap gap-2">{AGE_BANDS.map((b) => <Chip key={b} on={band === b} onClick={() => setBand(b)}>{b}</Chip>)}</div>
        <div className="grid grid-cols-2 gap-2"><label className="text-sm font-semibold">Children<input type="number" className="field" value={players} onChange={(e) => setPlayers(+e.target.value)} /></label><label className="text-sm font-semibold">Minutes<input type="number" className="field" value={minutes} step={5} onChange={(e) => setMinutes(+e.target.value)} /></label></div>
        <label className="text-sm font-semibold">Theme<select className="field" value={theme} onChange={(e) => setTheme(e.target.value)}>{THEMES.map((t) => <option key={t} value={t}>{t}{t === sug.theme ? ' (this fortnight)' : ''}</option>)}</select></label>
        <div><div className="mb-1 text-sm font-semibold">What do you have?</div><div className="flex flex-wrap gap-2">{(['ball', 'cones', 'bibs', 'goals'] as const).map((k) => <Chip key={k} on={eq[k]} onClick={() => setEq({ ...eq, [k]: !eq[k] })}>{k}</Chip>)}</div><p className="muted mt-1 text-xs">No cones? Use slippers or bottles. No bibs? Tuck shirts in. No balls? Share one between two.</p></div>
        <button className="btn ghost" onClick={() => { setSeed(seed + 1); setBlocks(null); }}>Shuffle drills</button>
      </Card>
      <H2>Your session</H2>
      {built.gaps.map((g) => <p key={g} className="mb-2 text-sm text-[#d98a00]">{g}</p>)}
      <ol className="grid gap-2">{shown.map((b, i) => { const d = b.drillId === 'huddle' ? null : drillById(b.drillId, s.drills); return (
        <li key={i} className="card p-3"><div className="flex items-baseline justify-between"><span className="muted text-sm">{b.slot}</span><span className="font-semibold">{b.minutes} min</span></div>
          {d ? <><Link to={`/drills/${d.id}`} className="text-xl font-semibold underline">{d.name}</Link><div className="text-sm">{d.how.slice(0, 110)}...</div>
            <select className="field mt-2 min-h-[44px] text-sm" aria-label={`Swap ${b.slot} drill`} value={d.id} onChange={(e) => setBlocks(shown.map((x, k) => (k === i ? { ...x, drillId: e.target.value } : x)))}>{[d, ...all.filter((x) => x.id !== d.id && eligible(x, { band, players, minutes, theme, equipment }))].map((x) => <option key={x.id} value={x.id}>{x.name}{'by' in x ? ' (our coaches)' : ''}</option>)}</select></>
            : <div className="text-xl font-semibold">Huddle</div>}</li>); })}</ol>
      <button className="btn mt-4 h-16 w-full text-xl" disabled={!shown.length} onClick={save}>Save and start</button>
      <H2>Past sessions</H2>
      {s.sessions.length === 0 ? <Empty>None yet.</Empty> : <ul className="grid gap-2">{[...s.sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map((x) => <li key={x.id}><Link to={`/train/run/${x.id}`} className="card flex justify-between p-3"><span>{x.date} · {x.band} · {x.theme}</span><span className="muted">{x.minutes} min</span></Link></li>)}</ul>}
    </Page>
  );
}

export function RunSession() {
  const { id } = useParams(); const s = useAppState(); const x = s.sessions.find((y) => y.id === id);
  const [i, setI] = useState(0); const [started, setStarted] = useState<number | null>(null); const [now, setNow] = useState(Date.now());
  const [heat, setHeat] = useState<number | null>(null); const [cat, setCat] = useState<keyof typeof HEAT_ACTIONS>('Normal');
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  useEffect(() => { fetchWx(YAM1.lat, YAM1.lng).then((h) => { const w = forEvent(h, new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 13), new Date(Date.now() + 10 * 3600000).toISOString().slice(0, 13)); if (w) { setHeat(w.maxHi); setCat(heatCategory(w.maxHi)); } }).catch(() => {}); }, []);
  useEffect(() => { let lock: { release: () => Promise<void> } | undefined; (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<typeof lock> } }).wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {}); return () => { void lock?.release(); }; }, []);
  if (!x) return <Page title="Session" back={<Back to="/train" />}><Empty>Session not found.</Empty></Page>;
  const b = x.blocks[i]; const d = b && b.drillId !== 'huddle' ? drillById(b.drillId, s.drills) : null;
  const elapsed = started ? Math.floor((now - started) / 1000) : 0; const blockStart = x.blocks.slice(0, i).reduce((a, k) => a + k.minutes * 60, 0);
  const inBlock = elapsed - blockStart; const left = b ? b.minutes * 60 - inBlock : 0;
  const act = HEAT_ACTIONS[cat]; const breaks = waterBreaks(x.minutes, act.breakEvery);
  const sinceBreak = act.breakEvery ? elapsed % (act.breakEvery * 60) : 0;
  useEffect(() => { if (started && left <= 0 && left > -2 && i < x.blocks.length - 1) { navigator.vibrate?.([300, 100, 300]); } }, [left, started, i, x.blocks.length]);
  return (
    <Page title={b ? b.slot : 'Done'} back={<Back to="/train" />}>
      {heat !== null && <div className="mb-3"><Tone tone={act.tone}>Heat index {heat}°C ({cat}). {act.breakEvery ? `Water break every ${act.breakEvery} min (${breaks} today).` : ''}</Tone></div>}
      {started && act.breakEvery && sinceBreak > (act.breakEvery - 1) * 60 && <div className="mb-3"><Tone tone="warn">Water break now.</Tone></div>}
      {!started ? <button className="btn h-16 w-full text-xl" onClick={() => setStarted(Date.now())}>Start the clock</button> : (
        <Card className="mb-3 text-center"><div className={`display text-8xl tabular-nums ${left < 0 ? 'text-red' : ''}`}>{left < 0 ? '+' : ''}{formatClock(Math.abs(left))}</div><div className="muted">of {b?.minutes ?? 0} min · session {formatClock(elapsed)} of {x.minutes}:00</div></Card>)}
      {b && (d ? (<>
        <h2 className="mb-2 text-3xl">{d.name}</h2><div className="mb-3"><DrillCard d={d} /></div></>) : (
        <Card className="mb-3 grid gap-2"><h2 className="text-3xl">Huddle</h2><ol className="list-decimal pl-5"><li>What was fun today?</li><li>What did you try that was new?</li><li>Recognise a child for a club value, and say why.</li><li>Next week's challenge: e.g. "20 sole rolls with your weaker foot".</li></ol><Link to="/recognise" className="btn">Recognise children</Link></Card>))}
      <div className="grid grid-cols-2 gap-2"><button className="btn ghost h-14" disabled={i === 0} onClick={() => setI(i - 1)}>Previous</button><button className="btn h-14" disabled={i >= x.blocks.length - 1} onClick={() => setI(i + 1)}>Next block</button></div>
      {i >= x.blocks.length - 1 && <Reflection x={x} />}
    </Page>
  );
}
function Reflection({ x }: { x: TrainingSession }) {
  const r = x.reflection ?? { energy: 'ok' as const, fun: 'yes' as const, note: '' };
  const set = (p: Partial<typeof r>) => put('sessions', { ...x, reflection: { ...r, ...p } });
  return (<><H2>How did it go?</H2><Card className="grid gap-3">
    <div><div className="mb-1 font-semibold">Energy</div><div className="flex gap-2">{(['low', 'ok', 'high'] as const).map((v) => <Chip key={v} on={x.reflection?.energy === v} onClick={() => set({ energy: v })}>{v}</Chip>)}</div></div>
    <div><div className="mb-1 font-semibold">Did the kids enjoy it?</div><div className="flex gap-2">{(['yes', 'partly', 'no'] as const).map((v) => <Chip key={v} on={x.reflection?.fun === v} onClick={() => set({ fun: v })}>{v}</Chip>)}</div></div>
    <input className="field" placeholder="One note for next time (optional)" value={r.note} onChange={(e) => set({ note: e.target.value })} /></Card></>);
}

export const CURR = CURRICULUM;
