import type { Ride } from '../types.ts';

/** Cycling MET values from the Compendium of Physical Activities, by average speed in km/h. */
function metFor(kmh: number): number {
  if (kmh < 16) return 4.0;
  if (kmh < 19) return 6.8;
  if (kmh < 22.5) return 8.0;
  if (kmh < 25.5) return 10.0;
  if (kmh <= 30.5) return 12.0;
  return 15.8;
}

/** Estimated kilocalories for one ride: MET x body weight (kg) x hours of moving time. */
export function rideCalories(ride: Pick<Ride, 'distanceM' | 'movingMs'>, weightKg: number): number {
  if (!(ride.movingMs > 0) || !(weightKg > 0)) return 0;
  const hours = ride.movingMs / 3600000;
  const kmh = Math.max(0, ride.distanceM) / 1000 / hours;
  return Math.round(metFor(kmh) * weightKg * hours);
}

export function totalCalories(rides: Ride[], weightKg: number): number {
  let sum = 0;
  for (const r of rides) sum += rideCalories(r, weightKg);
  return sum;
}
