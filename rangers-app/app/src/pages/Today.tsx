import { Link, useNavigate } from 'react-router-dom';
import { Card, ClubHero, DateBlock, IconChip, Page, Row, SectionHead, Tile, Tone } from '../components/ui';
import type { ReactNode } from 'react';
import { Award, CalendarDays, Camera, CheckCircle2, ChevronRight, ClipboardCheck, Dumbbell, FileWarning, IdCard, ListChecks, Medal, Megaphone, MessageCircle, MessageSquareHeart, Shapes, Star, TrendingUp, Trophy, Users, type LucideIcon } from 'lucide-react';
import { EventWeather } from '../components/Wx';
import { activeTeam, put, teamPlayers, update, useAppState } from '../lib/store';
import { fmtDate, fmtTime } from '../lib/util';
import { needRecognition } from '../lib/development';
import { growthVelocity } from '../lib/growth';
import { newMatch } from './Home';
import { statusFor } from './Schedule';
import { PROGRAMMES } from '../lib/model';
import { CREST } from '../components/ui';
import { unreadMessages } from '../lib/inbox';
import { useNewFeedback } from '../lib/cloud';
import { FeedbackNudge } from './Feedback';
import { progress } from '../lib/assignments';
import { isSchoolTeam } from '../lib/school';
import { docsMissingFor } from '../components/Docs';

