import { useState } from 'react';
import { Back, Card, Chip, H2, Page, Tone } from '../components/ui';
import { activeTeam, del, put, teamPlayers, uid, useAppState } from '../lib/store';
import { PROGRAMMES, type Recognition } from '../lib/model';
import { needRecognition } from '../lib/development';
import { SAY_THIS } from '../content/safety';
import { fmtDate } from '../lib/util';

/** What each club value looks like on the pitch, so coaches can spot it quickly. */
const LOOKS_LIKE: Record<string, string> = {
  'Play With Your Heart': 'gave full effort and enjoyed it', Teamwork: 'helped or passed to a teammate', Sportsmanship: 'shook hands, helped an opponent up, accepted a decision',
  Perseverance: 'kept trying after a mistake', Respect: 'listened, was kind to others and the referee', Integrity: 'was honest, even when it cost them',
  Discipline: 'was on time, followed the plan', Community: 'helped set up, tidy up, or welcomed someone new',
  Mindset: 'stayed positive and kept learning', Attitude: 'brought good energy', Belief: 'tried something brave', Unity: 'brought the group together',
  Grind: 'worked hard on something difficult', Improve: 'got better at something', Learn: 'asked a question or tried feedback', Achieve: 'reached a goal they set',
};

/** Recognise a child in three steps: who, which value they showed, and why. Families see it on their Progress page. */
export default function Recognise() {
  const s = useAppState(); const team = activeTeam(s); const kids = teamPlayers(s); const values = PROGRAMMES[team.programme].values;
  const [who, setWho] = useState<string[]>([]); const [value, setValue] = useState(''); const [why, setWhy] = useState('');
  const [saved, setSaved] = useState<Recognition[]>([]);
  const nudge = needRecognition(kids.map((k) => k.id), s.recognitions, Date.now());
  const name = (id: string) => s.players.find((p) => p.id === id)?.firstName ?? '';
  const save = () => {
    const at = new Date().toISOString();
    const recs = who.map((playerId) => ({ id: uid(), playerId, valueKey: value, note: why.trim(), at }));
    recs.forEach((r) => put('recognitions', r)); setSaved(recs); setWho([]); setValue(''); setWhy('');
  };
  const undo = () => { saved.forEach((r) => del('recognitions', r.id)); setSaved([]); };
  const recent = s.recognitions.filter((r) => kids.some((k) => k.id === r.playerId)).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10);
  return (
    <Page title="Recognise" back={<Back to="/" />}>
      <p className="mb-3">Catch a child doing something good, tell them why, and their family sees it too.</p>
      {saved.length > 0 && <div className="mb-3"><Tone tone="ok">Saved: {saved.map((r) => name(r.playerId)).join(', ')} for {saved[0].valueKey}. Their families will see it on the Progress page. <button className="underline" onClick={undo}>Undo</button></Tone></div>}
      <H2>1. Who?</H2>
      {nudge.length > 0 && <p className="muted mb-2 text-sm">★ = not recognised in the last 6 weeks. Try to notice them next.</p>}
      <div className="grid grid-cols-2 gap-2" data-tour="rec-who">{kids.map((k) => { const on = who.includes(k.id); return (
        <button key={k.id} className={`btn min-h-[56px] ${on ? '' : 'ghost'}`} aria-pressed={on} onClick={() => setWho(on ? who.filter((x) => x !== k.id) : [...who, k.id])}>{k.firstName}{nudge.includes(k.id) ? ' ★' : ''}</button>); })}</div>
      <H2>2. What did they show?</H2>
      <div className="grid gap-2" data-tour="rec-value">{values.map((v) => (
        <button key={v} className={`btn justify-start text-left ${value === v ? '' : 'ghost'}`} aria-pressed={value === v} onClick={() => setValue(v)}><span><b>{v}</b>{LOOKS_LIKE[v] && <span className="block text-sm font-normal">{LOOKS_LIKE[v]}</span>}</span></button>))}</div>
      <H2>3. Why? (one line)</H2>
      <Card className="grid gap-2" tour="rec-why">
        <input className="field" aria-label="Why" placeholder="e.g. Ran back to help Ben after losing the ball" value={why} onChange={(e) => setWhy(e.target.value)} />
        <p className="muted text-sm">Be specific: "Great pass to Ben when he was free" means more than "good job".</p>
      </Card>
      <button className="btn mt-3 h-14 w-full" disabled={!who.length || !value} onClick={save} data-tour="rec-save">{!who.length ? 'Choose at least one child' : !value ? 'Choose what they showed' : `Recognise ${who.map(name).join(', ')}`}</button>
      {recent.length > 0 && <><H2>Recently recognised</H2><div className="grid gap-2">{recent.map((r) => (
        <div key={r.id} className="card flex items-start justify-between gap-2 p-3"><div><b>{name(r.playerId)}</b>: {r.valueKey}{r.note && <span className="block text-sm">"{r.note}"</span>}<span className="muted block text-xs">{fmtDate(r.at)}</span></div>
          <button className="btn ghost min-h-[40px] px-3 text-sm" aria-label={`Remove recognition for ${name(r.playerId)}`} onClick={() => confirm('Remove this recognition?') && del('recognitions', r.id)}>Remove</button></div>))}</div></>}
      <H2>Say this, not that</H2>
      <Card><ul className="grid gap-2">{SAY_THIS.map(([a, b]) => <li key={a}><span className="text-[#2e8b57]">Say:</span> {a}<br /><span className="muted">Not: {b}</span></li>)}</ul></Card>
    </Page>
  );
}
