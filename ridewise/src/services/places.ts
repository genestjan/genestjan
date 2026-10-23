// Overpass (OpenStreetMap) search for real places along a route.

import type { Candidate } from '../types';
import { config } from '../config';
import { buildOverpassQuery, elementsToPlaces, placesToCandidates, type OsmElement, type ParseReport } from '../lib/discovery';
import { fetchWithRetry, ServiceError, type RetryOptions } from './http';

export type DiscoveryResult = { candidates: Candidate[]; report: ParseReport; source: string; retrievedAt: string };

export async function discoverAlongRoute(
  coords: [number, number][],
  corridorM: number,
  preferOnRoute: boolean,
  opts?: RetryOptions,
): Promise<DiscoveryResult> {
  const query = buildOverpassQuery(coords, corridorM);
  const errors: string[] = [];
  for (const url of config.overpassUrls) {
    try {
      const res = await fetchWithRetry(
        url,
        { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `data=${encodeURIComponent(query)}` },
        { retries: 2, timeoutMs: 100000, ...opts },
      );
      const json = (await res.json()) as { elements?: OsmElement[]; remark?: string };
      if (!Array.isArray(json.elements)) throw new ServiceError('Unexpected response from the place search.', 'bad-response');
      if (json.remark && /runtime error|timed out/i.test(json.remark)) throw new ServiceError(`Place search incomplete: ${json.remark}`, 'unavailable');
      const retrievedAt = new Date().toISOString();
      const { places, report } = elementsToPlaces(json.elements, retrievedAt);
      return {
        candidates: placesToCandidates(places, coords, corridorM, preferOnRoute),
        report,
        source: `OpenStreetMap via Overpass (${new URL(url).host})`,
        retrievedAt,
      };
    } catch (e) {
      errors.push(`${new URL(url).host}: ${(e as Error).message}`);
    }
  }
  throw new ServiceError(
    `Place search is unavailable right now (${errors.join('; ')}). Your route is fine; try again in a few minutes or add stops manually by dropping a pin.`,
    'unavailable',
  );
}
