import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Back, Ball, Card, Chip, CREST, DateBlock, Empty, H2, Page, Segmented } from '../components/ui';
import { Award, Backpack, CalendarDays, CalendarPlus, ChevronRight, Clock, Cross, MapPin, Medal, PartyPopper, Plus, Trophy, Users } from 'lucide-react';
import { EventWeather } from '../components/Wx';
import { activeTeam, del, put, teamPlayers, uid, useAppState, type AppState } from '../lib/store';
import type { Availability, ClubEvent, EventType, MeetLevel, MeetOutcome } from '../lib/model';
import { LEVELS, VENUES, infoFor, levelName } from '../lib/school';
import { STATUSES, summarise } from '../lib/attendance';
import { download, eventShareText, fmtDate, fmtDateTime, fmtTime, icsFor, localInput, share } from '../lib/util';
import { isStaff, useMyChildren, useRole } from '../lib/role';
import { newMatch } from './Home';
import { YAM1 } from '../lib/weather';
import { appUrl } from '../lib/cloud';
import { derivedId } from '../lib/syncMap';

/** Each person (a parent, or "coach") keeps one reply per child per event; the newest reply from anyone counts.
 *  Two parents of the same child can both answer without overwriting each other's row. */
export function setAvailability(s: AppState, eventId: string, playerId: string, status: Availability['status'], by: string) {
  const who = by === 'parent' ? (s.me.userId ?? 'parent') : by;
  put('availability', { id: derivedId(`${eventId}:${playerId}`, 'av:' + who), eventId, playerId, status, by, at: new Date().toISOString() });
}
export const latestReply = (s: AppState, eventId: string, playerId: string) =>
  s.availability.filter((a) => a.eventId === eventId && a.playerId === playerId).sort((a, b) => b.at.localeCompare(a.at))[0];
export const statusFor = (s: AppState, e: ClubEvent, playerId: string): Availability['status'] | 'none' =>
  latestReply(s, e.id, playerId)?.status ?? (e.goingByDefault && e.type === 'training' ? 'going' : 'none');

function Rsvp({ e, childId, by }: { e: ClubEvent; childId: string; by: string }) {
  const s = useAppState(); const st = statusFor(s, e, childId); const kid = s.players.find((p) => p.id === childId);
  return (
    <div className="flex items-center gap-2" role="group" aria-label={`Reply for ${kid?.firstName}`}>
      <span className="min-w-14 font-semibold">{kid?.firstName}</span>
      {(['going', 'maybe', 'no'] as const).map((v) => <button key={v} className={`btn flex-1 px-2 ${st === v ? '' : 'ghost'}`} aria-pressed={st === v} onClick={() => setAvailability(s, e.id, childId, v, by)}>{v === 'going' ? 'Going' : v === 'maybe' ? 'Maybe' : 'Not going'}</button>)}
    </div>
  );
}

