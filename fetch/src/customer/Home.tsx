import { useEffect, useMemo, useState } from 'react';
import { Bike, Crosshair, MapPin, Package, Search, ShoppingBag, Star } from 'lucide-react';
import type { Backend } from '../lib/backend';
import type { Driver, LatLng, PayMethod, Profile, ServiceType, VehicleType, Wallet } from '../lib/types';
import { MapView, icons, type MapMarker } from '../ui/MapView';
import { Sheet, PayPicker } from '../ui/Bits';
import { useLive } from '../ui/useData';
import { reverse, route, searchPlaces } from '../lib/services';
import { haversineKm, inMindanao } from '../lib/geo';
import { estimate, newTrip } from '../lib/trip';
import { peso } from '../lib/fare';
import { tierFor } from '../lib/points';
import { robotDriver } from '../lib/demo';

export type Draft = { service: ServiceType; pick?: { label: string; p: LatLng }; drop?: { label: string; p: LatLng }; items?: string };

const SERVICES: { k: ServiceType; label: string; sub: string; Icon: typeof Bike }[] = [
  { k: 'ride', label: 'Ride', sub: 'Sakay', Icon: Bike },
  { k: 'pabili', label: 'Pabili', sub: 'Buy for me', Icon: ShoppingBag },
  { k: 'delivery', label: 'Delivery', sub: 'Padala', Icon: Package },
];
const VEH: Record<VehicleType, string> = { motorcycle: 'Motorcycle', tricycle: 'Tricycle', car: 'Car', van: 'Van' };

function PlaceInput({ label, value, onPick, autoFocus }: { label: string; value?: string; onPick: (x: { label: string; p: LatLng }) => void; autoFocus?: boolean }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [res, setRes] = useState<{ label: string; p: LatLng }[]>([]);
  useEffect(() => { if (!open) return; const t = setTimeout(() => searchPlaces(q).then(setRes), 350); return () => clearTimeout(t); }, [q, open]);
  return (
    <div className="relative">
      <span className="label">{label}</span>
      <div className="relative"><Search className="absolute left-4 top-3.5 h-5 w-5 text-white/40" />
        <input className="input pl-12" autoFocus={autoFocus} placeholder={value || 'Search a place in GenSan or Mindanao'} value={q} onFocus={() => setOpen(true)} onChange={(e) => setQ(e.target.value)} aria-label={label} /></div>
      {value && !open && <p className="mt-1 truncate text-sm text-lime">{value}</p>}
      {open && (
        <div className="mt-2 max-h-56 overflow-y-auto rounded-2xl bg-coal">
          {res.map((r, i) => (
            <button key={i} className="flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left text-sm last:border-0" onClick={() => { onPick(r); setQ(''); setOpen(false); }}>
              <MapPin className="h-4 w-4 shrink-0 text-neon" />{r.label}</button>
          ))}
          {!res.length && <p className="p-4 text-sm text-white/50">No match yet. Keep typing or tap the map.</p>}
        </div>
      )}
    </div>
  );
}

