import { Link, useParams } from 'react-router-dom';
import { Avatar, Back, Card, CREST, ClubHero, DateBlock, Empty, H2, IconChip, Page, Row, SectionHead, Tile } from '../components/ui';
import { CalendarDays, ChevronRight, ListChecks, Medal, MessageCircle, TrendingUp } from 'lucide-react';
import { unreadMessages } from '../lib/inbox';
import { PROGRAMMES } from '../lib/model';
import { EventWeather } from '../components/Wx';
import { useAppState } from '../lib/store';
import { LEVEL_WORDS } from '../lib/model';
import { RUBRIC } from '../content/rubric';
import { summarise, drillFor } from '../lib/development';
import { fmtDate, fmtTime } from '../lib/util';
import { useMyChildren } from '../lib/role';
import { BAND_AGE } from '../lib/sessionBuilder';
import { statusFor, setAvailability } from './Schedule';
import { TIPS_PARENTS } from '../content/safety';
import { growthVelocity } from '../lib/growth';
import { bandOf, docsMissing, infoFor, isSchoolTeam } from '../lib/school';
import { DetailsReminder, EmergencyEditor } from '../components/Emergency';
import { DocsEditor, DocsReminder, docsMissingFor } from '../components/Docs';
import { activeTeam, teamPlayers } from '../lib/store';
import { isStaff, useRole } from '../lib/role';
import { openAssignments } from '../lib/assignments';

