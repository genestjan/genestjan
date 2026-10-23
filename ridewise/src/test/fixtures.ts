import type { Candidate, PlannedStop, RidePlan } from '../types';
import { newPlan } from '../lib/defaults';
import { cumulativeKm } from '../lib/geo';

/**
 * SYNTHETIC test geometry: a straight north-south line of ~100 km near
 * 125.3E. Used only to make arithmetic easy to check; it is not a real road.
 */
export function straightRoute(km = 100): [number, number][] {
  const coords: [number, number][] = [];
  const degPerKm = 1 / 111.195;
  for (let i = 0; i <= km; i++) coords.push([6 + i * degPerKm, 125.3]);
  return coords;
}

export function testPlan(overrides: Partial<RidePlan> = {}): RidePlan {
  const coords = straightRoute(100);
  const cum = cumulativeKm(coords);
  return newPlan({
    departureLocal: '2026-11-07T05:00',
    timeZone: 'Asia/Manila',
    route: {
      id: 'synthetic',
      provider: 'osrm-fossgis',
      providerLabel: 'synthetic test route',
      profile: 'bike',
      distanceM: cum[cum.length - 1] * 1000,
      coords,
      retrievedAt: '2026-10-23T00:00:00Z',
    },
    group: { riders: 1, regroupEveryStop: false, supportVehicle: false, regroupProcedureAgreed: true, participants: [] },
    ...overrides,
    settings: { ...newPlan().settings, speedKmh: 20, delayBufferPct: 0, ...(overrides.settings ?? {}) },
  });
}

export function cand(id: string, routeKm: number, extra: Partial<Candidate> = {}): Candidate {
  return {
    id,
    name: `Store ${id}`,
    category: 'convenience',
    point: { lat: 6 + routeKm / 111.195, lng: 125.3 },
    source: 'osm-overpass',
    verification: 'osm-listed',
    retrievedAt: '2026-10-23T00:00:00Z',
    routeKm,
    offRouteM: 0,
    detourKm: 0,
    insideCorridor: true,
    score: 30,
    ...extra,
  };
}

export function stop(id: string, c: Candidate, durationMin = 10, extra: Partial<PlannedStop> = {}): PlannedStop {
  return { id, place: c, kind: 'short', durationMin, status: 'planned', ...extra };
}
