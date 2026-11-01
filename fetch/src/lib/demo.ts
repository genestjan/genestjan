/** Demo-only helpers: sample drivers and a robot driver so one person can try the full flow. */
import type { Backend } from './backend';
import { DEFAULT_RATES, computeFare } from './fare';
import type { Driver, LatLng, Trip } from './types';
import { route } from './services';
import { patch, applyCompletion } from './trip';

const mk = (id: string, fullName: string, vehicleType: Driver['vehicleType'], make: string, model: string, color: string, plate: string, p: LatLng, rating: number): Driver => ({
  id, fullName, phone: '09170000000', vehicleType, make, model, color, plate, vehiclePhoto: '', rates: DEFAULT_RATES[vehicleType],
  gcash: '0917 000 0000', bank: 'BDO 0000-1234-5678', online: true, location: p, rating, ratingCount: 120, updatedAt: Date.now(),
});

export async function seedDemoDrivers(be: Backend) {
  if (be.mode !== 'demo') return;
  const have = await be.list<Driver>('drivers');
  if (have.some((d) => d.id.startsWith('demo-'))) return;
  for (const d of [
    mk('demo-mark', 'Kuya Mark Santos', 'motorcycle', 'Honda', 'Click 125i', 'Black', 'GA 1234', { lat: 6.1185, lng: 125.1745 }, 4.9),
    mk('demo-jayson', 'Kuya Jayson Reyes', 'motorcycle', 'Yamaha', 'NMAX', 'Green', 'MC 5521', { lat: 6.1140, lng: 125.1680 }, 4.8),
    mk('demo-ana', 'Ate Ana Lim', 'car', 'Toyota', 'Vios', 'White', 'NBA 4321', { lat: 6.1210, lng: 125.1800 }, 4.9),
    mk('demo-bong', 'Kuya Bong Torres', 'tricycle', 'Honda', 'TMX 155', 'Blue', 'TR 0912', { lat: 6.1100, lng: 125.1750 }, 4.7),
  ]) await be.put('drivers', d);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function drive(be: Backend, tripId: string, from: LatLng, to: LatLng, step = 0.12) {
  const { line } = await route(from, to);
  // Resample so the car moves at an even pace.
  for (let i = 0; i < line.length; i += Math.max(1, Math.round(line.length * step / 4))) {
    const t = await be.get<Trip>('trips', tripId);
    if (!t || t.status === 'cancelled') return false;
    await patch(be, t, { driverLoc: line[i], ...(t.status === 'ongoing' ? { meterKm: t.estKm * (i / line.length), meterMin: t.estMin * (i / line.length) } : {}) });
    const d = await be.get<Driver>('drivers', t.driverId);
    if (d) await be.put('drivers', { ...d, location: line[i] });
    await sleep(900);
  }
  return true;
}

const running = new Set<string>();

/** Plays the driver's side for sample drivers: accept, drive, arrive, run the meter, finish. */
export async function robotDriver(be: Backend, tripId: string) {
  if (be.mode !== 'demo' || running.has(tripId)) return;
  running.add(tripId);
  try {
    let t = await be.get<Trip>('trips', tripId);
    if (!t || !t.driverId.startsWith('demo-')) return;
    const d = (await be.get<Driver>('drivers', t.driverId))!;
    const say = (text: string) => be.put('messages', { id: tripId + Date.now(), tripId, from: 'driver', text, at: Date.now() });
    if (t.status === 'requested') {
      await sleep(2000);
      await say(t.service === 'pabili' ? 'Hello po! Ako na bahala sa pabili ninyo. Papunta na po ako sa store.' : 'Hello po! Papunta na po ako. Kita tayo sa pick-up point.');
      t = (await be.get<Trip>('trips', tripId))!;
      if (t.status !== 'requested') return;
      await patch(be, t, { status: 'agreed' });
    }
    if (!(await drive(be, tripId, d.location ?? t.pickup, t.pickup))) return;
    t = (await be.get<Trip>('trips', tripId))!;
    await patch(be, t, { status: 'arrived', driverLoc: t.pickup });
    await say('Andito na po ako.');
    await sleep(2500);
    t = (await be.get<Trip>('trips', tripId))!;
    if (t.status === 'cancelled') return;
    await patch(be, t, { status: 'ongoing', meterStart: Date.now() });
    if (!(await drive(be, tripId, t.pickup, t.dropoff))) return;
    t = (await be.get<Trip>('trips', tripId))!;
    const meterFare = computeFare(d.rates, t.estKm, t.estMin, t.service === 'pabili' ? 30 : 0);
    await patch(be, t, { status: 'completed', driverLoc: t.dropoff, meterKm: t.estKm, meterMin: t.estMin, meterFare, itemsCost: t.service === 'pabili' ? Math.min(t.budget, Math.round(t.budget * 0.9)) : 0 });
    // The robot confirms payment as soon as the customer pays.
    for (let k = 0; k < 600; k++) {
      await sleep(1000);
      t = (await be.get<Trip>('trips', tripId))!;
      if (t.payRef || t.ratingByCustomer) { await patch(be, t, { paid: true, ratingByDriver: 5, commentByDriver: 'Salamat, suki!' }); await applyCompletion(be, { ...t, paid: true }); return; }
    }
  } finally {
    running.delete(tripId);
  }
}
