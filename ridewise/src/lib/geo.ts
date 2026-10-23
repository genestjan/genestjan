import type { LatLng } from '../types';

const R = 6371008.8; // mean Earth radius, metres
const rad = (d: number) => (d * Math.PI) / 180;

export function isValidLatLng(p: unknown): p is LatLng {
  if (!p || typeof p !== 'object') return false;
  const { lat, lng } = p as LatLng;
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

/** Great-circle distance in metres. */
export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const ll = (c: [number, number]): LatLng => ({ lat: c[0], lng: c[1] });

/** Cumulative distance in km at each vertex of a [lat,lng] polyline. */
export function cumulativeKm(coords: [number, number][]): number[] {
  const out = new Array<number>(coords.length);
  let acc = 0;
  for (let i = 0; i < coords.length; i++) {
    if (i > 0) acc += haversineM(ll(coords[i - 1]), ll(coords[i])) / 1000;
    out[i] = acc;
  }
  return out;
}

/** Local equirectangular projection around a reference latitude, in metres. */
function toXY(p: LatLng, refLat: number): [number, number] {
  return [rad(p.lng) * R * Math.cos(rad(refLat)), rad(p.lat) * R];
}

export type Projection = {
  /** Distance along the route from the start, km. */
  routeKm: number;
  /** Perpendicular distance from the route, metres. */
  offRouteM: number;
  point: LatLng;
  segmentIndex: number;
};

/**
 * Project a point onto a polyline. Linear scan with a cheap bounding
 * pre-filter; fast enough for a few thousand vertices and a few hundred
 * candidates on a phone.
 */
export function projectOntoRoute(
  p: LatLng,
  coords: [number, number][],
  cum: number[] = cumulativeKm(coords),
): Projection | null {
  if (coords.length < 2 || !isValidLatLng(p)) return null;
  let best: Projection | null = null;
  let bestD = Infinity;
  const [px, py] = toXY(p, p.lat);
  for (let i = 0; i < coords.length - 1; i++) {
    const a = ll(coords[i]);
    const b = ll(coords[i + 1]);
    // Skip segments clearly farther than the current best (~1 deg ≈ 111 km).
    if (bestD < Infinity) {
      const degBound = bestD / 111_000 + 0.01;
      if (
        Math.min(a.lat, b.lat) - degBound > p.lat ||
        Math.max(a.lat, b.lat) + degBound < p.lat ||
        Math.min(a.lng, b.lng) - degBound > p.lng ||
        Math.max(a.lng, b.lng) + degBound < p.lng
      )
        continue;
    }
    const [ax, ay] = toXY(a, p.lat);
    const [bx, by] = toXY(b, p.lat);
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
    const qx = ax + t * dx;
    const qy = ay + t * dy;
    const d = Math.hypot(px - qx, py - qy);
    if (d < bestD) {
      bestD = d;
      const segKm = cum[i + 1] - cum[i];
      best = {
        routeKm: cum[i] + t * segKm,
        offRouteM: d,
        point: { lat: a.lat + t * (b.lat - a.lat), lng: a.lng + t * (b.lng - a.lng) },
        segmentIndex: i,
      };
    }
  }
  return best;
}

/** Point at a given distance along the route. */
export function pointAtKm(coords: [number, number][], km: number, cum = cumulativeKm(coords)): LatLng {
  if (coords.length === 0) throw new Error('Empty route');
  if (km <= 0) return ll(coords[0]);
  const total = cum[cum.length - 1];
  if (km >= total) return ll(coords[coords.length - 1]);
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= km) lo = mid;
    else hi = mid;
  }
  const seg = cum[hi] - cum[lo];
  const t = seg === 0 ? 0 : (km - cum[lo]) / seg;
  const a = coords[lo];
  const b = coords[hi];
  return { lat: a[0] + t * (b[0] - a[0]), lng: a[1] + t * (b[1] - a[1]) };
}

/** Douglas-Peucker simplification with a tolerance in metres. */
export function simplify(coords: [number, number][], toleranceM: number): [number, number][] {
  if (coords.length < 3) return coords.slice();
  const refLat = coords[0][0];
  const xy = coords.map((c) => toXY(ll(c), refLat));
  const keep = new Uint8Array(coords.length);
  keep[0] = 1;
  keep[coords.length - 1] = 1;
  const stack: [number, number][] = [[0, coords.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    const [ax, ay] = xy[s];
    const [bx, by] = xy[e];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let maxD = -1;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const [px, py] = xy[i];
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
      const d = Math.hypot(px - ax - t * dx, py - ay - t * dy);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > toleranceM && idx > 0) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return coords.filter((_, i) => keep[i]);
}

/**
 * Rough road-distance factor for a short detour, used only when we have a
 * straight-line distance. Labelled as an estimate wherever it is shown.
 */
export const DETOUR_ROAD_FACTOR = 1.3;

/** Estimated extra km to leave the route, reach the place and return. */
export function estimateDetourKm(offRouteM: number): number {
  if (!Number.isFinite(offRouteM) || offRouteM < 0) return 0;
  // Places within ~30 m are effectively on the roadside.
  if (offRouteM <= 30) return 0;
  return (2 * offRouteM * DETOUR_ROAD_FACTOR) / 1000;
}

export function boundsOf(coords: [number, number][]): [[number, number], [number, number]] | null {
  if (!coords.length) return null;
  let s = 90, w = 180, n = -90, e = -180;
  for (const [la, ln] of coords) {
    if (la < s) s = la;
    if (la > n) n = la;
    if (ln < w) w = ln;
    if (ln > e) e = ln;
  }
  return [[s, w], [n, e]];
}
