import { Link, useNavigate } from 'react-router-dom';
import { Back, Card, Empty, Page } from '../components/ui';
import { activeTeam, put, teamPlayers, uid, useAppState, type Match } from '../lib/store';
import { FORMATS, type FormatId } from '../lib/types';
import { isEnded } from '../lib/matchClock';
import { del } from '../lib/store';

export function newMatch(availableIds: string[], teamId: string, format: FormatId = '8v8'): Match {
  return { id: uid(), teamId, name: 'Match day', format, periods: 2, periodMinutes: 25, windowMinutes: 5, availableIds, locks: {}, carryOver: 'off',
    keys: ['Win it back fast', 'Spread wide', 'Talk to each other'], moveKey: 'give-and-go', focusValue: 'Play With Your Heart',
    halftimeGood: '', halftimeChange: '', celebrate: '', log: [], createdAt: Date.now() };
}

export default function MatchList() {
  const s = useAppState(); const nav = useNavigate(); const team = activeTeam(s);
  const mine = s.matches.filter((m) => m.teamId === team.id);
  return (
    <Page title="Matches" back={<Back to="/more" />}>
      <Card className="mb-4"><button className="btn h-16 w-full text-xl" onClick={() => { const m = newMatch(teamPlayers(s).filter((p) => !s.blocked.includes(p.id)).map((p) => p.id), team.id, team.defaultFormat); put('matches', m); nav(`/match/${m.id}`); }}>New match for {team.name}</button></Card>
      {mine.length === 0 && <Empty>No matches yet. Add your squad, then start a new match.</Empty>}
      <ul className="grid gap-2">{mine.sort((a, b) => b.createdAt - a.createdAt).map((m) => (
        <li key={m.id} className="card flex items-center justify-between p-3">
          <Link to={m.log.length ? `/match/${m.id}/live` : `/match/${m.id}`} className="flex-1"><div className="text-lg font-semibold">{m.name}</div>
            <div className="muted text-sm">{FORMATS[m.format].label} · {new Date(m.createdAt).toLocaleDateString('en-PH')} · {isEnded(m.log) ? 'finished' : m.log.length ? 'in progress' : 'setup'}</div></Link>
          <button className="btn ghost" aria-label="Delete match" onClick={() => confirm('Delete this match?') && del('matches', m.id)}>X</button></li>))}</ul>
    </Page>
  );
}
