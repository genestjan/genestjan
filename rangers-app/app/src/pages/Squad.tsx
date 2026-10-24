import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, H2, Page, Tone } from '../components/ui';
import { DEMO_PLAYERS, exportBackup, importBackup, put, teamPlayers, uid, update, useAppState, activeTeam } from '../lib/store';
import { download } from '../lib/util';
import { cloudEnabled } from '../lib/cloud';
import { growthVelocity } from '../lib/growth';

export default function Squad() {
  const s = useAppState(); const team = activeTeam(s); const kids = teamPlayers(s);
  const [paste, setPaste] = useState('');
  const add = () => {
    paste.split(/\n|,/).map((r) => r.trim()).filter(Boolean).forEach((r) => {
      const m = r.match(/^(\d+)\s+(.+)$/) ?? r.match(/^(.+?)\s+(\d+)$/);
      const num = m ? Number(/^\d+$/.test(m[1]) ? m[1] : m[2]) : undefined; const name = m ? (/^\d+$/.test(m[1]) ? m[2] : m[1]) : r;
      put('players', { id: uid(), teamId: team.id, firstName: name, number: num, gkWilling: false, photoConsent: false });
    });
    setPaste('');
  };
  return (
    <Page title="Squad">
      {s.teams.length > 1 && <div className="mb-3 flex flex-wrap gap-2">{s.teams.map((t) => <button key={t.id} className={`btn px-4 ${t.id === team.id ? '' : 'ghost'}`} onClick={() => update((x) => ({ ...x, activeTeamId: t.id }))}>{t.name}</button>)}</div>}
      <p className="muted mb-3">{team.name}. First names or nicknames show on the kids' screens; last names stay with coaches.</p>
      <Card className="mb-4">
        <label className="mb-1 block font-semibold" htmlFor="paste">Add players (one per line, like "7 Ana")</label>
        <textarea id="paste" className="field py-3" rows={3} value={paste} onChange={(e) => setPaste(e.target.value)} />
        <div className="mt-3 flex flex-wrap gap-2"><button className="btn" disabled={!paste.trim()} onClick={add}>Add</button>
          {!cloudEnabled && <button className="btn ghost" onClick={() => update((x) => ({ ...x, players: [...x.players, ...DEMO_PLAYERS.filter((d) => !x.players.some((p) => p.id === d.id)).map((d) => ({ ...d, teamId: team.id }))] }))}>Load demo team</button>}</div>
      </Card>
      <ul className="grid gap-2">
        {kids.map((p) => { const g = growthVelocity(s.growth.filter((x) => x.playerId === p.id)); return (
          <li key={p.id}><Link to={`/player/${p.id}`} className="card flex items-center gap-3 p-3">
            <span className="display w-10 text-center text-3xl">{p.number ?? '-'}</span>
            <span className="flex-1 text-lg">{p.firstName}{s.blocked.includes(p.id) && <span className="ml-2 text-red"> out: head knock</span>}{g.status === 'spurt' && <span className="ml-2 text-sm text-red"> growth spurt</span>}</span>
            <span className="muted text-sm">{p.gkWilling ? 'keeper' : ''}</span></Link></li>); })}
      </ul>
      <H2>Whole squad tools</H2>
      <div className="grid gap-2">
        <Link className="btn ghost" to="/recognise">Recognise a child</Link>
        <Link className="btn ghost" to="/review">Term reviews</Link>
        <button className="btn ghost" onClick={() => download(`rangers-backup-${new Date().toISOString().slice(0, 10)}.json`, exportBackup())}>Back up to file</button>
        <label className="btn ghost cursor-pointer">Restore backup<input type="file" accept="application/json" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f && confirm('Replace everything on this device?')) { try { importBackup(await f.text()); alert('Backup restored.'); } catch (err) { alert((err as Error).message); } } }} /></label>
        {s.blocked.length > 0 && <Tone tone="bad">Clear head-knock blocks from each child's Health section (head coach only).</Tone>}
      </div>
    </Page>
  );
}
