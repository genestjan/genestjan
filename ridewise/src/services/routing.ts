// Routing providers. Each returns real route geometry from a routing
// engine; nothing here draws a straight line or guesses a road.

import type { LatLng, RouteResult, RouteStep } from '../types';
import { config } from '../config';
import { fetchWithRetry, ServiceError, type RetryOptions } from './http';

export interface RoutingProvider {
  id: RouteResult['provider'];
  label: string;
  note: string;
  route(points: LatLng[], opts?: RetryOptions): Promise<RouteResult[]>;
}

type OsrmStep = { distance: number; name?: string; maneuver?: { type?: string; modifier?: string } };
type OsrmRoute = {
  distance: number;
  duration: number;
  geometry: { coordinates: [number, number][] };
  legs?: { steps?: OsrmStep[] }[];
};

function osrmInstruction(s: OsrmStep): string {
  const t = s.maneuver?.type ?? 'continue';
  const m = s.maneuver?.modifier;
  const road = s.name ? ` onto ${s.name}` : '';
  if (t === 'depart') return `Start${s.name ? ` on ${s.name}` : ''}`;
  if (t === 'arrive') return 'Arrive at destination';
  if (t === 'roundabout' || t === 'rotary') return `Take the roundabout${road}`;
  return `${m ? m.charAt(0).toUpperCase() + m.slice(1) : 'Continue'}${road}`.replace('Straight', 'Continue straight');
}

export function parseOsrm(json: unknown, retrievedAt: string): RouteResult[] {
  const j = json as { code?: string; message?: string; routes?: OsrmRoute[] };
  if (!j || j.code !== 'Ok' || !Array.isArray(j.routes) || j.routes.length === 0) {
    throw new ServiceError(j?.message || 'The routing service found no bicycle route between these points.', 'not-found');
  }
  return j.routes.map((r, i) => {
    const coords = (r.geometry?.coordinates ?? []).map(([lng, lat]) => [lat, lng] as [number, number]);
    if (coords.length < 2) throw new ServiceError('Route geometry missing from routing response.', 'bad-response');
    const steps: RouteStep[] = (r.legs ?? []).flatMap((l) => l.steps ?? []).map((s) => ({
      instruction: osrmInstruction(s),
      distanceM: s.distance,
      name: s.name || undefined,
    }));
    return {
      id: `osrm-${i}-${Math.round(r.distance)}`,
      provider: 'osrm-fossgis' as const,
      providerLabel: 'OSRM bicycle profile (FOSSGIS public server)',
      profile: 'bike',
      distanceM: r.distance,
      providerDurationS: r.duration,
      coords,
      steps: steps.length ? steps : undefined,
      retrievedAt,
    };
  });
}

export const osrmProvider: RoutingProvider = {
  id: 'osrm-fossgis',
  label: 'OpenStreetMap bicycle routing (FOSSGIS OSRM)',
  note: 'Free public server run by FOSSGIS e.V. Fair use only, no guaranteed uptime. No elevation or surface data.',
  async route(points, opts) {
    const coords = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
    const url = `${config.osrmBikeUrl}/route/v1/driving/${coords}?overview=full&geometries=geojson&alternatives=true&steps=true`;
    const res = await fetchWithRetry(url, {}, opts);
    return parseOsrm(await res.json(), new Date().toISOString());
  },
};

type OrsFeature = {
  geometry: { coordinates: [number, number, number?][] };
  properties: {
    summary?: { distance?: number; duration?: number };
    ascent?: number;
    descent?: number;
    segments?: { steps?: { instruction: string; distance: number; name?: string }[] }[];
    extras?: Record<string, { summary?: { value: number; amount: number }[] }>;
  };
};

// openrouteservice extra_info codes (https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/extra-info/)
const ORS_SURFACE: Record<number, string> = {
  0: 'Unknown', 1: 'Paved', 2: 'Unpaved', 3: 'Asphalt', 4: 'Concrete', 6: 'Metal', 7: 'Wood', 8: 'Compacted gravel',
  10: 'Gravel', 11: 'Dirt', 12: 'Ground', 13: 'Ice', 14: 'Paving stones', 15: 'Sand', 17: 'Grass', 18: 'Grass paver',
};
const ORS_WAYTYPE: Record<number, string> = {
  0: 'Unknown', 1: 'State road', 2: 'Road', 3: 'Street', 4: 'Path', 5: 'Track', 6: 'Cycleway', 7: 'Footway', 8: 'Steps', 9: 'Ferry', 10: 'Construction',
};

function summarize(extra: { summary?: { value: number; amount: number }[] } | undefined, names: Record<number, string>) {
  if (!extra?.summary?.length) return undefined;
  const out: Record<string, number> = {};
  for (const s of extra.summary) out[names[s.value] ?? `Code ${s.value}`] = (out[names[s.value] ?? `Code ${s.value}`] ?? 0) + s.amount / 100;
  return out;
}

export function parseOrs(json: unknown, retrievedAt: string, profile: string): RouteResult[] {
  const j = json as { features?: OrsFeature[]; error?: { message?: string } };
  if (!j?.features?.length) throw new ServiceError(j?.error?.message || 'openrouteservice returned no route.', 'not-found');
  return j.features.map((f, i) => ({
    id: `ors-${i}-${Math.round(f.properties.summary?.distance ?? 0)}`,
    provider: 'openrouteservice' as const,
    providerLabel: `openrouteservice (${profile})`,
    profile,
    distanceM: f.properties.summary?.distance ?? 0,
    providerDurationS: f.properties.summary?.duration,
    coords: f.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
    ascentM: f.properties.ascent,
    descentM: f.properties.descent,
    surfaceSummary: summarize(f.properties.extras?.surface, ORS_SURFACE),
    wayTypeSummary: summarize(f.properties.extras?.waytype, ORS_WAYTYPE),
    steps: f.properties.segments?.flatMap((s) => s.steps ?? []).map((s) => ({ instruction: s.instruction, distanceM: s.distance, name: s.name })),
    retrievedAt,
  }));
}

/** openrouteservice through the Supabase Edge Function; the ORS key never reaches the browser. */
export const orsProxyProvider: RoutingProvider = {
  id: 'openrouteservice',
  label: 'openrouteservice (via RideWise server)',
  note: 'Includes elevation gain, surface and road type where available.',
  async route(points, opts) {
    if (!config.routeProxyUrl) throw new ServiceError('openrouteservice is not configured.', 'unavailable');
    const profile = 'cycling-road';
    const res = await fetchWithRetry(
      config.routeProxyUrl,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, coordinates: points.map((p) => [p.lng, p.lat]) }),
      },
      opts,
    );
    return parseOrs(await res.json(), new Date().toISOString(), profile);
  },
};

export function availableProviders(): RoutingProvider[] {
  return config.routeProxyUrl ? [orsProxyProvider, osrmProvider] : [osrmProvider];
}

/** Try each configured provider in order; report which one answered. */
export async function routeWithFallback(points: LatLng[], opts?: RetryOptions): Promise<{ routes: RouteResult[]; errors: string[] }> {
  const errors: string[] = [];
  for (const p of availableProviders()) {
    try {
      return { routes: await p.route(points, opts), errors };
    } catch (e) {
      errors.push(`${p.label}: ${(e as Error).message}`);
      if (e instanceof ServiceError && e.kind === 'not-found') break;
    }
  }
  throw new ServiceError(`No routing service could calculate this route. ${errors.join(' ')}`, 'unavailable');
}
