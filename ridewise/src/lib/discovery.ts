// Turns raw OpenStreetMap elements into ranked pit stop candidates along a
// route. Pure functions only; the network call lives in services/places.ts.

import type { Candidate, Place, StopCategory } from '../types';
import { cumulativeKm, estimateDetourKm, haversineM, isValidLatLng, projectOntoRoute, simplify } from './geo';

export type OsmElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export const CATEGORY_LABEL: Record<StopCategory, string> = {
  convenience: 'Convenience store',
  'sari-sari': 'Sari-sari / small shop',
  supermarket: 'Supermarket',
  bakery: 'Bakery',
  restaurant: 'Restaurant / carinderia',
  cafe: 'Café',
  water: 'Water refill / drinking water',
  toilets: 'Public toilet',
  fuel: 'Fuel station',
  bicycle: 'Bicycle shop',
  pharmacy: 'Pharmacy',
  hospital: 'Hospital',
  clinic: 'Clinic',
  shelter: 'Shelter / rest area',
  police: 'Police station',
  other: 'Other',
};

/** Categories that can realistically supply water or food. */
export const SUPPLY_CATEGORIES: StopCategory[] = [
  'convenience',
  'sari-sari',
  'supermarket',
  'bakery',
  'restaurant',
  'cafe',
  'water',
];
export const MEDICAL_CATEGORIES: StopCategory[] = ['hospital', 'clinic', 'pharmacy'];

export function classify(tags: Record<string, string> = {}): StopCategory | null {
  const shop = tags.shop;
  const amenity = tags.amenity;
  if (shop === 'convenience') {
    // Small family shops are often tagged convenience in PH; the name tells.
    return /sari/i.test(tags.name ?? '') ? 'sari-sari' : 'convenience';
  }
  if (shop === 'general' || shop === 'kiosk') return 'sari-sari';
  if (shop === 'supermarket') return 'supermarket';
  if (shop === 'bakery') return 'bakery';
  if (shop === 'water' || shop === 'beverages') return 'water';
  if (shop === 'bicycle') return 'bicycle';
  switch (amenity) {
    case 'restaurant':
    case 'fast_food':
    case 'food_court':
      return 'restaurant';
    case 'cafe':
      return 'cafe';
    case 'drinking_water':
    case 'water_point':
      return 'water';
    case 'toilets':
      return 'toilets';
    case 'fuel':
      return 'fuel';
    case 'pharmacy':
      return 'pharmacy';
    case 'hospital':
      return 'hospital';
    case 'clinic':
    case 'doctors':
      return 'clinic';
    case 'shelter':
      return 'shelter';
    case 'police':
      return 'police';
  }
  if (tags.healthcare === 'pharmacy') return 'pharmacy';
  return null;
}

function isReportedClosed(tags: Record<string, string>): boolean {
  if (/^(closed|off)$/i.test(tags.opening_hours ?? '')) return true;
  return Object.keys(tags).some((k) => /^(disused|abandoned|was|demolished|razed):/.test(k));
}

