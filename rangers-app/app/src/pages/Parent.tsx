import { Link } from 'react-router-dom';
import { Back, Card, Empty, H2, Page } from '../components/ui';
import { EventWeather } from '../components/Wx';
import { useAppState } from '../lib/store';
import { LEVEL_WORDS } from '../lib/model';
import { RUBRIC } from '../content/rubric';
import { summarise, drillFor } from '../lib/development';
import { fmtDateTime } from '../lib/util';
import { useMyChildren } from '../lib/role';
import { BAND_AGE } from '../lib/sessionBuilder';
import { statusFor, setAvailability } from './Schedule';
import { TIPS_PARENTS } from '../content/safety';
import { growthVelocity } from '../lib/growth';

export function ParentHome() {
  const s = useAppState(); const kids = useMyChildren();
  const tip = TIPS_PARENTS[new Date().getDate() % TIPS_PARENTS.length];
  const upcoming = s.events.filter((e) => kids.some((k) => k.teamId === e.teamId) && !e.cancelled && Date.parse(e.endsAt) > Date.now()).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const next = upcoming[0];
  const news = s.announcements.filter((a) => a.scope === 'club' || kids.some((k) => k.teamId === a.teamId)).sort((a, b) => b.at.localeCompare(a.at))[0];
  return (
    <Page title="Rangers FC">
      <p className="display mb-3 text-2xl text-red">Play with your heart</p>
      {kids.length === 0 && <Empty>No child is linked to this account yet. Open the private link your coach sent you.</Empty>}
      {kids.map((k) => { const team = s.teams.find((t) => t.id === k.teamId); return (
        <Card key={k.id} className="mb-3"><div className="flex items-center justify-between"><div><div className="text-2xl font-semibold">{k.firstName}</div><div className="muted text-sm">{team?.name}{k.number ? ` · #${k.number}` : ''}</div></div><Link to={`/progress/${k.id}`} className="btn px-4">Progress</Link></div></Card>); })}
      {next && (<><H2>Next up</H2><Card className="grid gap-3"><div><div className="text-2xl font-semibold">{next.title}</div><div className="muted">{fmtDateTime(next.startsAt)} · {next.venue}</div></div>
        {kids.filter((k) => k.teamId === next.teamId).map((k) => { const st = statusFor(s, next, k.id); return (
          <div key={k.id} className="flex items-center gap-2"><span className="min-w-14 font-semibold">{k.firstName}</span>{(['going', 'maybe', 'no'] as const).map((v) => <button key={v} className={`btn flex-1 px-2 ${st === v ? '' : 'ghost'}`} aria-pressed={st === v} onClick={() => setAvailability(s, next.id, k.id, v, 'parent')}>{v === 'going' ? 'Going' : v === 'maybe' ? 'Maybe' : 'Not going'}</button>)}</div>); })}
        <EventWeather e={next} compact /><Link to={`/event/${next.id}`} className="btn ghost">Details and map</Link></Card></>)}
      {news && <><H2>Latest news</H2><Link to="/inbox" className="card block p-4"><div className="text-xl font-semibold">{news.title}</div><div className="truncate">{news.body}</div></Link></>}
      <H2>Tip of the week</H2><Card>{tip}</Card>
    </Page>
  );
}

export function ProgressPage({ playerId }: { playerId?: string }) {
  const s = useAppState(); const kids = useMyChildren();
  const k = kids.find((x) => x.id === playerId) ?? kids[0];
  if (!k) return <Page title="Progress"><Empty>No child linked yet.</Empty></Page>;
  const team = s.teams.find((t) => t.id === k.teamId) ?? s.teams[0];
  const skills = RUBRIC[team.ageBand];
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
        {recs.length > 0 && <p className="text-sm">Recognised for: {[...new Set(recs.map((r) => r.valueKey))].join(', ')}</p>}</Card>
      <H2>Attendance and playing time</H2>
      <Card className="grid gap-1"><p>Came to {came} of {att.length} recorded sessions.</p>{mins.slice(0, 5).map((m) => <p key={m.id} className="text-sm">{m.date}, {m.name}: {m.minutes} min</p>)}{mins.length === 0 && <p className="muted text-sm">Match minutes show here after each game.</p>}</Card>
      {g.status === 'spurt' && <><H2>Growth</H2><Card>{k.firstName} is in a growth spurt. Clumsiness is normal and temporary. Coaches are easing off jumping and sprinting. Tell the coach about any knee or heel pain.</Card></>}
    </Page>
  );
}
