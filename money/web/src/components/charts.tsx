import { useState, type ReactNode } from 'react';
import { cx } from './ui';

// Charts follow the dataviz rules: one validated categorical palette in fixed order, at most six
// parts (the rest fold into "Others"), thin marks with a 2px gap, a legend with figures beside
// every multi-part chart, and a hover readout on every mark.

export interface Slice { id: string; label: string; value: number; color: string }

export function Donut({ slices, size = 152, thickness = 16, center, format }: {
  slices: Slice[]; size?: number; thickness?: number; center?: ReactNode; format: (n: number) => string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  const gap = slices.length > 1 ? 2 : 0;
  let offset = 0;
  const active = slices.find((s) => s.id === hover);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img"
        aria-label={slices.map((s) => `${s.label} ${total ? Math.round((s.value / total) * 100) : 0}%`).join(', ')}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(232,237,242,0.06)" strokeWidth={thickness} />
        {total > 0 && slices.map((s) => {
          const len = (s.value / total) * C;
          const seg = Math.max(0.0001, len - gap);
          const el = (
            <circle key={s.id} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
              strokeDasharray={`${seg} ${C - seg}`} strokeDashoffset={-offset}
              style={{ opacity: hover && hover !== s.id ? 0.35 : 1, transition: 'opacity .15s' }}
              onPointerEnter={() => setHover(s.id)} onPointerLeave={() => setHover(null)} />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center px-5 text-center">
        {active ? (
          <div>
            <div className="text-[11px] leading-tight text-muted">{active.label}</div>
            <div className="num font-display text-[15px] font-bold">{format(active.value)}</div>
            <div className="text-[11px] text-muted">{Math.round((active.value / total) * 100)}%</div>
          </div>
        ) : center}
      </div>
    </div>
  );
}

export function Legend({ slices, format, showValues = false, onPick }: {
  slices: Slice[]; format: (n: number) => string; showValues?: boolean; onPick?: (id: string) => void;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <ul className="min-w-0 flex-1 space-y-2.5">
      {slices.map((s) => (
        <li key={s.id}>
          <button type="button" onClick={() => onPick?.(s.id)} className="flex w-full items-center gap-2.5 text-left text-[13px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 truncate text-paper/90">{s.label}</span>
            {showValues && <span className="num text-muted">{format(s.value)}</span>}
            <span className="num w-9 text-right font-medium">{Math.round((s.value / total) * 100)}%</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

export interface BarPoint { key: string; label: string; value: number; highlight?: boolean }

export function Bars({ data, height = 190, format, axisFormat, colour = '#1FA2B3', accent = '#FFB03A' }: {
  data: BarPoint[]; height?: number; format: (n: number) => string; axisFormat: (n: number) => string; colour?: string; accent?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const ticks = [1, 0.75, 0.5, 0.25, 0];
  return (
    <div className="flex gap-2" style={{ height: height + 22 }}>
      <div className="relative w-12 shrink-0" style={{ height }}>
        {ticks.map((t) => (
          <span key={t} className="num absolute right-0 -translate-y-1/2 text-[10px] text-faint" style={{ top: `${(1 - t) * 100}%` }}>
            {axisFormat(max * t)}
          </span>
        ))}
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="absolute inset-x-0 top-0" style={{ height }}>
          {ticks.map((t) => (
            <div key={t} className={cx('absolute inset-x-0 border-t', t === 0 ? 'border-line-strong' : 'border-line')} style={{ top: `${(1 - t) * 100}%` }} />
          ))}
        </div>
        <div className="relative flex items-end justify-between gap-[2px]" style={{ height }}>
          {data.map((d, i) => (
            <div key={d.key} className="relative flex h-full flex-1 items-end justify-center"
              onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
              <div className="w-full max-w-[26px] rounded-t-[4px] transition-[height] duration-500"
                style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 2 : 0, background: d.highlight ? accent : colour, opacity: hover != null && hover !== i ? 0.55 : 1 }} />
              {hover === i && (
                <div className="pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-lg border border-line-strong bg-ink-4 px-2.5 py-1.5 text-center text-xs shadow-card"
                  style={{ bottom: `${(d.value / max) * 100}%` }}>
                  <div className="text-muted">{d.label}</div>
                  <div className="num font-semibold">{format(d.value)}</div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between gap-[2px]">
          {data.map((d) => <span key={d.key} className={cx('flex-1 text-center text-[10px]', d.highlight ? 'text-signal' : 'text-faint')}>{d.label}</span>)}
        </div>
      </div>
    </div>
  );
}

export function Sparkline({ values, width = 132, height = 40, colour = '#4FD1E0' }: { values: number[]; width?: number; height?: number; colour?: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (width - 6) + 3, height - 4 - ((v - min) / span) * (height - 8)]);
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} aria-hidden className="overflow-visible">
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={colour} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />
      <circle cx={last[0]} cy={last[1]} r={4} fill="#FFB03A" stroke="#141B27" strokeWidth={2} />
    </svg>
  );
}

export interface LinePoint { key: string; label: string; value: number; dashed?: boolean }

export function LineChart({ data, height = 190, format, axisFormat }: {
  data: LinePoint[]; height?: number; format: (n: number) => string; axisFormat: (n: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return null;
  const lo = Math.min(0, ...data.map((d) => d.value));
  const hi = niceMax(Math.max(...data.map((d) => d.value)) - lo) + lo;
  const span = hi - lo || 1;
  const x = (i: number) => (data.length === 1 ? 50 : (i / (data.length - 1)) * 100);
  const y = (v: number) => (1 - (v - lo) / span) * 100;
  const solid = data.filter((d) => !d.dashed);
  const dashedFrom = solid.length ? solid.length - 1 : 0;
  const path = (pts: LinePoint[], start: number) => pts.map((d, i) => `${i ? 'L' : 'M'}${x(start + i)},${y(d.value)}`).join(' ');
  const ticks = [1, 0.5, 0];
  return (
    <div className="flex gap-2" style={{ height: height + 22 }}>
      <div className="relative w-12 shrink-0" style={{ height }}>
        {ticks.map((t) => (
          <span key={t} className="num absolute right-0 -translate-y-1/2 text-[10px] text-faint" style={{ top: `${(1 - t) * 100}%` }}>{axisFormat(lo + span * t)}</span>
        ))}
      </div>
      <div className="relative min-w-0 flex-1"
        onPointerMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          setHover(Math.round(((e.clientX - box.left) / box.width) * (data.length - 1)));
        }}
        onPointerLeave={() => setHover(null)}>
        <div className="relative" style={{ height }}>
          {ticks.map((t) => <div key={t} className="absolute inset-x-0 border-t border-line" style={{ top: `${(1 - t) * 100}%` }} />)}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
            <path d={path(solid, 0)} fill="none" stroke="#4FD1E0" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            {data.length > solid.length && (
              <path d={path(data.slice(dashedFrom), dashedFrom)} fill="none" stroke="#FFB03A" strokeWidth={2} strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
            )}
          </svg>
          {hover != null && data[hover] && (
            <>
              <div className="absolute inset-y-0 border-l border-line-strong" style={{ left: `${x(hover)}%` }} />
              <span className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink-3"
                style={{ left: `${x(hover)}%`, top: `${y(data[hover].value)}%`, background: data[hover].dashed ? '#FFB03A' : '#4FD1E0' }} />
              <div className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line-strong bg-ink-4 px-2.5 py-1.5 text-center text-xs shadow-card"
                style={{ left: `${Math.min(85, Math.max(15, x(hover)))}%`, top: 0 }}>
                <div className="text-muted">{data[hover].label}{data[hover].dashed ? ' (forecast)' : ''}</div>
                <div className="num font-semibold">{format(data[hover].value)}</div>
              </div>
            </>
          )}
        </div>
        <div className="mt-1.5 flex justify-between">
          {data.map((d, i) => (
            <span key={d.key} className={cx('text-[10px]', d.dashed ? 'text-signal/80' : 'text-faint', data.length > 8 && i % 2 === 1 && 'invisible')}>{d.label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
