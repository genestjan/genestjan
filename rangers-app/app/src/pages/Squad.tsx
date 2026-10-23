import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Page } from '../components/ui';
import { DEMO_PLAYERS, exportBackup, importBackup, uid, update, useAppState } from '../lib/store';

export default function Squad() {
  const { players, blocked } = useAppState();
  const [paste, setPaste] = useState('');
  const add = () => {
    const rows = paste.split(/\n|,/).map((r) => r.trim()).filter(Boolean).map((r) => {
      const m = r.match(/^(\d+)\s+(.+)$/) ?? r.match(/^(.+?)\s+(\d+)$/);
      const num = m ? Number(/^\d+$/.test(m[1]) ? m[1] : m[2]) : undefined;
      const name = m ? (/^\d+$/.test(m[1]) ? m[2] : m[1]) : r;
      return { id: uid(), firstName: name, number: num, gkWilling: false };
    });
    update((s) => ({ ...s, players: [...s.players, ...rows] })); setPaste('');
  };
  const backup = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([exportBackup()], { type: 'application/json' })); a.download = `rangers-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); };
  return (
    <Page title="Squad" back={<Link to="/" className="btn ghost" aria-label="Home">Home</Link>}>
      <p className="muted mb-3">First names or nicknames only. Everything stays on this device.</p>
      <div className="card mb-4 p-4">
        <label className="mb-1 block font-semibold" htmlFor="paste">Add players (one per line, like "7 Ana")</label>
        <textarea id="paste" className="field py-3" rows={4} value={paste} onChange={(e) => setPaste(e.target.value)} />
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn" disabled={!paste.trim()} onClick={add}>Add</button>
          <button className="btn ghost" onClick={() => update((s) => ({ ...s, players: [...s.players, ...DEMO_PLAYERS.filter((d) => !s.players.some((p) => p.id === d.id))] }))}>Load demo team</button>
        </div>
      </div>
      <ul className="space-y-2">
        {players.map((p) => (
          <li key={p.id} className="card flex items-center gap-3 p-3">
            <span className="display w-10 text-center text-3xl">{p.number ?? '-'}</span>
            <span className="flex-1 text-lg">{p.firstName}{blocked.includes(p.id) && <span className="ml-2 text-red">(out: head knock)</span>}</span>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-6 w-6" checked={p.gkWilling} onChange={(e) => update((s) => ({ ...s, players: s.players.map((x) => (x.id === p.id ? { ...x, gkWilling: e.target.checked } : x)) }))} />Keeper</label>
            <button className="btn ghost" aria-label={`Remove ${p.firstName}`} onClick={() => confirm(`Remove ${p.firstName}?`) && update((s) => ({ ...s, players: s.players.filter((x) => x.id !== p.id) }))}>X</button>
          </li>
        ))}
      </ul>
      {blocked.length > 0 && <button className="btn ghost mt-4" onClick={() => confirm('Only a head coach should clear a player after medical advice. Clear all blocks?') && update((s) => ({ ...s, blocked: [] }))}>Head coach: clear head-knock blocks</button>}
      <div className="mt-6 flex flex-wrap gap-2">
        <button className="btn ghost" onClick={backup}>Back up to file</button>
        <label className="btn ghost cursor-pointer">Restore backup<input type="file" accept="application/json" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f && confirm('Replace everything on this device?')) importBackup(await f.text()); }} /></label>
      </div>
    </Page>
  );
}
