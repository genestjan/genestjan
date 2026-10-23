import { computeSchedule, segmentMinutes, suggestStops, validateSpeed } from './schedule';
import { cand, stop, testPlan } from '../test/fixtures';
import { parseLocal } from './time';

const tz = 'Asia/Manila';
const t = (s: string) => parseLocal(s, tz)!;
const ok = <T extends { ok: boolean }>(s: T) => {
  if (!s.ok) throw new Error('schedule failed');
  return s as Extract<T, { ok: true }>;
};

describe('segment maths', () => {
  it('riding time = distance / speed', () => {
    expect(segmentMinutes(20, 20)).toBe(60);
    expect(segmentMinutes(15, 18)).toBe(50);
  });
  it('rejects zero, negative and absurd speeds', () => {
    expect(() => segmentMinutes(10, 0)).toThrow();
    expect(() => segmentMinutes(10, -5)).toThrow();
    expect(validateSpeed(NaN)).not.toBeNull();
    expect(validateSpeed(80)).not.toBeNull();
    expect(validateSpeed(20)).toBeNull();
  });
});

describe('computeSchedule', () => {
  it('fails clearly without a route', () => {
    const s = computeSchedule(testPlan({ route: undefined }));
    expect(s.ok).toBe(false);
  });

  it('fails clearly with an invalid speed or departure', () => {
    expect(computeSchedule(testPlan({ settings: { speedKmh: 0 } as never })).ok).toBe(false);
    expect(computeSchedule(testPlan({ departureLocal: 'nonsense' })).ok).toBe(false);
  });

  it('computes arrival with no stops', () => {
    const s = ok(computeSchedule(testPlan()));
    // ~100 km at 20 km/h = 5 h, from 05:00
    expect(s.totals.distanceKm).toBeCloseTo(100, 0);
    expect(Math.round((s.finish.arrivalMs - t('2026-11-07T05:00')) / 60000)).toBeCloseTo(300, -1);
  });

  it('computes cumulative distance, arrival and departure for each stop', () => {
    const plan = testPlan({ stops: [stop('a', cand('A', 20), 10), stop('b', cand('B', 50), 30)] });
    const s = ok(computeSchedule(plan));
    const [a, b] = s.rows;
    expect(a.segmentKm).toBeCloseTo(20, 5);
    expect(a.arrivalMs).toBe(t('2026-11-07T06:00'));
    expect(a.departureMs).toBe(t('2026-11-07T06:10'));
    expect(b.segmentKm).toBeCloseTo(30, 5);
    expect(b.cumKm).toBeCloseTo(50, 5);
    expect(b.arrivalMs).toBe(t('2026-11-07T07:40'));
    expect(b.departureMs).toBe(t('2026-11-07T08:10'));
    expect(s.totals.restMin).toBe(40);
  });

  it('recalculates every later time when a stop duration changes', () => {
    const base = testPlan({ stops: [stop('a', cand('A', 20), 10), stop('b', cand('B', 50), 10)] });
    const before = ok(computeSchedule(base));
    const longer = { ...base, stops: [{ ...base.stops[0], durationMin: 40 }, base.stops[1]] };
    const after = ok(computeSchedule(longer));
    expect(after.rows[0].arrivalMs).toBe(before.rows[0].arrivalMs);
    expect(after.rows[1].arrivalMs! - before.rows[1].arrivalMs!).toBe(30 * 60000);
    expect(after.finish.arrivalMs - before.finish.arrivalMs).toBe(30 * 60000);
  });

  it('uses recorded actual times so a delayed stop shifts the rest of the day', () => {
    const base = testPlan({ stops: [stop('a', cand('A', 20), 10), stop('b', cand('B', 50), 10)] });
    const delayed = {
      ...base,
      stops: [
        { ...base.stops[0], status: 'completed' as const, actualArrival: new Date(t('2026-11-07T06:15')).toISOString(), actualDeparture: new Date(t('2026-11-07T06:45')).toISOString() },
        base.stops[1],
      ],
    };
    const s = ok(computeSchedule(delayed));
    expect(s.rows[0].usesActuals).toBe(true);
    expect(s.rows[1].arrivalMs).toBe(t('2026-11-07T08:15'));
  });

  it('flags a departure recorded before arrival', () => {
    const base = testPlan({ stops: [stop('a', cand('A', 20), 10)] });
    base.stops[0].actualArrival = new Date(t('2026-11-07T06:30')).toISOString();
    base.stops[0].actualDeparture = new Date(t('2026-11-07T06:00')).toISOString();
    expect(ok(computeSchedule(base)).warnings.some((w) => w.code === 'bad-actuals')).toBe(true);
  });

  it('adds detour distance getting to the stop and back to the route', () => {
    const plan = testPlan({ stops: [stop('a', cand('A', 20, { detourKm: 2, offRouteM: 770 }), 10)] });
    const s = ok(computeSchedule(plan));
    expect(s.rows[0].segmentKm).toBeCloseTo(21, 5);
    expect(s.finish.segmentKm).toBeCloseTo(81, 0);
    expect(s.totals.distanceKm).toBeCloseTo(102, 0);
  });

  it('applies the delay buffer and the regroup time', () => {
    const plan = testPlan({
      settings: { delayBufferPct: 10 } as never,
      group: { riders: 5, regroupEveryStop: true, supportVehicle: false, regroupProcedureAgreed: true, participants: [] },
      stops: [stop('a', cand('A', 20), 10)],
    });
    const s = ok(computeSchedule(plan));
    expect(s.rows[0].arrivalMs).toBe(t('2026-11-07T06:06')); // 60 min + 10%
    expect(s.rows[0].restMin).toBe(15); // 10 + 5 regroup
  });

  it('skipping a stop recalculates and keeps the row', () => {
    const plan = testPlan({ stops: [stop('a', cand('A', 20)), stop('b', cand('B', 50)), stop('c', cand('C', 80))] });
    plan.stops[1].status = 'skipped';
    const s = ok(computeSchedule(plan));
    expect(s.rows[1].skipped).toBe(true);
    expect(s.rows[1].number).toBeNull();
    expect(s.rows[2].segmentKm).toBeCloseTo(60, 5);
    expect(s.rows[2].number).toBe(2);
    expect(s.warnings.some((w) => w.code === 'long-segment' && w.stopId === 'c')).toBe(true);
  });

  it('handles rides that cross midnight', () => {
    const plan = testPlan({ departureLocal: '2026-11-07T21:00' });
    const s = ok(computeSchedule(plan));
    expect(new Date(s.finish.arrivalMs).toISOString().slice(0, 10)).toBe('2026-11-07'); // 02:00 local = 18:00Z
    expect(s.warnings.some((w) => w.code === 'next-day')).toBe(true);
  });

  it('warns about arriving after sunset', () => {
    const s = ok(computeSchedule(testPlan({ departureLocal: '2026-11-07T14:00' }), { sunsetMs: t('2026-11-07T17:40') }));
    expect(s.warnings.some((w) => w.code === 'after-sunset')).toBe(true);
  });

  it('flags closed, reported-closed, fuel, duplicate and out-of-corridor stops', () => {
    const plan = testPlan({
      stops: [
        stop('a', cand('A', 10, { openingHours: 'Mo-Su 09:00-17:00' })), // ETA 05:30, closed
        stop('b', cand('B', 20, { verification: 'reported-closed' })),
        stop('c', cand('C', 30, { category: 'fuel' })),
        stop('d', cand('C', 30, { category: 'fuel' })),
        stop('e', cand('E', 40, { insideCorridor: false, offRouteM: 2500 })),
      ],
    });
    const codes = ok(computeSchedule(plan)).warnings.map((w) => w.code);
    expect(codes).toEqual(expect.arrayContaining(['closed-at-eta', 'reported-closed', 'fuel-unconfirmed', 'duplicate', 'outside-corridor']));
  });

  it('reports a supply gap prominently when the map has nothing in it', () => {
    const plan = testPlan({ candidates: [] });
    const w = ok(computeSchedule(plan)).warnings.find((x) => x.code === 'supply-gap')!;
    expect(w.level).toBe('danger');
    expect(w.message).toMatch(/No mapped water or food stop/);
  });

  it('flags a backwards stop order', () => {
    const plan = testPlan({ stops: [stop('a', cand('A', 50)), stop('b', cand('B', 20))] });
    expect(ok(computeSchedule(plan)).warnings.some((w) => w.code === 'backwards')).toBe(true);
  });
});

