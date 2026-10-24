import { useState } from 'react';
import { useRole } from '../lib/role';
import { EmergencyEditor } from '../components/Emergency';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Back, Card, Chip, Empty, H2, Page, Tone } from '../components/ui';
import { del, put, uid, update, useAppState } from '../lib/store';
import { PROGRAMMES, type Injury, type Player } from '../lib/model';
import { RUBRIC, SKILL_BADGES } from '../content/rubric';

import { growthVelocity } from '../lib/growth';
import { summarise } from '../lib/development';
import { today, ageOf } from '../lib/util';
import { cloudEnabled, createFamilyInvite, inviteLink, useCloud } from '../lib/cloud';
import { CONCUSSION } from '../content/safety';
import { bandOf, infoFor } from '../lib/school';
import { docsMissingFor, removeDocs } from '../components/Docs';
import { share } from '../lib/util';

export default function PlayerProfile() {
  const { id } = useParams(); const nav = useNavigate(); const s = useAppState(); const cloud = useCloud();
  const p = s.players.find((x) => x.id === id);
  const [invite, setInvite] = useState(''); const [err, setErr] = useState('');
  const [h, setH] = useState(''); const [goal, setGoal] = useState('');   // before the early return: hooks must run in the same order every time
  if (!p) return <Page title="Player" back={<Back to="/squad" />}><Empty>Player not found.</Empty></Page>;
  const team = s.teams.find((t) => t.id === p.teamId) ?? s.teams[0];
  const set = (patch: Partial<Player>) => put('players', { ...p, ...patch });
  const skills = RUBRIC[bandOf(p, team, infoFor(s.teamInfo, team.id))];
  const mine = s.assessments.filter((a) => a.playerId === p.id).sort((a, b) => a.term.localeCompare(b.term));
  const sum = mine.length ? summarise(skills, mine[mine.length - 1], mine[mine.length - 2]) : null;
  const growth = s.growth.filter((g) => g.playerId === p.id).sort((a, b) => b.date.localeCompare(a.date));
  const gv = growthVelocity(growth);
  const injuries = s.injuries.filter((i) => i.playerId === p.id).sort((a, b) => b.date.localeCompare(a.date));
  const pin = s.settings.headCoachPin;
  const role = useRole();
  const canClear = !cloudEnabled || role === 'admin' || s.myStaff.some((x) => x.teamId === p.teamId && x.head);
  const clear = (i: Injury) => {
    const entered = pin ? prompt('Head coach PIN') : '';
    if (pin && entered !== pin) return alert('That PIN is not right.');
    const earliest = new Date(Date.parse(i.date) + s.settings.concussionMinDays * 86400000).toISOString().slice(0, 10);
    const note = prompt(`Medical clearance noted (who cleared, and when). The child should not play a competitive match before ${earliest}.`);
    if (note === null) return;
    put('injuries', { ...i, clearedOn: today(), clearedNote: note });
  };
  const doInvite = async () => { setErr(''); try { setInvite(inviteLink(await createFamilyInvite(p.id))); } catch (e) { setErr((e as Error).message); } };
  return (
    <Page title={p.firstName} back={<Back to="/squad" />}>
      {s.blocked.includes(p.id) && <Tone tone="bad">Out after a head knock. Not available for lineups until a head coach records medical clearance.</Tone>}
      <H2>Details</H2>
      <Card className="grid gap-3">
        <div className="grid grid-cols-2 gap-2"><input className="field" aria-label="First name" value={p.firstName} onChange={(e) => set({ firstName: e.target.value })} /><input className="field" aria-label="Last name (coaches only)" placeholder="Last name (coaches only)" value={p.lastName ?? ''} onChange={(e) => set({ lastName: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-2"><input className="field" type="number" aria-label="Shirt number" placeholder="Shirt number" value={p.number ?? ''} onChange={(e) => set({ number: e.target.value ? +e.target.value : undefined })} /><input className="field" type="date" aria-label="Birth date" value={p.birthDate ?? ''} onChange={(e) => set({ birthDate: e.target.value })} /></div>
        {p.birthDate && <p className="muted text-sm">Age {ageOf(p.birthDate)}</p>}
        <label className="flex items-center gap-3"><input type="checkbox" className="h-6 w-6" checked={p.gkWilling} onChange={(e) => set({ gkWilling: e.target.checked })} />Happy to play in goal</label>
        <label className="flex items-center gap-3"><input type="checkbox" className="h-6 w-6" checked={p.photoConsent} onChange={(e) => set({ photoConsent: e.target.checked })} />Parent agreed to photo on team screens</label>
        {cloudEnabled ? <p className="text-sm">{p.videoConsent ? `Family agreed: ${p.firstName} may be in the club's how-to videos.` : `No video permission: do not film ${p.firstName} for how-to videos.`} <span className="muted">(The family changes this in their app.)</span></p>
          : <label className="flex items-center gap-3"><input type="checkbox" className="h-6 w-6" checked={!!p.videoConsent} onChange={(e) => set({ videoConsent: e.target.checked })} />Parent agreed to videos (how-to videos and the drill library)</label>}
        <label className="grid gap-1 text-sm font-semibold">Team<select className="field" value={p.teamId} onChange={(e) => set({ teamId: e.target.value })}>{s.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      </Card>

      <H2>Family link</H2>
      <Card className="grid gap-2">
        {cloudEnabled && cloud.status === 'ready' ? (<>
          <p>Create a private one-time link for this child's parent. It works once and expires in 14 days.</p>
          <button className="btn" onClick={doInvite} data-tour="invite">Create invite link</button>
          {invite && <><input className="field" readOnly value={invite} onFocus={(e) => e.target.select()} aria-label="Invite link" />
            <button className="btn ghost" onClick={() => share(`Hi! Here is ${p.firstName}'s private link for the Rangers app (it only works once, please don't share it): ${invite}`)}>Send it privately</button></>}
          {err && <p className="text-red" role="alert">{err}</p>}
        </>) : <p className="muted">Parent logins turn on when the club connects its online account (see the setup guide). Until then you can preview what a parent will see.</p>}
        <button className="btn ghost" onClick={() => { update((x) => ({ ...x, previewChildId: p.id })); nav('/'); }}>Preview as this child's parent</button>
      </Card>

      <H2>Development</H2>
      <Card className="grid gap-2">
        {sum ? <><p><b>Strengths:</b> {sum.strengths.map((x) => x.label).join(', ') || 'none yet'}</p><p><b>Working on:</b> {sum.working.map((x) => x.label).join(', ') || 'none yet'}</p>{sum.fastest && <p><b>Fastest developing:</b> {sum.fastest.label}</p>}</> : <p className="muted">No review yet.</p>}
        <Link className="btn" to={`/review/${p.id}`}>Term review</Link>
      </Card>
      <H2>Goal</H2>
      <Card className="grid gap-2">
        {s.goals.filter((g) => g.playerId === p.id).map((g) => <label key={g.id} className="flex items-center gap-3"><input type="checkbox" className="h-6 w-6" checked={g.status === 'done'} onChange={(e) => put('goals', { ...g, status: e.target.checked ? 'done' : 'active' })} /><span className={g.status === 'done' ? 'line-through' : ''}>{g.text}</span></label>)}
        <div className="flex gap-2"><input className="field" placeholder='The goal they chose, e.g. "Use my left foot in games"' value={goal} onChange={(e) => setGoal(e.target.value)} /><button className="btn" disabled={!goal.trim()} onClick={() => { put('goals', { id: uid(), playerId: p.id, text: goal.trim(), status: 'active', at: new Date().toISOString() }); setGoal(''); }}>Add</button></div>
      </Card>
      <H2>Recognition and badges</H2>
      <Card className="grid gap-3">
        <div className="flex flex-wrap gap-2">{PROGRAMMES[team.programme].values.map((v) => <button key={v} className="btn ghost min-h-[44px] px-3 text-sm" onClick={() => put('recognitions', { id: uid(), playerId: p.id, valueKey: v, note: '', at: new Date().toISOString() })}>+ {v}</button>)}</div>
        <p className="muted text-sm">Recognised {s.recognitions.filter((r) => r.playerId === p.id).length} times. Badges are for learning, never for goals or wins, and never promised in advance.</p>
        <select className="field" aria-label="Award a skill badge" value="" onChange={(e) => { if (e.target.value) put('badges', { id: uid(), playerId: p.id, badgeKey: e.target.value, at: new Date().toISOString() }); }}><option value="">Award a skill badge...</option>{SKILL_BADGES.filter((b) => !s.badges.some((x) => x.playerId === p.id && x.badgeKey === b)).map((b) => <option key={b}>{b}</option>)}</select>
        <div className="flex flex-wrap gap-2">{s.badges.filter((b) => b.playerId === p.id).map((b) => <span key={b.id} className="rounded-full border px-3 py-1" style={{ borderColor: 'var(--line)' }}>{b.badgeKey}</span>)}</div>
      </Card>

      <H2>Growth</H2>
      <Card className="grid gap-2">
        {gv.status === 'spurt' && <Tone tone="warn">Growing {gv.cmPerYear!.toFixed(1)} cm a year. Fewer jumps and flat-out sprints for a few weeks; watch for knee or heel pain; do not play through pain.</Tone>}
        {gv.status === 'remeasure' && <Tone tone="warn">That change looks odd. Please measure again (shoes off, same wall chart).</Tone>}
        {gv.status === 'ok' && <p>Growth {gv.cmPerYear!.toFixed(1)} cm a year: normal.</p>}
        {gv.status === 'not-enough-data' && <p className="muted">Measure every 3 months. Two measurements at least 8 weeks apart show the trend.</p>}
        <div className="flex gap-2"><input className="field" type="number" step="0.1" placeholder="Height in cm" aria-label="Height in cm" value={h} onChange={(e) => setH(e.target.value)} /><button className="btn" disabled={!h} onClick={() => { put('growth', { id: uid(), playerId: p.id, date: today(), heightCm: +h }); setH(''); }}>Save</button></div>
        <ul className="muted text-sm">{growth.slice(0, 4).map((g) => <li key={g.id}>{g.date}: {g.heightCm} cm</li>)}</ul>
      </Card>

      <H2>Health and safety</H2>
      <Card className="grid gap-3">
        <h3 className="text-2xl">Emergency information</h3>
        <EmergencyEditor p={p} />
        <h3 className="mt-2 text-2xl">ID papers</h3>
        <Link className="btn ghost" to={`/docs/${p.id}`}>{docsMissingFor(p).length === 0 ? 'Student ID and PSA birth certificate: view' : `${docsMissingFor(p).length === 2 ? 'Student ID and PSA birth certificate' : docsMissingFor(p)[0] === 'studentId' ? 'Student ID' : 'PSA birth certificate'} missing: add`}</Link>
        <h3 className="mt-2 text-2xl">Injuries</h3>
        {injuries.length === 0 && <p className="muted">None recorded.</p>}
        {injuries.map((i) => <div key={i.id} className="rounded-xl border p-3" style={{ borderColor: 'var(--line)' }}><b>{i.date}: {i.kind}</b> ({i.bodyPart}){i.head && <span className="text-red"> head injury</span>}<div className="text-sm">{i.notes}</div>{i.head && (i.clearedOn ? <div className="text-sm">Cleared {i.clearedOn}: {i.clearedNote}</div> : canClear ? <button className="btn ghost mt-2 min-h-[44px] text-sm" onClick={() => clear(i)}>Head coach: record medical clearance</button> : <p className="muted mt-2 text-sm">Only a head coach can record medical clearance.</p>)}</div>)}
        <Link className="btn ghost" to={`/safety?player=${p.id}`}>Record an injury or suspected head knock</Link>
        <p className="muted text-xs">{CONCUSSION.note}</p>
      </Card>
      <div className="mt-6"><button className="btn ghost" onClick={async () => { if (confirm(`Remove ${p.firstName} from the squad? Their ID paper photos are deleted; other records stay in your backup.`)) { const q = await removeDocs(p); put('players', { ...q, left: true, leftAt: new Date().toISOString() }); nav('/squad'); } }}>Mark as left the club</button> <button className="btn ghost" onClick={() => confirm(`Delete ${p.firstName} and everything about them? This cannot be undone.`) && (del('players', p.id), nav('/squad'))}>Delete completely</button></div>
    </Page>
  );
}
