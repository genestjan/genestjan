// Pit stop scheduling engine.
//
// Every time shown in RideWise comes from here and is an ESTIMATE built from
// (a) real route distances, (b) the pace the group agreed on, and (c) the
// stop durations the organiser set. Nothing in here invents a place: if no
// suitable real stop exists, the gap is reported, never filled.

import type { Candidate, PlannedStop, RidePlan, StopCategory, StopKind } from '../types';
import { hoursStatusAt, type HoursStatus } from './hours';
import { SUPPLY_CATEGORIES, CATEGORY_LABEL } from './discovery';
import { formatDuration, formatKm, localClock, localDayKey, parseLocal, hhmmToMinutes } from './time';
import { haversineM } from './geo';

export type Level = 'info' | 'caution' | 'danger';
export type ScheduleWarning = {
  level: Level;
  code:
    | 'long-segment'
    | 'supply-gap'
    | 'closed-at-eta'
    | 'reported-closed'
    | 'fuel-unconfirmed'
    | 'outside-corridor'
    | 'duplicate'
    | 'backwards'
    | 'after-sunset'
    | 'next-day'
    | 'long-day'
    | 'bad-actuals'
    | 'unverified-user-stop';
  message: string;
  stopId?: string;
  fromKm?: number;
  toKm?: number;
};

export type ScheduleRow = {
  stop: PlannedStop;
  number: number | null; // null when skipped
  skipped: boolean;
  segmentKm: number; // riding distance from the previous stop, incl. detours
  cumKm: number; // riding distance from the start, incl. detours so far
  movingMin: number;
  bufferMin: number;
  arrivalMs: number | null;
  departureMs: number | null;
  restMin: number; // planned stop duration plus regroup buffer
  hours: HoursStatus;
  usesActuals: boolean;
};

export type Schedule =
  | { ok: false; error: string }
  | {
      ok: true;
      departureMs: number;
      rows: ScheduleRow[];
      finish: { segmentKm: number; movingMin: number; bufferMin: number; arrivalMs: number; cumKm: number };
      totals: { distanceKm: number; movingMin: number; bufferMin: number; restMin: number; elapsedMin: number; stops: number };
      warnings: ScheduleWarning[];
    };

export type ScheduleOptions = {
  sunsetMs?: number | null;
};

export function validateSpeed(speedKmh: number): string | null {
  if (!Number.isFinite(speedKmh) || speedKmh <= 0) return 'Riding speed must be more than 0 km/h.';
  if (speedKmh > 45) return 'A planning speed over 45 km/h is not realistic for a group ride.';
  return null;
}

/** Riding minutes for a distance at a moving speed. Throws on invalid speed. */
export function segmentMinutes(km: number, speedKmh: number): number {
  const err = validateSpeed(speedKmh);
  if (err) throw new Error(err);
  if (!Number.isFinite(km) || km < 0) throw new Error('Distance must be a positive number.');
  return (km / speedKmh) * 60;
}

export function regroupMinFor(plan: RidePlan): number {
  return plan.group.riders > 1 || plan.group.regroupEveryStop ? Math.max(0, plan.settings.regroupMin) : 0;
}

