import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Back, Card, Empty, Page, Tone } from '../components/ui';
import { put, teamPlayers, uid, useAppState } from '../lib/store';
import { squadAnnouncement, squadChanges, squadMessage } from '../lib/squadPick';
import { AGE_FIT_TEXT, ageFit, docsMissing, infoFor } from '../lib/school';
import { latestReply } from './Schedule';
import { FORMATS } from '../lib/types';
import { fmtDateTime } from '../lib/util';

/** Coach: choose who plays in this match, tournament or school meet; then tell the team and each picked family. */
export function PickSquad() {
  const { id } = useParams(); const s = useAppState();
  const e = s.events.find((x) => x.id === id);
  const [chosen, setChosen] = useState<string[] | null>(null);
  const [announce, setAnnounce] = useState(true); const [message, setMessage] = useState(true); const [onlyCat, setOnlyCat] = useState(true);
  const [done, setDone] = useState('');
  if (!e) return <Page title="Squad" back={<Back to="/schedule" />}><Empty>This event is not here any more.</Empty></Page>;
  const team = s.teams.find((t) => t.id === e.teamId); const info = infoFor(s.teamInfo, e.teamId);
  const picked = chosen ?? e.squad ?? [];
  const elig = (pid: string) => s.eligibility.find((x) => x.playerId === pid);
  const all = teamPlayers(s, e.teamId);
  const kids = e.type === 'meet' && e.category && onlyCat ? all.filter((k) => !elig(k.id)?.category || elig(k.id)?.category === e.category) : all;
  const toggle = (pid: string) => setChosen(picked.includes(pid) ? picked.filter((x) => x !== pid) : [...picked, pid]);
  const fmt = team ? FORMATS[team.defaultFormat] : undefined;
  const { added, removed } = squadChanges(e.squadAnnounced, picked);
  const first = !e.squadAnnounced?.length;
  const save = () => {
    const players = s.players.filter((p) => picked.includes(p.id));
    const tell = announce || message;
    put('events', { ...e, squad: picked, squadAnnounced: tell ? picked : e.squadAnnounced });
    const now = new Date().toISOString(); let msgs = 0;
    if (announce && players.length && (first || added.length || removed.length)) {
      const a = squadAnnouncement(e, players, !first);
      put('announcements', { id: uid(), scope: 'team', teamId: e.teamId, title: a.title, body: a.body, at: now, by: s.me.name, seenBy: [] });
    }
    if (message) for (const p of players.filter((x) => (first ? true : added.includes(x.id)))) {
      put('messages', { id: uid(), threadId: p.id, playerId: p.id, teamId: p.teamId, from: 'coach', byName: s.me.name, body: squadMessage(e, p), at: now, readBy: [] }); msgs++;
    }
    setChosen(null);
    setDone(`Saved ${players.length} in the squad.${announce && (first || added.length || removed.length) ? ' Posted to the team.' : ''}${msgs ? ` Sent ${msgs} family message${msgs === 1 ? '' : 's'}.` : ''}`);
  };
  return (
    <Page title="Pick the squad" back={<Back to={`/event/${e.id}`} />}>
      <p className="text-lg font-semibold">{e.title}</p>
      <p className="muted mb-3">{fmtDateTime(e.startsAt)}{e.category ? ` · ${e.category}` : ''}{fmt ? ` · ${fmt.label}: ${fmt.slots} start` : ''}</p>
      {e.type === 'meet' && e.category && <label className="mb-3 flex items-center gap-3"><input type="checkbox" className="h-6 w-6" checked={onlyCat} onChange={(x) => setOnlyCat(x.target.checked)} />Only show players in {e.category} (or with no category yet)</label>}
      <div className="mb-3 flex gap-2"><button className="btn ghost flex-1" onClick={() => setChosen(kids.filter((k) => !s.blocked.includes(k.id)).map((k) => k.id))}>Pick everyone shown</button><button className="btn ghost flex-1" onClick={() => setChosen([])}>Clear</button></div>
      <div className="grid gap-2" data-tour="pick-list">
        {kids.map((k) => {
          const out = s.blocked.includes(k.id); const said = latestReply(s, e.id, k.id)?.status; const el = elig(k.id);
          const fit = e.type === 'meet' ? ageFit(k, el, info) : 'ok'; const miss = e.type === 'meet' ? docsMissing(el).length : 0;
          return (
            <label key={k.id} className={`card flex items-start gap-3 p-3 ${out ? 'opacity-60' : ''}`}>
              <input type="checkbox" className="mt-1 h-6 w-6" disabled={out} checked={picked.includes(k.id)} onChange={() => toggle(k.id)} aria-label={`Pick ${k.firstName}`} />
              <span className="grid gap-0.5"><span className="text-lg font-semibold">{k.firstName}{k.number ? ` #${k.number}` : ''}</span>
                {out && <span className="text-sm text-red">Out after a head knock</span>}
                {said && <span className="muted text-sm">Parent said: {said === 'no' ? 'not going' : said}</span>}
                {e.type === 'meet' && <span className={`text-sm ${fit === 'too-old' ? 'font-semibold text-red' : 'muted'}`}>{[el?.category || 'No category yet', fit !== 'no-category' ? AGE_FIT_TEXT[fit] : '', miss ? `${miss} paper${miss === 1 ? '' : 's'} missing` : 'papers ready'].filter(Boolean).join(' · ')}</span>}
              </span>
            </label>);
        })}
      </div>
      <Card className="mt-4 grid gap-2">
        <div className="text-lg font-semibold">{picked.length} picked{!first && (added.length || removed.length) ? ` (${added.length} added, ${removed.length} taken off since the families were told)` : ''}</div>
        <label className="flex items-center gap-3"><input type="checkbox" className="h-6 w-6" checked={announce} onChange={(x) => setAnnounce(x.target.checked)} />Post the squad as a team announcement</label>
        <label className="flex items-center gap-3"><input type="checkbox" className="h-6 w-6" checked={message} onChange={(x) => setMessage(x.target.checked)} />Message each {first ? '' : 'newly '}picked child's family</label>
        <p className="muted text-sm">Every family in the team sees the announcement. Tell children who were not picked yourself first, kindly and in person.</p>
        <button className="btn h-14" disabled={picked.length === 0 && !e.squad?.length} onClick={save} data-tour="pick-send">{announce || message ? 'Save and tell the families' : 'Save the squad'}</button>
        {done && <Tone tone="ok">{done}</Tone>}
      </Card>
    </Page>
  );
}
