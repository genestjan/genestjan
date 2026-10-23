import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from 'lucide-react';
import type { Level } from '../lib/schedule';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

const NOTICE: Record<Level | 'ok', { cls: string; Icon: typeof Info; word: string }> = {
  info: { cls: 'border-sky/30 bg-sky-soft text-sky-900', Icon: Info, word: 'Note' },
  caution: { cls: 'border-caution/40 bg-caution-soft text-amber-900', Icon: AlertTriangle, word: 'Caution' },
  danger: { cls: 'border-danger/40 bg-danger-soft text-red-900', Icon: OctagonAlert, word: 'Warning' },
  ok: { cls: 'border-go/30 bg-go-soft text-green-900', Icon: CheckCircle2, word: 'OK' },
};

/** Status message with an icon AND a word, so meaning never depends on colour. */
export function Notice({ level, title, children, role }: { level: Level | 'ok'; title?: string; children?: ReactNode; role?: 'alert' | 'status' }) {
  const n = NOTICE[level];
  return (
    <div role={role ?? (level === 'danger' ? 'alert' : 'status')} className={`flex gap-3 rounded-xl border p-3 text-sm ${n.cls}`}>
      <n.Icon aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0">
        <p className="font-semibold">
          <span className="sr-only">{n.word}: </span>
          {title ?? n.word}
        </p>
        {children && <div className="mt-0.5">{children}</div>}
      </div>
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl bg-slate-100 p-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-lg font-bold text-navy">{value}</dd>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'go' | 'caution' | 'danger' | 'sky' }) {
  const map = {
    slate: 'bg-slate-200 text-slate-800',
    go: 'bg-go-soft text-green-900',
    caution: 'bg-caution-soft text-amber-900',
    danger: 'bg-danger-soft text-red-900',
    sky: 'bg-sky-soft text-sky-900',
  };
  return <span className={`chip ${map[tone]}`}>{children}</span>;
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function NumberField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  hint,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  hint?: string;
}) {
  const invalid = !Number.isFinite(value) || (min !== undefined && value < min) || (max !== undefined && value > max);
  return (
    <Field label={suffix ? `${label} (${suffix})` : label} htmlFor={id} hint={hint}>
      <input
        id={id}
        className={`input ${invalid ? 'border-danger' : ''}`}
        type="number"
        inputMode="decimal"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step}
        aria-invalid={invalid}
        onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))}
      />
      {invalid && (
        <p className="mt-1 text-xs font-medium text-danger" role="alert">
          Enter a value{min !== undefined ? ` from ${min}` : ''}{max !== undefined ? ` to ${max}` : ''}.
        </p>
      )}
    </Field>
  );
}

export function Progress({ pct, label }: { pct: number; label: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-slate-600">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-full rounded-full bg-go transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card text-center">
      <p className="text-lg font-semibold text-navy">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-slate-600">{children}</div>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

/** Native confirm keeps destructive actions accessible on every phone. */
export function confirmAction(message: string): boolean {
  return typeof window !== 'undefined' ? window.confirm(message) : false;
}
