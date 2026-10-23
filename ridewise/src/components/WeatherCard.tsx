import type { RidePlan } from '../types';
import type { useWeather } from '../lib/usePlan';
import { describeCode, hourAt, weatherAdvice } from '../services/weather';
import { formatDateTime, formatTime, localDayKey, parseLocal } from '../lib/time';
import { Notice } from './ui';
import { computeSchedule } from '../lib/schedule';

export function WeatherCard({ plan, weather }: { plan: RidePlan; weather: ReturnType<typeof useWeather> }) {
  const { report, load, loading, error } = weather;
  const dep = parseLocal(plan.departureLocal, plan.timeZone);
  const schedule = computeSchedule(plan);
  const daysAhead = dep ? (dep - Date.now()) / 86400000 : 0;

  if (!report) {
    return (
      <div className="mt-2 space-y-2 text-sm">
        <p className="text-slate-600">Conditions not verified yet. Forecasts are available up to about 16 days before the ride.</p>
        {error && <Notice level="caution" title="Weather unavailable">{error}</Notice>}
        <button type="button" className="btn-secondary" onClick={load} disabled={loading || daysAhead > 16}>
          {loading ? 'Loading forecast…' : daysAhead > 16 ? 'Too early for a forecast' : 'Check forecast along the route'}
        </button>
      </div>
    );
  }
  const rows = report.points.map((p, i) => {
    let at = dep ?? Date.now();
    if (schedule.ok) at = i === 0 ? schedule.departureMs : i === report.points.length - 1 ? schedule.finish.arrivalMs : (schedule.departureMs + schedule.finish.arrivalMs) / 2;
    return { p, at, h: hourAt(p, at) };
  });
  const day = dep ? localDayKey(dep, plan.timeZone) : '';
  const sunrise = report.points[0]?.sunrise[day];
  const sunset = report.points[report.points.length - 1]?.sunset[day];
  const tips = Array.from(new Set(rows.flatMap((r) => (r.h ? weatherAdvice(r.h) : []))));
  return (
    <div className="mt-2 space-y-2 text-sm">
      <ul className="grid gap-2 sm:grid-cols-3">
        {rows.map(({ p, at, h }) => (
          <li key={p.label} className="rounded-xl bg-slate-50 p-2">
            <p className="font-semibold">{p.label} around {formatTime(at, plan.timeZone)}</p>
            {h ? (
              <p>
                {describeCode(h.code)}, {Math.round(h.tempC)}°C, rain chance {h.rainProbPct ?? '—'}%, wind {Math.round(h.windKmh)} km/h
              </p>
            ) : (
              <p className="text-slate-500">No forecast for this time yet.</p>
            )}
          </li>
        ))}
      </ul>
      {sunrise && sunset && (
        <p>
          Sunrise {formatTime(sunrise, plan.timeZone)} at the start, sunset {formatTime(sunset, plan.timeZone)} at the finish. Daylight is a planning guide, not a safety guarantee.
        </p>
      )}
      {tips.map((t) => (
        <Notice key={t} level="caution" title={t} />
      ))}
      <p className="text-xs text-slate-500">
        Source: {report.source}, retrieved {formatDateTime(Date.parse(report.retrievedAt), plan.timeZone)}. Forecasts change; check again on ride morning. RideWise cannot predict road hazards.
      </p>
      <button type="button" className="btn-ghost" onClick={load} disabled={loading}>
        {loading ? 'Refreshing…' : 'Refresh forecast'}
      </button>
    </div>
  );
}
