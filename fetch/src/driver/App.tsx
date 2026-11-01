import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, MessageCircle, Navigation, Power, Settings, Wallet as WalletIcon } from 'lucide-react';
import { makeBackend, uid as newId } from '../lib/backend';
import type { Driver, LatLng, Profile, Trip } from '../lib/types';
import { Intro } from '../ui/Intro';
import { Auth, ProfileForm, Pending, Logo } from '../ui/Auth';
import { George } from '../ui/George';
import { Chat, CallButton } from '../ui/Chat';
import { Rate, Sheet, Stars, PAY_LABEL } from '../ui/Bits';
import { MapView, icons, type MapMarker } from '../ui/MapView';
import { useGps, useLive } from '../ui/useData';
import { Setup } from './Setup';
import { patch, meterStep, applyCompletion, fareDue } from '../lib/trip';
import { computeFare, peso, PABILI_FEE } from '../lib/fare';
import { GENSAN, PLACES, haversineKm } from '../lib/geo';
import { route } from '../lib/services';
import type { Intent } from '../lib/assistant';

const be = makeBackend('driver');
type Tab = 'drive' | 'earnings' | 'account';

const gmaps = (p: LatLng) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`;

export default function App() {
  const [intro, setIntro] = useState(() => !sessionStorage.getItem('fetch:intro:d'));
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('drive');
  const [editing, setEditing] = useState(false);
  const [chat, setChat] = useState(false);
  const [counter, setCounter] = useState<Record<string, number>>({});
  const [itemsCost, setItemsCost] = useState(0);
  const { pos } = useGps(Boolean(uid));
  const doneIntro = useCallback(() => { sessionStorage.setItem('fetch:intro:d', '1'); setIntro(false); }, []);
  useEffect(() => { be.session().then(setUid); }, []);

  const [profile, reloadProfile] = useLive<Profile | null>(be, ['profiles'], async () => (uid ? be.get<Profile>('profiles', uid) : null), [uid]);
  const [me, reloadMe] = useLive<Driver | null>(be, ['drivers'], async () => (uid ? be.get<Driver>('drivers', uid) : null), [uid]);
  const [trips] = useLive<Trip[]>(be, ['trips'], async () => (uid ? (await be.list<Trip>('trips', 'driverId', uid)).sort((a, b) => b.createdAt - a.createdAt) : []), [uid]);

  const requests = (trips ?? []).filter((t) => t.status === 'requested' || t.status === 'negotiating');
  const active = (trips ?? []).find((t) => ['agreed', 'arrived', 'ongoing'].includes(t.status) || (t.status === 'completed' && (!t.paid || !t.ratingByDriver)));

  // Current position: the phone's GPS, or in demo mode a simulated car that drives to the target.
  const [sim, setSim] = useState<LatLng | null>(null);
  const here: LatLng | null = pos ? { lat: pos.lat, lng: pos.lng } : sim ?? me?.location ?? null;
  const target = active ? (active.status === 'ongoing' ? active.dropoff : active.pickup) : null;
  const [line, setLine] = useState<LatLng[]>();
  const hk = here ? here.lat.toFixed(3) + here.lng.toFixed(3) : '';
  useEffect(() => { if (here && target && active?.status !== 'completed') route(here, target).then((r) => setLine(r.line)); else setLine(undefined); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hk, target?.lat, active?.status]);

  useEffect(() => {
    if (be.mode !== 'demo' || pos || !line || line.length < 2 || !active || !['agreed', 'ongoing'].includes(active.status)) return;
    const t = setTimeout(() => setSim(line[Math.min(line.length - 1, Math.max(1, Math.round(line.length / 6)))]), 1200);
    return () => clearTimeout(t);
  }, [line, pos, active]);

  // Publish location every few seconds while online; run the meter while the trip is ongoing.
  const last = useRef<LatLng | null>(null);
  const hereRef = useRef(here); hereRef.current = here;
  useEffect(() => {
    if (!me?.online) return;
    const tick = async () => {
      const h = hereRef.current; if (!h) return;
      await be.put('drivers', { ...me, location: h, updatedAt: Date.now() });
      if (active && ['agreed', 'arrived', 'ongoing'].includes(active.status)) {
        const p: Partial<Trip> = { driverLoc: h };
        if (active.status === 'ongoing') {
          const km = active.meterKm + meterStep(last.current, h, pos?.acc ?? 10);
          const min = (Date.now() - (active.meterStart || Date.now())) / 60000;
          p.meterKm = km; p.meterMin = min; p.meterFare = computeFare(me.rates, km, min, active.service === 'pabili' ? PABILI_FEE : 0);
        }
        last.current = h;
        await patch(be, active, p);
      }
    };
    const iv = setInterval(tick, be.mode === 'demo' ? 1500 : 5000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.online, me?.rates, active?.id, active?.status, active?.meterKm]);

  const goOnline = async (on: boolean) => { if (me) await be.put('drivers', { ...me, online: on, location: here ?? me.location ?? GENSAN, updatedAt: Date.now() }); reloadMe(); };
  const accept = (t: Trip) => patch(be, t, { status: 'agreed' });

  const testRequest = async () => {
    const start = here ?? GENSAN;
    const drop = PLACES[1];
    const r = await route(start, drop.p);
    const t: Trip = {
      id: newId(), customerId: 'customer:demo', customerName: 'Maria Clara (demo)', customerPhone: '09180000000', driverId: me!.id, service: 'ride',
      pickup: { lat: start.lat + 0.004, lng: start.lng + 0.003 }, pickupLabel: 'Lagao Gym, GenSan', dropoff: drop.p, dropoffLabel: drop.label, items: '', budget: 0, itemsCost: 0, notes: 'Near the gate',
      estKm: r.km, estMin: r.min, estFare: computeFare(me!.rates, r.km, r.min), offer: computeFare(me!.rates, r.km, r.min), offerBy: 'customer', useMeter: true,
      meterStart: 0, meterKm: 0, meterMin: 0, meterFare: 0, discount: 0, pointsUsed: 0, tip: 0, finalFare: 0, payMethod: 'gcash', payRef: '', paid: false, status: 'requested',
      customerLoc: { lat: start.lat + 0.004, lng: start.lng + 0.003 }, driverLoc: start, ratingByCustomer: 0, commentByCustomer: '', ratingByDriver: 0, commentByDriver: '', createdAt: Date.now(), updatedAt: Date.now(),
    };
    await be.put('trips', t);
  };

  // Demo customer pays and rates automatically after a test trip.
  useEffect(() => {
    if (be.mode !== 'demo' || !active || active.customerId !== 'customer:demo' || active.status !== 'completed' || active.ratingByCustomer) return;
    const t = setTimeout(() => patch(be, active, { ratingByCustomer: 5, commentByCustomer: 'Very safe and friendly. Salamat kuya!', tip: 20, finalFare: fareDue(active) + 20, payRef: 'GC-' + Math.floor(Math.random() * 1e8) }), 2500);
    return () => clearTimeout(t);
  }, [active]);

  const handle = async (i: Intent): Promise<string | null> => {
    if (i.kind === 'goOnline') { await goOnline(i.on); return i.on ? 'You are online. I will tell you when a booking comes in.' : 'You are offline. Rest well.'; }
    if (i.kind === 'accept') { const r = requests[0]; if (!r) return 'There are no new requests.'; await accept(r); return `Accepted. Pick up ${r.customerName} at ${r.pickupLabel}.`; }
    if (i.kind === 'navigate') { if (!target) return 'No active trip to navigate to.'; window.open(gmaps(target), '_blank'); return 'Opening Google Maps.'; }
    if (!active) return i.kind === 'unknown' ? null : 'You have no active trip.';
    if (i.kind === 'call') { location.href = 'tel:' + active.customerPhone; return 'Calling ' + active.customerName + '.'; }
    if (i.kind === 'message') { await be.put('messages', { id: newId(), tripId: active.id, from: 'driver', text: i.text, at: Date.now() }); return 'Sent: ' + i.text; }
    if (i.kind === 'whereDriver') { if (!here || !target) return null; return `The ${active.status === 'ongoing' ? 'drop-off' : 'customer'} is ${haversineKm(here, target).toFixed(1)} kilometres away.`; }
    return null;
  };

  // Announce new requests out loud.
  const seen = useRef(new Set<string>());
  useEffect(() => {
    for (const r of requests) if (!seen.current.has(r.id)) { seen.current.add(r.id); navigator.vibrate?.([200, 100, 200]); }
  }, [requests]);

  const stats = useMemo(() => {
    const done = (trips ?? []).filter((t) => t.status === 'completed' && t.paid);
    const today = done.filter((t) => new Date(t.createdAt).toDateString() === new Date().toDateString());
    const sum = (a: Trip[]) => a.reduce((s, t) => s + (t.finalFare - (t.itemsCost || 0)), 0);
    return { done, today, todayTotal: sum(today), allTotal: sum(done), tips: done.reduce((s, t) => s + t.tip, 0) };
  }, [trips]);

  if (intro) return <Intro subtitle="DRIVER · RIDE · PABILI · DELIVER" onDone={doneIntro} />;
  if (uid === undefined) return null;
  if (!uid) return <Auth be={be} role="driver" onSignedIn={setUid} />;
  if (profile === undefined || me === undefined) return null;
  if (!profile) return <ProfileForm be={be} id={uid} role="driver" email={localStorage.getItem('fetch:email') ?? ''} onSaved={() => reloadProfile()} />;
  if (!me || editing) return <Setup be={be} profile={profile} initial={me} onSaved={() => { setEditing(false); reloadMe(); }} />;
  if (profile.verified !== 'approved') return <Pending onSignOut={() => be.signOut().then(() => setUid(null))} />;

  const markers: MapMarker[] = [
    ...(here ? [{ id: 'me', p: here, icon: icons.vehicle(me.vehicleType) }] : []),
    ...(active ? [{ id: 'cust', p: active.status === 'ongoing' ? active.dropoff : active.customerLoc ?? active.pickup, icon: active.status === 'ongoing' ? icons.drop : icons.customer }] : []),
    ...(!active ? requests.map((r) => ({ id: r.id, p: r.pickup, icon: icons.customer })) : []),
  ];

  return (
    <div className="flex h-full flex-col">
      <main className="relative flex-1 overflow-hidden">
        {tab === 'drive' && (
          <div className="relative h-full">
            <MapView markers={markers} line={line} fit={[here, target].filter(Boolean) as LatLng[]} />
            <div className="absolute inset-x-4 top-0 z-[500] flex items-center gap-2 pt-safe">
              <button onClick={() => goOnline(!me.online)} className={'btn flex-1 ' + (me.online ? 'bg-neon text-ink shadow-glow' : 'bg-ink/90 text-white')}><Power className="h-5 w-5" />{me.online ? 'You are ONLINE' : 'Go online'}</button>
              <div className="rounded-2xl bg-ink/90 px-3 py-3 text-sm"><b className="text-neon">{peso(stats.todayTotal)}</b> today</div>
            </div>
            <Sheet>
              {active ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-white text-2xl">🙋</div>
                    <div className="flex-1"><p className="font-bold">{active.customerName}</p><p className="text-xs capitalize text-lime">{active.service} · {PAY_LABEL[active.payMethod]} · {active.useMeter ? 'Metered' : 'Fixed ' + peso(active.offer)}</p></div>
                    <button className="btn-ghost !px-4" onClick={() => setChat(true)} aria-label="Chat"><MessageCircle className="h-5 w-5 text-neon" /></button>
                    <CallButton phone={active.customerPhone} />
                  </div>
                  <div className="rounded-2xl bg-white/5 p-3 text-sm"><p><span className="text-neon">●</span> {active.pickupLabel}</p><p><span className="text-red-400">⚑</span> {active.dropoffLabel}</p>
                    {active.items && <p className="mt-1 text-white/80">🛍 {active.items}{active.budget ? ` · budget ${peso(active.budget)}` : ''}</p>}{active.notes && <p className="text-white/60">📝 {active.notes}</p>}</div>
                  {active.status === 'ongoing' && (
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-2xl bg-white/5 p-2"><p className="text-xs text-white/50">km</p><p className="font-brand text-xl">{active.meterKm.toFixed(2)}</p></div>
                      <div className="rounded-2xl bg-white/5 p-2"><p className="text-xs text-white/50">min</p><p className="font-brand text-xl">{Math.round(active.meterMin)}</p></div>
                      <div className="rounded-2xl bg-neon/15 p-2"><p className="text-xs text-white/50">Meter</p><p className="font-brand text-xl text-neon">{peso(active.meterFare || me.rates.minimum)}</p></div>
                    </div>
                  )}
                  {target && active.status !== 'completed' && <a className="btn-ghost w-full" href={gmaps(target)} target="_blank" rel="noreferrer"><Navigation className="h-5 w-5" />Navigate with Google Maps</a>}
                  {active.status === 'agreed' && <button className="btn-neon w-full" onClick={() => patch(be, active, { status: 'arrived' })}>I have arrived</button>}
                  {active.status === 'arrived' && <button className="btn-neon w-full" onClick={() => { last.current = here; patch(be, active, { status: 'ongoing', meterKm: 0, meterMin: 0, meterFare: me.rates.minimum, meterStart: Date.now() }); }}>Start trip and meter</button>}
                  {active.status === 'ongoing' && (
                    <>
                      {active.service === 'pabili' && <div><label className="label" htmlFor="ic">Amount you paid for the items (₱)</label><input id="ic" className="input" inputMode="numeric" value={itemsCost || ''} onChange={(e) => setItemsCost(+e.target.value.replace(/\D/g, ''))} /></div>}
                      <button className="btn-neon w-full" onClick={() => patch(be, active, { status: 'completed', itemsCost, driverLoc: here ?? active.dropoff })}>Complete trip</button>
                    </>
                  )}
                  {['agreed', 'arrived'].includes(active.status) && <button className="w-full text-sm text-red-300" onClick={() => { if (confirm('Cancel this trip? Cancelling often lowers your rating.')) patch(be, active, { status: 'cancelled' }); }}>Cancel trip</button>}
                  {active.status === 'completed' && (
                    <div className="space-y-3">
                      <div className="rounded-2xl bg-white/5 p-3 text-center"><p className="text-sm text-white/60">Amount to collect</p><p className="font-brand text-4xl text-neon">{peso(active.finalFare || fareDue(active))}</p>
                        {active.tip > 0 && <p className="text-sm text-lime">Includes a {peso(active.tip)} tip 🎉</p>}
                        {active.payRef && active.payRef !== 'cash' && <p className="text-sm">Ref: {active.payRef}</p>}
                        {!active.ratingByCustomer && <p className="text-xs text-white/50">Waiting for the customer to pay and rate...</p>}</div>
                      {!active.paid && <button className="btn-neon w-full" disabled={!active.ratingByCustomer} onClick={async () => { await patch(be, active, { paid: true }); await applyCompletion(be, { ...active, paid: true }); }}><Banknote className="h-5 w-5" />Payment received</button>}
                      {active.paid && !active.ratingByDriver && <Rate title={`Rate ${active.customerName}`} onSubmit={(s, c) => patch(be, active, { ratingByDriver: s, commentByDriver: c })} />}
                    </div>
                  )}
                </div>
              ) : requests.length ? (
                <div className="space-y-3">
                  <p className="font-bold">New requests</p>
                  {requests.map((r) => (
                    <div key={r.id} className="card space-y-2 border-neon/40">
                      <div className="flex justify-between"><p className="font-bold capitalize">{r.service} · {r.customerName}</p><p className="font-brand text-xl text-neon">{peso(r.useMeter ? r.estFare : r.offer)}</p></div>
                      <p className="text-sm"><span className="text-neon">●</span> {r.pickupLabel}<br /><span className="text-red-400">⚑</span> {r.dropoffLabel}</p>
                      {r.items && <p className="text-sm text-white/80">🛍 {r.items}</p>}
                      <p className="text-xs text-white/50">{r.estKm.toFixed(1)} km · {Math.round(r.estMin)} min · {PAY_LABEL[r.payMethod]} · {r.useMeter ? 'Metered' : 'Customer offer'}{here ? ` · ${haversineKm(here, r.pickup).toFixed(1)} km to pick-up` : ''}</p>
                      {r.status === 'negotiating' ? <p className="text-sm text-lime">You offered {peso(r.offer)}. Waiting for the customer...</p> : (
                        <>
                          <div className="flex gap-2"><button className="btn-neon flex-1" onClick={() => accept(r)}>Accept</button><button className="btn-ghost" onClick={() => patch(be, r, { status: 'cancelled' })}>Decline</button></div>
                          <div className="flex gap-2"><input className="input !py-2" inputMode="numeric" placeholder="Counter offer ₱" value={counter[r.id] || ''} onChange={(e) => setCounter({ ...counter, [r.id]: +e.target.value.replace(/\D/g, '') })} aria-label="Counter offer" />
                            <button className="btn-ghost !py-2" disabled={!counter[r.id]} onClick={() => patch(be, r, { status: 'negotiating', offer: counter[r.id], offerBy: 'driver', useMeter: false })}>Send</button></div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3 text-center">
                  <p className="text-white/70">{me.online ? 'Waiting for bookings near you...' : 'Go online to receive bookings.'}</p>
                  {be.mode === 'demo' && me.online && <button className="btn-ghost w-full" onClick={testRequest}>Send me a test booking</button>}
                </div>
              )}
            </Sheet>
          </div>
        )}
        {tab === 'earnings' && (
          <div className="h-full space-y-4 overflow-y-auto p-4 pt-safe">
            <h1 className="text-2xl font-extrabold">Earnings</h1>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-3xl bg-gradient-to-br from-neon to-leaf p-4 text-ink"><p className="text-sm">Today</p><p className="font-brand text-3xl">{peso(stats.todayTotal)}</p><p className="text-xs">{stats.today.length} trips</p></div>
              <div className="card"><p className="text-sm text-white/60">All time</p><p className="font-brand text-3xl">{peso(stats.allTotal)}</p><p className="text-xs text-lime">Tips {peso(stats.tips)}</p></div>
            </div>
            <div className="card flex items-center justify-between"><div><p className="text-sm text-white/60">Your rating</p><p className="font-brand text-3xl">{me.rating.toFixed(2)}</p></div><Stars value={Math.round(me.rating)} size="h-5 w-5" /></div>
            <p className="font-bold">Reviews</p>
            {stats.done.filter((t) => t.commentByCustomer || t.ratingByCustomer).map((t) => (
              <div key={t.id} className="card"><Stars value={t.ratingByCustomer} size="h-4 w-4" /><p className="mt-1 text-sm">{t.commentByCustomer || 'No comment'}</p><p className="text-xs text-white/50">{t.customerName} · {new Date(t.createdAt).toLocaleDateString('en-PH')}</p></div>
            ))}
          </div>
        )}
        {tab === 'account' && (
          <div className="h-full space-y-4 overflow-y-auto p-4 pt-safe">
            <div className="flex items-center gap-3"><Logo small /><div><p className="text-xl font-extrabold">{me.fullName}</p><p className="text-sm text-white/60">{me.phone}</p></div></div>
            <div className="card text-sm"><p className="font-bold">{me.color} {me.make} {me.model}</p><p className="mt-1 inline-block rounded bg-white px-2 font-brand tracking-widest text-ink">{me.plate}</p>
              <p className="mt-2 text-white/70">{peso(me.rates.base)} flag-down · {peso(me.rates.perKm)}/km · {peso(me.rates.perMin)}/min · min {peso(me.rates.minimum)}</p></div>
            <button className="btn-ghost w-full" onClick={() => setEditing(true)}>Edit vehicle, rates and payment details</button>
            <button className="btn-ghost w-full text-red-300" onClick={() => goOnline(false).then(() => be.signOut()).then(() => setUid(null))}>Log out</button>
          </div>
        )}
      </main>
      <nav className="z-[600] grid grid-cols-3 border-t border-white/10 bg-ink pb-safe">
        {([['drive', 'Drive', Navigation], ['earnings', 'Earnings', WalletIcon], ['account', 'Account', Settings]] as const).map(([k, l, I]) => (
          <button key={k} onClick={() => setTab(k)} className={'flex flex-col items-center gap-0.5 py-2.5 text-xs ' + (tab === k ? 'text-neon' : 'text-white/50')}><I className="h-6 w-6" />{l}</button>
        ))}
      </nav>
      {chat && active && <Chat be={be} tripId={active.id} me="driver" otherName={active.customerName} otherPhone={active.customerPhone} onClose={() => setChat(false)} />}
      {tab === 'drive' && <George handle={handle} greeting={`Good day, ${me.fullName.split(' ')[0]}. George here. Say "go online" when you are ready.`} />}
    </div>
  );
}