export default function Today() {
  const s = useAppState(); const nav = useNavigate();
  const team = activeTeam(s); const kids = teamPlayers(s);
  const upcoming = s.events.filter((e) => e.teamId === team.id && !e.cancelled && Date.parse(e.endsAt) > Date.now()).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const next = upcoming[0];
  const av = (st: string) => (next ? kids.filter((k) => statusFor(s, next, k.id) === st).length : 0);
  const going = av('going'), no = av('no'), maybe = av('maybe'); const noReply = Math.max(0, kids.length - going - no - maybe);
  const nudge = needRecognition(kids.map((k) => k.id), s.recognitions, Date.now());
  const spurts = kids.filter((k) => growthVelocity(s.growth.filter((g) => g.playerId === k.id)).status === 'spurt');
  const school = isSchoolTeam(s.teamInfo, team.id); const noDocs = kids.filter((k) => docsMissingFor(k).length).length;
  const toReview = s.assignments.filter((a) => a.teamId === team.id).reduce((n, a) => n + progress(a, s.submissions).toReview, 0);
  const unread = unreadMessages(s, 'coach', 'parent').filter((m) => m.teamId === team.id).length;
  const startMatch = () => { const m = newMatch(kids.filter((k) => !s.blocked.includes(k.id)).map((k) => k.id), team.id, team.defaultFormat); if (next?.type !== 'training' && next) { m.eventId = next.id; m.name = next.title; if (next.opponent) m.name = `${next.title} vs ${next.opponent}`; const ids = kids.filter((k) => statusFor(s, next, k.id) === 'going').map((k) => k.id); if (ids.length) m.availableIds = ids.filter((i) => !s.blocked.includes(i)); } put('matches', m); nav(`/match/${m.id}`); };
  const newFb = useNewFeedback();
  const news = s.announcements.filter((x) => x.scope === 'club' || x.teamId === team.id).sort((x, y) => y.at.localeCompare(x.at)).slice(0, 3);
  const attention: [LucideIcon, string, ReactNode][] = [
    ...(noDocs > 0 ? [[FileWarning, '/documents', `${noDocs} child(ren) still missing ID papers (student ID or PSA)`] as [LucideIcon, string, ReactNode]] : []),
    ...(toReview > 0 ? [[Camera, '/assign', `${toReview} task photo(s) to review`] as [LucideIcon, string, ReactNode]] : []),
    ...(unread > 0 ? [[MessageCircle, '/inbox', `${unread} unread message(s) from parents`] as [LucideIcon, string, ReactNode]] : []),
    ...(newFb > 0 ? [[MessageSquareHeart, '/feedback/inbox', `${newFb} new feedback about the app`] as [LucideIcon, string, ReactNode]] : []),
    ...(nudge.length > 0 ? [[Star, '/recognise', `${nudge.length} child(ren) not recognised in 6 weeks: ${nudge.slice(0, 3).map((id) => s.players.find((p) => p.id === id)?.firstName).join(', ')}${nudge.length > 3 ? '...' : ''}`] as [LucideIcon, string, ReactNode]] : []),
    ...(spurts.length > 0 ? [[TrendingUp, '/squad', `Growth spurt: ${spurts.map((p) => p.firstName).join(', ')}. Ease off jumping and sprinting for a few weeks.`] as [LucideIcon, string, ReactNode]] : []),
  ];
  return (
    <Page title={PROGRAMMES[team.programme].short} bare>
      <ClubHero programme={team.programme} values={PROGRAMMES[team.programme].values} unread={unread} />
      {s.teams.length > 1 && <div className="mb-3 flex gap-2 overflow-x-auto pb-1">{s.teams.map((t) => <button key={t.id} className={`btn shrink-0 px-4 ${t.id === team.id ? '' : 'ghost'}`} onClick={() => update((x) => ({ ...x, activeTeamId: t.id }))}>{t.name}</button>)}</div>}
      {s.blocked.length > 0 && <div className="mb-3"><Tone tone="bad">{s.blocked.length} child(ren) out after a head knock: {s.players.filter((p) => s.blocked.includes(p.id)).map((p) => p.firstName).join(', ')}. <Link to="/safety" className="underline">Open safety</Link></Tone></div>}
      <div className="grid grid-cols-2 gap-3" data-tour="quick-actions">
        <Tile to="/schedule" icon={CalendarDays} title="Schedule" sub="Training and match schedule" gold />
        <Tile to="/train" icon={Dumbbell} title="Training" sub="Plan today's session" />
        <Tile to="/squad" icon={Users} title="Team" sub="Players and families" />
        <Tile to="/match" icon={Trophy} title="Matches" sub="Match day and lineups" />
        <Tile to="/attendance" icon={ClipboardCheck} title="Attendance" sub="Who came today" />
        <Tile to="/assign" icon={ListChecks} title="Assign tasks" sub="Home tasks and photos" />
        <Tile to="/recognise" icon={Award} title="Recognise" sub="Praise a child" />
        {school ? <Tile to="/pathway" icon={Medal} title="Road to Palaro" sub="School meets" /> : <Tile to="/board" icon={Shapes} title="Tactics board" sub="Moves and lineups" />}
        <Tile to="/documents" icon={IdCard} title="ID papers" sub="Student ID and PSA" />
        <Tile to="/inbox" icon={Megaphone} title="Announce" sub="Post to families" />
      </div>
      <SectionHead title="Next up" to="/schedule" link="Schedule" />
      <div data-tour="today-next">
      {next ? (
        <Card className="grid gap-3">
          <Link to={`/event/${next.id}`} className="flex items-center gap-3"><DateBlock iso={next.startsAt} /><span className="min-w-0 flex-1"><span className="block text-lg font-bold">{next.title}</span><span className="muted block text-sm">{fmtTime(next.startsAt)} to {fmtTime(next.endsAt)}</span><span className="muted block truncate text-sm">{next.venue || 'Venue to confirm'}</span></span><ChevronRight size={20} className="muted" /></Link>
          <div className="grid grid-cols-4 gap-2 text-center"><Stat n={going} l="Going" /><Stat n={maybe} l="Maybe" /><Stat n={no} l="Not going" /><Stat n={noReply} l="No reply" /></div>
          <EventWeather e={next} compact />
          <div className="grid grid-cols-2 gap-2"><Link className="btn" to={`/event/${next.id}`}>Open event</Link>{next.type === 'training' ? <Link className="btn ghost" to="/train">Plan the session</Link> : <button className="btn ghost" onClick={startMatch}>Set up match</button>}</div>
        </Card>
      ) : <Card className="grid gap-3"><p>Nothing scheduled yet.</p><Link className="btn" to="/event/new">Add an event</Link></Card>}</div>
      <SectionHead title="Needs your attention" />
      <ul className="grid gap-2" data-tour="attention">
        {attention.map(([Icon, to, text], i) => <li key={i}><Row to={to} lead={<IconChip icon={Icon} />} title={text} /></li>)}
        {attention.length === 0 && <li><Row lead={<IconChip icon={CheckCircle2} />} title="All clear" sub="Nothing is waiting for you." /></li>}
      </ul>
      {news.length > 0 && <><SectionHead title="Latest updates" to="/inbox" />
        <div className="grid gap-2">{news.map((n) => <Row key={n.id} to="/inbox" lead={<img src={CREST[team.programme]} alt="" className="h-14 w-14 shrink-0 rounded-xl bg-white object-contain p-1" />} title={n.title} sub={fmtDate(n.at)} />)}</div></>}
      {kids.length === 0 && <Link to="/squad" className="btn mt-4 w-full">Add your squad</Link>}
      <FeedbackNudge />
    </Page>
  );
}
const Stat = ({ n, l }: { n: number; l: string }) => <div className="rounded-2xl p-2" style={{ background: 'rgba(255,255,255,.07)' }}><div className="text-2xl font-bold">{n}</div><div className="muted text-xs">{l}</div></div>;
