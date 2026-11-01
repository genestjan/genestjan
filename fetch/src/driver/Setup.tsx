import { useState } from 'react';
import { Car } from 'lucide-react';
import type { Backend } from '../lib/backend';
import type { Driver, Profile, VehicleType } from '../lib/types';
import { DEFAULT_RATES, peso, computeFare } from '../lib/fare';
import { compressImage } from '../lib/services';

const TYPES: [VehicleType, string, string][] = [['motorcycle', 'Motorcycle', '🏍️'], ['tricycle', 'Tricycle', '🛺'], ['car', 'Car', '🚗'], ['van', 'Van / L300', '🚐']];

export function Setup({ be, profile, initial, onSaved }: { be: Backend; profile: Profile; initial?: Driver | null; onSaved: () => void }) {
  const [d, setD] = useState<Driver>(initial ?? {
    id: profile.id, fullName: profile.fullName, phone: profile.phone, vehicleType: 'motorcycle', make: '', model: '', color: '', plate: '', vehiclePhoto: '',
    rates: DEFAULT_RATES.motorcycle, gcash: profile.phone, bank: '', online: false, location: null, rating: 5, ratingCount: 0, updatedAt: Date.now(),
  });
  const [err, setErr] = useState('');
  const plateOk = /^[A-Z0-9]{2,4}[ -]?[A-Z0-9]{2,5}$/i.test(d.plate.trim());
  const ok = d.make.trim() && d.model.trim() && d.color.trim() && plateOk && d.vehiclePhoto;
  const r = d.rates;
  const set = (k: keyof Driver['rates'], v: string) => setD({ ...d, rates: { ...r, [k]: Math.max(0, +v || 0) } });
  return (
    <form className="space-y-4 p-6 pt-safe pb-safe" onSubmit={async (e) => {
      e.preventDefault(); if (!ok) return;
      try { await be.put('drivers', { ...d, plate: d.plate.trim().toUpperCase(), updatedAt: Date.now() }); onSaved(); } catch (x) { setErr((x as Error).message); }
    }}>
      <div className="flex items-center gap-3"><Car className="h-8 w-8 text-neon" /><div><h2 className="text-xl font-extrabold">Your vehicle and rates</h2><p className="text-sm text-white/60">Customers choose by vehicle and plate number, so use your real details.</p></div></div>
      <div className="grid grid-cols-4 gap-2">{TYPES.map(([k, l, e]) => (
        <button type="button" key={k} onClick={() => setD({ ...d, vehicleType: k, rates: initial ? d.rates : DEFAULT_RATES[k] })} className={'rounded-2xl border p-2 text-center text-xs ' + (d.vehicleType === k ? 'border-neon bg-neon/15 text-neon' : 'border-white/10')}><span className="text-2xl">{e}</span><br />{l}</button>))}</div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label" htmlFor="mk">Make</label><input id="mk" className="input" placeholder="Honda" value={d.make} onChange={(e) => setD({ ...d, make: e.target.value })} /></div>
        <div><label className="label" htmlFor="md">Model</label><input id="md" className="input" placeholder="Click 125i" value={d.model} onChange={(e) => setD({ ...d, model: e.target.value })} /></div>
        <div><label className="label" htmlFor="cl">Colour</label><input id="cl" className="input" placeholder="Black" value={d.color} onChange={(e) => setD({ ...d, color: e.target.value })} /></div>
        <div><label className="label" htmlFor="pl">Plate number</label><input id="pl" className="input uppercase" placeholder="GA 1234" value={d.plate} onChange={(e) => setD({ ...d, plate: e.target.value })} /></div>
      </div>
      {d.plate && !plateOk && <p className="text-xs text-amber-300">Check the plate number, for example GA 1234 or NBA 4321.</p>}
      <label className="block"><span className="label">Photo of your vehicle showing the plate</span>
        <div className="flex h-32 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-white/20 bg-white/5">{d.vehiclePhoto ? <img src={d.vehiclePhoto} alt="" className="h-full w-full object-cover" /> : <span className="text-sm text-white/60">Tap to take a photo</span>}</div>
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setD({ ...d, vehiclePhoto: await compressImage(f, 700) }); }} /></label>
      <div className="card space-y-3">
        <p className="font-bold">Your rates (you decide)</p>
        <div className="grid grid-cols-2 gap-3">
          {([['base', 'Flag-down'], ['perKm', 'Per km'], ['perMin', 'Per minute'], ['minimum', 'Minimum fare']] as const).map(([k, l]) => (
            <div key={k}><label className="label" htmlFor={k}>{l} (₱)</label><input id={k} className="input" inputMode="decimal" value={r[k]} onChange={(e) => set(k, e.target.value)} /></div>))}
        </div>
        <p className="text-xs text-lime">Example 5 km, 15 min trip: {peso(computeFare(r, 5, 15))}</p>
      </div>
      <div className="card space-y-3">
        <p className="font-bold">How customers pay you</p>
        <div><label className="label" htmlFor="gc">GCash number</label><input id="gc" className="input" inputMode="tel" value={d.gcash} onChange={(e) => setD({ ...d, gcash: e.target.value })} /></div>
        <div><label className="label" htmlFor="bk">Bank and account number (optional)</label><input id="bk" className="input" placeholder="BDO 0012-3456-7890" value={d.bank} onChange={(e) => setD({ ...d, bank: e.target.value })} /></div>
      </div>
      {err && <p className="rounded-xl bg-red-500/20 p-3 text-sm text-red-200">{err}</p>}
      <button className="btn-neon w-full" disabled={!ok}>Save and continue</button>
    </form>
  );
}