const TYPE_ICON: Record<string, (p: { size?: number }) => JSX.Element> = {
  training: Ball, match: (p) => <Trophy {...p} />, tournament: (p) => <Medal {...p} />, meet: (p) => <Award {...p} />, festival: (p) => <PartyPopper {...p} />, meeting: (p) => <Users {...p} />, other: (p) => <CalendarDays {...p} />,
};
type Range = 'all' | 'week' | 'month' | 'past';
export default function Schedule() {
  const s = useAppState(); const role = useRole(); const staff = isStaff(role); const kids = useMyChildren(); const team = activeTeam(s);
  const [range, setRange] = useState<Range>('all'); const past = range === 'past';
  const mine = staff ? s.events.filter((e) => e.teamId === team.id) : s.events.filter((e) => kids.some((k) => k.teamId === e.teamId));
  const now = Date.now(); const limit = range === 'week' ? now + 7 * 86400000 : range === 'month' ? now + 31 * 86400000 : Infinity;
  const list = mine.filter((e) => (past ? Date.parse(e.endsAt) <= now : Date.parse(e.endsAt) > now && Date.parse(e.startsAt) <= limit)).sort((a, b) => (past ? b.startsAt.localeCompare(a.startsAt) : a.startsAt.localeCompare(b.startsAt)));
  return (
    <Page title="Schedule" actions={staff && <Link className="btn h-11 min-h-[44px] w-11 px-0" to="/event/new" data-tour="new-event" aria-label="New event"><Plus size={22} /></Link>}>
      <Segmented label="Show" value={range} onChange={setRange} options={[['all', 'Upcoming'], ['week', 'This week'], ['month', 'This month'], ['past', 'Past']]} />
      {list.length === 0 && <Empty>{staff ? 'No events here yet. Tap + to add training, a match or a school meet.' : 'Nothing scheduled here yet.'}</Empty>}
      <ul className="grid gap-3">
        {list.map((e) => { const Icon = TYPE_ICON[e.type] ?? TYPE_ICON.other; return (
          <li key={e.id} className={`card p-3 ${e.cancelled ? 'opacity-60' : ''}`}>
            <Link to={`/event/${e.id}`} className="flex items-center gap-3"><DateBlock iso={e.startsAt} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-base font-bold"><Icon size={18} /><span className="truncate">{e.title}{e.cancelled && ' (cancelled)'}</span></span>
                <span className="muted block text-sm">{fmtTime(e.startsAt)} to {fmtTime(e.endsAt)}</span>
                <span className="muted block truncate text-sm">{e.venue || 'Venue to confirm'}</span>
              </span><ChevronRight size={20} className="muted shrink-0" /></Link>
            {!staff && !e.cancelled && !past && <div className="mt-3 grid gap-2">{kids.filter((k) => k.teamId === e.teamId).map((k) => <Rsvp key={k.id} e={e} childId={k.id} by="parent" />)}</div>}
            {staff && !past && <div className="muted mt-2 text-sm">{teamPlayers(s, e.teamId).filter((p) => statusFor(s, e, p.id) === 'going').length} going{e.squad?.length ? ` · squad of ${e.squad.length}` : ''}</div>}
          </li>); })}
      </ul>
      {staff && <Link to="/event/new" className="btn mt-4 w-full"><CalendarDays size={20} />Add an event</Link>}
    </Page>
  );
}

