import type { Point } from '../types.ts';

/** One raw GPS reading. */
export type Fix = { t: number; lat: number; lon: number; alt: number | null; acc: number | null };

export type Track = {
  points: Point[];
  distanceM: number;
  movingMs: number;
  elevGainM: number;
  maxSpeedMs: number;
  /** Smoothed current speed. */
  speedMs: number;
  /** Accuracy of the latest reading in metres, or null when unknown. */
  accuracyM: number | null;
  last: Fix | null;
  altRef: number | null;
};

const MAX_ACCURACY_M = 35; // readings worse than this are ignored
const MAX_SPEED_MS = 28; // about 100 km/h; faster than this is a GPS jump
const GAP_S = 30; // longer than this between readings counts as a signal gap
const CLIMB_STEP_M = 3; // altitude must change this much before it counts

export function emptyTrack(): Track {
  return {
    points: [],
    distanceM: 0,
    movingMs: 0,
    elevGainM: 0,
    maxSpeedMs: 0,
    speedMs: 0,
    accuracyM: null,
    last: null,
    altRef: null,
  };
}

export function haversineM(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Feed one GPS reading into the track. Changes the track in place.
 * Bad readings are dropped so the distance is never inflated by GPS noise.
 */
export function addFix(tr: Track, fix: Fix): void {
  tr.accuracyM = fix.acc;
  if (fix.acc != null && fix.acc > MAX_ACCURACY_M) return;

  const last = tr.last;
  if (!last) {
    tr.last = fix;
    tr.altRef = fix.alt;
    tr.points.push({ t: fix.t, lat: fix.lat, lon: fix.lon, alt: fix.alt });
    return;
  }

  const dt = (fix.t - last.t) / 1000;
  if (dt <= 0) return;
  const d = haversineM(last.lat, last.lon, fix.lat, fix.lon);
  const v = d / dt;
  if (v > MAX_SPEED_MS) return;

  // Standing still: GPS wanders a few metres even when the bike does not move.
  const minMove = Math.max(4, Math.min(fix.acc ?? 0, 20) * 0.6);
  if (d < minMove) {
    if (dt > 4) tr.speedMs = 0;
    return;
  }

  tr.distanceM += d;
  if (dt <= GAP_S) {
    tr.movingMs += dt * 1000;
    tr.speedMs = tr.speedMs > 0 ? 0.6 * v + 0.4 * tr.speedMs : v;
    tr.maxSpeedMs = Math.max(tr.maxSpeedMs, tr.speedMs);
  } else {
    // Signal gap: keep the distance, estimate the time from the pace so far.
    const pace = tr.movingMs > 0 ? tr.distanceM / (tr.movingMs / 1000) : 0;
    tr.movingMs += Math.min(dt, d / Math.max(pace, 2.5)) * 1000;
  }

  if (fix.alt != null) {
    if (tr.altRef == null) tr.altRef = fix.alt;
    const rise = fix.alt - tr.altRef;
    if (rise >= CLIMB_STEP_M) {
      tr.elevGainM += rise;
      tr.altRef = fix.alt;
    } else if (rise <= -CLIMB_STEP_M) {
      tr.altRef = fix.alt;
    }
  }

  tr.last = fix;
  tr.points.push({ t: fix.t, lat: fix.lat, lon: fix.lon, alt: fix.alt });
}

/** Call when the ride is paused so no distance is counted across the pause. */
export function breakTrack(tr: Track): void {
  tr.last = null;
  tr.altRef = null;
  tr.speedMs = 0;
}

/** Thin a long route to at most `max` points, keeping the first and last. */
export function thin(points: Point[], max: number): Point[] {
  if (points.length <= max) return points;
  const out: Point[] = [];
  const step = (points.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(points[Math.round(i * step)]);
  return out;
}
