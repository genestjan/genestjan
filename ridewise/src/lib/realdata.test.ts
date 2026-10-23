// End-to-end check of the planning engine on REAL data for the default route:
// the OSRM bicycle route (2026-10-23) and an OpenStreetMap places snapshot
// retrieved the same day. Nothing in this test is synthetic.
import route from '../data/gensan-davao-route.json';
import snapshot from '../data/gensan-davao-places-snapshot.json';
import { elementsToPlaces, placesToCandidates, type OsmElement } from './discovery';
import { computeSchedule, suggestStops } from './schedule';
import { newPlan } from './defaults';
import { formatTime, formatDuration } from './time';
import type { RidePlan } from '../types';

const coords = (route.coordinates as [number, number][]).map(([lng, lat]) => [lat, lng] as [number, number]);
const { places, report } = elementsToPlaces(snapshot.elements as unknown as OsmElement[], snapshot.retrievedAt);
const candidates = placesToCandidates(places, coords, 1000, true);
const inCorridor = candidates.filter((c) => c.insideCorridor);

function plan(): RidePlan {
  return newPlan({
    departureLocal: '2026-11-07T05:00',
    start: { label: 'Jollibee Lagao', point: { lat: 6.1270345, lng: 125.1952745 } },
    end: { label: 'DCOTT', point: { lat: 7.0555737, lng: 125.601089 } },
    route: { id: 'osrm-real', provider: 'osrm-fossgis', providerLabel: 'OSRM', profile: 'bike', distanceM: route.distanceM, coords, retrievedAt: route.retrievedAt },
    candidates,
  });
}

describe('real GenSan → Davao data', () => {
  it('parses the snapshot and keeps every place with coordinates', () => {
    expect(report.missingCoords).toBe(0);
    expect(places.length).toBeGreaterThan(400);
  });

  it('finds real places inside the 1 km corridor along the whole route', () => {
    expect(inCorridor.length).toBeGreaterThan(100);
    // The 24/7 7-Eleven on Digos-Makar Road, Lagao (node 13741247801) is beside the start.
    const sevenEleven = inCorridor.find((c) => c.osmRef === 'node/13741247801')!;
    expect(sevenEleven.routeKm).toBeLessThan(1);
    expect(sevenEleven.openingHours).toBe('24/7');
    // A 7-Eleven tagged opening_hours=closed is never offered as a working stop.
    const closed = candidates.find((c) => c.osmRef === 'node/13741256202')!;
    expect(closed.verification).toBe('reported-closed');
  });

  it('builds a schedule only from real places and flags real gaps', () => {
    const p = plan();
    const { stops, gaps } = suggestStops(p);
    const ids = new Set(candidates.map((c) => c.id));
    for (const s of stops) {
      expect(ids.has(s.place.id)).toBe(true);
      expect(s.place.insideCorridor).toBe(true);
      expect(s.place.verification).not.toBe('reported-closed');
      expect(s.place.category).not.toBe('fuel');
    }
    const sched = computeSchedule({ ...p, stops });
    if (!sched.ok) throw new Error(sched.error);
    expect(sched.totals.distanceKm).toBeGreaterThan(135);
    expect(sched.totals.distanceKm).toBeLessThan(140);

    // Printed so a human can sanity-check the real itinerary.
    const lines = sched.rows.map(
      (r) =>
        `${String(r.number).padStart(2)} ${formatTime(r.arrivalMs!, 'Asia/Manila').padStart(8)}  km ${r.stop.place.routeKm.toFixed(1).padStart(5)}  ` +
        `+${r.segmentKm.toFixed(1).padStart(4)} km  ${r.stop.kind.padEnd(5)} ${r.stop.place.name} [${r.stop.place.category}, ${r.stop.place.offRouteM} m off, ${r.stop.place.openingHours ?? 'hours n/a'}]`,
    );
    console.log(
      [
        `${inCorridor.length} of ${candidates.length} real places within 1 km of the route`,
        ...lines,
        `Finish ${formatTime(sched.finish.arrivalMs, 'Asia/Manila')}, ${sched.totals.distanceKm.toFixed(1)} km, total ${formatDuration(sched.totals.elapsedMin)}`,
        `Gaps: ${JSON.stringify(gaps.map((g) => [g.fromKm.toFixed(1), g.toKm.toFixed(1)]))}`,
        ...sched.warnings.map((w) => `[${w.level}] ${w.message}`),
      ].join('\n'),
    );
  });
});