const OUTCOMES: { id: MeetOutcome; label: string }[] = [{ id: '', label: 'No result yet' }, { id: 'qualified', label: 'Qualified' }, { id: 'champion', label: 'Champions' }, { id: 'placed', label: 'Placed' }, { id: 'eliminated', label: 'Out' }];
const TYPES: EventType[] = ['training', 'match', 'tournament', 'meet', 'festival', 'meeting', 'other'];
/** Defined outside the form: a component made inside it would be rebuilt on every keystroke and the box would lose focus. */
const L = ({ t, children }: { t: string; children: React.ReactNode }) => <label className="grid gap-1 text-sm font-semibold">{t}{children}</label>;
export function EventForm() {
  const s = useAppState(); const nav = useNavigate(); const team = activeTeam(s); const [q] = useSearchParams();
  const meetFromLink = LEVELS.find((l) => l.id === q.get('meet'))?.id; const cats = infoFor(s.teamInfo, team.id)?.categories ?? [];
  const [meet, setMeet] = useState<{ level: MeetLevel; category: string }>({ level: meetFromLink ?? 'intramurals', category: '' });
  const start = new Date(); start.setDate(start.getDate() + 1); start.setHours(16, 0, 0, 0);
  const [f, setF] = useState({ type: (meetFromLink ? 'meet' : 'training') as EventType, title: meetFromLink ? levelName(meetFromLink) : 'Training', start: localInput(start), mins: 90, venue: 'Yam 1, Purok 27, Barangay Mabuhay', mapUrl: 'https://share.google/nRfj0M8NLTZqJQiBK', hospital: '', bring: 'Water bottle, boots or shoes, shin guards', opponent: '', notes: '', weeks: 1, lat: String(YAM1.lat), lng: String(YAM1.lng) });
  const set = (k: keyof typeof f, v: string | number) => setF({ ...f, [k]: v });
  const save = () => {
    for (let w = 0; w < Math.max(1, f.weeks); w++) {
      const st = new Date(f.start); st.setDate(st.getDate() + 7 * w); const en = new Date(st.getTime() + f.mins * 60000);
      put('events', { id: uid(), teamId: team.id, type: f.type, title: f.title, startsAt: st.toISOString(), endsAt: en.toISOString(), venue: f.venue, mapUrl: f.mapUrl, hospital: f.hospital, bring: f.bring, opponent: f.opponent, notes: f.notes, lat: Number(f.lat) || undefined, lng: Number(f.lng) || undefined, goingByDefault: s.settings.goingDefaultTraining, ...(f.type === 'meet' ? { meetLevel: meet.level, category: meet.category || undefined, outcome: '' as MeetOutcome } : {}) });
    }
    nav('/schedule');
  };
  return (
    <Page title="New event" back={<Back to="/schedule" />}>
      <Card className="grid gap-3">
        <div className="flex flex-wrap gap-2" data-tour="event-types">{TYPES.map((t) => <Chip key={t} on={f.type === t} onClick={() => setF({ ...f, type: t, title: t === 'training' ? 'Training' : t === 'match' ? 'Match' : t === 'meet' ? levelName(meet.level) : t[0].toUpperCase() + t.slice(1) })}>{t === 'meet' ? 'school meet' : t}</Chip>)}</div>
        {f.type === 'meet' && (<>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Meet level">{LEVELS.map((l) => <Chip key={l.id} on={meet.level === l.id} onClick={() => { setMeet({ ...meet, level: l.id }); setF({ ...f, title: l.name }); }}>{l.short}</Chip>)}</div>
          {cats.length > 0 && <L t="Category"><select className="field" value={meet.category} onChange={(e) => setMeet({ ...meet, category: e.target.value })}><option value="">All or not decided</option>{cats.map((c) => <option key={c}>{c}</option>)}</select></L>}
        </>)}
        <L t="Title"><input className="field" value={f.title} onChange={(e) => set('title', e.target.value)} /></L>
        <div className="grid grid-cols-2 gap-2"><L t="Starts"><input type="datetime-local" className="field" value={f.start} onChange={(e) => set('start', e.target.value)} /></L><L t="Length (min)"><input type="number" className="field" value={f.mins} onChange={(e) => set('mins', +e.target.value)} /></L></div>
        <L t="Where"><input className="field" list="venues" value={f.venue} onChange={(e) => set('venue', e.target.value)} /><datalist id="venues">{VENUES.map((v) => <option key={v} value={v} />)}</datalist></L>
        <L t="Map link"><input className="field" value={f.mapUrl} onChange={(e) => set('mapUrl', e.target.value)} /></L>
        <L t="Nearest hospital"><input className="field" value={f.hospital} onChange={(e) => set('hospital', e.target.value)} /></L>
        <L t="What to bring"><input className="field" value={f.bring} onChange={(e) => set('bring', e.target.value)} /></L>
        {(f.type === 'match' || f.type === 'tournament' || f.type === 'meet') && <L t="Opponent"><input className="field" value={f.opponent} onChange={(e) => set('opponent', e.target.value)} /></L>}
        <L t="Notes"><textarea className="field py-3" rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></L>
        <details><summary className="muted">Heat forecast location (optional)</summary><div className="mt-2 grid grid-cols-2 gap-2"><L t="Latitude"><input className="field" value={f.lat} onChange={(e) => set('lat', e.target.value)} /></L><L t="Longitude"><input className="field" value={f.lng} onChange={(e) => set('lng', e.target.value)} /></L></div></details>
        <L t="Repeat weekly for"><select className="field" value={f.weeks} onChange={(e) => set('weeks', +e.target.value)}>{[1, 4, 8, 12].map((n) => <option key={n} value={n}>{n === 1 ? 'Just this once' : `${n} weeks`}</option>)}</select></L>
        <button className="btn h-14" disabled={!f.title} onClick={save} data-tour="event-save">Save event</button>
      </Card>
    </Page>
  );
}

