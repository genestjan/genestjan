import { Link, useParams } from 'react-router-dom';
import { Back, Card, Chip, Empty, H2, Page, Tone } from '../components/ui';
import { MediaView } from '../components/MediaView';
import { activeTeam, put, teamPlayers, useAppState } from '../lib/store';
import { derivedId } from '../lib/syncMap';
import { AGE_FIT_TEXT, DISTRICTS, LEVELS, SCREENING_DOCS, STAGE_TEXT, ageFit, ageOn, birthOf, docsMissing, infoFor, ladder, levelName, newTeamInfo } from '../lib/school';
import { isStaff, useMyChildren, useRole } from '../lib/role';
import { fmtDate } from '../lib/util';
import type { Eligibility, MeetLevel, Player, TeamInfo } from '../lib/model';

const elId = (playerId: string) => derivedId(playerId, 'elig');
const blankElig = (playerId: string): Eligibility => ({ id: elId(playerId), playerId, category: '', docs: {}, selectedFor: [], note: '' });

/** In More > Settings: mark a team as a DepEd school team, with its school details and age cutoffs. */
export function SchoolSettings({ teamId }: { teamId: string }) {
  const s = useAppState();
  const info = infoFor(s.teamInfo, teamId) ?? newTeamInfo(teamId, derivedId(teamId, 'info'));
  const set = (p: Partial<TeamInfo>) => put('teamInfo', { ...info, ...p });
  const F = (label: string, key: 'schoolName' | 'coordinator' | 'coordinatorPhone', ph = '', mode?: 'tel') => (
    <label className="grid gap-1 text-sm font-semibold">{label}<input className="field" inputMode={mode} placeholder={ph} value={info[key]} onChange={(e) => set({ [key]: e.target.value })} /></label>);
  return (
    <Card className="grid gap-3" tour="school-settings">
      <label className="flex items-center gap-3"><input type="checkbox" className="h-6 w-6" checked={info.kind === 'school'} onChange={(e) => set({ kind: e.target.checked ? 'school' : 'club' })} />School team (DepEd), for example SPED Rangers</label>
      <label className="flex items-center gap-3"><input type="checkbox" className="h-6 w-6" checked={info.mixedAges} onChange={(e) => set({ mixedAges: e.target.checked })} />Mixed ages (each child's review uses their own age group, from their birthday)</label>
      {info.kind === 'school' && (<>
        {F('School', 'schoolName', 'e.g. GSC SPED Integrated School')}
        <label className="grid gap-1 text-sm font-semibold">DepEd district<select className="field" value={info.district} onChange={(e) => set({ district: e.target.value })}><option value="">Choose</option>{DISTRICTS.map((d) => <option key={d}>{d}</option>)}</select></label>
        {F('School coordinator or MAPEH teacher', 'coordinator', 'Name')}
        {F('Their phone number', 'coordinatorPhone', '09...', 'tel')}
        <label className="grid gap-1 text-sm font-semibold">Competition categories (separate with commas)
          <input className="field" value={info.categories.join(', ')} onChange={(e) => set({ categories: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></label>
        <p className="text-sm font-semibold">Age cutoff for each category: "born on or after"</p>
        {info.categories.map((c) => (
          <label key={c} className="grid grid-cols-2 items-center gap-2 text-sm">{c}<input type="date" className="field" aria-label={`Cutoff for ${c}`} value={info.cutoffs[c] ?? ''} onChange={(e) => set({ cutoffs: { ...info.cutoffs, [c]: e.target.value } })} /></label>))}
        <p className="muted text-sm">Copy these dates from the current DepEd memorandum for the meet, and check them every school year. The app only compares birthdays with them.</p>
      </>)}
    </Card>
  );
}

const STATE_TONE: Record<string, string> = { champion: 'text-red font-semibold', qualified: 'text-red font-semibold', next: 'font-semibold', out: 'muted', placed: 'font-semibold', played: '', 'not-yet': 'muted' };

/** The Road to Palaro: where the team is on the DepEd ladder, and each child's screening papers. */
export function Pathway() {
  const s = useAppState(); const role = useRole(); const staff = isStaff(role); const kids = useMyChildren();
  const team = staff ? activeTeam(s) : s.teams.find((t) => kids.some((k) => k.teamId === t.id)) ?? activeTeam(s);
  const info = infoFor(s.teamInfo, team.id);
  if (info?.kind !== 'school') return (
    <Page title="Road to Palaro" back={<Back to={staff ? '/' : '/more'} />}>
      <Empty>{staff ? <>This is for school teams. Turn on "School team (DepEd)" for {team.name} in <Link className="underline" to="/settings">More, Settings</Link>.</> : 'Your child\'s team is not a school team.'}</Empty>
    </Page>);
  const stages = ladder(s.events, team.id);
  const players = staff ? teamPlayers(s, team.id) : kids.filter((k) => k.teamId === team.id);
  return (
    <Page title="Road to Palaro" back={<Back to={staff ? '/' : '/more'} />}>
      <Card className="mb-3 grid gap-1">
        <div className="text-xl font-semibold">{team.name}</div>
        <div className="muted">{[info.schoolName, info.district && `${info.district} District`].filter(Boolean).join(' · ') || 'Add the school details in More, Settings.'}</div>
        {info.coordinator && <div>Coordinator: {info.coordinator}{info.coordinatorPhone && <> · <a className="underline" href={`tel:${info.coordinatorPhone}`}>{info.coordinatorPhone}</a></>}</div>}
      </Card>
      <H2>The ladder this school year</H2>
      <ol className="grid gap-2" data-tour="ladder">
        {stages.map((st, i) => (
          <li key={st.level} className="card grid gap-1 p-4">
            <div className="flex items-start justify-between gap-2"><div className="text-lg font-semibold">{i + 1}. {st.name}</div><span className={`shrink-0 text-sm ${STATE_TONE[st.state]}`}>{STAGE_TEXT[st.state]}</span></div>
            <p className="muted text-sm">{st.what}</p>
            {st.next && <Link className="underline" to={`/event/${st.next.id}`}>Next: {fmtDate(st.next.startsAt)}{st.next.venue ? `, ${st.next.venue}` : ''}{st.next.category ? ` (${st.next.category})` : ''}</Link>}
            {st.last && !st.next && <Link className="underline" to={`/event/${st.last.id}`}>{fmtDate(st.last.startsAt)}{st.last.resultNote ? `: ${st.last.resultNote}` : ''}</Link>}
            {staff && <Link className="btn ghost mt-1 min-h-[44px] text-sm" to={`/event/new?meet=${st.level}`}>Add a {st.name} date</Link>}
          </li>))}
      </ol>
      <H2>{staff ? 'Screening papers' : 'What your child needs'}</H2>
      {staff && players.length > 0 && <p className="mb-2">{players.filter((p) => docsMissing(s.eligibility.find((e) => e.playerId === p.id)).length === 0).length} of {players.length} children have all 5 papers. Tap a child to update.</p>}
      <Card className="mb-2 text-sm">Before GSCAA and SRAA, DepEd checks: {SCREENING_DOCS.map((d) => d.label).join(', ')}. The age cutoff is often the hardest part, so check birthdays early.</Card>
      {players.length === 0 && <Empty>No players yet.</Empty>}
      <div className="grid gap-2" data-tour="screening">
        {players.map((p) => <ScreeningRow key={p.id} p={p} info={info} staff={staff} />)}
      </div>
    </Page>
  );
}

function ScreeningRow({ p, info, staff }: { p: Player; info: TeamInfo; staff: boolean }) {
  const s = useAppState(); const e = s.eligibility.find((x) => x.playerId === p.id);
  const missing = docsMissing(e); const fit = ageFit(p, e, info);
  const body = (<>
    <div className="flex items-center justify-between gap-2"><span className="text-lg font-semibold">{p.firstName}{p.number ? ` #${p.number}` : ''}</span><span className="muted text-sm">{e?.category || 'No category yet'}</span></div>
    {staff ? <div className="text-sm">Papers {5 - missing.length} of 5{fit !== 'no-category' && <span className={fit === 'too-old' ? 'font-semibold text-red' : 'muted'}> · {AGE_FIT_TEXT[fit]}</span>}</div>
      : <><div className="text-sm">{missing.length === 0 ? 'All papers ready' : `Still needed: ${missing.join(', ')}`}</div>{fit !== 'no-category' && <div className={`text-sm ${fit === 'too-old' ? 'font-semibold text-red' : 'muted'}`}>{AGE_FIT_TEXT[fit]}</div>}</>}
    {e?.selectedFor?.length ? <div className="text-sm font-semibold">Selected for: {e.selectedFor.map(levelName).join(', ')}</div> : null}
  </>);
  return staff ? <Link to={`/pathway/${p.id}`} className="card grid gap-1 p-4">{body}</Link> : <div className="card grid gap-1 p-4">{body}{!staff && <p className="muted text-sm">Give the papers to the coach or school. Your coach ticks them off here.</p>}</div>;
}

/** Coach: one child's category, papers, age check and selection. */
export function EligibilityEditor() {
  const { id } = useParams(); const s = useAppState();
  const p = s.players.find((x) => x.id === id);
  if (!p) return <Page title="Screening" back={<Back to="/pathway" />}><Empty>This player is not here.</Empty></Page>;
  const info = infoFor(s.teamInfo, p.teamId); const e = s.eligibility.find((x) => x.playerId === p.id) ?? blankElig(p.id);
  const set = (x: Partial<Eligibility>) => put('eligibility', { ...e, ...x });
  const birth = birthOf(p); const fit = ageFit(p, e, info); const docs = p.emergency?.docs;
  const toggleSel = (l: MeetLevel) => set({ selectedFor: e.selectedFor.includes(l) ? e.selectedFor.filter((x) => x !== l) : [...e.selectedFor, l] });
  return (
    <Page title={`${p.firstName}: screening`} back={<Back to="/pathway" />}>
      <Card className="grid gap-3">
        <label className="grid gap-1 text-sm font-semibold">Category<select className="field" value={e.category} onChange={(ev) => set({ category: ev.target.value })}><option value="">Choose</option>{(info?.categories ?? []).map((c) => <option key={c}>{c}</option>)}</select></label>
        <div>{birth ? <>Born {fmtDate(birth)} (age {ageOn(birth, new Date())}).</> : <span className="text-red">No birthday yet. Add it on the player page or ask the family.</span>} <span className={fit === 'too-old' ? 'font-semibold text-red' : 'muted'}>{AGE_FIT_TEXT[fit]}{e.category && info?.cutoffs[e.category] ? ` (born on or after ${fmtDate(info.cutoffs[e.category])})` : ''}</span></div>
      </Card>
      <H2>Papers</H2>
      <Card className="grid gap-2">
        {SCREENING_DOCS.map((d) => (
          <label key={d.id} className="flex items-center gap-3"><input type="checkbox" className="h-6 w-6" checked={!!e.docs[d.id]} onChange={(ev) => set({ docs: { ...e.docs, [d.id]: ev.target.checked } })} />{d.label}
            {d.id === 'psa' && docs?.birthCert && <span className="muted text-sm">(family uploaded a photo)</span>}</label>))}
        <p className="muted text-sm">Tick a paper once you have checked the original or the school has it.</p>
      </Card>
      {(docs?.birthCert || docs?.studentId) && <><H2>Photos from the family</H2><Card className="grid gap-3">
        {docs.studentId && <div><div className="mb-1 font-semibold">Student ID</div><MediaView path={docs.studentId.path} version={docs.studentId.at} /></div>}
        {docs.birthCert && <div><div className="mb-1 font-semibold">PSA birth certificate</div><MediaView path={docs.birthCert.path} version={docs.birthCert.at} /></div>}
      </Card></>}
      <H2>Selected for</H2>
      <Card className="grid gap-2"><div className="flex flex-wrap gap-2">{LEVELS.filter((l) => l.id !== 'intramurals').map((l) => <Chip key={l.id} on={e.selectedFor.includes(l.id)} onClick={() => toggleSel(l.id)}>{l.short}</Chip>)}</div>
        <p className="muted text-sm">For example, picked for the GenSan delegation at SRAA. The family sees this.</p></Card>
      <H2>Note</H2>
      <Card><textarea className="field py-3" rows={2} aria-label="Screening note" placeholder="e.g. medical clearance booked for Friday" value={e.note} onChange={(ev) => set({ note: ev.target.value })} /></Card>
      <Tone tone="ok">Saved as you go.</Tone>
    </Page>
  );
}
