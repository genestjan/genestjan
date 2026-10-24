import { Link } from 'react-router-dom';
import type { Emergency, Player } from '../lib/model';
import { put } from '../lib/store';

const blank = (): Emergency => ({ contacts: [{ name: '', phone: '' }], allergies: '', inhaler: false, note: '' });
/** What a family still needs to fill in (used for the reminder on the parent's home screen). */
export function missingDetails(p: Player): string[] {
  const e = p.emergency; const out: string[] = [];
  if (!(e?.birthDate || p.birthDate)) out.push('birthday');
  if (!e?.address?.trim()) out.push('address');
  if (!e?.contacts.some((c) => c.name.trim() && c.phone.trim())) out.push('an emergency contact');
  if (!e?.allergies.trim()) out.push('allergies (write "none" if there are none)');
  return out;
}
export const DetailsReminder = ({ p }: { p: Player }) => {
  const m = missingDetails(p); if (m.length === 0) return null;
  return <Link to={`/details/${p.id}`} className="card block p-4"><div className="text-xl font-semibold">Please finish {p.firstName}'s details</div><div className="muted">Still needed: {m.join(', ')}. Tap to fill in.</div></Link>;
};

/** The child's details and the health facts a coach needs in an emergency. Editable by the child's coaches and their own parents. */
export function EmergencyEditor({ p }: { p: Player }) {
  const em: Emergency = p.emergency ?? blank();
  const setEm = (patch: Partial<Emergency>) => put('players', { ...p, emergency: { ...em, ...patch } });
  const txt = (label: string, key: 'fullName' | 'address' | 'phone' | 'medication' | 'other', ph = '', type = 'text', mode?: 'tel') => (
    <label className="grid gap-1 text-sm font-semibold">{label}<input className="field" type={type} inputMode={mode} placeholder={ph} value={em[key] ?? ''} onChange={(e) => setEm({ [key]: e.target.value })} /></label>);
  return (
    <div className="grid gap-3">
      <h4 className="text-xl font-semibold">About the child</h4>
      {txt('Full name', 'fullName', `${p.firstName} ${p.lastName ?? ''}`.trim())}
      <label className="grid gap-1 text-sm font-semibold">Birthday<input className="field" type="date" max={new Date().toISOString().slice(0, 10)} value={em.birthDate ?? p.birthDate ?? ''} onChange={(e) => setEm({ birthDate: e.target.value })} /></label>
      {txt('Home address', 'address', 'Street, barangay, city')}
      {txt("Child's phone number (if they have one)", 'phone', '09...', 'tel', 'tel')}
      <h4 className="mt-2 text-xl font-semibold">Parent or guardian to call in an emergency</h4>
      {em.contacts.map((c, i) => (
        <div key={i} className="grid grid-cols-2 gap-2">
          <input className="field" placeholder="Name" aria-label={`Emergency contact ${i + 1} name`} value={c.name} onChange={(e) => setEm({ contacts: em.contacts.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)) })} />
          <input className="field" inputMode="tel" placeholder="Phone number" aria-label={`Emergency contact ${i + 1} phone`} value={c.phone} onChange={(e) => setEm({ contacts: em.contacts.map((x, k) => (k === i ? { ...x, phone: e.target.value } : x)) })} />
        </div>))}
      {em.contacts.length < 3 && <button className="btn ghost" onClick={() => setEm({ contacts: [...em.contacts, { name: '', phone: '' }] })}>Add another contact</button>}
      <h4 className="mt-2 text-xl font-semibold">Health</h4>
      <input className="field" placeholder="Allergies (or none)" aria-label="Allergies" value={em.allergies} onChange={(e) => setEm({ allergies: e.target.value })} />
      <label className="flex items-center gap-3"><input type="checkbox" className="h-6 w-6" checked={em.inhaler} onChange={(e) => setEm({ inhaler: e.target.checked })} />Uses an inhaler (asthma)</label>
      <input className="field" placeholder="Health condition a coach should know (or none)" aria-label="Condition" value={em.note} onChange={(e) => setEm({ note: e.target.value })} />
      {txt('Medication, and when it is taken (or none)', 'medication')}
      {txt('Anything else important', 'other', 'For example: fear of water, speaks Cebuano only')}
      <p className="muted text-sm">Only the child's coaches and the family can see this. It is used in an emergency and to look after your child at training. Please do not add medical reports or diagnoses.</p>
    </div>
  );
}
