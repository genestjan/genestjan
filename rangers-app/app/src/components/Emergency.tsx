import type { Emergency, Player } from '../lib/model';
import { put } from '../lib/store';

/** Emergency contacts and the few health facts a coach needs. Editable by the child's coaches and their own parents. */
export function EmergencyEditor({ p }: { p: Player }) {
  const em: Emergency = p.emergency ?? { contacts: [{ name: '', phone: '' }], allergies: '', inhaler: false, note: '' };
  const setEm = (patch: Partial<Emergency>) => put('players', { ...p, emergency: { ...em, ...patch } });
  return (
    <div className="grid gap-3">
      {em.contacts.map((c, i) => (
        <div key={i} className="grid grid-cols-2 gap-2">
          <input className="field" placeholder="Contact name" aria-label={`Emergency contact ${i + 1} name`} value={c.name} onChange={(e) => setEm({ contacts: em.contacts.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)) })} />
          <input className="field" inputMode="tel" placeholder="Phone" aria-label={`Emergency contact ${i + 1} phone`} value={c.phone} onChange={(e) => setEm({ contacts: em.contacts.map((x, k) => (k === i ? { ...x, phone: e.target.value } : x)) })} />
        </div>))}
      {em.contacts.length < 2 && <button className="btn ghost" onClick={() => setEm({ contacts: [...em.contacts, { name: '', phone: '' }] })}>Add a second contact</button>}
      <input className="field" placeholder="Allergies (or none)" aria-label="Allergies" value={em.allergies} onChange={(e) => setEm({ allergies: e.target.value })} />
      <label className="flex items-center gap-3"><input type="checkbox" className="h-6 w-6" checked={em.inhaler} onChange={(e) => setEm({ inhaler: e.target.checked })} />Uses an inhaler (asthma)</label>
      <input className="field" placeholder="One condition a coach should know (optional)" aria-label="Condition" value={em.note} onChange={(e) => setEm({ note: e.target.value })} />
      <p className="muted text-sm">Only what a coach needs in an emergency. No diagnoses or reports.</p>
    </div>
  );
}