export function ParentHome() {
  const s = useAppState(); const kids = useMyChildren();
  const tip = TIPS_PARENTS[new Date().getDate() % TIPS_PARENTS.length];
  const upcoming = s.events.filter((e) => kids.some((k) => k.teamId === e.teamId) && !e.cancelled && Date.parse(e.endsAt) > Date.now()).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const next = upcoming[0];
  const todo = kids.reduce((n, k) => n + openAssignments(s.assignments.filter((a) => a.playerId === k.id), s.submissions).length, 0);
  const news = s.announcements.filter((a) => a.scope === 'club' || kids.some((k) => k.teamId === a.teamId)).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 3);
  const prog = (kids[0] && s.teams.find((t) => t.id === kids[0].teamId)?.programme) || 'rangers';
  const unread = unreadMessages(s, 'parent', 'coach').length;
  return (
    <Page title="Rangers FC" bare>
      <ClubHero programme={prog} values={PROGRAMMES[prog].values} unread={unread} />
      {kids.length === 0 && <Empty>No child is linked to this account yet. Open the private link your coach sent you.</Empty>}
      <div className="grid gap-2">
        {kids.map((k) => { const team = s.teams.find((t) => t.id === k.teamId); return (
          <Row key={k.id} to={`/progress/${k.id}`} tour="home-child" lead={<Avatar name={k.firstName} number={k.number} />} title={<span className="text-lg">{k.firstName}</span>} sub={`${team?.name ?? ''}${k.number ? ` · #${k.number}` : ''} · Progress`} />); })}
      </div>
      {kids.length > 0 && <div className="mt-3 grid gap-3">{kids.map((k) => <div key={k.id} className="grid gap-3"><DocsReminder p={k} /><DetailsReminder p={k} /></div>)}</div>}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Tile to="/schedule" icon={CalendarDays} title="Schedule" sub="Training and matches" gold />
        <Tile to="/tasks" icon={ListChecks} title="Tasks" sub={todo ? `${todo} to do` : 'Home tasks'} />
        <Tile to="/progress" icon={TrendingUp} title="Progress" sub="Reviews and goals" />
        <Tile to="/inbox" icon={MessageCircle} title="Messages" sub="Talk to the coach" />
      </div>
      {kids.filter((k) => isSchoolTeam(s.teamInfo, k.teamId)).map((k) => { const el = s.eligibility.find((x) => x.playerId === k.id); const miss = docsMissing(el); return (
        <div key={k.id} className="mt-3"><Row to="/pathway" lead={<IconChip icon={Medal} />} title="Road to Palaro" sub={`${el?.selectedFor?.length ? `${k.firstName} is selected for the next level. ` : ''}${miss.length ? `School screening: ${miss.length} paper${miss.length === 1 ? '' : 's'} still needed for ${k.firstName}.` : `${k.firstName}'s screening papers are ready.`}`} /></div>); })}
      {todo > 0 && <div className="mt-3"><Row to="/tasks" lead={<IconChip icon={ListChecks} />} title={`${todo} task${todo === 1 ? '' : 's'} from your coach`} sub="Tap to see the list and send your photos." /></div>}
      {next && (<><SectionHead title="Next up" to="/schedule" link="Schedule" /><Card className="grid gap-3" tour="rsvp">
        <Link to={`/event/${next.id}`} className="flex items-center gap-3"><DateBlock iso={next.startsAt} /><span className="min-w-0 flex-1"><span className="block text-lg font-bold">{next.title}</span><span className="muted block text-sm">{fmtTime(next.startsAt)} to {fmtTime(next.endsAt)}</span><span className="muted block truncate text-sm">{next.venue}</span></span><ChevronRight size={20} className="muted" /></Link>
        {kids.filter((k) => k.teamId === next.teamId).map((k) => { const st = statusFor(s, next, k.id); return (
          <div key={k.id} className="grid gap-1"><span className="text-sm font-semibold">Is {k.firstName} coming?</span><div className="grid grid-cols-3 gap-2">{(['going', 'maybe', 'no'] as const).map((v) => <button key={v} className={`btn px-2 ${st === v ? '' : 'ghost'}`} aria-pressed={st === v} onClick={() => setAvailability(s, next.id, k.id, v, 'parent')}>{v === 'going' ? 'Going' : v === 'maybe' ? 'Maybe' : 'Not going'}</button>)}</div></div>); })}
        <EventWeather e={next} compact /></Card></>)}
      {news.length > 0 && <><SectionHead title="Latest updates" to="/inbox" /><div className="grid gap-2">{news.map((n) => <Row key={n.id} to="/inbox" lead={<img src={CREST[prog]} alt="" className="h-14 w-14 shrink-0 rounded-xl bg-white object-contain p-1" />} title={n.title} sub={fmtDate(n.at)} />)}</div></>}
      <SectionHead title="Tip of the week" /><Card>{tip}</Card>
    </Page>
  );
}

export function ProgressPage({ playerId }: { playerId?: string }) {
  const s = useAppState(); const kids = useMyChildren();
  const k = kids.find((x) => x.id === playerId) ?? kids[0];
  if (!k) return <Page title="Progress"><Empty>No child linked yet.</Empty></Page>;
  const team = s.teams.find((t) => t.id === k.teamId) ?? s.teams[0];
  const skills = RUBRIC[bandOf(k, team, infoFor(s.teamInfo, team.id))];
  const pubs = s.assessments.filter((a) => a.playerId === k.id && a.publishedAt).sort((a, b) => a.term.localeCompare(b.term));
  const cur = pubs[pubs.length - 1]; const prev = pubs[pubs.length - 2];
  const sum = cur ? summarise(skills, cur, prev) : null;
  const goals = s.goals.filter((g) => g.playerId === k.id); const badges = s.badges.filter((b) => b.playerId === k.id);
  const recs = s.recognitions.filter((r) => r.playerId === k.id);
  const att = s.attendance.filter((a) => a.playerId === k.id); const came = att.filter((a) => a.present).length;
  const mins = s.minutes.filter((m) => m.playerId === k.id).sort((a, b) => b.date.localeCompare(a.date));
  const g = growthVelocity(s.growth.filter((x) => x.playerId === k.id));
  return (
    <Page title={k.firstName} back={kids.length > 1 ? <Back to="/progress" /> : undefined}>
      {kids.length > 1 && <div className="mb-3 flex flex-wrap gap-2">{kids.map((x) => <Link key={x.id} to={`/progress/${x.id}`} className={`btn px-4 ${x.id === k.id ? '' : 'ghost'}`}>{x.firstName}</Link>)}</div>}
      {!cur ? <Empty>No term review has been shared yet. It will show here when the coach publishes it.</Empty> : (<>
        <H2>{cur.term}</H2>
        <Card className="grid gap-2">{cur.familyComment && <p className="text-lg">"{cur.familyComment}"</p>}
          <p><b>Strengths:</b> {sum!.strengths.map((x) => x.label).join(', ') || '-'}</p>{sum!.fastest && <p><b>Fastest developing:</b> {sum!.fastest.label}</p>}</Card>
        <H2>Working on</H2>
        <Card className="grid gap-3">{sum!.working.length === 0 && <p className="muted">Nothing yet.</p>}{sum!.working.map((w) => { const d = drillFor(w.id, BAND_AGE[team.ageBand]); return <div key={w.id}><div className="text-lg font-semibold">{w.label}</div>{d && <p className="text-sm">Try at home: <b>{d.name}</b>. {d.how}</p>}</div>; })}</Card>
        <H2>You then, you now</H2>
        <Card className="grid gap-1">{skills.filter((x) => (cur.ratings[x.id] ?? 0) > 0).map((x) => <div key={x.id} className="flex justify-between gap-2 border-b py-1" style={{ borderColor: 'var(--line)' }}><span>{x.label}</span><span className="text-right text-sm">{prev?.ratings[x.id] ? <span className="muted">{LEVEL_WORDS[prev.ratings[x.id]]} then </span> : null}<b>{LEVEL_WORDS[cur.ratings[x.id]]}</b></span></div>)}</Card></>)}
      <H2>Goal</H2><Card className="grid gap-1">{goals.length === 0 ? <p className="muted">Your coach will help {k.firstName} choose a goal.</p> : goals.map((x) => <p key={x.id} className={x.status === 'done' ? 'line-through' : ''}>{x.text}{x.status === 'done' && ' (done!)'}</p>)}</Card>
      <H2>Badges and recognition</H2>
      <Card className="grid gap-2"><div className="flex flex-wrap gap-2">{badges.map((b) => <span key={b.id} className="rounded-full border px-3 py-1" style={{ borderColor: 'var(--line)' }}>{b.badgeKey}</span>)}{badges.length === 0 && <span className="muted">Badges appear when {k.firstName} learns a new move.</span>}</div>
        {recs.length > 0 && <div className="grid gap-1 text-sm">{[...recs].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5).map((r) => <p key={r.id}>Recognised for <b>{r.valueKey}</b>{r.note ? `: "${r.note}"` : ''}</p>)}</div>}</Card>
      <H2>Attendance and playing time</H2>
      <Card className="grid gap-1"><p>{att.length ? `Came to ${came} of ${att.length} recorded sessions.` : 'Attendance shows here once the coach starts recording it.'}</p>{mins.slice(0, 5).map((m) => <p key={m.id} className="text-sm">{m.date}, {m.name}: {m.minutes} min</p>)}{mins.length === 0 && <p className="muted text-sm">Match minutes show here after each game.</p>}</Card>
      {g.status === 'spurt' && <><H2>Growth</H2><Card>{k.firstName} is in a growth spurt. Clumsiness is normal and temporary. Coaches are easing off jumping and sprinting. Tell the coach about any knee or heel pain.</Card></>}
    </Page>
  );
}

/** Family-facing page to enter or update a child's details. */
export function DetailsPage() {
  const { id } = useParams(); const s = useAppState(); const kids = useMyChildren();
  const k = kids.find((x) => x.id === id) ?? kids[0];
  if (!k) return <Page title="Details"><Empty>No child linked yet.</Empty></Page>;
  const p = s.players.find((x) => x.id === k.id) ?? k;
  return (
    <Page title={`${p.firstName}'s details`} back={<Back to="/" />}>
      {kids.length > 1 && <div className="mb-3 flex flex-wrap gap-2">{kids.map((x) => <Link key={x.id} to={`/details/${x.id}`} className={`btn px-4 ${x.id === k.id ? '' : 'ghost'}`}>{x.firstName}</Link>)}</div>}
      <p className="mb-3">Please fill in what you can. Changes save as you type.</p>
      <Card tour="details-form"><EmergencyEditor p={p} /></Card>
    </Page>
  );
}

/** ID papers for one child: the family adds them after joining; coaches can add them too. */
export function DocsPage() {
  const { id } = useParams(); const s = useAppState(); const kids = useMyChildren(); const staff = isStaff(useRole());
  const p = s.players.find((x) => x.id === id && (staff || kids.some((k) => k.id === x.id)));
  if (!p) return <Page title="ID papers"><Empty>This child is not linked to your account.</Empty></Page>;
  return (
    <Page title={`${p.firstName}'s ID papers`} back={<Back to={staff ? `/player/${p.id}` : '/'} />}>
      <p className="mb-3">Tournament and school-meet organisers check age and enrolment, so the coach needs to show these on the day.</p>
      <DocsEditor p={p} />
      {!staff && docsMissingFor(p).length > 0 && <Link to="/" className="btn ghost mt-4 w-full">I do not have them with me: remind me later</Link>}
      {!staff && docsMissingFor(p).length === 0 && <Link to="/" className="btn mt-4 w-full">Done</Link>}
    </Page>
  );
}

/** Coach: everyone's ID papers in one place, for tournament check-in. */
export function TeamDocs() {
  const s = useAppState(); const team = activeTeam(s); const kids = teamPlayers(s);
  const missing = kids.filter((k) => docsMissingFor(k).length);
  return (
    <Page title="ID papers" back={<Back to="/" />}>
      <p className="mb-3">{team.name}: {kids.length - missing.length} of {kids.length} children have both papers.{missing.length ? ' Missing ones are listed first.' : ''}</p>
      <div className="grid gap-2">{[...missing, ...kids.filter((k) => !missing.includes(k))].map((k) => { const m = docsMissingFor(k); return (
        <Link key={k.id} to={`/docs/${k.id}`} className="card flex items-center justify-between p-4"><span className="text-lg font-semibold">{k.firstName}{k.number ? ` #${k.number}` : ''}</span>
          <span className={`text-sm ${m.length ? 'text-red' : ''}`}>{m.length === 0 ? 'Student ID, PSA' : m.length === 2 ? 'Both missing' : m[0] === 'studentId' ? 'Student ID missing' : 'PSA missing'}</span></Link>); })}</div>
      <p className="muted mt-3 text-sm">These need an internet connection to open. At a venue with weak signal, open each one before you leave home.</p>
    </Page>
  );
}
