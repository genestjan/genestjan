import { type ReactNode } from 'react';
import { update, useAppState } from '../lib/store';

export function Page({ title, children, back }: { title: string; children: ReactNode; back?: ReactNode }) {
  const { mode } = useAppState();
  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-4" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">{back}<h1 className="text-4xl leading-none">{title}</h1></div>
        <button className="btn ghost" aria-label="Toggle sun mode" onClick={() => update((s) => ({ ...s, mode: s.mode === 'club' ? 'sun' : 'club' }))}>
          {mode === 'club' ? 'Sun mode' : 'Club mode'}
        </button>
      </header>
      {children}
    </div>
  );
}

export function Pitch({ format, children, className = 'w-full' }: { format: 'v' | 'h'; children?: ReactNode; className?: string }) {
  const w = format === 'v' ? 100 : 160, h = format === 'v' ? 160 : 100;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`${className} rounded-card`} style={{ background: 'var(--pitch)' }} role="img">
      <g fill="none" stroke="var(--text)" strokeOpacity=".45" strokeWidth=".6">
        <rect x="2" y="2" width={w - 4} height={h - 4} rx="2" />
        {format === 'v' ? (<><line x1="2" y1={h / 2} x2={w - 2} y2={h / 2} /><circle cx={w / 2} cy={h / 2} r="12" /><rect x="28" y="2" width="44" height="18" /><rect x="28" y={h - 20} width="44" height="18" /></>)
          : (<><line x1={w / 2} y1="2" x2={w / 2} y2={h - 2} /><circle cx={w / 2} cy={h / 2} r="12" /><rect x="2" y="28" width="18" height="44" /><rect x={w - 20} y="28" width="18" height="44" /></>)}
      </g>
      {children}
    </svg>
  );
}
