import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RidePlan } from '../types';
import { useActivePlan, useStore } from '../store/store';
import { computeSchedule } from './schedule';
import { fetchRouteWeather, type WeatherReport } from '../services/weather';
import { pointAtKm } from './geo';
import { localDayKey, parseLocal } from './time';

// Weather lives in memory only and always shows its retrieval time.
const weatherCache = new Map<string, WeatherReport>();
const listeners = new Set<() => void>();

export function useWeather(plan: RidePlan | null) {
  const [, force] = useState(0);
  const [state, setState] = useState<{ loading: boolean; error: string | null }>({ loading: false, error: null });
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  const key = plan?.route ? `${plan.id}:${plan.route.id}` : null;
  const report = key ? weatherCache.get(key) ?? null : null;
  const load = useCallback(async () => {
    if (!plan?.route || !key) return;
    setState({ loading: true, error: null });
    try {
      const c = plan.route.coords;
      const total = plan.route.distanceM / 1000;
      const pts = [
        { label: 'Start', point: { lat: c[0][0], lng: c[0][1] } },
        { label: 'Midway', point: pointAtKm(c, total / 2) },
        { label: 'Finish', point: { lat: c[c.length - 1][0], lng: c[c.length - 1][1] } },
      ];
      weatherCache.set(key, await fetchRouteWeather(pts, plan.timeZone));
      listeners.forEach((f) => f());
      setState({ loading: false, error: null });
    } catch (e) {
      setState({ loading: false, error: (e as Error).message });
    }
  }, [plan, key]);
  return { report, load, ...state };
}

export function sunsetFor(plan: RidePlan, report: WeatherReport | null): number | null {
  if (!report) return null;
  const dep = parseLocal(plan.departureLocal, plan.timeZone);
  if (dep === null) return null;
  const finish = report.points[report.points.length - 1];
  return finish?.sunset[localDayKey(dep, plan.timeZone)] ?? null;
}

export function usePlanSchedule() {
  const plan = useActivePlan();
  const updatePlan = useStore((s) => s.updatePlan);
  const weather = useWeather(plan);
  const sunsetMs = plan ? sunsetFor(plan, weather.report) : null;
  const schedule = useMemo(() => (plan ? computeSchedule(plan, { sunsetMs }) : null), [plan, sunsetMs]);
  const edit = useCallback((fn: (p: RidePlan) => RidePlan) => plan && updatePlan(plan.id, fn), [plan, updatePlan]);
  return { plan, schedule, edit, weather };
}