export function Home({ be, me, wallet, gps, draft, setDraft }: { be: Backend; me: Profile; wallet: Wallet; gps: LatLng | null; draft: Draft; setDraft: (d: Draft) => void }) {
  const [pick, setPick] = useState<{ label: string; p: LatLng } | null>(null);
  const [mapTarget, setMapTarget] = useState<'pick' | 'drop'>('drop');
  const [plan, setPlan] = useState<{ km: number; min: number; line: LatLng[] } | null>(null);
  const [chosen, setChosen] = useState<Driver | null>(null);
  const [vehFilter, setVehFilter] = useState<VehicleType | 'all'>('all');
  const [items, setItems] = useState(draft.items ?? '');
  const [budget, setBudget] = useState(0);
  const [notes, setNotes] = useState('');
  const [offer, setOffer] = useState(0);
  const [useMeter, setUseMeter] = useState(true);
  const [pay, setPay] = useState<PayMethod>('cash');
  const [err, setErr] = useState('');
  const service = draft.service;
  const drop = draft.drop ?? null;
  useEffect(() => { if (draft.items) setItems(draft.items); }, [draft.items]);
  useEffect(() => { if (draft.pick) setPick(draft.pick); }, [draft.pick]);

  // Default pick-up is where the customer is standing.
  useEffect(() => { if (gps && !pick) reverse(gps).then((label) => setPick((p) => p ?? { label, p: gps })); }, [gps, pick]);
  useEffect(() => { if (pick && drop) route(pick.p, drop.p).then(setPlan); else setPlan(null); }, [pick, drop]);

  const [drivers] = useLive<Driver[]>(be, ['drivers'], () => be.list<Driver>('drivers', 'online', true as unknown as string), []);
  const near = useMemo(() => {
    const from = pick?.p ?? gps;
    return (drivers ?? [])
      .filter((d) => d.online && d.location && (vehFilter === 'all' || d.vehicleType === vehFilter))
      .map((d) => ({ d, away: from ? haversineKm(from, d.location!) : 0 }))
      .filter((x) => x.away < 30)
      .sort((a, b) => a.away - b.away);
  }, [drivers, pick, gps, vehFilter]);

  const labels = service === 'ride' ? ['Pick-up point', 'Where to?'] : service === 'pabili' ? ['Buy from (store)', 'Deliver to'] : ['Pick up parcel from', 'Deliver to'];
  const tier = tierFor(wallet.completedTrips);

  const book = async () => {
    if (!pick || !drop || !chosen || !plan) return;
    if (!inMindanao(drop.p)) return setErr('Fetch GenSan serves Mindanao only.');
    if (service !== 'ride' && !items.trim()) return setErr(service === 'pabili' ? 'List the items to buy.' : 'Describe the parcel.');
    const t = newTrip({ customer: me, driver: chosen, service, pickup: pick.p, pickupLabel: pick.label, dropoff: drop.p, dropoffLabel: drop.label, items, budget, notes, km: plan.km, min: plan.min, offer: offer || estimate(chosen.rates, service, plan.km, plan.min), useMeter, payMethod: pay });
    await be.put('trips', t);
    robotDriver(be, t.id);
  };

  const markers: MapMarker[] = [
    ...(gps ? [{ id: 'me', p: gps, icon: icons.me }] : []),
    ...(pick ? [{ id: 'pick', p: pick.p, icon: icons.pickup }] : []),
    ...(drop ? [{ id: 'drop', p: drop.p, icon: icons.drop }] : []),
    ...near.map(({ d }) => ({ id: d.id, p: d.location!, icon: icons.vehicle(d.vehicleType), onClick: () => setChosen(d) })),
  ];

  return (
    <div className="relative h-full">
      <MapView markers={markers} line={plan?.line} fit={[pick?.p, drop?.p].filter(Boolean) as LatLng[]}
        onPick={async (p) => { const label = await reverse(p); if (mapTarget === 'pick') setPick({ label, p }); else setDraft({ ...draft, drop: { label, p } }); }} />
      <div className="absolute inset-x-0 top-0 z-[500] flex items-center justify-between p-4 pt-safe">
        <div className="rounded-full bg-ink/80 px-4 py-2 text-sm backdrop-blur">Hi, <b>{me.fullName.split(' ')[0]}</b> 👋</div>
        <div className="flex items-center gap-1 rounded-full bg-neon px-3 py-2 text-sm font-bold text-ink"><Star className="h-4 w-4" />{wallet.points} pts · {tier.name}</div>
      </div>
      {gps && <button aria-label="Use my location as pick-up" onClick={() => reverse(gps).then((label) => setPick({ label, p: gps }))} className="absolute left-4 top-24 z-[500] rounded-full bg-ink/80 p-3"><Crosshair className="h-5 w-5 text-neon" /></button>}

      <Sheet>
        {!chosen ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {SERVICES.map(({ k, label, sub, Icon }) => (
                <button key={k} onClick={() => setDraft({ ...draft, service: k })} className={'rounded-2xl border p-3 text-center transition ' + (service === k ? 'border-neon bg-neon text-ink shadow-glow' : 'border-white/10 bg-white/5')}>
                  <Icon className="mx-auto h-7 w-7" /><p className="mt-1 font-bold">{label}</p><p className={'text-[11px] ' + (service === k ? 'text-ink/70' : 'text-white/50')}>{sub}</p>
                </button>
              ))}
            </div>
            <div onFocus={() => setMapTarget('pick')}><PlaceInput label={labels[0]} value={pick?.label} onPick={setPick} /></div>
            <div onFocus={() => setMapTarget('drop')}><PlaceInput label={labels[1]} value={drop?.label} onPick={(x) => setDraft({ ...draft, drop: x })} /></div>
            <p className="text-xs text-white/40">Tip: tap the map to drop a pin for the field you last tapped.</p>
            {service !== 'ride' && (
              <div className="space-y-2">
                <label className="label" htmlFor="items">{service === 'pabili' ? 'What should we buy?' : 'What are we delivering?'}</label>
                <textarea id="items" className="input min-h-20" placeholder={service === 'pabili' ? '2 Chickenjoy, 1 Coke Mismo, Biogesic x 4' : '1 small box, documents'} value={items} onChange={(e) => setItems(e.target.value)} />
                {service === 'pabili' && <><label className="label" htmlFor="budget">Item budget (you pay this back to the driver)</label>
                  <input id="budget" className="input" inputMode="numeric" value={budget || ''} placeholder="₱500" onChange={(e) => setBudget(+e.target.value.replace(/\D/g, ''))} /></>}
              </div>
            )}
            {plan && (
              <div>
                <div className="mb-2 flex items-center justify-between"><p className="font-bold">Choose your driver</p><p className="text-xs text-white/50">{plan.km.toFixed(1)} km · {Math.round(plan.min)} min</p></div>
                <div className="mb-2 flex gap-2 overflow-x-auto">{(['all', 'motorcycle', 'tricycle', 'car', 'van'] as const).map((v) => <button key={v} onClick={() => setVehFilter(v)} className={'chip shrink-0 ' + (vehFilter === v ? 'bg-neon text-ink' : 'bg-white/10')}>{v === 'all' ? 'All' : VEH[v]}</button>)}</div>
                <div className="space-y-2">
                  {near.map(({ d, away }) => (
                    <button key={d.id} onClick={() => { setChosen(d); setOffer(estimate(d.rates, service, plan.km, plan.min)); }} className="flex w-full items-center gap-3 rounded-2xl bg-white/5 p-3 text-left">
                      <div className="grid h-12 w-12 place-items-center rounded-xl bg-neon/15 text-2xl">{d.vehicleType === 'car' ? '🚗' : d.vehicleType === 'van' ? '🚐' : d.vehicleType === 'tricycle' ? '🛺' : '🏍️'}</div>
                      <div className="min-w-0 flex-1"><p className="truncate font-bold">{d.fullName}</p>
                        <p className="truncate text-xs text-white/60">{d.color} {d.make} {d.model} · <b className="text-white">{d.plate}</b></p>
                        <p className="text-xs text-lime">★ {d.rating.toFixed(1)} · {Math.max(1, Math.round(away * 3))} min away</p></div>
                      <p className="font-brand text-lg text-neon">{peso(estimate(d.rates, service, plan.km, plan.min))}</p>
                    </button>
                  ))}
                  {!near.length && <p className="rounded-2xl bg-white/5 p-4 text-sm text-white/60">No drivers online nearby right now. Try again in a few minutes.</p>}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <button className="text-sm text-white/60" onClick={() => setChosen(null)}>← Back to drivers</button>
            <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-neon/15 text-2xl">🏍️</div>
              <div className="flex-1"><p className="font-bold">{chosen.fullName}</p><p className="text-xs text-white/60">{chosen.color} {chosen.make} {chosen.model} · {chosen.plate}</p>
                <p className="text-xs text-white/50">Rate: {peso(chosen.rates.base)} + {peso(chosen.rates.perKm)}/km + {peso(chosen.rates.perMin)}/min</p></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setUseMeter(true)} className={'rounded-2xl border p-3 text-left ' + (useMeter ? 'border-neon bg-neon/15' : 'border-white/10')}><p className="font-bold">Metered</p><p className="text-xs text-white/60">Pay by actual km and time. Est. {peso(offer)}</p></button>
              <button onClick={() => setUseMeter(false)} className={'rounded-2xl border p-3 text-left ' + (!useMeter ? 'border-neon bg-neon/15' : 'border-white/10')}><p className="font-bold">Fixed offer</p><p className="text-xs text-white/60">Agree a price in chat first</p></button>
            </div>
            {!useMeter && <div><label className="label" htmlFor="offer">Your offer</label><input id="offer" className="input font-brand text-xl" inputMode="numeric" value={offer || ''} onChange={(e) => setOffer(+e.target.value.replace(/\D/g, ''))} /></div>}
            <div><p className="label">Payment</p><PayPicker value={pay} onChange={setPay} /></div>
            <textarea className="input min-h-16" placeholder="Note for the driver (landmark, gate colour)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            {tier.discount > 0 && <p className="rounded-xl bg-neon/10 p-3 text-sm text-lime">{tier.name} discount: {Math.round(tier.discount * 100)}% off at the end of this trip.</p>}
            {err && <p className="rounded-xl bg-red-500/20 p-3 text-sm text-red-200">{err}</p>}
            <button className="btn-neon w-full text-lg" onClick={book}>Send request</button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
