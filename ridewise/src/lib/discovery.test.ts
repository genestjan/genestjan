import { buildOverpassQuery, classify, elementsToPlaces, placesToCandidates, type OsmElement } from './discovery';
import { straightRoute } from '../test/fixtures';

const at = '2026-10-23T00:00:00Z';

describe('discovery', () => {
  it('classifies OSM tags', () => {
    expect(classify({ shop: 'convenience', name: '7-Eleven' })).toBe('convenience');
    expect(classify({ shop: 'convenience', name: "Aling Nena's Sari-Sari Store" })).toBe('sari-sari');
    expect(classify({ amenity: 'fast_food' })).toBe('restaurant');
    expect(classify({ amenity: 'drinking_water' })).toBe('water');
    expect(classify({ amenity: 'fuel' })).toBe('fuel');
    expect(classify({ amenity: 'bench' })).toBeNull();
  });

  it('drops elements with missing coordinates and de-duplicates', () => {
    const els: OsmElement[] = [
      { type: 'node', id: 1, lat: 6.1, lon: 125.3, tags: { shop: 'convenience', name: '7-Eleven' } },
      { type: 'node', id: 1, lat: 6.1, lon: 125.3, tags: { shop: 'convenience', name: '7-Eleven' } },
      { type: 'way', id: 2, center: { lat: 6.10001, lon: 125.30001 }, tags: { shop: 'convenience', name: '7-eleven', opening_hours: '24/7' } },
      { type: 'node', id: 3, tags: { shop: 'bakery' } },
      { type: 'node', id: 4, lat: 6.2, lon: 125.3, tags: { amenity: 'bench' } },
    ];
    const { places, report } = elementsToPlaces(els, at);
    expect(places).toHaveLength(1);
    expect(places[0].openingHours).toBe('24/7');
    expect(report).toMatchObject({ kept: 1, missingCoords: 1, unclassified: 1, duplicates: 2 });
  });

  it('labels unnamed places honestly and keeps hours unknown', () => {
    const { places } = elementsToPlaces([{ type: 'node', id: 9, lat: 6.1, lon: 125.3, tags: { shop: 'general' } }], at);
    expect(places[0].unnamed).toBe(true);
    expect(places[0].name).toMatch(/^Unnamed/);
    expect(places[0].openingHours).toBeUndefined();
  });

  it('marks disused or closed places as reported-closed', () => {
    const { places } = elementsToPlaces(
      [
        { type: 'node', id: 1, lat: 6.1, lon: 125.3, tags: { shop: 'convenience', name: 'A', 'disused:shop': 'convenience' } },
        { type: 'node', id: 2, lat: 6.2, lon: 125.3, tags: { amenity: 'cafe', name: 'B', opening_hours: 'closed' } },
      ],
      at,
    );
    expect(places.every((p) => p.verification === 'reported-closed')).toBe(true);
  });

  it('projects places onto the route with corridor and detour', () => {
    const coords = straightRoute(100);
    const { places } = elementsToPlaces(
      [
        { type: 'node', id: 1, lat: 6 + 30 / 111.195, lon: 125.3, tags: { shop: 'convenience', name: 'Roadside' } },
        { type: 'node', id: 2, lat: 6 + 60 / 111.195, lon: 125.3 + 0.02, tags: { shop: 'convenience', name: 'Far' } },
      ],
      at,
    );
    const c = placesToCandidates(places, coords, 1000);
    const road = c.find((x) => x.name === 'Roadside')!;
    const far = c.find((x) => x.name === 'Far')!;
    expect(road.routeKm).toBeCloseTo(30, 1);
    expect(road.detourKm).toBe(0);
    expect(road.insideCorridor).toBe(true);
    expect(far.offRouteM).toBeGreaterThan(2000);
    expect(far.insideCorridor).toBe(false);
    expect(far.detourKm).toBeGreaterThan(5);
    expect(road.score).toBeGreaterThan(far.score);
  });

  it('builds a corridor query with the requested radius', () => {
    const q = buildOverpassQuery(straightRoute(100), 1500);
    expect(q).toContain('around:1500,');
    expect(q).toContain('shop~"^(convenience');
    expect(q).toContain('out center tags');
  });
});
