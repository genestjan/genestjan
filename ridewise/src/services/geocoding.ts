// Nominatim place search. Usage policy: max 1 request per second, no
// autocomplete-as-you-type. Searches run only when the rider presses Search.

import type { Endpoint } from '../types';
import { config } from '../config';
import { fetchWithRetry, type RetryOptions } from './http';

export type GeocodeResult = Endpoint & { osmType: string; category: string; type: string };

let lastCall = 0;
async function politeDelay() {
  const wait = lastCall + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

type NominatimItem = { lat: string; lon: string; name?: string; display_name: string; osm_type: string; osm_id: number; category?: string; class?: string; type: string };

export function parseNominatim(items: unknown): GeocodeResult[] {
  if (!Array.isArray(items)) return [];
  return (items as NominatimItem[])
    .map((i) => ({
      label: i.name || i.display_name.split(',')[0],
      address: i.display_name,
      point: { lat: Number(i.lat), lng: Number(i.lon) },
      source: 'osm-nominatim' as const,
      osmRef: `${i.osm_type}/${i.osm_id}`,
      osmType: i.osm_type,
      category: i.category ?? i.class ?? '',
      type: i.type,
    }))
    .filter((r) => Number.isFinite(r.point.lat) && Number.isFinite(r.point.lng));
}

export async function searchPlaces(query: string, opts?: RetryOptions): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  await politeDelay();
  const url = `${config.nominatimUrl}/search?${new URLSearchParams({ q, format: 'jsonv2', countrycodes: 'ph', limit: '10', addressdetails: '0' })}`;
  const res = await fetchWithRetry(url, { headers: { 'Accept-Language': 'en' } }, opts);
  return parseNominatim(await res.json());
}

export async function reverseGeocode(lat: number, lng: number, opts?: RetryOptions): Promise<string | null> {
  await politeDelay();
  const url = `${config.nominatimUrl}/reverse?${new URLSearchParams({ lat: String(lat), lon: String(lng), format: 'jsonv2', zoom: '18' })}`;
  try {
    const res = await fetchWithRetry(url, { headers: { 'Accept-Language': 'en' } }, opts);
    const j = (await res.json()) as { display_name?: string };
    return j.display_name ?? null;
  } catch {
    return null;
  }
}
