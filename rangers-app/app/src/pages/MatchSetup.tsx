import { Link, useNavigate, useParams } from 'react-router-dom';
import { Page } from '../components/ui';
import { put, useAppState, type Match } from '../lib/store';
import { FORMATS, type FormatId } from '../lib/types';
import { planFor } from '../lib/lineup';
import { KEY_PHRASES, PRESETS } from '../lib/presets';
import { PROGRAMMES } from '../lib/model';
import { statusFor } from './Schedule';

export default function MatchSetup() {
  const { id } = useParams();
  const nav = useNavigate();
  const st = useAppState(); const { matches, blocked, strategies, teams, events } = st;
  const all = useAppState().players;
  const m = matches.find((x) => x.id === id);
  if (!m) return <Page title="Match"><Link to="/match" className="btn">Matches</Link></Page>;
  const players = all.filter((p) => p.teamId === m.teamId && !p.left);
  const set = (patch: Partial<Match>) => put('matches', { ...m, ...patch });
  const avail = players.filter((p) => m.availableIds.includes(p.id) && !blocked.includes(p.id));
  const plan = planFor({ ...m, availableIds: avail.map((p) => p.id) }, all);
  const fmt = FORMATS[m.format];
  const enough = avail.length >= fmt.slots;
  const toggleKey = (k: string) => set({ keys: m.keys.includes(k) ? m.keys.filter((x) => x !== k) : m.keys.length < 3 ? [...m.keys, k] : m.keys });

  return (
    <Page title="Match setup" back={<Link to="/match" className="btn ghost">Back</Link>}>
      <div className="card mb-4 grid gap-3 p-4">
        <input className="field" aria-label="Match name" value={m.name} onChange={(e) => set({ name: e.target.value })} />
        <select className="field" aria-label="Format" value={m.format} onChange={(e) => set({ format: e.target.value as FormatId, locks: {} })}>
          {Object.values(FORMATS).map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <label>Periods<input type="number" min={1} max={4} className="field" value={m.periods} onChange={(e) => set({ periods: Math.max(1, +e.target.value), locks: {} })} /></label>
          <label>Minutes each<input type="number" min={5} max={45} className="field" value={m.periodMinutes} onChange={(e) => set({ periodMinutes: Math.max(5, +e.target.value) })} /></label>
          <label>Sub every (min)<input type="number" min={2} max={45} className="field" value={m.windowMinutes} onChange={(e) => set({ windowMinutes: Math.max(2, +e.target.value) })} /></label>
        </div>
        <label className="text-sm">Make up for missed minutes from earlier matches
          <select className="field" value={m.carryOver} onChange={(e) => set({ carryOver: e.target.value as Match['carryOver'] })}><option value="off">Off</option><option value="gentle">Gentle</option><option value="strong">Strong</option></select>
        </label>
      </div>

      <h2 className="mb-2 text-3xl">Who is here ({avail.length})</h2>
      {m.eventId && <button className="btn ghost mb-3" onClick={() => { const ev = events.find((e) => e.id === m.eventId); if (ev) set({ availableIds: players.filter((p) => statusFor(st, ev, p.id) === 'going').map((p) => p.id) }); }}>Use the parents' Going replies</button>}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {players.map((p) => {
          const out = blocked.includes(p.id);
          return (
            <label key={p.id} className={`card flex min-h-[48px] items-center gap-2 px-3 ${out ? 'opacity-40' : ''}`}>
              <input type="checkbox" className="h-6 w-6" disabled={out} checked={m.availableIds.includes(p.id) && !out}
                onChange={(e) => set({ availableIds: e.target.checked ? [...m.availableIds, p.id] : m.availableIds.filter((x) => x !== p.id) })} />
              <span>{p.number} {p.firstName}{out ? ' (out)' : ''}</span>
            </label>
          );
        })}
      </div>
      {players.length === 0 && <Link to="/squad" className="btn mb-4">Add your squad first</Link>}

      {fmt.hasKeeper && enough && (
        <div className="card mb-4 grid gap-2 p-4">
          <h3 className="text-2xl">Lock a keeper (optional)</h3>
          {Array.from({ length: m.periods }, (_, i) => (
            <label key={i} className="flex items-center justify-between gap-3 text-sm">Period {i + 1}
              <select className="field w-48" value={m.locks.gk?.[i] ?? ''} onChange={(e) => { const gk = { ...(m.locks.gk ?? {}) }; if (e.target.value) gk[i] = e.target.value; else delete gk[i]; set({ locks: { ...m.locks, gk } }); }}>
                <option value="">Auto</option>{avail.map((p) => <option key={p.id} value={p.id}>{p.firstName}</option>)}
              </select>
            </label>
          ))}
        </div>
      )}

      <h2 className="mb-2 text-3xl">Minutes plan</h2>
      {!enough ? <p className="card p-4">Need at least {fmt.slots} players here for {m.format}.</p> : (
        <div className="card mb-4 overflow-x-auto p-3">
          <p className="mb-2">Fairest gap: <b>{plan.spread} min</b> between most and least{plan.spread > m.windowMinutes ? ' (a long keeper stint or a big squad adds to this)' : ''}.</p>
          <table className="w-full text-center text-sm">
            <thead><tr><th className="text-left">Player</th>{plan.windows.map((w) => <th key={w.index}>{w.index + 1}</th>)}<th>Min</th></tr></thead>
            <tbody>{avail.map((p) => (
              <tr key={p.id}><td className="py-1 text-left">{p.firstName}</td>
                {plan.windows.map((w) => <td key={w.index} className={w.roles[p.id] === 'BENCH' ? 'muted' : w.roles[p.id] === 'GK' ? 'font-bold text-red' : 'font-semibold'}>{w.roles[p.id] === 'GK' ? 'G' : w.roles[p.id] === 'FIELD' ? 'on' : '-'}</td>)}
                <td className="font-semibold">{plan.minutes[p.id]}</td></tr>))}</tbody>
          </table>
        </div>
      )}

      <h2 className="mb-2 text-3xl">For the kids</h2>
      <div className="card mb-4 grid gap-3 p-4">
        <div><div className="mb-1 font-semibold">Our 3 keys ({m.keys.length}/3)</div>
          <div className="flex flex-wrap gap-2">{KEY_PHRASES.map((k) => <button key={k} className={`btn ${m.keys.includes(k) ? '' : 'ghost'}`} onClick={() => toggleKey(k)}>{k}</button>)}</div></div>
        <label className="text-sm">The move<select className="field" value={m.moveKey} onChange={(e) => set({ moveKey: e.target.value })}>{PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}{strategies.map((p) => <option key={p.id} value={p.id}>{p.name} (mine)</option>)}</select></label>
        <label className="text-sm">Focus value today<select className="field" value={m.focusValue} onChange={(e) => set({ focusValue: e.target.value })}>{PROGRAMMES[teams.find((t) => t.id === m.teamId)?.programme ?? 'rangers'].values.map((v) => <option key={v}>{v}</option>)}</select></label>
      </div>

      <div className="h-24" aria-hidden />
      <div className="fixed inset-x-0 z-30 flex gap-2 p-3" style={{ background: 'var(--bg)', bottom: 'calc(56px + env(safe-area-inset-bottom))' }}>
        <Link to={`/match/${m.id}/present`} className="btn ghost flex-1">Show the kids</Link>
        <button className="btn flex-1" disabled={!enough} onClick={() => nav(`/match/${m.id}/live`)}>Go to match</button>
      </div>
    </Page>
  );
}
