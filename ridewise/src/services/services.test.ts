import { fetchWithRetry, ServiceError } from './http';
import { parseOsrm, parseOrs } from './routing';
import { parseNominatim } from './geocoding';
import { parseOpenMeteo } from './weather';
import { decodeShare, encodeShare } from '../lib/share';
import { testPlan, cand, stop } from '../test/fixtures';

const noSleep = { sleep: async () => undefined, baseDelayMs: 1 };
const resp = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });

describe('fetchWithRetry', () => {
  it('retries busy servers then succeeds', async () => {
    const f = vi.fn().mockResolvedValueOnce(resp(502)).mockResolvedValueOnce(resp(429)).mockResolvedValueOnce(resp(200, { ok: 1 }));
    const r = await fetchWithRetry('x', {}, { ...noSleep, fetchImpl: f, retries: 2 });
    expect(await r.json()).toEqual({ ok: 1 });
    expect(f).toHaveBeenCalledTimes(3);
  });
  it('gives up with a typed error', async () => {
    const f = vi.fn().mockResolvedValue(resp(503));
    await expect(fetchWithRetry('x', {}, { ...noSleep, fetchImpl: f, retries: 1 })).rejects.toMatchObject({ kind: 'unavailable' });
  });
  it('does not retry client errors', async () => {
    const f = vi.fn().mockResolvedValue(resp(400));
    await expect(fetchWithRetry('x', {}, { ...noSleep, fetchImpl: f })).rejects.toBeInstanceOf(ServiceError);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('reports network failure', async () => {
    const f = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(fetchWithRetry('x', {}, { ...noSleep, fetchImpl: f, retries: 0 })).rejects.toMatchObject({ kind: 'unavailable' });
  });
});

describe('provider parsing', () => {
  it('parses OSRM routes and alternatives', () => {
    const routes = parseOsrm(
      {
        code: 'Ok',
        routes: [
          { distance: 135130.5, duration: 32493, geometry: { coordinates: [[125.195353, 6.126999], [125.60074, 7.055757]] }, legs: [{ steps: [{ distance: 10, name: 'Digos-Makar Road', maneuver: { type: 'depart' } }] }] },
          { distance: 292833.8, duration: 36724.7, geometry: { coordinates: [[125.195353, 6.126999], [125.60074, 7.055757]] } },
        ],
      },
      'now',
    );
    expect(routes).toHaveLength(2);
    expect(routes[0].coords[0]).toEqual([6.126999, 125.195353]);
    expect(routes[0].steps![0].instruction).toBe('Start on Digos-Makar Road');
  });
  it('rejects OSRM errors instead of drawing something', () => {
    expect(() => parseOsrm({ code: 'NoRoute', message: 'Impossible route' }, 'now')).toThrow(/Impossible route/);
    expect(() => parseOsrm({ code: 'Ok', routes: [{ distance: 1, duration: 1, geometry: { coordinates: [] } }] }, 'now')).toThrow();
  });
  it('parses openrouteservice with ascent and surface', () => {
    const r = parseOrs(
      {
        features: [
          {
            geometry: { coordinates: [[125.1, 6.1, 10], [125.2, 6.2, 30]] },
            properties: { summary: { distance: 1000, duration: 200 }, ascent: 20, descent: 0, extras: { surface: { summary: [{ value: 3, amount: 80 }, { value: 10, amount: 20 }] } } },
          },
        ],
      },
      'now',
      'cycling-road',
    );
    expect(r[0].ascentM).toBe(20);
    expect(r[0].surfaceSummary).toEqual({ Asphalt: 0.8, Gravel: 0.2 });
  });
  it('parses Nominatim results (real response shape, 2026-10-23)', () => {
    const res = parseNominatim([
      { place_id: 260643468, osm_type: 'way', osm_id: 28996131, lat: '7.0555737', lon: '125.6010890', category: 'amenity', type: 'bus_station', name: 'Davao City Overland Transport Terminal', display_name: 'Davao City Overland Transport Terminal, Quimpo Boulevard, Davao City' },
      { osm_type: 'node', osm_id: 1, lat: 'x', lon: '1', type: 'x', display_name: 'bad' },
    ]);
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ label: 'Davao City Overland Transport Terminal', osmRef: 'way/28996131', point: { lat: 7.0555737, lng: 125.601089 } });
  });
  it('converts Open-Meteo local times using the offset', () => {
    const f = parseOpenMeteo(
      { utc_offset_seconds: 28800, hourly: { time: ['2026-11-07T05:00'], temperature_2m: [24], precipitation_probability: [10], wind_speed_10m: [8], weather_code: [1] }, daily: { time: ['2026-11-07'], sunrise: ['2026-11-07T05:40'], sunset: ['2026-11-07T17:35'] } },
      'Start',
      { lat: 6, lng: 125 },
    );
    expect(new Date(f.hours[0].timeMs).toISOString()).toBe('2026-11-06T21:00:00.000Z');
    expect(new Date(f.sunset['2026-11-07']).toISOString()).toBe('2026-11-07T09:35:00.000Z');
  });
});

describe('share links', () => {
  it('round-trips a plan and strips participant names by default', async () => {
    const plan = testPlan({ stops: [stop('a', cand('A', 20))] });
    plan.group.participants = [{ id: '1', name: 'Tito Boy' }];
    plan.group.organizer = 'Jan';
    const token = await encodeShare(plan);
    const back = await decodeShare(token);
    expect(back.stops[0].place.name).toBe('Store A');
    expect(back.group.participants).toEqual([]);
    expect(back.group.organizer).toBeUndefined();
    expect(JSON.stringify(back)).not.toContain('Tito Boy');
  });
  it('rejects damaged links', async () => {
    await expect(decodeShare('jbm90LWpzb24')).rejects.toThrow();
  });
});
