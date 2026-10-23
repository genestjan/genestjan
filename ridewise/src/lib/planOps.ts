// Pure edits on a RidePlan. Pages call these, then save. Every edit keeps
// the rider's own changes unless they explicitly ask to regenerate.

import type { Candidate, LatLng, PlannedStop, RidePlan, RouteResult, StopCategory, StopKind } from '../types';
import { durationFor, newId, suggestStops } from './schedule';
import { estimateDetourKm, isValidLatLng, projectOntoRoute } from './geo';
import { scorePlace } from './discovery';

export function selectRoute(plan: RidePlan, route: RouteResult, alternatives: RouteResult[]): RidePlan {
  const changed = plan.route && plan.route.id !== route.id;
  return {
    ...plan,
    route,
    alternatives,
    // A different route invalidates positions along the old one.
    candidates: changed ? [] : plan.candidates,
    candidatesRetrievedAt: changed ? undefined : plan.candidatesRetrievedAt,
    stops: changed ? reprojectStops(plan.stops, route) : plan.stops,
    status: plan.status === 'draft' ? 'planned' : plan.status,
  };
}

/** Keep the rider's stops when the route changes, re-measured on the new route. */
export function reprojectStops(stops: PlannedStop[], route: RouteResult): PlannedStop[] {
  return stops
    .filter((s) => !s.autoSuggested || s.mandatory)
    .map((s) => {
      const p = projectOntoRoute(s.place.point, route.coords);
      if (!p) return s;
      return { ...s, place: { ...s.place, routeKm: p.routeKm, offRouteM: Math.round(p.offRouteM), detourKm: estimateDetourKm(p.offRouteM) } };
    })
    .sort((a, b) => a.place.routeKm - b.place.routeKm);
}

export function applySuggestions(plan: RidePlan): { plan: RidePlan; gaps: { fromKm: number; toKm: number }[] } {
  const { stops, gaps } = suggestStops(plan);
  return { plan: { ...plan, stops }, gaps };
}

export function addStop(plan: RidePlan, c: Candidate, kind: StopKind = 'short', extra: Partial<PlannedStop> = {}): RidePlan {
  const stop: PlannedStop = { id: newId('stop'), place: c, kind, durationMin: durationFor(kind, plan), status: 'planned', ...extra };
  // Insert by position along the route; rider can reorder afterwards.
  const stops = [...plan.stops];
  const idx = stops.findIndex((s) => s.place.routeKm > c.routeKm);
  stops.splice(idx < 0 ? stops.length : idx, 0, stop);
  return { ...plan, stops };
}

export function updateStop(plan: RidePlan, id: string, patch: Partial<PlannedStop>): RidePlan {
  return { ...plan, stops: plan.stops.map((s) => (s.id === id ? { ...s, ...patch } : s)) };
}

export function removeStop(plan: RidePlan, id: string): RidePlan {
  return { ...plan, stops: plan.stops.filter((s) => s.id !== id) };
}

export function moveStop(plan: RidePlan, id: string, dir: -1 | 1): RidePlan {
  const i = plan.stops.findIndex((s) => s.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= plan.stops.length) return plan;
  const stops = [...plan.stops];
  [stops[i], stops[j]] = [stops[j], stops[i]];
  return { ...plan, stops };
}

export function replaceStopPlace(plan: RidePlan, id: string, c: Candidate): RidePlan {
  return updateStop(plan, id, { place: c, autoSuggested: false });
}

/** Candidates that could replace a stop: same supply role, nearby on the route. */
export function replacementOptions(plan: RidePlan, stop: PlannedStop, withinKm = 6): Candidate[] {
  const used = new Set(plan.stops.map((s) => s.place.id));
  return plan.candidates
    .filter(
      (c) =>
        !used.has(c.id) &&
        c.verification !== 'reported-closed' &&
        Math.abs(c.routeKm - stop.place.routeKm) <= withinKm &&
        !['hospital', 'clinic', 'police'].includes(c.category),
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

export function verifyPlace(plan: RidePlan, placeId: string, today = new Date().toISOString().slice(0, 10)): RidePlan {
  const mark = (c: Candidate): Candidate => (c.id === placeId ? { ...c, verification: 'user-verified', lastVerified: today } : c);
  return {
    ...plan,
    candidates: plan.candidates.map(mark),
    stops: plan.stops.map((s) => ({ ...s, place: mark(s.place) })),
  };
}

export type CustomPlaceInput = {
  name: string;
  point: LatLng;
  category: StopCategory;
  supplies?: string[];
  openingHours?: string;
  notes?: string;
  photo?: string;
  lastConfirmed?: string;
};

export function validateCustomPlace(input: CustomPlaceInput): string | null {
  if (!input.name.trim()) return 'Give the place a name, even a description like "Sari-sari store by the chapel".';
  if (!isValidLatLng(input.point)) return 'Drop a pin on the map or enter valid coordinates.';
  return null;
}

/** A rider-submitted place, always labelled user-submitted until confirmed. */
export function customCandidate(plan: RidePlan, input: CustomPlaceInput): Candidate {
  const err = validateCustomPlace(input);
  if (err) throw new Error(err);
  if (!plan.route) throw new Error('Calculate a route before adding stops.');
  const proj = projectOntoRoute(input.point, plan.route.coords);
  if (!proj) throw new Error('Could not place this point on the route.');
  const base = {
    id: newId('user'),
    name: input.name.trim(),
    category: input.category,
    point: input.point,
    openingHours: input.openingHours?.trim() || undefined,
    supplies: input.supplies,
    notes: input.notes?.trim() || undefined,
    photo: input.photo,
    source: 'user' as const,
    verification: input.lastConfirmed ? ('user-verified' as const) : ('user-unverified' as const),
    lastVerified: input.lastConfirmed || undefined,
    retrievedAt: new Date().toISOString(),
    routeKm: proj.routeKm,
    offRouteM: Math.round(proj.offRouteM),
    detourKm: estimateDetourKm(proj.offRouteM),
    insideCorridor: proj.offRouteM <= plan.settings.corridorM,
  };
  return { ...base, score: scorePlace(base, plan.settings.preferOnRoute) };
}

export function addCustomPlace(plan: RidePlan, input: CustomPlaceInput, asStop = true): RidePlan {
  const c = customCandidate(plan, input);
  const withCand = { ...plan, candidates: [...plan.candidates, c].sort((a, b) => a.routeKm - b.routeKm) };
  return asStop ? addStop(withCand, c, 'custom', { mandatory: false }) : withCand;
}
