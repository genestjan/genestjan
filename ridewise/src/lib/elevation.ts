// Hills along a route. Heights come from a real terrain model (Open-Meteo's
// elevation API, a 90 m grid), sampled at evenly spaced points. At that scale
// small bumps vanish, so every number here is labelled as an estimate.

import type { RouteResult } from '../types';
import { cumulativeKm, pointAtKm } from './geo';

export const ELEVATION_SAMPLES = 100;

export type ElevationData = { elevationM: number[]; retrievedAt: string; source: string };
export type ProfilePoint = { km: number; ele: number; grade: number }; // grade of the stretch ending here, in %

export function samplePoints(coords: [number, number][], n = ELEVATION_SAMPLES): { km: number; lat: number; lng: number }[] {
  const cum = cumulativeKm(coords);
  const total = cum[cum.length - 1];
  return Array.from({ length: n }, (_, k) => {
    const km = (total * k) / (n - 1);
    const p = pointAtKm(coords, km, cum);
    return { km, lat: p.lat, lng: p.lng };
  });
}

export function buildProfile(coords: [number, number][], data: ElevationData) {
  const pts = samplePoints(coords, data.elevationM.length);
  const profile: ProfilePoint[] = pts.map((p, i) => {
    const prev = pts[i - 1];
    const dKm = prev ? p.km - prev.km : 0;
    const grade = prev && dKm > 0 ? ((data.elevationM[i] - data.elevationM[i - 1]) / (dKm * 1000)) * 100 : 0;
    return { km: p.km, ele: data.elevationM[i], grade };
  });
  // Ignore wobbles under 3 m so noise in the terrain grid does not count as climbing.
  let ascent = 0;
  let descent = 0;
  let anchor = profile[0].ele;
  for (const p of profile) {
    const d = p.ele - anchor;
    if (d >= 3) {
      ascent += d;
      anchor = p.ele;
    } else if (d <= -3) {
      descent -= d;
      anchor = p.ele;
    }
  }
  const eles = profile.map((p) => p.ele);
  const steepest = profile.reduce((m, p) => (p.grade > m.grade ? p : m), profile[0]);
  return {
    profile,
    ascentM: Math.round(ascent),
    descentM: Math.round(descent),
    highestM: Math.max(...eles),
    lowestM: Math.min(...eles),
    steepestUpPct: Math.max(0, steepest.grade),
    steepestUpAtKm: steepest.km,
  };
}

/** Colour for a stretch: easy to hard. Never used alone; the chart also has numbers. */
export function gradeColor(grade: number): string {
  const g = Math.abs(grade);
  if (g < 2) return '#4caf7d';
  if (g < 4) return '#f2c94c';
  if (g < 6) return '#f2994a';
  return '#e0483e';
}

export function hasElevation(route?: RouteResult): route is RouteResult & { elevation: ElevationData } {
  return !!route?.elevation?.elevationM?.length;
}
