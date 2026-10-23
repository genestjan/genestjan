import { useState } from 'react';
import { Back, Card, Empty, H2, Page, Tone } from '../components/ui';
import { del, put, teamPlayers, uid, useAppState } from '../lib/store';
import { fundTotals, nextCharge } from '../lib/fees';
import { isStaff, useMyChildren, useRole } from '../lib/role';
import { today } from '../lib/util';

const peso = (n: number) => '₱' + n.toLocaleString('en-PH');

export default function Support() {
  const s = useAppState(); const staff = isStaff(useRole());
  const [name, setName] = useState(''); const [target, setTarget] = useState('');
  const [item, setItem] = useState(''); const [size, setSize] = useState(''); const [qty, setQty] = useState('1');
  const [entry, setEntry] = useState<Record<string, { l: string; a: string }>>({});
  return (
    <Page title="Club support" back={<Back to="/more" />}>
      <p className="muted mb-3">Boots, balls, bibs and tournament fees are the club's biggest needs. Totals only: nobody sees who gave what or who needs what.</p>
      <H2>Tournament fund</H2>
      {s.funds.length === 0 && <Empty>No campaign yet.</Empty>}
      {s.funds.map((f) => { const t = fundTotals(f); return (
        <Card key={f.id} className="mb-3 grid gap-2"><div className="flex justify-between"><b className="text-xl">{f.tournament}</b><span>{peso(t.have)} of {peso(f.target)}</span></div>
          <div className="h-3 overflow-hidden rounded-full" style={{ background: 'var(--bg)' }}><div className="h-full bg-red" style={{ width: `${t.pct}%` }} /></div><p className="muted text-sm">Still needed: {peso(t.still)}. {f.items.map((i) => `${i.label} ${peso(i.amount)}`).join(', ')}</p>
          {staff && <div className="grid grid-cols-[1fr_6rem_auto] gap-2"><input className="field" placeholder="Received from (e.g. sponsor)" aria-label="Received from" value={entry[f.id]?.l ?? ''} onChange={(e) => setEntry({ ...entry, [f.id]: { l: e.target.value, a: entry[f.id]?.a ?? '' } })} /><input className="field" type="number" placeholder="₱" aria-label="Amount" value={entry[f.id]?.a ?? ''} onChange={(e) => setEntry({ ...entry, [f.id]: { l: entry[f.id]?.l ?? '', a: e.target.value } })} /><button className="btn" onClick={() => { const e = entry[f.id]; if (e?.a) { put('funds', { ...f, entries: [...f.entries, { id: uid(), label: e.l || 'Contribution', amount: +e.a, date: today() }] }); setEntry({ ...entry, [f.id]: { l: '', a: '' } }); } }}>Add</button></div>}
          {staff && <button className="btn ghost min-h-[44px] text-sm" onClick={() => confirm('Delete this campaign?') && del('funds', f.id)}>Delete campaign</button>}</Card>); })}
      {staff && <Card className="grid gap-2"><h3 className="text-2xl">New campaign</h3><input className="field" placeholder="Tournament name" aria-label="Tournament name" value={name} onChange={(e) => setName(e.target.value)} /><input className="field" type="number" placeholder="Target amount (₱)" aria-label="Target" value={target} onChange={(e) => setTarget(e.target.value)} /><button className="btn" disabled={!name || !target} onClick={() => { put('funds', { id: uid(), tournament: name, target: +target, items: [], entries: [] }); setName(''); setTarget(''); }}>Create</button></Card>}

      <H2>Equipment and boot bank</H2>
      <Card className="grid gap-2">{s.equipment.length === 0 && <p className="muted">Nothing listed.</p>}
        {s.equipment.map((q) => <div key={q.id} className="flex items-center gap-2"><span className="flex-1">{q.item}{q.size && ` (size ${q.size})`}</span>{staff ? <><button className="btn ghost min-h-[44px] px-3" aria-label="One less" onClick={() => put('equipment', { ...q, qty: Math.max(0, q.qty - 1) })}>-</button><b className="w-8 text-center">{q.qty}</b><button className="btn ghost min-h-[44px] px-3" aria-label="One more" onClick={() => put('equipment', { ...q, qty: q.qty + 1 })}>+</button></> : <b>{q.qty}</b>}</div>)}
        {staff && <div className="grid grid-cols-[1fr_5rem_4rem_auto] gap-2"><input className="field" placeholder="Item (boots, balls...)" aria-label="Item" value={item} onChange={(e) => setItem(e.target.value)} /><input className="field" placeholder="Size" aria-label="Size" value={size} onChange={(e) => setSize(e.target.value)} /><input className="field" type="number" aria-label="Quantity" value={qty} onChange={(e) => setQty(e.target.value)} /><button className="btn" disabled={!item} onClick={() => { put('equipment', { id: uid(), item, size, qty: +qty || 1 }); setItem(''); setSize(''); }}>Add</button></div>}
        <p className="muted text-sm">Needs to share? <button className="underline" onClick={() => { const need = s.equipment.filter((q) => q.qty <= 2).map((q) => `${q.item}${q.size ? ' size ' + q.size : ''}`); navigator.clipboard?.writeText(`Rangers FC needs: ${need.join(', ') || 'balls, boots, bibs'}. Message Coach James at +63 993 291 0764 to help a child play.`); }}>Copy a "we need" message for Facebook</button></p></Card>
      {staff && <BootRequests />}
      <Contributions />
    </Page>
  );
}

