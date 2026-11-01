import type { Rates, VehicleType } from './types';

/** Suggested starting rates per vehicle. Drivers can change them freely. */
export const DEFAULT_RATES: Record<VehicleType, Rates> = {
  motorcycle: { base: 40, perKm: 10, perMin: 1, minimum: 50 },
  tricycle: { base: 30, perKm: 8, perMin: 1, minimum: 40 },
  car: { base: 60, perKm: 15, perMin: 2, minimum: 90 },
  van: { base: 100, perKm: 20, perMin: 2, minimum: 150 },
};

export const PABILI_FEE = 30; // extra for buying items on the customer's behalf

export function computeFare(r: Rates, km: number, min: number, extra = 0): number {
  const raw = r.base + r.perKm * Math.max(0, km) + r.perMin * Math.max(0, min) + extra;
  return Math.round(Math.max(r.minimum, raw));
}

export const peso = (n: number) => '₱' + Math.round(n).toLocaleString('en-PH');
