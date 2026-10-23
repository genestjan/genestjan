import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Back, Card, H2, Page, Tone } from '../components/ui';
import { put, teamPlayers, uid, useAppState } from '../lib/store';
import { CHECKLIST, CONCUSSION, HEADING, HEAT_ACTIONS, HEAT_ILLNESS, LIGHTNING } from '../content/safety';
import type { HeatCategory } from '../lib/heatIndex';
import { heatCategory, heatIndexC } from '../lib/heatIndex';
import { today } from '../lib/util';

export default function Safety() {
  const s = useAppState(); const [sp] = useSearchParams(); const kids = teamPlayers(s);
  const [pid, setPid] = useState(sp.get('player') ?? ''); const [step, setStep] = useState<'pick' | 'check' | 'record'>(pid ? 'check' : 'pick');
  const [flags, setFlags] = useState<Record<string, boolean>>({}); const [body, setBody] = useState('Head'); const [notes, setNotes] = useState(''); const [kind, setKind] = useState('Head knock');
  const [thunder, setThunder] = useState<number | null>(null); const [temp, setTemp] = useState(32); const [rh, setRh] = useState(70);
  const hi = heatIndexC(temp, rh); const cat: HeatCategory = heatCategory(hi);
  const kid = s.players.find((p) => p.id === pid);
  const red = CONCUSSION.redFlags.some((f) => flags['r' + f]); const any = [...CONCUSSION.signs, ...CONCUSSION.symptoms].some((f) => flags['s' + f]);
  const [now, setNow] = useState(Date.now()); useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const left = thunder ? Math.max(0, 30 * 60 - Math.floor((now - thunder) / 1000)) : 0;
  const record = (head: boolean) => { if (!kid) return; put('injuries', { id: uid(), playerId: kid.id, date: today(), kind: head ? 'Suspected head injury' : kind, bodyPart: head ? 'Head' : body, notes, head, familyNotified: false }); setStep('pick'); setPid(''); setFlags({}); setNotes(''); };
  return (
    <Page title="Safety" back={<Back to="/more" />}>
      <H2>Head knock</H2>
      <Card className="grid gap-3">
        {step === 'pick' && <><p>Someone took a knock to the head? Pick the child. <b>If in doubt, sit them out.</b></p><div className="flex flex-wrap gap-2">{kids.map((k) => <button key={k.id} className="btn ghost px-4" onClick={() => { setPid(k.id); setStep('check'); }}>{k.firstName}</button>)}</div></>}
        {step === 'check' && kid && (<>
          <h3 className="text-2xl">{kid.firstName}: check now</h3>
          <p className="font-semibold">Red flags: call for medical help immediately.</p>
          <ul className="grid gap-1">{CONCUSSION.redFlags.map((f) => <li key={f}><label className="flex items-center gap-3"><input type="checkbox" className="h-6 w-6" checked={!!flags['r' + f]} onChange={(e) => setFlags({ ...flags, ['r' + f]: e.target.checked })} />{f}</label></li>)}</ul>
          {red && <Tone tone="bad">Call for medical help now. Do not move the child unless they are in danger. Stay with them and contact their family.</Tone>}
          <p className="font-semibold">Signs and symptoms: any one means they stop for the day.</p>
          <ul className="grid gap-1">{[...CONCUSSION.signs, ...CONCUSSION.symptoms].map((f) => <li key={f}><label className="flex items-center gap-3"><input type="checkbox" className="h-6 w-6" checked={!!flags['s' + f]} onChange={(e) => setFlags({ ...flags, ['s' + f]: e.target.checked })} />{f}</label></li>)}</ul>
          {(any || red) && <Tone tone="bad">{kid.firstName} is out for the rest of today and cannot be in any lineup until a head coach records medical clearance. Not a competitive match within {s.settings.concussionMinDays} days. Never leave them alone; hand over to a parent or guardian.</Tone>}
          <textarea className="field py-3" rows={2} placeholder="What happened?" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button className="btn h-14" onClick={() => record(true)}>Record head injury and take {kid.firstName} out</button>
          <button className="btn ghost" onClick={() => setStep('record')}>Not a head injury: record another injury</button><button className="btn ghost" onClick={() => { setStep('pick'); setPid(''); }}>Cancel</button>
          <p className="muted text-xs">{CONCUSSION.note}</p></>)}
        {step === 'record' && kid && (<><h3 className="text-2xl">Injury for {kid.firstName}</h3><input className="field" aria-label="What kind" value={kind} onChange={(e) => setKind(e.target.value)} /><input className="field" aria-label="Body part" value={body} onChange={(e) => setBody(e.target.value)} /><textarea className="field py-3" rows={2} placeholder="Notes and what you did" value={notes} onChange={(e) => setNotes(e.target.value)} /><button className="btn h-14" onClick={() => record(false)}>Save</button></>)}
        {s.blocked.length > 0 && <p className="text-red">Currently out: {s.players.filter((p) => s.blocked.includes(p.id)).map((p) => p.firstName).join(', ')}. Clear from the child's Health section.</p>}
      </Card>

      <H2>Heat check</H2>
      <Card className="grid gap-3">
        <div className="grid grid-cols-2 gap-2"><label className="text-sm">Air temperature °C<input type="number" className="field" value={temp} onChange={(e) => setTemp(+e.target.value)} /></label><label className="text-sm">Humidity %<input type="number" className="field" value={rh} onChange={(e) => setRh(+e.target.value)} /></label></div>
        <Tone tone={HEAT_ACTIONS[cat].tone}>Heat index {hi}°C: {cat}</Tone><p>{HEAT_ACTIONS[cat].text}</p>
        <p className="muted text-sm"><b>If a child feels unwell:</b> {HEAT_ILLNESS}</p>
      </Card>

      <H2>Thunder</H2>
      <Card className="grid gap-3"><p>{LIGHTNING}</p>
        <button className="btn h-14" onClick={() => setThunder(Date.now())}>Thunder heard: start 30-minute clock</button>
        {thunder && <Tone tone={left > 0 ? 'bad' : 'ok'}>{left > 0 ? `Stay inside. Restart in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} (resets if you hear thunder again).` : 'Thirty minutes since the last thunder. Safe to restart.'}</Tone>}</Card>

      <H2>Heading</H2>
      <Card><ul className="grid gap-1">{HEADING.map((h) => <li key={h.max}><b>Up to U{h.max}:</b> {h.text}</li>)}</ul><p className="muted mt-2 text-sm">Follows The FA's approach. Drills with heading are hidden for younger ages automatically.</p></Card>

      <H2>Before every session</H2>
      <Card><ul className="grid gap-2">{CHECKLIST.map((c) => <li key={c}><label className="flex items-center gap-3"><input type="checkbox" className="h-6 w-6" />{c}</label></li>)}</ul></Card>
    </Page>
  );
}
