import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, Gift, Home as HomeIcon, User } from 'lucide-react';
import { makeBackend } from '../lib/backend';
import type { Driver, Profile, Trip, Wallet } from '../lib/types';
import { Intro } from '../ui/Intro';
import { Auth, ProfileForm, Pending, Logo } from '../ui/Auth';
import { George } from '../ui/George';
import { Stars } from '../ui/Bits';
import { useGps, useLive } from '../ui/useData';
import { Home, type Draft } from './Home';
import { TripView } from './TripView';
import { ACTIVE, patch } from '../lib/trip';
import { peso } from '../lib/fare';
import { PLACES, haversineKm } from '../lib/geo';
import { tierFor, nextTier, tiers } from '../lib/points';
import { seedDemoDrivers } from '../lib/demo';
import type { Intent } from '../lib/assistant';

const be = makeBackend('customer');
type Tab = 'home' | 'activity' | 'rewards' | 'profile';

export default function App() {
  const [intro, setIntro] = useState(() => !sessionStorage.getItem('fetch:intro'));
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('home');
  const [draft, setDraft] = useState<Draft>({ service: 'ride' });
  const [closed, setClosed] = useState<string[]>([]);
  const { pos, err: gpsErr } = useGps(Boolean(uid));
  const gps = useMemo(() => (pos ? { lat: pos.lat, lng: pos.lng } : null), [pos]);
  const doneIntro = useCallback(() => { sessionStorage.setItem('fetch:intro', '1'); setIntro(false); }, []);

  useEffect(() => { be.session().then(setUid); seedDemoDrivers(be); }, []);
  const [profile, reloadProfile] = useLive<Profile | null>(be, ['profiles'], async () => (uid ? be.get<Profile>('profiles', uid) : null), [uid]);
  const [wallet] = useLive<Wallet>(be, ['wallets'], async () => (uid && (await be.get<Wallet>('wallets', uid))) || { id: uid ?? '', points: 0, completedTrips: 0 }, [uid]);
  const [trips] = useLive<Trip[]>(be, ['trips'], async () => (uid ? (await be.list<Trip>('trips', 'customerId', uid)).sort((a, b) => b.createdAt - a.createdAt) : []), [uid]);

  const current = trips?.find((t) => !closed.includes(t.id) && (ACTIVE.includes(t.status) || (t.status === 'completed' && (!t.ratingByCustomer || Date.now() - t.updatedAt < 600000))));

  const handle = async (i: Intent): Promise<string | null> => {
    if (i.kind === 'book') {
      const place = i.place ? PLACES.find((p) => p.label === i.place) : undefined;
      setTab('home'); setDraft(i.service === 'pabili' ? { service: i.service, pick: place, items: i.items } : { service: i.service, drop: place, items: i.items });
      if (current) return 'You already have an active booking. I will keep you on it.';
      return `${i.service === 'ride' ? 'Ride' : i.service === 'pabili' ? 'Pabili' : 'Delivery'} it is${place ? ', to ' + place.label : ''}. ${i.service === 'pabili' && i.items ? 'I have added ' + i.items + ' to your list. ' : ''}Now choose your driver from the list.`;
    }
    if (i.kind === 'points') return `You have ${wallet?.points ?? 0} suki points and you are ${tierFor(wallet?.completedTrips ?? 0).name} level.`;
    if (!current) return i.kind === 'unknown' ? null : 'You have no active booking right now. Say "book a ride to SM" to start.';
    const d = await be.get<Driver>('drivers', current.driverId);
    if (i.kind === 'call') { if (d) location.href = 'tel:' + d.phone; return 'Calling ' + (d?.fullName ?? 'your driver') + '.'; }
    if (i.kind === 'message') { await be.put('messages', { id: crypto.randomUUID?.() ?? String(Date.now()), tripId: current.id, from: 'customer', text: i.text, at: Date.now() }); return 'Sent: ' + i.text; }
    if (i.kind === 'whereDriver') {
      const p = current.driverLoc ?? d?.location;
      if (!p) return 'I cannot see your driver yet.';
      const km = haversineKm(p, current.status === 'ongoing' ? current.dropoff : current.pickup);
      return `${d?.fullName ?? 'Your driver'} is about ${km.toFixed(1)} kilometres away, roughly ${Math.max(1, Math.round(km * 1.3 / 25 * 60))} minutes. Plate ${d?.plate}.`;
    }
    if (i.kind === 'cancel') { if (['ongoing', 'completed'].includes(current.status)) return 'The trip has started, so it can no longer be cancelled.'; await patch(be, current, { status: 'cancelled' }); return 'Your booking is cancelled.'; }
    return null;
  };

  if (intro) return <Intro subtitle="PABILI · PICK-UP · DELIVERY" onDone={doneIntro} />;
  if (uid === undefined) return null;
  if (!uid) return <Auth be={be} role="customer" onSignedIn={setUid} />;
  if (profile === undefined) return null;
  if (!profile) return <ProfileForm be={be} id={uid} role="customer" email={uid.replace(/^customer:/, '')} onSaved={() => reloadProfile()} />;
  if (profile.verified !== 'approved') return <Pending onSignOut={() => be.signOut().then(() => setUid(null))} />;
  const w = wallet ?? { id: uid, points: 0, completedTrips: 0 };

  return (
    <div className="flex h-full flex-col">
      <main className="relative flex-1 overflow-hidden">
        {tab === 'home' && (current
          ? <TripView be={be} trip={current} wallet={w} gps={gps} onDone={() => setClosed((c) => [...c, current.id])} />
          : <Home be={be} me={profile} wallet={w} gps={gps} draft={draft} setDraft={setDraft} />)}
        {tab === 'home' && gpsErr && !gps && <p className="absolute left-4 right-20 top-40 z-[600] rounded-xl bg-amber-500/90 p-2 text-xs text-ink">{gpsErr}</p>}
        {tab === 'activity' && (
          <div className="h-full space-y-3 overflow-y-auto p-4 pt-safe">
            <h1 className="text-2xl font-extrabold">My activity</h1>
            {!trips?.length && <p className="text-white/60">No trips yet.</p>}
            {trips?.map((t) => (
              <div key={t.id} className="card">
                <div className="flex justify-between"><p className="font-bold capitalize">{t.service}</p><p className="font-brand text-neon">{peso(t.finalFare || t.offer)}</p></div>
                <p className="truncate text-sm text-white/70">{t.pickupLabel} → {t.dropoffLabel}</p>
                <div className="mt-1 flex justify-between text-xs text-white/50"><span>{new Date(t.createdAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</span><span className="capitalize">{t.status}</span></div>
                {t.ratingByCustomer > 0 && <div className="mt-1"><Stars value={t.ratingByCustomer} size="h-4 w-4" /></div>}
              </div>
            ))}
          </div>
        )}
        {tab === 'rewards' && (
          <div className="h-full space-y-4 overflow-y-auto p-4 pt-safe">
            <h1 className="text-2xl font-extrabold">Suki rewards</h1>
            <div className="rounded-3xl bg-gradient-to-br from-neon to-leaf p-5 text-ink shadow-glow">
              <p className="text-sm font-semibold">Your points</p><p className="font-brand text-5xl">{w.points}</p>
              <p className="mt-1 font-bold">{tierFor(w.completedTrips).name} · {Math.round(tierFor(w.completedTrips).discount * 100)}% off every trip</p>
              {nextTier(w.completedTrips) && <p className="text-sm">{nextTier(w.completedTrips)!.min - w.completedTrips} more trips to {nextTier(w.completedTrips)!.name}</p>}
            </div>
            <div className="card space-y-2 text-sm">
              <p className="font-bold">How it works</p>
              <p>Earn 1 point for every ₱10 you pay. Use points like cash, 1 point = ₱1, up to half of a fare.</p>
              {tiers.map((t) => <div key={t.name} className="flex justify-between border-t border-white/5 pt-2"><span>{t.name}</span><span className="text-white/60">{t.min}+ trips · {Math.round(t.discount * 100)}% off</span></div>)}
            </div>
          </div>
        )}
        {tab === 'profile' && (
          <div className="h-full space-y-4 overflow-y-auto p-4 pt-safe">
            <div className="flex items-center gap-3"><Logo small /><div><p className="text-xl font-extrabold">{profile.fullName}</p><p className="text-sm text-white/60">{profile.phone} · {profile.email}</p></div></div>
            <div className="card text-sm"><p>✅ Verified with {profile.idType}</p>{be.mode === 'demo' && <p className="mt-2 text-lime">Demo mode: data stays on this phone only.</p>}</div>
            <a className="btn-ghost w-full" href={import.meta.env.BASE_URL + 'driver/'}>Want to drive? Open the driver app</a>
            <a className="btn-ghost w-full" href="mailto:genestjan@genestjanramirez.com?subject=Fetch%20GenSan%20help">Help and support</a>
            <button className="btn-ghost w-full text-red-300" onClick={() => be.signOut().then(() => setUid(null))}>Log out</button>
          </div>
        )}
      </main>
      <nav className="z-[600] grid grid-cols-4 border-t border-white/10 bg-ink pb-safe">
        {([['home', 'Book', HomeIcon], ['activity', 'Activity', Clock], ['rewards', 'Rewards', Gift], ['profile', 'Profile', User]] as const).map(([k, l, I]) => (
          <button key={k} onClick={() => setTab(k)} className={'flex flex-col items-center gap-0.5 py-2.5 text-xs ' + (tab === k ? 'text-neon' : 'text-white/50')}><I className="h-6 w-6" />{l}</button>
        ))}
      </nav>
      {tab === 'home' && <George handle={handle} greeting={`Good day, ${profile.fullName.split(' ')[0]}. George here. Where are we going?`} />}
    </div>
  );
}
