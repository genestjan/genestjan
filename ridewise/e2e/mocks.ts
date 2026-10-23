import type { Page, Route } from '@playwright/test';
import fs from 'node:fs';

// REAL recorded responses (retrieved 2026-10-23 from the public services):
// - Nominatim search results for "Jollibee General Santos" and "Ecoland Terminal Davao"
// - FOSSGIS OSRM bicycle route Jollibee (Lagao) -> Davao City Overland Transport Terminal,
//   full geometry, plus the 292.8 km alternative (simplified geometry as returned).
// SYNTHETIC test-only data, never shipped in the app:
// - Overpass place results ("TEST ..." names placed on the real route line)
// - Open-Meteo forecast values

const route = JSON.parse(fs.readFileSync(new URL('../src/data/gensan-davao-route.json', import.meta.url), 'utf8'));

export const JOLLIBEE_RESULTS = [
  { place_id: 260721497, osm_type: 'way', osm_id: 1055856208, lat: '6.1270345', lon: '125.1952745', category: 'amenity', type: 'fast_food', name: 'Jollibee', display_name: 'Jollibee, Digos-Makar Road, San Vicente, Lagao, General Santos, Soccsksargen, 9500, Philippines' },
  { place_id: 260920793, osm_type: 'way', osm_id: 691588899, lat: '6.0772641', lon: '125.1457088', category: 'amenity', type: 'fast_food', name: 'Jollibee', display_name: 'Jollibee, Jose P. Rizal Street, Veterans Village, Malinawon, Calumpang, General Santos, Soccsksargen, 9500, Philippines' },
  { place_id: 260907035, osm_type: 'way', osm_id: 870553231, lat: '6.1191757', lon: '125.1608749', category: 'amenity', type: 'fast_food', name: 'Jollibee', display_name: 'Jollibee, Digos-Makar Road, Dadiangas North, General Santos, Soccsksargen, 9500, Philippines' },
  { place_id: 260701901, osm_type: 'node', osm_id: 4396261292, lat: '6.1157298', lon: '125.1805442', category: 'amenity', type: 'fast_food', name: 'Jollibee', display_name: 'Jollibee, San Miguel Street, Dadiangas East, General Santos, Soccsksargen, 9500, Philippines' },
  { place_id: 260716923, osm_type: 'node', osm_id: 775371398, lat: '6.1185529', lon: '125.1788817', category: 'amenity', type: 'fast_food', name: 'Jollibee', display_name: 'Jollibee, Donato Quinto Sr. Street, Dadiangas East, General Santos, Soccsksargen, 9500, Philippines' },
  { place_id: 260728817, osm_type: 'node', osm_id: 4396260890, lat: '6.1211662', lon: '125.1902386', category: 'amenity', type: 'fast_food', name: 'Jollibee', display_name: 'Jollibee, Digos-Makar Road, Lagao, General Santos, Soccsksargen, 9500, Philippines' },
];
export const ECOLAND_RESULTS = [
  { place_id: 260643468, osm_type: 'way', osm_id: 28996131, lat: '7.0555737', lon: '125.6010890', category: 'amenity', type: 'bus_station', name: 'Davao City Overland Transport Terminal', display_name: 'Davao City Overland Transport Terminal, Quimpo Boulevard, Robillo Compound, SIR 2, 76-A Bucana, Talomo District, Davao City, Davao Region, 8000, Philippines' },
];
const ALT_292 = {
  distance: 292833.8,
  duration: 36724.7,
  geometry: { type: 'LineString', coordinates: [[125.195353, 6.126999], [125.154665, 6.094849], [125.159098, 5.772147], [125.257019, 5.529422], [125.320199, 5.509554], [125.377175, 5.512683], [125.448069, 5.559008], [125.751579, 5.941594], [125.771385, 6.003518], [125.642738, 6.941678], [125.665807, 7.126048], [125.60074, 7.055757]] },
  legs: [{ steps: [] }],
};

/** SYNTHETIC places on the real route line, every ~12 km, for pipeline testing only. */
function syntheticOverpass() {
  const c: [number, number][] = route.coordinates;
  const els: unknown[] = [];
  const kinds = [{ shop: 'convenience' }, { amenity: 'restaurant' }, { shop: 'general' }, { amenity: 'drinking_water' }];
  for (let i = 150, n = 0; i < c.length - 100; i += 300, n++) {
    const [lon, lat] = c[i];
    els.push({ type: 'node', id: 900000 + n, lat, lon, tags: { ...kinds[n % kinds.length], name: `TEST Place ${n + 1}`, opening_hours: n % 3 === 0 ? '24/7' : undefined } });
  }
  els.push({ type: 'node', id: 999001, lat: 6.75, lon: 125.357, tags: { amenity: 'hospital', name: 'TEST Hospital' } });
  els.push({ type: 'node', id: 999002, tags: { shop: 'bakery', name: 'TEST no coordinates' } });
  return { elements: els };
}

const tilePng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

export async function mockServices(page: Page, opts: { overpass?: 'ok' | 'fail' } = {}) {
  await page.route(/tile\.openstreetmap\.org/, (r) => r.fulfill({ body: tilePng, contentType: 'image/png' }));
  await page.route(/nominatim\.openstreetmap\.org\/search/, (r: Route) => {
    const q = new URL(r.request().url()).searchParams.get('q') ?? '';
    const body = /jollibee/i.test(q) ? JOLLIBEE_RESULTS : /ecoland|overland/i.test(q) ? ECOLAND_RESULTS : [];
    return r.fulfill({ json: body });
  });
  await page.route(/nominatim\.openstreetmap\.org\/reverse/, (r) => r.fulfill({ json: { display_name: 'Dropped pin test address' } }));
  await page.route(/routed-bike\/route/, (r) =>
    r.fulfill({
      json: {
        code: 'Ok',
        routes: [
          { distance: route.distanceM, duration: route.durationS, geometry: { type: 'LineString', coordinates: route.coordinates }, legs: [{ steps: [] }] },
          ALT_292,
        ],
      },
    }),
  );
  await page.route(/overpass/, (r) => (opts.overpass === 'fail' ? r.fulfill({ status: 502, body: 'at capacity' }) : r.fulfill({ json: syntheticOverpass() })));
  await page.route(/open-meteo/, (r) => {
    const times = Array.from({ length: 48 }, (_, i) => new Date(Date.UTC(2026, 9, 24, i)).toISOString().slice(0, 13) + ':00');
    return r.fulfill({
      json: {
        utc_offset_seconds: 0,
        hourly: { time: times, temperature_2m: times.map(() => 27), precipitation_probability: times.map(() => 20), wind_speed_10m: times.map(() => 10), weather_code: times.map(() => 2) },
        daily: { time: ['2026-10-24', '2026-10-25'], sunrise: ['2026-10-24T21:30', '2026-10-25T21:30'], sunset: ['2026-10-24T09:40', '2026-10-25T09:40'] },
      },
    });
  });
}
