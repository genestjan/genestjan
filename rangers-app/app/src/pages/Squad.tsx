import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Card, CLUB_PHOTO, Empty, Hero, IconChip, Page, Row, SectionHead, Tone } from '../components/ui';
import { Award, ClipboardList, Download, IdCard, Upload, UserPlus } from 'lucide-react';
import { PROGRAMMES } from '../lib/model';
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
    <Page title="Team">
      <Hero image={CLUB_PHOTO[team.programme]} className="mb-4 min-h-[180px]">
        <div className="flex min-h-[180px] flex-col justify-end p-4 text-white"><div className="text-2xl font-bold leading-tight drop-shadow">{PROGRAMMES[team.programme].name}</div><div className="text-sm opacity-90">{team.name} · {kids.length} player{kids.length === 1 ? '' : 's'}</div></div>
      </Hero>
      {s.teams.length > 1 && <div className="mb-3 flex gap-2 overflow-x-auto pb-1">{s.teams.map((t) => <button key={t.id} className={`btn shrink-0 px-4 ${t.id === team.id ? '' : 'ghost'}`} onClick={() => update((x) => ({ ...x, activeTeamId: t.id }))}>{t.name}</button>)}</div>}
      <ul className="grid gap-2">
        {kids.map((p) => { const g = growthVelocity(s.growth.filter((x) => x.playerId === p.id)); const flags = [p.gkWilling ? 'Keeper' : '', s.blocked.includes(p.id) ? 'Out: head knock' : '', g.status === 'spurt' ? 'Growth spurt' : ''].filter(Boolean); return (
          <li key={p.id}><Row to={`/player/${p.id}`} lead={<Avatar name={p.firstName} number={p.number} />} title={<span className="text-lg">{p.firstName}{p.lastName ? ` ${p.lastName}` : ''}</span>} sub={<>{p.number ? `#${p.number}` : 'No number'}{flags.length ? ' · ' : ''}{flags.map((f) => <span key={f} className={f.startsWith('Out') || f.startsWith('Growth') ? 'text-red' : ''}>{f} </span>)}</>} /></li>); })}
      </ul>
      {kids.length === 0 && <Empty>No players yet. Add them below.</Empty>}
      <SectionHead title="Add players" />
      <Card>
        <label className="mb-1 block text-sm font-semibold" htmlFor="paste">One per line, like "7 Ana". First names or nicknames show on the kids' screens; last names stay with coaches.</label>
        <textarea id="paste" data-tour="squad-add" className="field py-3" rows={3} value={paste} onChange={(e) => setPaste(e.target.value)} />
        <div className="mt-3 flex flex-wrap gap-2"><button className="btn" disabled={!paste.trim()} onClick={add}><UserPlus size={20} />Add</button>
          {!cloudEnabled && <button className="btn ghost" onClick={() => update((x) => ({ ...x, players: [...x.players, ...DEMO_PLAYERS.filter((d) => !x.players.some((p) => p.id === d.id)).map((d) => ({ ...d, teamId: team.id }))] }))}>Load demo team</button>}</div>
      </Card>
      <SectionHead title="Whole squad tools" />
      <div className="grid gap-2">
        <Row to="/recognise" lead={<IconChip icon={Award} />} title="Recognise a child" />
        <Row to="/review" lead={<IconChip icon={ClipboardList} />} title="Term reviews" />
        <Row to="/documents" lead={<IconChip icon={IdCard} />} title="ID papers" />
        <Row onClick={() => download(`rangers-backup-${new Date().toISOString().slice(0, 10)}.json`, exportBackup())} lead={<IconChip icon={Download} />} title="Back up to file" />
        <label className="card flex min-h-[64px] cursor-pointer items-center gap-3 p-3"><IconChip icon={Upload} /><span className="flex-1 font-semibold">Restore backup</span><input type="file" accept="application/json" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f && confirm('Replace everything on this device?')) { try { importBackup(await f.text()); } catch (err) { alert((err as Error).message); } } }} /></label>
        {s.blocked.length > 0 && <Tone tone="bad">Clear head-knock blocks from each child's Health section (head coach only).</Tone>}
      </div>
    </Page>
  );
}
