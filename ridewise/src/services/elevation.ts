import { fetchWithRetry, ServiceError, type RetryOptions } from './http';
import { samplePoints, type ElevationData } from '../lib/elevation';

const URL_BASE = 'https://api.open-meteo.com/v1/elevation';

export function parseElevation(json: unknown, expected: number): number[] {
  const e = (json as { elevation?: unknown })?.elevation;
  if (!Array.isArray(e) || e.length !== expected || e.some((v) => typeof v !== 'number' || !Number.isFinite(v))) {
    throw new ServiceError('The terrain service sent an answer I could not read.', 'bad-response');
  }
  return e as number[];
}

export async function fetchRouteElevation(coords: [number, number][], opts?: RetryOptions): Promise<ElevationData> {
  const pts = samplePoints(coords);
  const q = `latitude=${pts.map((p) => p.lat.toFixed(4)).join(',')}&longitude=${pts.map((p) => p.lng.toFixed(4)).join(',')}`;
  const res = await fetchWithRetry(`${URL_BASE}?${q}`, {}, opts);
  return {
    elevationM: parseElevation(await res.json(), pts.length),
    retrievedAt: new Date().toISOString(),
    source: 'Open-Meteo elevation API (Copernicus DEM, 90 m grid)',
  };
}
