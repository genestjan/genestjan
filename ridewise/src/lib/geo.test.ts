import { cumulativeKm, estimateDetourKm, haversineM, isValidLatLng, pointAtKm, projectOntoRoute, simplify } from './geo';
import { straightRoute } from '../test/fixtures';
import realRoute from '../data/gensan-davao-route.json';

describe('geo', () => {
  it('measures great-circle distance', () => {
    // 1 degree of latitude is ~111.2 km
    expect(haversineM({ lat: 6, lng: 125 }, { lat: 7, lng: 125 }) / 1000).toBeCloseTo(111.19, 1);
  });

  it('validates coordinates', () => {
    expect(isValidLatLng({ lat: 6.1, lng: 125.2 })).toBe(true);
    expect(isValidLatLng({ lat: NaN, lng: 125 })).toBe(false);
    expect(isValidLatLng({ lat: 91, lng: 0 })).toBe(false);
    expect(isValidLatLng(null)).toBe(false);
  });

  it('accumulates distance along a line', () => {
    const cum = cumulativeKm(straightRoute(100));
    expect(cum[0]).toBe(0);
    expect(cum[cum.length - 1]).toBeCloseTo(100, 1);
  });

  it('projects a point onto the route', () => {
    const coords = straightRoute(100);
    // 500 m east of the 40 km mark
    const p = { lat: 6 + 40 / 111.195, lng: 125.3 + 0.5 / (111.32 * Math.cos((6.36 * Math.PI) / 180)) };
    const proj = projectOntoRoute(p, coords)!;
    expect(proj.routeKm).toBeCloseTo(40, 1);
    expect(proj.offRouteM).toBeGreaterThan(480);
    expect(proj.offRouteM).toBeLessThan(520);
  });

  it('returns null for invalid input', () => {
    expect(projectOntoRoute({ lat: NaN, lng: 1 }, straightRoute(5))).toBeNull();
    expect(projectOntoRoute({ lat: 6, lng: 125 }, [[6, 125]])).toBeNull();
  });

  it('finds the point at a distance', () => {
    const p = pointAtKm(straightRoute(100), 25);
    expect(p.lat).toBeCloseTo(6 + 25 / 111.195, 3);
  });

  it('estimates detours as out-and-back with a road factor', () => {
    expect(estimateDetourKm(10)).toBe(0);
    expect(estimateDetourKm(500)).toBeCloseTo(1.3, 5);
    expect(estimateDetourKm(-1)).toBe(0);
  });

  it('simplifies without moving endpoints', () => {
    const s = simplify(straightRoute(100), 50);
    expect(s.length).toBe(2);
  });

  it('real GenSan-Davao OSRM geometry matches the provider distance', () => {
    const coords = (realRoute.coordinates as [number, number][]).map(([lng, lat]) => [lat, lng] as [number, number]);
    const km = cumulativeKm(coords).at(-1)!;
    // Our haversine sum vs OSRM's reported 135.13 km: within 1%.
    expect(Math.abs(km - realRoute.distanceM / 1000) / (realRoute.distanceM / 1000)).toBeLessThan(0.01);
    expect(coords[0][0]).toBeCloseTo(6.127, 2);
    expect(coords.at(-1)![0]).toBeCloseTo(7.0558, 3);
  });
});
