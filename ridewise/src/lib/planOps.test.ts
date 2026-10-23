import { addCustomPlace, addStop, moveStop, removeStop, replacementOptions, selectRoute, updateStop, validateCustomPlace, verifyPlace } from './planOps';
import { cand, stop, testPlan, straightRoute } from '../test/fixtures';
import { computeSchedule } from './schedule';

describe('plan editing', () => {
  it('adds a stop in route order with the right default duration', () => {
    const p = addStop(testPlan({ stops: [stop('a', cand('A', 10)), stop('c', cand('C', 50))] }), cand('B', 30), 'meal');
    expect(p.stops.map((s) => s.place.id)).toEqual(['A', 'B', 'C']);
    expect(p.stops[1].durationMin).toBe(30);
  });

  it('edits, reorders and removes stops', () => {
    let p = testPlan({ stops: [stop('a', cand('A', 10)), stop('b', cand('B', 20))] });
    p = updateStop(p, 'a', { durationMin: 25, notes: 'Coffee' });
    expect(p.stops[0]).toMatchObject({ durationMin: 25, notes: 'Coffee' });
    p = moveStop(p, 'b', -1);
    expect(p.stops.map((s) => s.id)).toEqual(['b', 'a']);
    expect(moveStop(p, 'b', -1)).toBe(p);
    p = removeStop(p, 'a');
    expect(p.stops.map((s) => s.id)).toEqual(['b']);
  });

  it('adds user-submitted places, labelled unverified, projected onto the route', () => {
    const p = addCustomPlace(testPlan(), { name: 'Sari-sari by the chapel', category: 'sari-sari', point: { lat: 6 + 33 / 111.195, lng: 125.3 } });
    expect(p.candidates).toHaveLength(1);
    expect(p.stops[0].place).toMatchObject({ verification: 'user-unverified', source: 'user' });
    expect(p.stops[0].place.routeKm).toBeCloseTo(33, 1);
    expect(computeSchedule(p).ok).toBe(true);
  });

  it('marks a place confirmed by date when the rider supplies one', () => {
    const p = addCustomPlace(testPlan(), { name: 'Water refill', category: 'water', point: { lat: 6.2, lng: 125.3 }, lastConfirmed: '2026-10-20' });
    expect(p.stops[0].place).toMatchObject({ verification: 'user-verified', lastVerified: '2026-10-20' });
  });

  it('validates user-submitted places', () => {
    expect(validateCustomPlace({ name: '', category: 'water', point: { lat: 6, lng: 125 } })).toMatch(/name/);
    expect(validateCustomPlace({ name: 'x', category: 'water', point: { lat: NaN, lng: 125 } })).toMatch(/pin/);
  });

  it('verifies a place in both candidates and stops', () => {
    const c = cand('A', 10);
    const p = verifyPlace(testPlan({ candidates: [c], stops: [stop('a', c)] }), 'A', '2026-10-23');
    expect(p.candidates[0].verification).toBe('user-verified');
    expect(p.stops[0].place.lastVerified).toBe('2026-10-23');
  });

  it('offers nearby replacements, never closed places', () => {
    const p = testPlan({ candidates: [cand('A', 20), cand('B', 22), cand('C', 24, { verification: 'reported-closed' }), cand('D', 60)], stops: [stop('a', cand('A', 20))] });
    expect(replacementOptions(p, p.stops[0]).map((c) => c.id)).toEqual(['B']);
  });

  it('switching routes re-measures rider stops and clears stale candidates', () => {
    const p = testPlan({ candidates: [cand('A', 20)], stops: [stop('mine', cand('M', 20)), stop('auto', cand('A', 20), 10, { autoSuggested: true })] });
    const newRoute = { ...p.route!, id: 'other', coords: straightRoute(100).map(([la, ln]) => [la, ln + 0.001] as [number, number]) };
    const q = selectRoute(p, newRoute, [newRoute]);
    expect(q.candidates).toEqual([]);
    expect(q.stops.map((s) => s.id)).toEqual(['mine']);
    expect(q.stops[0].place.offRouteM).toBeGreaterThan(90);
  });
});