function BootRequests() {
  const s = useAppState(); const kids = teamPlayers(s); const [pid, setPid] = useState(''); const [size, setSize] = useState('');
  return (<><H2>Boot requests (coaches only)</H2><Card className="grid gap-2">
    {s.bootRequests.map((b) => <div key={b.id} className="flex items-center gap-2"><span className="flex-1">{s.players.find((p) => p.id === b.playerId)?.firstName}: size {b.size}</span><select className="field w-36" aria-label="Status" value={b.status} onChange={(e) => put('bootRequests', { ...b, status: e.target.value as typeof b.status })}><option value="needed">Needed</option><option value="matched">Matched</option><option value="given">Given</option></select></div>)}
    <div className="grid grid-cols-[1fr_5rem_auto] gap-2"><select className="field" aria-label="Child" value={pid} onChange={(e) => setPid(e.target.value)}><option value="">Child...</option>{kids.map((k) => <option key={k.id} value={k.id}>{k.firstName}</option>)}</select><input className="field" placeholder="Size" aria-label="Boot size" value={size} onChange={(e) => setSize(e.target.value)} /><button className="btn" disabled={!pid || !size} onClick={() => { put('bootRequests', { id: uid(), playerId: pid, size, status: 'needed' }); setPid(''); setSize(''); }}>Add</button></div></Card></>);
}

/** Optional contributions: only shown if the club switched them on. A parent only ever sees their own child's. */
export function Contributions() {
  const s = useAppState(); const staff = isStaff(useRole()); const kids = useMyChildren(); const [ref, setRef] = useState<Record<string, string>>({}); const [err, setErr] = useState('');
  const [pid, setPid] = useState(''); const [label, setLabel] = useState('Monthly contribution'); const [amt, setAmt] = useState('');
  if (!s.settings.contributionsOn) return staff ? <><H2>Contributions</H2><Card className="muted">Switched off. Turn them on in Settings only if Coach James wants them. Most families cannot spend on football.</Card></> : null;
  const mine = staff ? s.charges : s.charges.filter((c) => kids.some((k) => k.id === c.playerId));
  const refOf = (id: string) => s.chargeRefs.find((r) => r.chargeId === id);
  const statusOf = (c: typeof mine[number]) => (c.status === 'due' && refOf(c.id) ? 'submitted' : c.status);
  return (<>
    <H2>Contributions</H2>
    {!staff && s.settings.gcashNumber && <Card className="mb-2">Pay by GCash to <b>{s.settings.gcashNumber}</b>, then enter the 13-digit reference number below. A coach will confirm it. If money is tight, tell a coach quietly: nobody else can see this.</Card>}
    <div className="grid gap-2">{mine.length === 0 && <Empty>Nothing due.</Empty>}
      {mine.map((c) => { const k = s.players.find((p) => p.id === c.playerId); const st = statusOf(c); const r = refOf(c.id); return (
        <Card key={c.id} className="grid gap-2"><div className="flex justify-between"><span><b>{c.label}</b>{staff && ` · ${k?.firstName}`}</span><span>{peso(c.amount)} · <b className={st === 'paid' ? 'text-[#2e8b57]' : ''}>{st === 'due' ? 'Due ' + c.dueOn : st === 'submitted' ? 'Waiting for coach' : st === 'paid' ? 'Paid' : 'Waived'}</b></span></div>
          {!staff && st === 'due' && <div className="flex gap-2"><input className="field" inputMode="numeric" maxLength={13} placeholder="13-digit GCash reference" aria-label="GCash reference" value={ref[c.id] ?? ''} onChange={(e) => setRef({ ...ref, [c.id]: e.target.value.replace(/\D/g, '') })} /><button className="btn" onClick={() => { try { nextCharge(c, 'submit', ref[c.id]); put('chargeRefs', { id: uid(), chargeId: c.id, playerId: c.playerId, reference: ref[c.id], at: new Date().toISOString() }); setErr(''); } catch (e) { setErr((e as Error).message); } }}>Send</button></div>}
          {staff && st === 'submitted' && r && <div className="flex items-center gap-2"><span className="flex-1 text-sm">Ref {r.reference}</span><button className="btn min-h-[44px]" onClick={() => put('charges', nextCharge({ ...c, reference: r.reference, status: 'submitted' }, 'confirm'))}>Confirm</button><button className="btn ghost min-h-[44px]" onClick={() => { del('chargeRefs', r.id); }}>Not received</button></div>}
          {staff && (st === 'due' || st === 'submitted') && <button className="btn ghost min-h-[44px] text-sm" onClick={() => put('charges', nextCharge({ ...c, status: st === 'submitted' ? 'submitted' : 'due' }, 'waive'))}>Waive quietly</button>}</Card>); })}
      {err && <Tone tone="bad">{err}</Tone>}</div>
    {staff && <Card className="mt-3 grid gap-2"><h3 className="text-2xl">New charge</h3><select className="field" aria-label="Child" value={pid} onChange={(e) => setPid(e.target.value)}><option value="">Child...</option>{teamPlayers(s).map((k) => <option key={k.id} value={k.id}>{k.firstName}</option>)}</select><div className="grid grid-cols-2 gap-2"><input className="field" aria-label="What for" value={label} onChange={(e) => setLabel(e.target.value)} /><input className="field" type="number" placeholder="₱" aria-label="Amount" value={amt} onChange={(e) => setAmt(e.target.value)} /></div><button className="btn" disabled={!pid || !amt} onClick={() => { put('charges', { id: uid(), playerId: pid, label, amount: +amt, dueOn: today(), status: 'due' }); setAmt(''); }}>Add charge</button></Card>}
  </>);
}