export function computeSchedule(plan: RidePlan, opts: ScheduleOptions = {}): Schedule {
  if (!plan.route || plan.route.coords.length < 2) return { ok: false, error: 'No route yet. Calculate a route first.' };
  const speedErr = validateSpeed(plan.settings.speedKmh);
  if (speedErr) return { ok: false, error: speedErr };
  const departureMs = parseLocal(plan.departureLocal, plan.timeZone);
  if (departureMs === null) return { ok: false, error: 'Departure date or time is not valid.' };

  const tz = plan.timeZone;
  const speed = plan.settings.speedKmh;
  const bufPct = Math.max(0, plan.settings.delayBufferPct) / 100;
  const regroup = regroupMinFor(plan);
  const totalKm = plan.route.distanceM / 1000;
  const warnings: ScheduleWarning[] = [];

  const rows: ScheduleRow[] = [];
  let prevKm = 0;
  let pendingReturnKm = 0; // half the detour of the previous stop: riding back to the route
  let clock = departureMs;
  let cumKm = 0;
  let number = 0;
  let movingTotal = 0;
  let bufferTotal = 0;
  let restTotal = 0;
  let prevStop: PlannedStop | null = null;

  for (const stop of plan.stops) {
    const c = stop.place;
    if (stop.status === 'skipped') {
      rows.push({
        stop,
        number: null,
        skipped: true,
        segmentKm: 0,
        cumKm,
        movingMin: 0,
        bufferMin: 0,
        arrivalMs: null,
        departureMs: null,
        restMin: 0,
        hours: 'unknown',
        usesActuals: false,
      });
      continue;
    }
    number++;
    if (c.routeKm < prevKm - 0.05) {
      warnings.push({
        level: 'caution',
        code: 'backwards',
        stopId: stop.id,
        message: `${c.name} is ${formatKm(prevKm - c.routeKm)} behind the previous stop on the route. Riding back adds distance; check the stop order.`,
      });
    }
    const along = Math.abs(c.routeKm - prevKm);
    const segmentKm = along + pendingReturnKm + c.detourKm / 2;
    const movingMin = (segmentKm / speed) * 60;
    const bufferMin = movingMin * bufPct;
    cumKm += segmentKm;
    let arrival = clock + (movingMin + bufferMin) * 60000;
    let usesActuals = false;
    if (stop.actualArrival) {
      const a = Date.parse(stop.actualArrival);
      if (Number.isFinite(a)) {
        arrival = a;
        usesActuals = true;
      }
    }
    const duration = Math.max(0, Number.isFinite(stop.durationMin) ? stop.durationMin : 0);
    const restMin = duration + regroup;
    let departure = arrival + restMin * 60000;
    if (stop.actualDeparture) {
      const d = Date.parse(stop.actualDeparture);
      if (Number.isFinite(d)) {
        if (d < arrival) {
          warnings.push({
            level: 'caution',
            code: 'bad-actuals',
            stopId: stop.id,
            message: `Recorded departure from ${c.name} is before its arrival time. Check the times.`,
          });
        } else {
          departure = d;
          usesActuals = true;
        }
      }
    }
    const hours = hoursStatusAt(c.openingHours, arrival, tz);
    rows.push({
      stop,
      number,
      skipped: false,
      segmentKm,
      cumKm,
      movingMin,
      bufferMin,
      arrivalMs: arrival,
      departureMs: departure,
      restMin: (departure - arrival) / 60000,
      hours,
      usesActuals,
    });
    movingTotal += movingMin;
    bufferTotal += bufferMin;
    restTotal += (departure - arrival) / 60000;

    // Per-stop checks.
    if (movingMin + bufferMin > plan.settings.maxRideMinBetweenStops * 1.25) {
      warnings.push({
        level: 'caution',
        code: 'long-segment',
        stopId: stop.id,
        fromKm: prevKm,
        toKm: c.routeKm,
        message: `Long stretch before ${c.name}: ${formatKm(segmentKm)} (about ${formatDuration(movingMin + bufferMin)}) without a planned stop.`,
      });
    }
    if (c.verification === 'reported-closed') {
      warnings.push({ level: 'danger', code: 'reported-closed', stopId: stop.id, message: `${c.name} is marked closed or disused in map data. Do not rely on it.` });
    } else if (hours === 'listed-closed') {
      warnings.push({ level: 'caution', code: 'closed-at-eta', stopId: stop.id, message: `${c.name}'s listed hours say it is closed at the estimated arrival. Consider a replacement.` });
    }
    if (c.category === 'fuel' && c.verification !== 'user-verified') {
      warnings.push({ level: 'info', code: 'fuel-unconfirmed', stopId: stop.id, message: `${c.name} is a fuel station. Confirm there is a safe place for bikes to stop away from the pumps.` });
    }
    if (c.verification === 'user-unverified') {
      warnings.push({ level: 'info', code: 'unverified-user-stop', stopId: stop.id, message: `${c.name} was added by a rider and is not yet confirmed.` });
    }
    if (!c.insideCorridor) {
      warnings.push({ level: 'caution', code: 'outside-corridor', stopId: stop.id, message: `${c.name} is ${Math.round(c.offRouteM)} m from the route, outside the search corridor.` });
    }
    if (prevStop && (prevStop.place.id === c.id || haversineM(prevStop.place.point, c.point) < 50)) {
      warnings.push({ level: 'caution', code: 'duplicate', stopId: stop.id, message: `${c.name} duplicates the previous stop.` });
    }

    clock = departure;
    prevKm = c.routeKm;
    pendingReturnKm = c.detourKm / 2;
    prevStop = stop;
  }

  const finishKm = Math.abs(totalKm - prevKm) + pendingReturnKm;
  const finishMoving = (finishKm / speed) * 60;
  const finishBuffer = finishMoving * bufPct;
  cumKm += finishKm;
  movingTotal += finishMoving;
  bufferTotal += finishBuffer;
  const arrivalMs = clock + (finishMoving + finishBuffer) * 60000;
  if (finishMoving + finishBuffer > plan.settings.maxRideMinBetweenStops * 1.25) {
    warnings.push({
      level: 'caution',
      code: 'long-segment',
      fromKm: prevKm,
      toKm: totalKm,
      message: `Long final stretch: ${formatKm(finishKm)} (about ${formatDuration(finishMoving + finishBuffer)}) to the destination without a planned stop.`,
    });
  }

  warnings.push(...supplyGapWarnings(plan, totalKm));

  if (opts.sunsetMs && arrivalMs > opts.sunsetMs) {
    warnings.push({
      level: 'caution',
      code: 'after-sunset',
      message: 'Estimated arrival is after sunset. Leave earlier, shorten stops, or make sure every bike has working front and rear lights.',
    });
  }
  if (localDayKey(arrivalMs, tz) !== localDayKey(departureMs, tz)) {
    warnings.push({ level: 'caution', code: 'next-day', message: 'Estimated arrival falls on a later calendar day than departure.' });
  }
  const elapsedMin = (arrivalMs - departureMs) / 60000;
  if (elapsedMin > 14 * 60) {
    warnings.push({ level: 'caution', code: 'long-day', message: `This plan is a ${formatDuration(elapsedMin)} day. Consider splitting the ride or arranging support.` });
  }

  return {
    ok: true,
    departureMs,
    rows,
    finish: { segmentKm: finishKm, movingMin: finishMoving, bufferMin: finishBuffer, arrivalMs, cumKm },
    totals: {
      distanceKm: cumKm,
      movingMin: movingTotal,
      bufferMin: bufferTotal,
      restMin: restTotal,
      elapsedMin,
      stops: number,
    },
    warnings,
  };
}

