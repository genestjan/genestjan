import type { PlanSettings, RidePlan, RideStyle, StopCategory } from '../types';
import { config } from '../config';
import { newId } from './schedule';
import { nowLocal } from './time';

export const ALL_STOP_TYPES: StopCategory[] = [
  'convenience', 'sari-sari', 'supermarket', 'bakery', 'restaurant', 'cafe', 'water', 'toilets', 'bicycle', 'shelter', 'fuel',
];

/** Editable planning defaults, not medical prescriptions. */
export const STYLE_PRESETS: Record<RideStyle, Pick<PlanSettings, 'speedKmh' | 'maxRideMinBetweenStops' | 'preferredStopIntervalKm' | 'restStopMin'>> = {
  relaxed: { speedKmh: 18, maxRideMinBetweenStops: 45, preferredStopIntervalKm: 15, restStopMin: 15 },
  moderate: { speedKmh: 22, maxRideMinBetweenStops: 60, preferredStopIntervalKm: 20, restStopMin: 12 },
  experienced: { speedKmh: 26, maxRideMinBetweenStops: 75, preferredStopIntervalKm: 30, restStopMin: 10 },
};

export function defaultSettings(style: RideStyle = 'relaxed'): PlanSettings {
  return {
    ...STYLE_PRESETS[style],
    shortStopMin: 10,
    mealStopMin: 30,
    regroupMin: 5,
    delayBufferPct: 10,
    corridorM: 1000,
    preferOnRoute: true,
    stopTypes: ALL_STOP_TYPES.filter((t) => t !== 'fuel'),
    lunchTime: '12:00',
    includeFuelStations: false,
  };
}

function tomorrowAt(hhmm: string, tz: string): string {
  const today = nowLocal(tz, Date.now() + 24 * 3600 * 1000);
  return `${today.slice(0, 10)}T${hhmm}`;
}

export function newPlan(partial: Partial<RidePlan> = {}): RidePlan {
  const now = new Date().toISOString();
  const tz = config.defaultTimeZone;
  return {
    id: newId('plan'),
    name: 'GenSan to Davao ride',
    isSample: false,
    createdAt: now,
    updatedAt: now,
    // Six Jollibee branches in General Santos are listed in OpenStreetMap,
    // so the start stays unconfirmed until the rider picks one.
    start: { label: 'Jollibee, General Santos City', point: null },
    end: { label: 'Ecoland Bus Terminal (Davao City Overland Transport Terminal)', point: null },
    waypoints: [],
    departureLocal: tomorrowAt('05:00', tz),
    timeZone: tz,
    settings: defaultSettings('relaxed'),
    candidates: [],
    stops: [],
    group: { riders: 4, regroupEveryStop: true, supportVehicle: false, regroupProcedureAgreed: false, participants: [] },
    bike: { type: 'road' },
    status: 'draft',
    ...partial,
  };
}

/**
 * Demonstration plan. The route geometry is a real OSRM bicycle route
 * (retrieved 2026-10-23) bundled so the demo works without a connection.
 * It is labelled as sample data everywhere it appears.
 */
export async function samplePlan(): Promise<RidePlan> {
  const data = (await import('../data/gensan-davao-route.json')).default as unknown as {
    source: string;
    retrievedAt: string;
    distanceM: number;
    durationS: number;
    coordinates: [number, number][];
  };
  return newPlan({
    name: 'Sample: GenSan to Davao (demo data)',
    isSample: true,
    start: {
      label: 'Jollibee, Digos-Makar Road, Lagao (sample pick)',
      address: 'Digos-Makar Road, San Vicente, Lagao, General Santos (one of six Jollibee branches listed in OpenStreetMap)',
      point: { lat: 6.1270345, lng: 125.1952745 },
      source: 'osm-nominatim',
      osmRef: 'way/1055856208',
    },
    end: {
      label: 'Davao City Overland Transport Terminal (Ecoland)',
      address: 'Quimpo Boulevard, Talomo District, Davao City',
      point: { lat: 7.0555737, lng: 125.601089 },
      source: 'osm-nominatim',
      osmRef: 'way/28996131',
    },
    route: {
      id: 'sample-osrm-0',
      provider: 'osrm-fossgis',
      providerLabel: `OSRM bicycle profile (FOSSGIS), bundled snapshot from ${data.retrievedAt}`,
      profile: 'bike',
      distanceM: data.distanceM,
      providerDurationS: data.durationS,
      coords: data.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
      retrievedAt: `${data.retrievedAt}T00:00:00.000Z`,
    },
    status: 'planned',
  });
}
