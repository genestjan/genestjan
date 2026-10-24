import { Link, useNavigate } from 'react-router-dom';
import { Card, H2, Page, Tone } from '../components/ui';
import { EventWeather } from '../components/Wx';
import { activeTeam, put, teamPlayers, update, useAppState } from '../lib/store';
import { fmtDateTime } from '../lib/util';
import { needRecognition } from '../lib/development';
import { growthVelocity } from '../lib/growth';
import { newMatch } from './Home';
import { statusFor } from './Schedule';
import { PROGRAMMES } from '../lib/model';
import { unreadMessages } from '../lib/inbox';

export default function Today() {
  const s = useAppState(); const nav = useNavigate();
  const team = activeTeam(s); const kids = teamPlayers(s);
  const upcoming = s.events.filter((e) => e.teamId === team.id && !e.cancelled && Date.parse(e.endsAt) > Date.now()).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const next = upcoming[0];
  const av = (st: string) => (next ? kids.filter((k) => statusFor(s, next, k.id) === st).length : 0);
  const going = av('going'), no = av('no'), maybe = av('maybe'); const noReply = Math.max(0, kids.length - going - no - maybe);
  const nudge = needRecognition(kids.map((k) => k.id), s.recognitions, Date.now());
  const spurts = kids.filter((k) => growthVelocity(s.growth.filter((g) => g.playerId === k.id)).status === 'spurt');
  const unread = unreadMessages(s, 'coach', 'parent').filter((m) => m.teamId === team.id).length;
  const startMatch = () => { const m = newMatch(kids.filter((k) => !s.blocked.includes(k.id)).map((k) => k.id), team.id, team.defaultFormat); if (next?.type !== 'training' && next) { m.eventId = next.id; m.name = next.title; if (next.opponent) m.name = `${next.title} vs ${next.opponent}`; const ids = kids.filter((k) => statusFor(s, next, k.id) === 'going').map((k) => k.id); if (ids.length) m.availableIds = ids.filter((i) => !s.blocked.includes(i)); } put('matches', m); nav(`/match/${m.id}`); };
  return (
    <Page title={PROGRAMMES[team.programme].short}>
      {s.teams.length > 1 && <div className="mb-3 flex flex-wrap gap-2">{s.teams.map((t) => <button key={t.id} className={`btn px-4 ${t.id === team.id ? '' : 'ghost'}`} onClick={() => update((x) => ({ ...x, activeTeamId: t.id }))}>{t.name}</button>)}</div>}
      <p className="display mb-3 text-2xl text-red">Play with your heart</p>
      {s.blocked.length > 0 && <Tone tone="bad">{s.blocked.length} child(ren) out after a head knock: {s.players.filter((p) => s.blocked.includes(p.id)).map((p) => p.firstName).join(', ')}. <Link to="/safety" className="underline">Open safety</Link></Tone>}
      <H2>Next up</H2>
      {next ? (
        <Card className="grid gap-3">
          <div><div className="text-2xl font-semibold">{next.title}</div><div className="muted">{fmtDateTime(next.startsAt)} · {next.venue || 'Venue to confirm'}</div></div>
          <div className="grid grid-cols-4 gap-2 text-center"><Stat n={going} l="Going" /><Stat n={maybe} l="Maybe" /><Stat n={no} l="Not going" /><Stat n={noReply} l="No reply" /></div>
          <EventWeather e={next} compact />
          <div className="flex flex-wrap gap-2"><Link className="btn" to={`/event/${next.id}`}>Open event</Link>{next.type === 'training' ? <Link className="btn ghost" to="/train">Plan the session</Link> : <button className="btn ghost" onClick={startMatch}>Set up match</button>}</div>
        </Card>
      ) : <Card><p className="mb-3">Nothing scheduled.</p><Link className="btn" to="/event/new">Add an event</Link></Card>}
      <H2>Quick actions</H2>
      <div className="grid grid-cols-2 gap-3">
        <button className="btn h-16" onClick={startMatch}>New match</button>
        <Link className="btn ghost h-16" to="/train">Plan training</Link>
        <Link className="btn ghost h-16" to="/inbox">Post an announcement</Link>
        <Link className="btn ghost h-16" to="/board">Tactics board</Link>
      </div>
      <H2>Needs your attention</H2>
      <ul className="grid gap-2">
        {unread > 0 && <li><Link to="/inbox" className="card block p-3">{unread} unread message(s) from parents</Link></li>}
        {nudge.length > 0 && <li><Link to="/recognise" className="card block p-3">{nudge.length} child(ren) not recognised in 6 weeks: {nudge.slice(0, 3).map((id) => s.players.find((p) => p.id === id)?.firstName).join(', ')}{nudge.length > 3 ? '...' : ''}</Link></li>}
        {spurts.length > 0 && <li className="card p-3">Growth spurt: {spurts.map((p) => p.firstName).join(', ')}. Ease off jumping and sprinting for a few weeks.</li>}
        {unread === 0 && nudge.length === 0 && spurts.length === 0 && <li className="muted card p-3">All clear.</li>}
      </ul>
      {kids.length === 0 && <Link to="/squad" className="btn mt-4">Add your squad</Link>}
    </Page>
  );
}
const Stat = ({ n, l }: { n: number; l: string }) => <div className="rounded-2xl p-2" style={{ background: 'var(--bg)' }}><div className="display text-4xl">{n}</div><div className="muted text-xs">{l}</div></div>;