function addressOf(tags: Record<string, string>): string | undefined {
  const parts = [
    [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' '),
    tags['addr:barangay'] ?? tags['addr:suburb'],
    tags['addr:city'] ?? tags['addr:municipality'],
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : undefined;
}

export type ParseReport = { kept: number; missingCoords: number; unclassified: number; duplicates: number };

export function elementsToPlaces(
  elements: OsmElement[],
  retrievedAt: string,
  source: Place['source'] = 'osm-overpass',
): { places: Place[]; report: ParseReport } {
  const report: ParseReport = { kept: 0, missingCoords: 0, unclassified: 0, duplicates: 0 };
  const places: Place[] = [];
  const seen = new Set<string>();
  for (const el of elements ?? []) {
    const ref = `${el.type}/${el.id}`;
    if (seen.has(ref)) {
      report.duplicates++;
      continue;
    }
    seen.add(ref);
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    const point = { lat: lat as number, lng: lng as number };
    if (!isValidLatLng(point)) {
      report.missingCoords++;
      continue;
    }
    const tags = el.tags ?? {};
    const category = classify(tags);
    if (!category) {
      report.unclassified++;
      continue;
    }
    const name = (tags.name ?? tags['name:en'] ?? tags.brand)?.trim() || undefined;
    places.push({
      id: `osm:${ref}`,
      name: name ?? `Unnamed ${CATEGORY_LABEL[category].toLowerCase()}`,
      unnamed: !name,
      category,
      point,
      address: addressOf(tags),
      openingHours: tags.opening_hours,
      brand: tags.brand,
      source,
      osmRef: ref,
      verification: isReportedClosed(tags) ? 'reported-closed' : 'osm-listed',
      retrievedAt,
      hasToilets: tags.toilets === 'yes' || category === 'toilets',
      hasDrinkingWater: tags.drinking_water === 'yes' || category === 'water',
    });
  }
  // Merge near-identical listings (same name within 40 m), keeping the richer one.
  const merged: Place[] = [];
  for (const p of places) {
    const dup = merged.find(
      (q) =>
        !p.unnamed &&
        !q.unnamed &&
        q.name.trim().toLowerCase() === p.name.trim().toLowerCase() &&
        haversineM(q.point, p.point) < 40,
    );
    if (dup) {
      report.duplicates++;
      if (!dup.openingHours && p.openingHours) dup.openingHours = p.openingHours;
      if (!dup.address && p.address) dup.address = p.address;
      continue;
    }
    merged.push(p);
  }
  report.kept = merged.length;
  return { places: merged, report };
}

const CATEGORY_WEIGHT: Partial<Record<StopCategory, number>> = {
  convenience: 30,
  'sari-sari': 22,
  supermarket: 24,
  bakery: 20,
  restaurant: 24,
  cafe: 20,
  water: 26,
  toilets: 8,
  fuel: 6, // not a stop by default: needs confirmation of a safe area
  bicycle: 12,
  pharmacy: 8,
  hospital: 4,
  clinic: 4,
  shelter: 10,
  police: 2,
};

export function scorePlace(c: Omit<Candidate, 'score'>, preferOnRoute: boolean): number {
  let s = CATEGORY_WEIGHT[c.category] ?? 0;
  if (c.verification === 'user-verified') s += 25;
  if (c.verification === 'reported-closed') s -= 100;
  if (!c.unnamed) s += 12; // a named place is far easier for a group to find
  if (c.openingHours) s += 6;
  if (c.hasToilets) s += 4;
  // Closer to the road is better; the penalty is steeper when the group
  // prefers roadside stops.
  s -= (c.offRouteM / 100) * (preferOnRoute ? 4 : 2);
  if (!c.insideCorridor) s -= 30;
  return Math.round(s * 10) / 10;
}

export function placesToCandidates(
  places: Place[],
  coords: [number, number][],
  corridorM: number,
  preferOnRoute = true,
): Candidate[] {
  const cum = cumulativeKm(coords);
  const out: Candidate[] = [];
  for (const p of places) {
    const proj = projectOntoRoute(p.point, coords, cum);
    if (!proj) continue;
    const base = {
      ...p,
      routeKm: Math.round(proj.routeKm * 100) / 100,
      offRouteM: Math.round(proj.offRouteM),
      detourKm: Math.round(estimateDetourKm(proj.offRouteM) * 100) / 100,
      insideCorridor: proj.offRouteM <= corridorM,
    };
    out.push({ ...base, score: scorePlace(base, preferOnRoute) });
  }
  return out.sort((a, b) => a.routeKm - b.routeKm);
}

export const OVERPASS_SHOPS = ['convenience', 'supermarket', 'bakery', 'general', 'kiosk', 'bicycle', 'water', 'beverages'];
export const OVERPASS_AMENITIES = [
  'restaurant',
  'cafe',
  'fast_food',
  'food_court',
  'fuel',
  'pharmacy',
  'hospital',
  'clinic',
  'doctors',
  'toilets',
  'drinking_water',
  'water_point',
  'shelter',
  'police',
];

/**
 * Overpass QL for everything useful within `radiusM` of the route. The line
 * is simplified first (tolerance well under the radius) to keep the query small.
 */
export function buildOverpassQuery(coords: [number, number][], radiusM: number): string {
  const tol = Math.max(30, Math.min(150, radiusM / 5));
  const line = simplify(coords, tol)
    .map(([la, ln]) => `${la.toFixed(5)},${ln.toFixed(5)}`)
    .join(',');
  const r = Math.round(radiusM);
  return (
    `[out:json][timeout:90];(` +
    `nwr(around:${r},${line})[shop~"^(${OVERPASS_SHOPS.join('|')})$"];` +
    `nwr(around:${r},${line})[amenity~"^(${OVERPASS_AMENITIES.join('|')})$"];` +
    `);out center tags;`
  );
}