const isSupply = (cat: StopCategory) => SUPPLY_CATEGORIES.includes(cat);

/**
 * Longest stretches with no planned water/food stop. If the map has no
 * supply candidates in the stretch either, say so prominently.
 */
export function supplyGapWarnings(plan: RidePlan, totalKm: number): ScheduleWarning[] {
  const limitKm = (plan.settings.speedKmh * plan.settings.maxRideMinBetweenStops) / 60 * 1.5;
  const points = [0];
  for (const s of plan.stops) {
    if (s.status !== 'skipped' && isSupply(s.place.category) && s.place.verification !== 'reported-closed') points.push(s.place.routeKm);
  }
  points.push(totalKm);
  points.sort((a, b) => a - b);
  const out: ScheduleWarning[] = [];
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    const gap = to - from;
    if (gap <= limitKm) continue;
    const mapped = plan.candidates.filter(
      (c) => c.routeKm > from && c.routeKm < to && isSupply(c.category) && c.insideCorridor && c.verification !== 'reported-closed',
    ).length;
    out.push(
      mapped === 0
        ? {
            level: 'danger',
            code: 'supply-gap',
            fromKm: from,
            toKm: to,
            message: `No mapped water or food stop between km ${from.toFixed(1)} and km ${to.toFixed(1)} (${formatKm(gap)}). Add a confirmed stop, carry enough supplies for the whole stretch, change the route, or reconsider the plan.`,
          }
        : {
            level: 'caution',
            code: 'supply-gap',
            fromKm: from,
            toKm: to,
            message: `${formatKm(gap)} between planned water/food stops (km ${from.toFixed(1)} to ${to.toFixed(1)}). ${mapped} mapped option${mapped === 1 ? '' : 's'} exist in between; consider adding one.`,
          },
    );
  }
  return out;
}

export type SuggestionResult = { stops: PlannedStop[]; gaps: { fromKm: number; toKm: number }[] };

