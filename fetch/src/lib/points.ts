/**
 * Suki points. 1 point for every ₱10 paid (tips excluded).
 * Tiers give an automatic discount; points can also be redeemed 1 point = ₱1.
 */
export const tiers = [
  { name: 'Bago', min: 0, discount: 0 },
  { name: 'Suki', min: 5, discount: 0.05 },
  { name: 'Suki Gold', min: 15, discount: 0.08 },
  { name: 'Suki Platinum', min: 40, discount: 0.1 },
] as const;

export function tierFor(completedTrips: number) {
  let t: (typeof tiers)[number] = tiers[0];
  for (const x of tiers) if (completedTrips >= x.min) t = x;
  return t;
}

export function nextTier(completedTrips: number) {
  return tiers.find((x) => x.min > completedTrips) ?? null;
}

export const pointsEarned = (farePaid: number) => Math.floor(Math.max(0, farePaid) / 10);

/** Points can cover at most half of the fare so drivers are never paid too little. */
export function maxRedeemable(points: number, fare: number) {
  return Math.max(0, Math.min(points, Math.floor(fare / 2)));
}

/**
 * Final amount: tier discount and points come off the fare. The discount is
 * funded by the platform in the Supabase setup; in the demo it simply reduces the total.
 */
export function settle(fare: number, completedTrips: number, pointsUsed: number, tip: number) {
  const discount = Math.round(fare * tierFor(completedTrips).discount);
  const afterDiscount = fare - discount;
  const used = Math.min(pointsUsed, maxRedeemable(pointsUsed, afterDiscount));
  return { discount, pointsUsed: used, total: afterDiscount - used + Math.max(0, tip) };
}
