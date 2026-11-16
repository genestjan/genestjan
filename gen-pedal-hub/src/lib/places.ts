import { haversineM } from './track.ts';

export type PlaceKind = 'water' | 'shop';
export type Place = { id: string; kind: PlaceKind; name: string; lat: number; lon: number; distM: number };
type LatLon = { lat: number; lon: number };

/** Picks points about `everyM` apart along a route, always keeping both ends. */
export function sampleRoute(points: LatLon[], everyM: number, max = 40): LatLon[] {
  if (points.length === 0) return [];
  const out: LatLon[] = [points[0]];
  let since = 0;
  for (let i = 1; i < points.length; i++) {
    since += haversineM(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
    if (since >= everyM) {
      out.push(points[i]);
      since = 0;
    }
  }
  const last = points[points.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  if (out.length <= max) return out;
  const step = (out.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => out[Math.round(i * step)]);
}

/**
 * The question sent to OpenStreetMap (Overpass): drinking water, shops that
 * sell drinks, and bike shops, within `radiusM` of any of the centres.
 */
export function overpassQuery(centres: LatLon[], radiusM: number): string {
  const around = `(around:${Math.round(radiusM)},${centres.map((c) => `${c.lat.toFixed(5)},${c.lon.toFixed(5)}`).join(',')})`;
  const tags = [
    'node["amenity"="drinking_water"]',
    'node["amenity"="water_point"]',
    'nwr["shop"="convenience"]',
    'nwr["shop"="supermarket"]',
    'nwr["amenity"="fuel"]',
    'nwr["shop"="bicycle"]',
    'node["amenity"="bicycle_repair_station"]',
  ];
  return `[out:json][timeout:25];(${tags.map((t) => `${t}${around};`).join('')});out center 400;`;
}

type Element = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

const WATER_NAMES: Record<string, string> = {
  drinking_water: 'Drinking water',
  water_point: 'Water point',
  convenience: 'Convenience store',
  supermarket: 'Supermarket',
  fuel: 'Fuel station',
};

/** Turns the answer into a tidy list, nearest to the route first. */
export function parsePlaces(json: unknown, near: LatLon[]): Place[] {
  const elements = (json as { elements?: Element[] })?.elements ?? [];
  const seen = new Set<string>();
  const out: Place[] = [];
  for (const e of elements) {
    const lat = e.lat ?? e.center?.lat;
    const lon = e.lon ?? e.center?.lon;
    const tags = e.tags ?? {};
    if (lat == null || lon == null) continue;
    const isShop = tags.shop === 'bicycle' || tags.amenity === 'bicycle_repair_station';
    const base = isShop
      ? tags.amenity === 'bicycle_repair_station'
        ? 'Bike repair stand'
        : 'Bike shop'
      : WATER_NAMES[tags.amenity ?? ''] ?? WATER_NAMES[tags.shop ?? ''];
    if (!base) continue;
    const id = `${e.type}/${e.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    let distM = Infinity;
    for (const p of near) distM = Math.min(distM, haversineM(p.lat, p.lon, lat, lon));
    out.push({ id, kind: isShop ? 'shop' : 'water', name: tags.name ? `${tags.name} (${base.toLowerCase()})` : base, lat, lon, distM });
  }
  return out.sort((a, b) => a.distM - b.distM);
}

/** Asks each server in turn until one answers. */
export async function fetchPlaces(urls: string[], centres: LatLon[], radiusM: number): Promise<Place[]> {
  const body = 'data=' + encodeURIComponent(overpassQuery(centres, radiusM));
  let lastError: unknown = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parsePlaces(await res.json(), centres);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? new Error('Could not reach the map service. Check your internet and try again.') : new Error('Could not reach the map service.');
}

export function fmtAway(m: number): string {
  if (!isFinite(m)) return '';
  return m < 950 ? `${Math.round(m / 50) * 50} m away` : `${(m / 1000).toFixed(1)} km away`;
}