let idCounter = 0;
export const newId = (prefix = 'id') =>
  `${prefix}_${Date.now().toString(36)}${(idCounter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function durationFor(kind: StopKind, plan: RidePlan): number {
  switch (kind) {
    case 'short':
      return plan.settings.shortStopMin;
    case 'rest':
      return plan.settings.restStopMin;
    case 'meal':
      return plan.settings.mealStopMin;
    case 'regroup':
      return plan.settings.regroupMin;
    default:
      return plan.settings.shortStopMin;
  }
}

/** Candidates eligible for automatic selection. */
export function eligibleForAuto(c: Candidate, plan: RidePlan): boolean {
  if (!c.insideCorridor || c.verification === 'reported-closed') return false;
  if (c.category === 'fuel' && !(plan.settings.includeFuelStations && c.verification === 'user-verified')) return false;
  if (['hospital', 'clinic', 'police', 'pharmacy'].includes(c.category)) return false;
  return plan.settings.stopTypes.includes(c.category);
}

/**
 * Suggest pit stops at real places. Keeps every stop the rider added or
 * marked mandatory; replaces only previous automatic suggestions.
 */
export function suggestStops(plan: RidePlan): SuggestionResult {
  const route = plan.route;
  if (!route) return { stops: plan.stops, gaps: [] };
  const speed = plan.settings.speedKmh;
  if (validateSpeed(speed)) return { stops: plan.stops, gaps: [] };
  const departureMs = parseLocal(plan.departureLocal, plan.timeZone);
  if (departureMs === null) return { stops: plan.stops, gaps: [] };

  const totalKm = route.distanceM / 1000;
  const bufPct = Math.max(0, plan.settings.delayBufferPct) / 100;
  const kmPerMinute = speed / 60 / (1 + bufPct);
  const intervalKm = Math.max(
    3,
    Math.min(plan.settings.preferredStopIntervalKm, plan.settings.maxRideMinBetweenStops * kmPerMinute),
  );
  const kept = plan.stops.filter((s) => !s.autoSuggested || s.mandatory || s.status !== 'planned');
  const anchors = [...kept].sort((a, b) => a.place.routeKm - b.place.routeKm);
  const pool = plan.candidates.filter((c) => eligibleForAuto(c, plan));
  const lunchMin = hhmmToMinutes(plan.settings.lunchTime) ?? 12 * 60;
  const regroup = regroupMinFor(plan);

  const out: PlannedStop[] = [];
  const gaps: { fromKm: number; toKm: number }[] = [];
  let prevKm = 0;
  let clock = departureMs;
  let ate = anchors.some((s) => s.kind === 'meal');
  let count = 0;
  const etaAt = (km: number) => clock + ((km - prevKm) / kmPerMinute) * 60000;

  // Stop once the finish is within one interval: no stop is needed there.
  while (totalKm - prevKm > intervalKm) {
    const target = prevKm + intervalKm;
    const anchor = anchors.find((s) => s.place.routeKm > prevKm + 0.05 && s.place.routeKm <= target + 0.05);
    let chosen: PlannedStop | null = null;
    if (anchor) {
      chosen = anchor;
    } else {
      const wantMeal = !ate && localClock(etaAt(target), plan.timeZone).minutes >= lunchMin - 45;
      const pick = (lo: number, hi: number) => {
        let best: Candidate | null = null;
        let bestScore = -Infinity;
        for (const c of pool) {
          if (c.routeKm <= lo || c.routeKm > hi) continue;
          if (out.some((s) => s.place.id === c.id)) continue;
          let s = c.score + ((c.routeKm - prevKm) / intervalKm) * 12;
          const hrs = hoursStatusAt(c.openingHours, etaAt(c.routeKm), plan.timeZone);
          if (hrs === 'listed-closed') s -= 40;
          if (hrs === 'listed-open') s += 4;
          if (wantMeal && (c.category === 'restaurant' || c.category === 'cafe')) s += 30;
          if (s > bestScore) {
            bestScore = s;
            best = c;
          }
        }
        return best;
      };
      const c = pick(prevKm + intervalKm * 0.5, target) ?? pick(target, target + intervalKm * 0.25);
      if (c) {
        count++;
        const kind: StopKind =
          wantMeal && (c.category === 'restaurant' || c.category === 'cafe') ? 'meal' : count % 2 === 0 ? 'rest' : 'short';
        chosen = {
          id: newId('stop'),
          place: c,
          kind,
          durationMin: durationFor(kind, plan),
          status: 'planned',
          autoSuggested: true,
        };
      }
    }
    if (!chosen) {
      gaps.push({ fromKm: prevKm, toKm: Math.min(totalKm, target + intervalKm * 0.25) });
      // Move on without inventing a stop. The supply-gap check will flag it.
      clock = etaAt(target);
      prevKm = target;
      continue;
    }
    if (chosen.kind === 'meal') ate = true;
    out.push(chosen);
    clock = etaAt(chosen.place.routeKm) + (chosen.durationMin + regroup) * 60000;
    prevKm = chosen.place.routeKm;
  }
  // Anchors past the last suggestion (e.g. near the finish) are kept too.
  for (const a of anchors) if (!out.includes(a)) out.push(a);
  out.sort((a, b) => a.place.routeKm - b.place.routeKm);
  return { stops: out, gaps };
}

export function kindLabel(kind: StopKind): string {
  return { short: 'Hydration & quick check', rest: 'Rest stop', meal: 'Meal stop', regroup: 'Regroup point', custom: 'Custom stop' }[kind];
}

export function suggestedActivities(stop: PlannedStop): string[] {
  const base = ['Drink water', 'Check how everyone feels', 'Confirm the group is together'];
  switch (stop.kind) {
    case 'meal':
      return ['Eat a proper meal', 'Refill bottles', 'Use the toilet if available', 'Quick tyre and brake check', ...base.slice(1)];
    case 'rest':
      return ['Sit down in the shade', 'Eat a snack', 'Refill bottles', 'Quick tyre and brake check', ...base.slice(1)];
    case 'regroup':
      return ['Count riders', 'Confirm the next stop', 'Drink water'];
    default:
      return [...base, 'Quick tyre look'];
  }
}

export function categoryLabel(cat: StopCategory) {
  return CATEGORY_LABEL[cat];
}
