import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Ride } from '../types.ts';
import { daysLeftInMonth, monthChallenges, monthStart } from './challenges.ts';
import { difficulty } from './difficulty.ts';
import { fmtAway, overpassQuery, parsePlaces, sampleRoute } from './places.ts';

const at = (y: number, m: number, d: number, h = 8) => new Date(y, m - 1, d, h).getTime();
let n = 0;
const ride = (startedAt: number, km: number, climb = 0): Ride => ({
  id: String(++n), title: 'Ride', startedAt, endedAt: startedAt + 3600000, distanceM: km * 1000,
  movingMs: 3600000, elapsedMs: 3600000, elevGainM: climb, maxSpeedMs: 10, bikeId: null,
});

test('monthly challenges count only this month and scale with the goal', () => {
  const now = at(2026, 11, 16);
  const rides = [ride(at(2026, 11, 2), 40, 300), ride(at(2026, 11, 9), 30, 150), ride(at(2026, 10, 30), 500, 5000)];
  const c = monthChallenges(rides, 120, now);
  assert.deepEqual(c.map((x) => x.key), ['distance', 'rides', 'climb', 'long']);
  assert.equal(c[0].target, 120);
  assert.equal(c[0].value, 70);
  assert.equal(c[0].done, false);
  assert.equal(c[1].value, 2);
  assert.equal(c[2].value, 450);
  assert.equal(c[3].target, 30);
  assert.equal(c[3].done, true); // the 40 km ride
  assert.ok(monthChallenges([], 800, now)[1].target <= 20);
  assert.equal(new Date(monthStart(now)).getDate(), 1);
  assert.equal(daysLeftInMonth(now), 15);
});

test('route difficulty uses distance and climbing together', () => {
  assert.equal(difficulty(15000, 50), 'Easy');
  assert.equal(difficulty(45000, 200), 'Moderate');
  assert.equal(difficulty(90000, 600), 'Hard');
  assert.equal(difficulty(160000, 2000), 'Extreme');
  assert.equal(difficulty(20000, 100), 'Easy');
  assert.equal(difficulty(20000, 600), 'Hard'); // short but steep: moderate by effort, moved up one
});

test('a route is sampled at steady gaps and keeps both ends', () => {
  const pts = Array.from({ length: 1001 }, (_, i) => ({ lat: 6 + i * 0.0001, lon: 125 })); // about 11 km
  const s = sampleRoute(pts, 2000);
  assert.equal(s[0], pts[0]);
  assert.equal(s[s.length - 1], pts[1000]);
  assert.ok(s.length >= 6 && s.length <= 8, String(s.length));
  assert.ok(sampleRoute(pts, 10).length <= 40);
  assert.deepEqual(sampleRoute([], 100), []);
});

test('the map question names every kind of place and every centre', () => {
  const q = overpassQuery([{ lat: 6.1, lon: 125.1 }, { lat: 6.2, lon: 125.2 }], 800);
  assert.ok(q.includes('around:800,6.10000,125.10000,6.20000,125.20000'));
  for (const tag of ['drinking_water', 'convenience', 'bicycle', 'bicycle_repair_station']) assert.ok(q.includes(tag), tag);
});

test('places are sorted nearest first, de-duplicated and labelled', () => {
  const json = {
    elements: [
      { type: 'node', id: 1, lat: 6.11, lon: 125.1, tags: { shop: 'bicycle', name: 'Pedal Works' } },
      { type: 'node', id: 2, lat: 6.1005, lon: 125.1, tags: { amenity: 'drinking_water' } },
      { type: 'way', id: 3, center: { lat: 6.102, lon: 125.1 }, tags: { shop: 'convenience', name: '7-Eleven' } },
      { type: 'node', id: 2, lat: 6.1005, lon: 125.1, tags: { amenity: 'drinking_water' } },
      { type: 'node', id: 4, lat: 6.1, lon: 125.1, tags: { amenity: 'bench' } },
      { type: 'way', id: 5, tags: { shop: 'bicycle' } },
    ],
  };
  const out = parsePlaces(json, [{ lat: 6.1, lon: 125.1 }]);
  assert.deepEqual(out.map((p) => p.id), ['node/2', 'way/3', 'node/1']);
  assert.deepEqual(out.map((p) => p.kind), ['water', 'water', 'shop']);
  assert.equal(out[2].name, 'Pedal Works (bike shop)');
  assert.equal(out[0].name, 'Drinking water');
  assert.deepEqual(parsePlaces({}, []), []);
  assert.equal(fmtAway(430), '450 m away');
  assert.equal(fmtAway(2340), '2.3 km away');
});