describe('suggestStops', () => {
  it('picks real candidates near each interval and never invents places', () => {
    const candidates = [cand('A', 13), cand('B', 14.5), cand('C', 28), cand('D', 44), cand('E', 58), cand('F', 73), cand('G', 88)];
    const plan = testPlan({ candidates });
    const { stops, gaps } = suggestStops(plan);
    expect(stops.length).toBeGreaterThan(3);
    for (const s of stops) expect(candidates.map((c) => c.id)).toContain(s.place.id);
    // Interval is min(15 km, 45 min at 20 km/h = 15 km)
    expect(stops[0].place.id).toBe('B');
    expect(gaps).toEqual([]);
  });

  it('reports gaps instead of filling them', () => {
    const plan = testPlan({ candidates: [cand('A', 14)] });
    const { stops, gaps } = suggestStops(plan);
    expect(stops.map((s) => s.place.id)).toEqual(['A']);
    expect(gaps.length).toBeGreaterThan(0);
  });

  it('skips closed, fuel and out-of-corridor places', () => {
    const plan = testPlan({
      candidates: [cand('X', 14, { verification: 'reported-closed' }), cand('Y', 14, { category: 'fuel' }), cand('Z', 14, { insideCorridor: false })],
    });
    expect(suggestStops(plan).stops).toEqual([]);
  });

  it('keeps stops the rider added and mandatory stops', () => {
    const mine = stop('mine', cand('M', 40, { verification: 'user-verified', source: 'user' }), 20, { mandatory: true });
    const plan = testPlan({ candidates: [cand('A', 14), cand('B', 28)], stops: [mine] });
    const ids = suggestStops(plan).stops.map((s) => s.id);
    expect(ids).toContain('mine');
  });

  it('prefers a restaurant as the meal stop around lunch', () => {
    const plan = testPlan({
      departureLocal: '2026-11-07T09:00',
      settings: { lunchTime: '12:00' } as never,
      candidates: [cand('A', 14), cand('B', 28), cand('C', 43), cand('R', 42, { category: 'restaurant', score: 24 }), cand('D', 58)],
    });
    const meal = suggestStops(plan).stops.find((s) => s.kind === 'meal');
    expect(meal?.place.id).toBe('R');
  });
});