export function EventDetail() {
  const { id } = useParams(); const nav = useNavigate();
  const s = useAppState(); const role = useRole(); const staff = isStaff(role); const kids = useMyChildren();
  const e = s.events.find((x) => x.id === id);
  const [msg, setMsg] = useState('');
  if (!e) return <Page title="Event" back={<Back to="/schedule" />}><Empty>This event is not here any more.</Empty></Page>;
  const team = s.teams.find((t) => t.id === e.teamId); const players = teamPlayers(s, e.teamId);
  const att = summarise(s.attendance.filter((a) => a.eventId === e.id && players.some((p) => p.id === a.playerId)));
  const link = appUrl('/schedule');
  const doShare = async () => { const r = await share(eventShareText(e, team?.name ?? 'Rangers', link)); setMsg(r === 'copied' ? 'Copied. Paste it in your group chat.' : r === 'shared' ? 'Shared.' : ''); };
  const startMatch = () => { const going = e.squad?.length ? e.squad.filter((id) => !s.blocked.includes(id) && players.some((p) => p.id === id)) : players.filter((p) => statusFor(s, e, p.id) === 'going' && !s.blocked.includes(p.id)).map((p) => p.id); const m = newMatch(going.length ? going : players.filter((p) => !s.blocked.includes(p.id)).map((p) => p.id), e.teamId, team?.defaultFormat); m.eventId = e.id; m.name = e.opponent ? `${e.title} vs ${e.opponent}` : e.title; put('matches', m); nav(`/match/${m.id}`); };
  return (
    <Page title={e.title} back={<Back to="/schedule" />}>
      <Card className="grid gap-3">
        <div className="flex items-center justify-between gap-2"><span className="font-bold">{fmtDate(e.startsAt)}</span><span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: 'rgba(255,255,255,.1)' }}>{e.type === 'meet' ? levelName(e.meetLevel) : e.type[0].toUpperCase() + e.type.slice(1)}</span></div>
        {e.cancelled && <p className="font-bold text-red">Cancelled</p>}
        {['match', 'tournament', 'meet'].includes(e.type) && (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-2 text-center">
            <div className="grid justify-items-center gap-1"><img src={CREST[team?.programme ?? 'rangers']} alt="" width={72} height={72} className="h-[72px] w-[72px] rounded-full bg-white object-contain p-1" /><span className="text-sm font-bold uppercase">{team?.name ?? 'Rangers'}</span></div>
            <span className="text-3xl font-bold">VS</span>
            <div className="grid justify-items-center gap-1"><span className="grid h-[72px] w-[72px] place-items-center rounded-full text-2xl font-bold" style={{ background: 'linear-gradient(160deg,#5b2a86,#2a1050)', border: '2px solid rgba(255,255,255,.3)' }}>{(e.opponent || e.category || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</span><span className="text-sm font-bold uppercase">{e.opponent || (e.type === 'meet' ? 'Opponents to confirm' : 'To confirm')}</span></div>
          </div>)}
        <div className="grid gap-1.5">
          <div className="flex items-center gap-2"><Clock size={18} className="shrink-0" />{fmtTime(e.startsAt)} to {fmtTime(e.endsAt)}</div>
          <div className="flex items-center gap-2"><MapPin size={18} className="shrink-0" /><span>{e.venue || 'Venue to confirm'}{e.mapUrl && <> · <a className="underline" href={e.mapUrl} target="_blank" rel="noreferrer">Map</a></>}</span></div>
          {e.bring && <div className="flex items-center gap-2"><Backpack size={18} className="shrink-0" />{e.bring}</div>}
          {e.hospital && staff && <div className="flex items-center gap-2"><Cross size={18} className="shrink-0" />Nearest hospital: {e.hospital}</div>}
        </div>
        {e.type === 'meet' && (e.category || e.outcome || e.resultNote) && <div className="font-semibold">{levelName(e.meetLevel)}{e.category ? ` · ${e.category}` : ''}{e.outcome ? ` · ${OUTCOMES.find((o) => o.id === e.outcome)?.label}` : ''}{e.resultNote ? `: ${e.resultNote}` : ''}</div>}
        {e.notes && <div>{e.notes}</div>}
        <button className="btn" onClick={() => download(`${e.title.replace(/\W+/g, '-')}.ics`, icsFor(e, appUrl(`/event/${e.id}`)), 'text/calendar')}><CalendarPlus size={20} />Add to calendar</button>
      </Card>
      <H2>Heat and weather</H2><Card><EventWeather e={e} /></Card>
      {!staff && e.squad?.length ? <><H2>Squad</H2><Card className="grid gap-1">{kids.filter((k) => k.teamId === e.teamId).map((k) => <p key={k.id} className={e.squad!.includes(k.id) ? 'text-lg font-semibold' : ''}>{e.squad!.includes(k.id) ? `${k.firstName} is in the squad.` : `${k.firstName} is not in the squad this time.`}</p>)}</Card></> : null}
      {!staff && !e.cancelled && <><H2>Are they coming?</H2><Card className="grid gap-3">{kids.filter((k) => k.teamId === e.teamId).map((k) => <Rsvp key={k.id} e={e} childId={k.id} by="parent" />)}</Card></>}
      {staff && (<>
        <H2>Replies</H2>
        <Card className="grid gap-2">{players.length === 0 && <p className="muted">No players in this team yet.</p>}
          {players.map((p) => { const st = statusFor(s, e, p.id); return (
            <div key={p.id} className="flex items-center gap-2"><span className="flex-1">{p.firstName}</span>
              {(['going', 'maybe', 'no'] as const).map((v) => <button key={v} className={`btn min-h-[44px] px-3 text-sm ${st === v ? '' : 'ghost'}`} aria-label={`${p.firstName} ${v}`} aria-pressed={st === v} onClick={() => setAvailability(s, e.id, p.id, v, 'coach')}>{v === 'going' ? 'Yes' : v === 'maybe' ? '?' : 'No'}</button>)}
              {st === 'none' && <span className="muted text-xs">no reply</span>}</div>); })}</Card>
        {e.type === 'meet' && <><H2>Result</H2><Card className="grid gap-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Result">{OUTCOMES.map((o) => <Chip key={o.id} on={(e.outcome ?? '') === o.id} onClick={() => put('events', { ...e, outcome: o.id })}>{o.label}</Chip>)}</div>
          <input className="field" aria-label="Result note" placeholder="e.g. Won 2-1 against Lagao, through to GSCAA" value={e.resultNote ?? ''} onChange={(ev) => put('events', { ...e, resultNote: ev.target.value })} />
          <Link className="underline" to="/pathway">See the Road to Palaro</Link></Card></>}
        {['match', 'tournament', 'meet'].includes(e.type) && <><H2>Squad</H2><Card className="grid gap-2" tour="squad-section">
          <p>{e.squad?.length ? s.players.filter((p) => e.squad!.includes(p.id)).map((p) => p.firstName + (p.number ? ` #${p.number}` : '')).join(', ') : 'Not picked yet.'}</p>
          <Link className="btn" to={`/event/${e.id}/squad`}>{e.squad?.length ? 'Change the squad' : 'Pick the squad'}</Link></Card></>}
        <H2>Attendance</H2>
        <Card className="grid gap-2"><p>{att.recorded === 0 ? 'Not taken yet.' : STATUSES.map((x) => `${att[x.id]} ${x.label.toLowerCase()}`).join(', ')}</p>
          <Link className="btn" to={`/attendance/${e.id}`}>{att.recorded === 0 ? 'Take attendance' : 'Change attendance'}</Link></Card>
        <div className="mt-4 grid gap-2">
          <button className="btn h-14" onClick={doShare}>Share to group chat</button>{msg && <p role="status">{msg}</p>}
          {e.type !== 'training' ? <button className="btn ghost h-14" onClick={startMatch}>Set up this match</button> : <Link className="btn ghost h-14" to="/train">Plan the session</Link>}
          <button className="btn ghost" onClick={() => put('events', { ...e, cancelled: !e.cancelled })}>{e.cancelled ? 'Restore event' : 'Cancel event'}</button>
          <button className="btn ghost" onClick={() => confirm('Delete this event?') && (del('events', e.id), nav('/schedule'))}>Delete event</button>
        </div></>)}
    </Page>
  );
}
