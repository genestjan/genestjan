import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Bike, Ride } from '../types.ts';
import { fmtClock, fmtDist, fmtHours, fmtSpeed } from './format.ts';
import { badges, bests, bikeChecks, streakWeeks, weekOf, weekStart } from './stats.ts';

const at = (y: number, m: number, d: number, h = 8) => new Date(y, m - 1, d, h).getTime();
let n = 0;
const ride = (startedAt: number, km: number, extra: Partial<Ride> = {}): Ride => ({
  id: String(++n),
  title: 'Ride',
  startedAt,
  endedAt: startedAt + 3600000,
  distanceM: km * 1000,
  movingMs: 3600000,
  elapsedMs: 3600000,
  elevGainM: 0,
  maxSpeedMs: 10,
  bikeId: null,
  ...extra,
});

// 16 November 2026 is a Monday.
const MON = at(2026, 11, 16);

test('the week starts on Monday', () => {
  assert.equal(new Date(weekStart(at(2026, 11, 22, 23))).getDate(), 16); // Sunday night
  assert.equal(new Date(weekStart(MON)).getDate(), 16);
});

test('weekly totals only count this week, split by day', () => {
  const rides = [ride(at(2026, 11, 16), 10), ride(at(2026, 11, 18), 20), ride(at(2026, 11, 15), 99), ride(at(2026, 11, 23), 99)];
  const w = weekOf(rides, at(2026, 11, 19));
  assert.equal(w.distanceM, 30000);
  assert.equal(w.rides, 2);
  assert.deepEqual(w.days, [10000, 0, 20000, 0, 0, 0, 0]);
});

test('streak counts weeks in a row and survives an empty current week', () => {
  const rides = [ride(at(2026, 11, 10), 5), ride(at(2026, 11, 3), 5), ride(at(2026, 10, 28), 5), ride(at(2026, 10, 10), 5)];
  assert.equal(streakWeeks(rides, MON), 3); // nothing yet this week, last three weeks ridden
  assert.equal(streakWeeks([...rides, ride(MON, 5)], MON), 4);
  assert.equal(streakWeeks(rides, at(2026, 11, 25)), 0); // a full week missed
  assert.equal(streakWeeks([], MON), 0);
});

test('badges are earned from real totals', () => {
  const none = badges([], MON);
  assert.ok(none.every((b) => !b.earned));
  const some = badges([ride(MON, 60), ride(MON - 86400000, 45)], MON);
  const got = some.filter((b) => b.earned).map((b) => b.key);
  assert.deepEqual(got, ['first', 'r25', 'r50', 't100']);
});

test('personal bests compare with earlier rides only', () => {
  const a = ride(at(2026, 11, 1), 20);
  const b = ride(at(2026, 11, 8), 30);
  assert.deepEqual(bests(a, [a, b]), []); // first ride has nothing to beat
  assert.ok(bests(b, [a, b]).includes('Longest ride yet'));
});

test('bike care becomes due by distance and resets when done', () => {
  const bike: Bike = { id: 'b', name: 'Bike', kind: 'Road', startKm: 1000, doneAtKm: { chain: 1000, tyres: 1000, service: 1000 }, log: [] };
  const rides = [ride(MON, 320, { bikeId: 'b' }), ride(MON, 500)]; // second ride is on no bike
  const checks = bikeChecks(bike, rides);
  assert.equal(checks.find((c) => c.key === 'chain')?.due, true);
  assert.equal(checks.find((c) => c.key === 'tyres')?.due, false);
  bike.doneAtKm.chain = 1320;
  assert.equal(bikeChecks(bike, rides).find((c) => c.key === 'chain')?.due, false);
});

test('numbers are formatted for people', () => {
  assert.equal(fmtDist(12345, 'km'), '12.3');
  assert.equal(fmtDist(16093.44, 'mi'), '10.0');
  assert.equal(fmtSpeed(5.5556, 'km'), '20.0');
  assert.equal(fmtClock(3725000), '1:02:05');
  assert.equal(fmtClock(125000), '2:05');
  assert.equal(fmtHours(3725000), '1 h 2 min');
});
