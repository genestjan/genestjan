import { useState } from 'react';
import { Back, Card, Chip, H2, Page } from '../components/ui';
import { activeTeam, put, teamPlayers, uid, useAppState } from '../lib/store';
import { PROGRAMMES } from '../lib/model';
import { needRecognition } from '../lib/development';
import { SAY_THIS } from '../content/safety';

export default function Recognise() {
  const s = useAppState(); const team = activeTeam(s); const kids = teamPlayers(s); const values = PROGRAMMES[team.programme].values;
  const [value, setValue] = useState(values[0]); const [done, setDone] = useState<string[]>([]);
  const nudge = needRecognition(kids.map((k) => k.id), s.recognitions, Date.now());
  return (
    <Page title="Recognise" back={<Back to="/squad" />}>
      <p className="mb-3">Pick a value, then tap the children who showed it today. Be specific when you tell them why.</p>
      <div className="mb-4 flex flex-wrap gap-2">{values.map((v) => <Chip key={v} on={value === v} onClick={() => setValue(v)}>{v}</Chip>)}</div>
      <div className="grid grid-cols-2 gap-2">{kids.map((k) => { const need = nudge.includes(k.id); const did = done.includes(k.id); return (
        <button key={k.id} className={`btn min-h-[56px] ${did ? '' : 'ghost'}`} aria-pressed={did} onClick={() => { if (!did) { put('recognitions', { id: uid(), playerId: k.id, valueKey: value, note: '', at: new Date().toISOString() }); setDone([...done, k.id]); } }}>{k.firstName}{need && !did && <span className="ml-1 text-xs">(not for a while)</span>}</button>); })}</div>
      <H2>Say this, not that</H2>
      <Card><ul className="grid gap-2">{SAY_THIS.map(([a, b]) => <li key={a}><span className="text-[#2e8b57]">Say:</span> {a}<br /><span className="muted">Not: {b}</span></li>)}</ul></Card>
    </Page>
  );
}
