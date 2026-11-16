import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fitView, project, tilesFor, tileUrl, toScreen, unproject, type LatLon } from './tiles.ts';

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('project and unproject round trip', () => {
  for (const [lat, lon, z] of [[6.1164, 125.1716, 14], [-33.86, 151.2, 10], [51.5, -0.12, 3], [0, 0, 0]]) {
    const { x, y } = project(lat, lon, z);
    const back = unproject(x, y, z);
    close(back.lat, lat);
    close(back.lon, lon);
  }
});

test('project(0, 0, 0) is the middle of the single world tile', () => {
  const p = project(0, 0, 0);
  close(p.x, 128);
  close(p.y, 128);
});

test('project clamps latitude near the poles', () => {
  assert.deepEqual(project(90, 0, 2), project(85.05, 0, 2));
});

test('fitView keeps two far apart points inside the padded box', () => {
  const pts: LatLon[] = [{ lat: 6.1164, lon: 125.1716 }, { lat: 7.1907, lon: 125.4553 }];
  const w = 320, h = 220, pad = 24;
  const v = fitView(pts, w, h, pad);
  assert.ok(v.zoom >= 2 && v.zoom <= 17);
  for (const p of pts) {
    const s = toScreen(v, w, h, p);
    assert.ok(s.x >= pad - 1e-6 && s.x <= w - pad + 1e-6, `x ${s.x}`);
    assert.ok(s.y >= pad - 1e-6 && s.y <= h - pad + 1e-6, `y ${s.y}`);
  }
  // One zoom step closer must no longer fit.
  const tighter = { ...v, zoom: v.zoom + 1 };
  const out = pts.some((p) => {
    const s = toScreen(tighter, w, h, p);
    return s.x < pad || s.x > w - pad || s.y < pad || s.y > h - pad;
  });
  assert.ok(out);
});

test('fitView picks a lower zoom for a wider spread', () => {
  const near = fitView([{ lat: 6.1, lon: 125.1 }, { lat: 6.12, lon: 125.13 }], 320, 220);
  const far = fitView([{ lat: 6.1, lon: 125.1 }, { lat: 14.6, lon: 121.0 }], 320, 220);
  assert.ok(far.zoom < near.zoom, `${far.zoom} vs ${near.zoom}`);
});

test('fitView with one point, or identical points, centres on it', () => {
  const one = fitView([{ lat: 6.1, lon: 125.1 }], 320, 220);
  assert.equal(one.zoom, 16);
  close(one.centerLat, 6.1);
  close(one.centerLon, 125.1);
  const same = fitView([{ lat: 6.1, lon: 125.1 }, { lat: 6.1, lon: 125.1 }], 320, 220, 24, 14);
  assert.equal(same.zoom, 14);
});

test('fitView with nothing gives the Philippines', () => {
  const v = fitView([], 320, 220);
  assert.equal(v.zoom, 5);
  close(v.centerLat, 12.5);
  close(v.centerLon, 122.5);
});

test('tilesFor covers the whole box with no duplicate keys', () => {
  const cases = [
    { w: 320, h: 220, v: { zoom: 13, centerLat: 6.1164, centerLon: 125.1716 } },
    { w: 1000, h: 700, v: { zoom: 2, centerLat: 0, centerLon: 179 } },
    { w: 257, h: 1, v: { zoom: 0, centerLat: 0, centerLon: 0 } },
  ];
  for (const { w, h, v } of cases) {
    const tiles = tilesFor(v, w, h);
    const keys = new Set(tiles.map((t) => t.key));
    assert.equal(keys.size, tiles.length);
    const n = Math.pow(2, v.zoom);
    for (const t of tiles) {
      assert.ok(t.x >= 0 && t.x < n && t.y >= 0 && t.y < n);
    }
    // Corners nudged inwards so a corner sitting exactly on an edge counts.
    const e = 1e-6;
    for (const [cx, cy] of [[e, e], [w - e, e], [e, h - e], [w - e, h - e], [w / 2, h / 2]]) {
      const covered = tiles.some((t) => cx >= t.left && cx <= t.left + 256 && cy >= t.top && cy <= t.top + 256);
      assert.ok(covered, `corner ${cx},${cy} at zoom ${v.zoom}`);
    }
  }
});

test('tilesFor skips rows beyond the poles', () => {
  const tiles = tilesFor({ zoom: 1, centerLat: 0, centerLon: 0 }, 300, 2000);
  assert.ok(tiles.every((t) => t.y === 0 || t.y === 1));
});

test('tileUrl fills the placeholders', () => {
  assert.equal(
    tileUrl('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { z: 13, x: 6944, y: 3956 }),
    'https://tile.openstreetmap.org/13/6944/3956.png',
  );
});
