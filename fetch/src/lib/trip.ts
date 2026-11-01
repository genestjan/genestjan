import type { Backend } from './backend';
import { uid } from './backend';
import { computeFare, PABILI_FEE } from './fare';
import { haversineKm } from './geo';
import { pointsEarned } from './points';
import type { Driver, LatLng, Profile, Rates, ServiceType, Trip, Wallet, PayMethod } from './types';

export const ACTIVE: Trip['status'][] = ['requested', 'negotiating', 'agreed', 'arrived', 'ongoing'];

export function estimate(rates: Rates, service: ServiceType, km: number, min: number) {
  return computeFare(rates, km, min, service === 'ride' ? 0 : PABILI_FEE * (service === 'pabili' ? 1 : 0));
}

export function newTrip(a: {
  customer: Profile; driver: Driver; service: ServiceType; pickup: LatLng; pickupLabel: string; dropoff: LatLng; dropoffLabel: string;
  items: string; budget: number; notes: string; km: number; min: number; offer: number; useMeter: boolean; payMethod: PayMethod;
}): Trip {
  const now = Date.now();
  return {
    id: uid(), customerId: a.customer.id, customerName: a.customer.fullName, customerPhone: a.customer.phone, driverId: a.driver.id,
    service: a.service, pickup: a.pickup, pickupLabel: a.pickupLabel, dropoff: a.dropoff, dropoffLabel: a.dropoffLabel,
    items: a.items, budget: a.budget, itemsCost: 0, notes: a.notes, estKm: a.km, estMin: a.min,
    estFare: estimate(a.driver.rates, a.service, a.km, a.min), offer: a.offer, offerBy: 'customer', useMeter: a.useMeter,
    meterStart: 0, meterKm: 0, meterMin: 0, meterFare: 0, discount: 0, pointsUsed: 0, tip: 0, finalFare: 0, payMethod: a.payMethod, payRef: '', paid: false,
    status: 'requested', customerLoc: a.pickup, driverLoc: a.driver.location, ratingByCustomer: 0, commentByCustomer: '', ratingByDriver: 0,
    commentByDriver: '', createdAt: now, updatedAt: now,
  };
}

export const patch = (be: Backend, t: Trip, p: Partial<Trip>) => be.put('trips', { ...t, ...p, updatedAt: Date.now() });

/** The fare that is owed once the trip ends: meter or agreed price, plus pabili items. */
export const fareDue = (t: Trip) => (t.useMeter ? t.meterFare : t.offer) + (t.itemsCost || 0);

/**
 * Applied after a trip is paid and rated. In live mode a database trigger does this
 * (customers cannot write other people's rows); the demo does it in the browser.
 */
export async function applyCompletion(be: Backend, t: Trip) {
  if (be.mode !== 'demo') return;
  const w = (await be.get<Wallet>('wallets', t.customerId)) ?? { id: t.customerId, points: 0, completedTrips: 0 };
  await be.put('wallets', { ...w, points: w.points - t.pointsUsed + pointsEarned(t.finalFare - t.tip - (t.itemsCost || 0)), completedTrips: w.completedTrips + 1 });
  const d = await be.get<Driver>('drivers', t.driverId);
  if (d && t.ratingByCustomer) {
    const n = d.ratingCount + 1;
    await be.put('drivers', { ...d, rating: (d.rating * d.ratingCount + t.ratingByCustomer) / n, ratingCount: n });
  }
}

/** Live meter: adds GPS movement, ignoring jitter and impossible jumps. */
export function meterStep(prev: LatLng | null, next: LatLng, accuracy: number) {
  if (!prev || accuracy > 60) return 0;
  const km = haversineKm(prev, next);
  if (km < 0.01 || km > 2) return 0;
  return km;
}
