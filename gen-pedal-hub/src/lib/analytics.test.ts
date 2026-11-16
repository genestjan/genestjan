import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Ride } from '../types.ts';
import { change, metricValue, monthlySeries, records, weeklySeries } from './analytics.ts';
import { rideCalories, totalCalories } from './calories.ts';

const at = (y: number, m: number, d: number, h = 8, min = 0) => new Date(y, m - 1, d, h, min).getTime();
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
const NOW = at(2026, 11, 18, 12);

test('weekly series has 12 Mondays, oldest first, ending this week', () => {
  const s = weeklySeries([], NOW);
  assert.equal(s.length, 12);
  assert.equal(s[11].label, '16 Nov');
  assert.equal(s[10].label, '9 Nov');
  assert.equal(s[0].label, '31 Aug');
  for (let i = 0; i < s.length; i++) {
    const d = new Date(s[i].start);
    assert.equal(d.getDay(), 1);
    assert.equal(d.getHours(), 0);
    if (i > 0) assert.ok(s[i].start > s[i - 1].start);
  }
  assert.ok(s.every((b) => b.rides === 0 && b.distanceM === 0 && b.avgSpeedMs === 0));
});

test('weeks stay on Monday midnight across clock changes and the new year', () => {
  const s = weeklySeries([], at(2027, 4, 7), 30); // spans late October, new year and late March
  for (const b of s) {
    const d = new Date(b.start);
    assert.equal(d.getDay(), 1);
    assert.equal(d.getHours(), 0);
    assert.equal(d.getMinutes(), 0);
  }
  assert.equal(s[s.length - 1].label, '5 Apr');
  assert.ok(s.some((b) => b.label === '28 Dec'));
  assert.ok(s.some((b) => b.label === '4 Jan'));
});

test('Sunday night and Monday morning land in different weeks', () => {
  const sun = ride(at(2026, 11, 15, 23, 50), 10);
  const mon = ride(at(2026, 11, 16, 0, 10), 20);
  const s = weeklySeries([sun, mon], NOW);
  assert.equal(s[10].distanceM, 10000);
  assert.equal(s[11].distanceM, 20000);
  assert.equal(s[11].rides, 1);
});

test('rides outside the window are ignored', () => {
  const s = weeklySeries([ride(at(2026, 11, 23), 50), ride(at(2025, 1, 1), 50)], NOW);
  assert.equal(s.reduce((sum, b) => sum + b.rides, 0), 0);
});

test('bucket average speed is total distance over total moving time', () => {
  const s = weeklySeries([ride(at(2026, 11, 16), 20), ride(at(2026, 11, 17), 10, { movingMs: 3600000 })], NOW);
  assert.ok(Math.abs(s[11].avgSpeedMs - 30000 / 7200) < 1e-9);
  assert.equal(metricValue(s[11], 'distance'), 30000);
  assert.equal(metricValue(s[11], 'time'), 7200000);
  assert.equal(metricValue(s[11], 'speed'), s[11].avgSpeedMs);
});

test('monthly series has 6 months, oldest first, across a year boundary', () => {
  const rides = [ride(at(2027, 1, 31, 23), 5), ride(at(2027, 2, 1, 1), 7), ride(at(2026, 9, 1), 3)];
  const s = monthlySeries(rides, at(2027, 2, 10));
  assert.deepEqual(
    s.map((b) => b.label),
    ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb']
  );
  assert.equal(s[0].distanceM, 3000);
  assert.equal(s[4].distanceM, 5000);
  assert.equal(s[5].distanceM, 7000);
  assert.equal(new Date(s[4].start).getFullYear(), 2027);
  assert.equal(monthlySeries([], NOW).length, 6);
});

test('change compares the last 4 buckets with the 4 before', () => {
  const rides = [
    ride(at(2026, 10, 1), 10), // weeks 5 to 8 ago
    ride(at(2026, 10, 15), 10),
    ride(at(2026, 10, 27), 12), // last 4 weeks
    ride(at(2026, 11, 16), 12),
  ];
  const s = weeklySeries(rides, NOW);
  const c = change(s, 'distance');
  assert.equal(c.recent, 24000);
  assert.equal(c.before, 20000);
  assert.ok(c.pct !== null && Math.abs(c.pct - 20) < 1e-9);

  const sp = change(s, 'speed');
  assert.ok(sp.pct !== null && Math.abs(sp.recent - 12000 / 3600) < 1e-9);
});

test('change has no percentage without earlier data', () => {
  const s = weeklySeries([ride(at(2026, 11, 16), 12)], NOW);
  const c = change(s, 'distance');
  assert.equal(c.before, 0);
  assert.equal(c.pct, null);
  assert.equal(change([], 'time').pct, null);
});

test('records pick the best rides, and fastest needs at least 5 km', () => {
  const short = ride(at(2026, 11, 1), 4, { movingMs: 600000 }); // 24 km/h but too short
  const long = ride(at(2026, 11, 2), 60, { movingMs: 3 * 3600000 });
  const hilly = ride(at(2026, 11, 3), 30, { elevGainM: 800, movingMs: 2 * 3600000 });
  const quick = ride(at(2026, 11, 4), 25, { movingMs: 3600000 });
  const r = records([short, long, hilly, quick]);
  assert.equal(r.longest, long);
  assert.equal(r.mostClimb, hilly);
  assert.equal(r.fastest, quick);
  assert.equal(r.longestTime, long);
  assert.deepEqual(records([]), { longest: null, mostClimb: null, fastest: null, longestTime: null });
  assert.equal(records([short]).fastest, null);
});

test('calories follow MET x weight x hours', () => {
  assert.equal(rideCalories({ distanceM: 20000, movingMs: 3600000 }, 70), 560); // 8.0 MET
  assert.equal(rideCalories({ distanceM: 10000, movingMs: 3600000 }, 70), 280); // 4.0 MET
  assert.equal(rideCalories({ distanceM: 15000, movingMs: 1800000 }, 80), 480); // 30 km/h, 12.0 MET
  assert.equal(rideCalories({ distanceM: 35000, movingMs: 3600000 }, 60), 948); // 15.8 MET
  assert.equal(rideCalories({ distanceM: 16000, movingMs: 3600000 }, 50), 340); // 16 km/h is 6.8 MET
  assert.equal(rideCalories({ distanceM: 5000, movingMs: 0 }, 70), 0);
  assert.equal(rideCalories({ distanceM: 20000, movingMs: 3600000 }, 0), 0);
  assert.equal(totalCalories([ride(NOW, 20), ride(NOW, 10)], 70), 840);
  assert.equal(totalCalories([], 70), 0);
});
