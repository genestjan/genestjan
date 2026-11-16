/** Web Mercator maths for laying out 256 px map tiles. No React in here so it can be tested in Node. */

export type LatLon = { lat: number; lon: number };

export type View = { zoom: number; centerLat: number; centerLon: number };

export type Tile = { key: string; z: number; x: number; y: number; left: number; top: number };

const TILE = 256;
const MAX_LAT = 85.05;
const DEFAULT_VIEW: View = { zoom: 5, centerLat: 12.5, centerLon: 122.5 };

function worldSize(zoom: number): number {
  return TILE * Math.pow(2, zoom);
}

export function project(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const size = worldSize(zoom);
  const clamped = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const sin = Math.sin((clamped * Math.PI) / 180);
  const x = ((lon + 180) / 360) * size;
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size;
  return { x, y };
}

export function unproject(x: number, y: number, zoom: number): LatLon {
  const size = worldSize(zoom);
  const lon = (x / size) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / size;
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { lat, lon };
}

export function fitView(points: LatLon[], width: number, height: number, padding = 24, maxZoom = 17): View {
  const pts = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  if (pts.length === 0) return { ...DEFAULT_VIEW };

  // Work at zoom 0 and scale up: every zoom step doubles the pixel span.
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    const { x, y } = project(p.lat, p.lon, 0);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const mid = unproject((minX + maxX) / 2, (minY + maxY) / 2, 0);
  const spanX = maxX - minX;
  const spanY = maxY - minY;

  if (spanX === 0 && spanY === 0) {
    return { zoom: Math.min(maxZoom, 16), centerLat: mid.lat, centerLon: mid.lon };
  }

  const availW = Math.max(1, width - padding * 2);
  const availH = Math.max(1, height - padding * 2);
  let zoom = 2;
  for (let z = Math.floor(maxZoom); z >= 2; z--) {
    const scale = Math.pow(2, z);
    if (spanX * scale <= availW && spanY * scale <= availH) {
      zoom = z;
      break;
    }
  }
  return { zoom, centerLat: mid.lat, centerLon: mid.lon };
}

function topLeft(view: View, width: number, height: number): { x: number; y: number } {
  const c = project(view.centerLat, view.centerLon, view.zoom);
  return { x: c.x - width / 2, y: c.y - height / 2 };
}

export function tilesFor(view: View, width: number, height: number): Tile[] {
  if (!(width > 0) || !(height > 0)) return [];
  const z = view.zoom;
  const n = Math.pow(2, z);
  const tl = topLeft(view, width, height);
  const x0 = Math.floor(tl.x / TILE);
  const x1 = Math.ceil((tl.x + width) / TILE) - 1;
  const y0 = Math.floor(tl.y / TILE);
  const y1 = Math.ceil((tl.y + height) / TILE) - 1;
  const tiles: Tile[] = [];
  for (let ty = y0; ty <= y1; ty++) {
    if (ty < 0 || ty >= n) continue;
    for (let tx = x0; tx <= x1; tx++) {
      const x = ((tx % n) + n) % n;
      // The key uses the unwrapped column so a tile repeated across the date line stays unique.
      tiles.push({ key: `${z}/${tx}/${ty}`, z, x, y: ty, left: tx * TILE - tl.x, top: ty * TILE - tl.y });
    }
  }
  return tiles;
}

export function toScreen(view: View, width: number, height: number, p: LatLon): { x: number; y: number } {
  const tl = topLeft(view, width, height);
  const w = project(p.lat, p.lon, view.zoom);
  return { x: w.x - tl.x, y: w.y - tl.y };
}

export function tileUrl(template: string, t: { z: number; x: number; y: number }): string {
  return template.replace('{z}', String(t.z)).replace('{x}', String(t.x)).replace('{y}', String(t.y));
}
