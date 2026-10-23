import { Link, useNavigate } from 'react-router-dom';
import { Page } from '../components/ui';
import { uid, update, useAppState, type Match } from '../lib/store';
import { FORMATS } from '../lib/types';
import { isEnded } from '../lib/matchClock';

export function newMatch(availableIds: string[]): Match {
  return { id: uid(), name: 'Match day', format: '8v8', periods: 2, periodMinutes: 25, windowMinutes: 5, availableIds, locks: {}, carryOver: 'off',
    keys: ['Win it back fast', 'Spread wide', 'Talk to each other'], moveKey: 'give-and-go', focusValue: 'Play With Your Heart',
    halftimeGood: '', halftimeChange: '', celebrate: '', log: [], createdAt: Date.now() };
}

export default function Home() {
  const { players, matches } = useAppState();
  const nav = useNavigate();
  return (
    <Page title="Rangers FC">
      <p className="display mb-4 text-2xl text-red">Play with your heart</p>
      <div className="mb-6 grid gap-3">
        <button className="btn h-16 text-xl" onClick={() => { const m = newMatch(players.map((p) => p.id)); update((s) => ({ ...s, matches: [m, ...s.matches] })); nav(`/match/${m.id}`); }}>New match</button>
        <Link to="/squad" className="btn ghost h-14">Squad ({players.length})</Link>
        <Link to="/board" className="btn ghost h-14">Moves board</Link>
      </div>
      <h2 className="mb-2 text-3xl">Matches</h2>
      {matches.length === 0 && <p className="muted">No matches yet. Add your squad, then start a new match.</p>}
      <ul className="space-y-2">
        {matches.map((m) => (
          <li key={m.id} className="card flex items-center justify-between p-3">
            <Link to={m.log.length ? `/match/${m.id}/live` : `/match/${m.id}`} className="flex-1">
              <div className="text-lg font-semibold">{m.name}</div>
              <div className="muted text-sm">{FORMATS[m.format].label} · {new Date(m.createdAt).toLocaleDateString('en-PH')} · {isEnded(m.log) ? 'finished' : m.log.length ? 'in progress' : 'setup'}</div>
            </Link>
            <button className="btn ghost" aria-label="Delete match" onClick={() => confirm('Delete this match?') && update((s) => ({ ...s, matches: s.matches.filter((x) => x.id !== m.id) }))}>X</button>
          </li>
        ))}
      </ul>
    </Page>
  );
}
