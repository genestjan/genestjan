import { useEffect, useState } from 'react';
import { MessageCircle, Navigation, ShieldAlert } from 'lucide-react';
import type { Backend } from '../lib/backend';
import type { Driver, LatLng, Trip, Wallet } from '../lib/types';
import { MapView, icons, type MapMarker } from '../ui/MapView';
import { Chat, CallButton } from '../ui/Chat';
import { Rate, Sheet, PAY_LABEL } from '../ui/Bits';
import { useLive } from '../ui/useData';
import { patch, fareDue } from '../lib/trip';
import { peso } from '../lib/fare';
import { settle, maxRedeemable, tierFor } from '../lib/points';
import { haversineKm } from '../lib/geo';
import { route } from '../lib/services';
import { robotDriver } from '../lib/demo';

const STATUS: Record<Trip['status'], string> = {
  requested: 'Waiting for the driver to accept...',
  negotiating: 'The driver sent a new price',
  agreed: 'Your driver is on the way',
  arrived: 'Your driver has arrived',
  ongoing: 'On the way to your destination',
  completed: 'You have arrived',
  cancelled: 'Cancelled',
};

export function TripView({ be, trip, wallet, gps, onDone }: { be: Backend; trip: Trip; wallet: Wallet; gps: LatLng | null; onDone: () => void }) {
  const [driver] = useLive<Driver | null>(be, ['drivers'], () => be.get<Driver>('drivers', trip.driverId), [trip.driverId]);
  const [chat, setChat] = useState(false);
  const [line, setLine] = useState<LatLng[]>();
  const [usePts, setUsePts] = useState(false);
  const [ref, setRef] = useState('');
  useEffect(() => { robotDriver(be, trip.id); }, [be, trip.id]);

  // Share the customer's live location while waiting so the driver can find them.
  useEffect(() => {
    if (!gps || !['requested', 'negotiating', 'agreed', 'arrived'].includes(trip.status)) return;
    if (trip.customerLoc && haversineKm(trip.customerLoc, gps) < 0.02) return;
    const t = setTimeout(() => patch(be, trip, { customerLoc: gps }), 3000);
    return () => clearTimeout(t);
  }, [gps, trip, be]);

  const from = trip.driverLoc ?? driver?.location ?? null;
  const target = trip.status === 'ongoing' ? trip.dropoff : trip.pickup;
  const fk = from ? from.lat.toFixed(3) + from.lng.toFixed(3) : '';
  useEffect(() => { if (from && trip.status !== 'completed') route(from, target).then((r) => setLine(r.line)); else setLine([trip.pickup, trip.dropoff]); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fk, trip.status]);

  const eta = from ? Math.max(1, Math.round((haversineKm(from, target) * 1.3 / 25) * 60)) : null;
  const markers: MapMarker[] = [
    { id: 'pick', p: trip.pickup, icon: icons.pickup },
    { id: 'drop', p: trip.dropoff, icon: icons.drop },
    ...(gps ? [{ id: 'me', p: gps, icon: icons.me }] : []),
    ...(from ? [{ id: 'drv', p: from, icon: icons.vehicle(driver?.vehicleType ?? 'motorcycle') }] : []),
  ];

  const due = fareDue(trip);
  const ptsAvail = maxRedeemable(wallet.points, due);
  const s = (tip: number) => settle(due, wallet.completedTrips, usePts ? ptsAvail : 0, tip);
  const canCancel = ['requested', 'negotiating', 'agreed', 'arrived'].includes(trip.status);

  return (
    <div className="relative h-full">
      <MapView markers={markers} line={line} fit={from && trip.status !== 'completed' ? [from, target] : [trip.pickup, trip.dropoff]} />
      <div className="absolute inset-x-4 top-0 z-[500] pt-safe">
        <div className="rounded-2xl bg-neon p-3 text-ink shadow-glow">
          <p className="font-extrabold">{STATUS[trip.status]}</p>
          {eta && ['agreed', 'ongoing'].includes(trip.status) && <p className="text-sm">Arriving in about {eta} min</p>}
        </div>
      </div>
      <Sheet>
        {driver && (
          <div className="flex items-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-neon/15 text-3xl">{driver.vehicleType === 'car' ? '🚗' : '🏍️'}</div>
            <div className="min-w-0 flex-1"><p className="font-bold">{driver.fullName} <span className="text-xs text-lime">★ {driver.rating.toFixed(1)}</span></p>
              <p className="text-xs text-white/60">{driver.color} {driver.make} {driver.model}</p>
              <p className="mt-0.5 inline-block rounded-md bg-white px-2 font-brand text-sm tracking-widest text-ink">{driver.plate}</p></div>
            <button className="btn-ghost !px-4" onClick={() => setChat(true)} aria-label="Chat"><MessageCircle className="h-5 w-5 text-neon" /></button>
            <CallButton phone={driver.phone} />
          </div>
        )}
        <div className="mt-3 space-y-1 rounded-2xl bg-white/5 p-3 text-sm">
          <p><span className="text-neon">●</span> {trip.pickupLabel}</p>
          <p><span className="text-red-400">⚑</span> {trip.dropoffLabel}</p>
          {trip.items && <p className="text-white/70">🛍 {trip.items}{trip.budget ? ` (budget ${peso(trip.budget)})` : ''}</p>}
        </div>

        {trip.status === 'negotiating' && (
          <div className="mt-3 rounded-2xl border border-neon/40 p-3">
            <p>Driver offers <b className="font-brand text-xl text-neon">{peso(trip.offer)}</b></p>
            <div className="mt-2 flex gap-2"><button className="btn-neon flex-1" onClick={() => patch(be, trip, { status: 'agreed', useMeter: false })}>Accept</button>
              <button className="btn-ghost flex-1" onClick={() => setChat(true)}>Discuss</button></div>
          </div>
        )}

        {trip.status === 'ongoing' && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-white/5 p-2"><p className="text-xs text-white/50">Distance</p><p className="font-brand">{trip.meterKm.toFixed(1)} km</p></div>
            <div className="rounded-2xl bg-white/5 p-2"><p className="text-xs text-white/50">Time</p><p className="font-brand">{Math.round(trip.meterMin)} min</p></div>
            <div className="rounded-2xl bg-neon/15 p-2"><p className="text-xs text-white/50">{trip.useMeter ? 'Meter' : 'Agreed'}</p><p className="font-brand text-neon">{peso(trip.useMeter ? trip.meterFare || trip.estFare : trip.offer)}</p></div>
          </div>
        )}

        {trip.status === 'completed' && !trip.ratingByCustomer && (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl bg-white/5 p-3 text-sm">
              <div className="flex justify-between"><span>{trip.useMeter ? `Meter (${trip.meterKm.toFixed(1)} km, ${Math.round(trip.meterMin)} min)` : 'Agreed fare'}</span><span>{peso(trip.useMeter ? trip.meterFare : trip.offer)}</span></div>
              {trip.itemsCost > 0 && <div className="flex justify-between"><span>Pabili items</span><span>{peso(trip.itemsCost)}</span></div>}
              {s(0).discount > 0 && <div className="flex justify-between text-lime"><span>{tierFor(wallet.completedTrips).name} discount</span><span>-{peso(s(0).discount)}</span></div>}
              {ptsAvail > 0 && <label className="mt-2 flex items-center justify-between"><span>Use {ptsAvail} suki points</span><input type="checkbox" checked={usePts} onChange={(e) => setUsePts(e.target.checked)} className="h-5 w-5 accent-[#7ff004]" /></label>}
              <div className="mt-2 flex justify-between border-t border-white/10 pt-2 text-lg font-extrabold"><span>Total ({PAY_LABEL[trip.payMethod]})</span><span className="text-neon">{peso(s(0).total)}</span></div>
            </div>
            {trip.payMethod !== 'cash' && driver && (
              <div className="rounded-2xl border border-white/10 p-3 text-sm">
                <p className="font-bold">{trip.payMethod === 'gcash' ? `Send to GCash ${driver.gcash}` : `Transfer to ${driver.bank}`}</p>
                <p className="text-white/60">Account name: {driver.fullName}. Enter the reference number after you pay.</p>
                <input className="input mt-2" placeholder="Reference number" value={ref} onChange={(e) => setRef(e.target.value)} aria-label="Reference number" />
              </div>
            )}
            <Rate title="How was your trip?" withTip onSubmit={(stars, comment, tip) => {
              if (trip.payMethod !== 'cash' && !ref.trim()) { alert('Enter the payment reference number first.'); return; }
              const x = s(tip);
              patch(be, trip, { ratingByCustomer: stars, commentByCustomer: comment, tip, discount: x.discount, pointsUsed: x.pointsUsed, finalFare: x.total, payRef: ref.trim() || 'cash' });
            }} />
          </div>
        )}
        {trip.status === 'completed' && trip.ratingByCustomer > 0 && (
          <div className="mt-4 space-y-3 text-center">
            <p className="text-lg font-extrabold">Salamat, suki! 💚</p>
            <p className="text-white/70">{trip.paid ? 'Payment confirmed by your driver.' : 'Waiting for the driver to confirm your payment...'}</p>
            <button className="btn-neon w-full" onClick={onDone}>Done</button>
          </div>
        )}
        {trip.status === 'cancelled' && <button className="btn-neon mt-4 w-full" onClick={onDone}>Book again</button>}

        <div className="mt-4 flex gap-2">
          {canCancel && <button className="btn-ghost flex-1 text-red-300" onClick={() => { if (confirm('Cancel this booking?')) patch(be, trip, { status: 'cancelled' }); }}>Cancel</button>}
          {['agreed', 'arrived', 'ongoing'].includes(trip.status) && (
            <>
              <button className="btn-ghost flex-1" onClick={() => navigator.share?.({ title: 'My Fetch GenSan trip', text: `I'm riding with ${driver?.fullName}, plate ${driver?.plate}. From ${trip.pickupLabel} to ${trip.dropoffLabel}.` })}><Navigation className="h-4 w-4" />Share trip</button>
              <a className="btn-danger flex-1" href="tel:911"><ShieldAlert className="h-4 w-4" />SOS 911</a>
            </>
          )}
        </div>
      </Sheet>
      {chat && driver && <Chat be={be} tripId={trip.id} me="customer" otherName={driver.fullName} otherPhone={driver.phone} onClose={() => setChat(false)} />}
    </div>
  );
}
