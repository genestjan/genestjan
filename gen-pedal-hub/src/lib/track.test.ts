import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addFix, breakTrack, emptyTrack, haversineM, thin, type Fix } from './track.ts';

// 0.0001 degrees of latitude is about 11.1 m.
const fix = (i: number, t: number, extra: Partial<Fix> = {}): Fix => ({
  t: t * 1000,
  lat: 6.1 + i * 0.0001,
  lon: 125.17,
  alt: 10,
  acc: 5,
  ...extra,
});

test('haversine matches a known distance', () => {
  // General Santos to Davao, straight line, is roughly 113 km.
  const d = haversineM(6.1164, 125.1716, 7.1907, 125.4553);
  assert.ok(d > 120000 && d < 126000, String(d));
});

test('steady riding adds up distance, time and speed', () => {
  const tr = emptyTrack();
  for (let i = 0; i <= 100; i++) addFix(tr, fix(i * 0.5, i)); // 5.55 m every second = 20 km/h
  assert.ok(Math.abs(tr.distanceM - 555) < 6, String(tr.distanceM));
  assert.equal(Math.round(tr.movingMs / 1000), 100);
  assert.ok(Math.abs(tr.speedMs * 3.6 - 20) < 0.5, String(tr.speedMs * 3.6));
});

test('standing still adds no distance even though GPS wanders', () => {
  const tr = emptyTrack();
  for (let i = 0; i < 120; i++) addFix(tr, fix((i % 3) * 0.1, i, { acc: 8 })); // wobbles about 1 to 2 m
  assert.equal(tr.distanceM, 0);
  assert.equal(tr.movingMs, 0);
  assert.equal(tr.speedMs, 0);
});

test('inaccurate readings and impossible jumps are ignored', () => {
  const tr = emptyTrack();
  addFix(tr, fix(0, 0));
  addFix(tr, fix(1, 2));
  const before = tr.distanceM;
  addFix(tr, fix(50, 3, { acc: 80 })); // poor accuracy
  addFix(tr, fix(500, 4)); // 5.5 km in one second
  assert.equal(tr.distanceM, before);
  addFix(tr, fix(2, 5));
  assert.ok(tr.distanceM > before);
});

test('no distance is counted across a pause', () => {
  const tr = emptyTrack();
  addFix(tr, fix(0, 0));
  addFix(tr, fix(1, 2));
  const before = tr.distanceM;
  breakTrack(tr);
  addFix(tr, fix(1000, 600)); // moved 11 km while paused (in a car, say)
  assert.equal(tr.distanceM, before);
  addFix(tr, fix(1001, 602));
  assert.ok(Math.abs(tr.distanceM - before - 11.1) < 0.5);
});

test('a signal gap keeps the distance but does not count the whole wait as riding', () => {
  const tr = emptyTrack();
  for (let i = 0; i <= 60; i++) addFix(tr, fix(i * 0.5, i));
  const movingBefore = tr.movingMs;
  addFix(tr, fix(60, 660)); // 10 minutes later, 333 m further on
  assert.ok(Math.abs(tr.distanceM - 666) < 8, String(tr.distanceM));
  assert.ok(tr.movingMs - movingBefore < 120000, String(tr.movingMs - movingBefore));
});

test('climbing counts real climbs and ignores small altitude noise', () => {
  const tr = emptyTrack();
  for (let i = 0; i <= 50; i++) addFix(tr, fix(i, i * 2, { alt: 10 + (i % 2) })); // 1 m flutter
  assert.equal(tr.elevGainM, 0);
  for (let i = 51; i <= 100; i++) addFix(tr, fix(i, i * 2, { alt: 10 + (i - 50) })); // 50 m climb
  assert.ok(tr.elevGainM >= 45 && tr.elevGainM <= 50, String(tr.elevGainM));
});

test('thin keeps the first and last point', () => {
  const pts = Array.from({ length: 5000 }, (_, i) => ({ t: i, lat: i, lon: 0, alt: null }));
  const out = thin(pts, 2000);
  assert.equal(out.length, 2000);
  assert.equal(out[0].t, 0);
  assert.equal(out[1999].t, 4999);
});
