import { useMemo } from 'react';
import type { RouteResult, PlannedStop } from '../types';
import { buildProfile, gradeColor, hasElevation } from '../lib/elevation';

/** Hills chart. Colour shows steepness, but the numbers and a text summary carry the same information. */
export function ElevationChart({ route, stops = [] }: { route: RouteResult; stops?: PlannedStop[] }) {
  const info = useMemo(() => (hasElevation(route) ? buildProfile(route.coords, route.elevation) : null), [route]);
  if (!info) return null;
  const W = 320;
  const H = 140;
  const L = 34;
  const B = 22;
  const T = 8;
  const totalKm = info.profile[info.profile.length - 1].km;
  const top = Math.max(100, Math.ceil(info.highestM / 100) * 100);
  const x = (km: number) => L + (km / totalKm) * (W - L - 6);
  const y = (m: number) => T + (1 - m / top) * (H - T - B);
  const ticks = [0, top / 2, top];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Hills along the route. About ${info.ascentM} metres of climbing in total. Highest point ${info.highestM} metres. Steepest stretch about ${info.steepestUpPct.toFixed(1)} percent.`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - 6} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeWidth="1" />
            <text x={L - 4} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#64748b">
              {t}
            </text>
          </g>
        ))}
        {info.profile.slice(1).map((p, i) => {
          const a = info.profile[i];
          return <polygon key={i} points={`${x(a.km)},${y(0)} ${x(a.km)},${y(a.ele)} ${x(p.km)},${y(p.ele)} ${x(p.km)},${y(0)}`} fill={gradeColor(p.grade)} stroke={gradeColor(p.grade)} strokeWidth="0.6" />;
        })}
        <polyline points={info.profile.map((p) => `${x(p.km)},${y(p.ele)}`).join(' ')} fill="none" stroke="#17404d" strokeWidth="1.4" strokeLinejoin="round" />
        {stops
          .filter((s) => s.status !== 'skipped')
          .map((s, i) => (
            <line key={s.id + i} x1={x(s.place.routeKm)} x2={x(s.place.routeKm)} y1={y(0) - 6} y2={y(0)} stroke="#17404d" strokeWidth="2" />
          ))}
        <text x={L} y={H - 6} fontSize="10" fill="#64748b">
          0 km
        </text>
        <text x={W - 6} y={H - 6} textAnchor="end" fontSize="10" fill="#64748b">
          {totalKm.toFixed(1)} km
        </text>
        <text x="4" y="10" fontSize="9" fill="#64748b">
          m
        </text>
      </svg>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
        {[
          ['#4caf7d', 'Easy'],
          ['#f2c94c', 'Some climb'],
          ['#f2994a', 'Hard'],
          ['#e0483e', 'Steep'],
        ].map(([c, l]) => (
          <span key={l} className="inline-flex items-center gap-1">
            <span aria-hidden className="inline-block h-3 w-3 rounded-sm" style={{ background: c }} />
            {l}
          </span>
        ))}
      </p>
    </div>
  );
}
