// Tiny charts drawn with plain divs and SVG, coloured only with theme tokens.
import { moneyShort } from '@/domain/util';

export function BarChart({ data, height = 120 }: { data: { label: string; value: number }[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height }} role="img" aria-label="Bar chart">
        {data.map((d) => (
          <div key={d.label} className="group relative flex h-full flex-1 items-end" title={`${d.label}: ${moneyShort(d.value)}`}>
            <div
              className={d.value ? 'w-full rounded-t-md bg-brand' : 'w-full rounded-t-md bg-line'}
              style={{ height: d.value ? `${Math.max(4, (d.value / max) * 100)}%` : '3px' }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {data.map((d, i) => (
          <div key={d.label} className="num flex-1 text-center text-[10px] text-faint">
            {data.length > 12 && i % 2 ? '' : d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Sparkline({ values, height = 72 }: { values: number[]; height?: number }) {
  const w = 300;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const pts = values.map((v, i) => [i * step, height - 6 - (v / max) * (height - 14)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${w} ${height} L0 ${height} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="h-[72px] w-full overflow-visible" role="img" aria-label="Sales trend">
      <path d={area} className="fill-brand/10" />
      <path d={line} className="fill-none stroke-brand" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** A thin horizontal meter, e.g. a share of total. */
export function Meter({ value, tone = 'brand' }: { value: number; tone?: 'brand' | 'ok' | 'warn' }) {
  const bg = tone === 'ok' ? 'bg-ok' : tone === 'warn' ? 'bg-warn' : 'bg-brand';
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
      <div className={`h-full rounded-full ${bg}`} style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} />
    </div>
  );
}
