import { Loader2, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { formatMoney, parseAmount, symbol, type Currency } from '../lib/money';
import { institution, type Category, type InstitutionId } from '../lib/model';
import { appTag, copyText } from '../lib/problems';
import { useApp } from '../lib/session';
import { iconFor } from './icons';

export const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(' ');

export function Logo({ size = 36, glow = false }: { size?: number; glow?: boolean }) {
  return (
    <img
      src="./logo.png"
      alt=""
      width={size}
      height={size}
      className="shrink-0 select-none"
      style={glow ? { filter: 'drop-shadow(0 0 18px rgba(227,197,116,0.35))' } : undefined}
      draggable={false}
    />
  );
}

export function Brand({ size = 32 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <Logo size={size} />
      <span className="font-display text-[17px] font-bold tracking-tight text-paper">Money Hub</span>
    </div>
  );
}

export function useHidden() {
  return useApp((s) => !!s.snap?.settings.hideBalances);
}

type Tone = 'auto' | 'in' | 'out' | 'plain' | 'muted';

export function Money({
  value, currency = 'PHP', sign, tone = 'plain', className, hideable = true, compact,
}: { value: number; currency?: Currency; sign?: boolean; tone?: Tone; className?: string; hideable?: boolean; compact?: boolean }) {
  const hidden = useHidden() && hideable;
  const t = tone === 'auto' ? (value > 0 ? 'in' : value < 0 ? 'out' : 'plain') : tone;
  const colour = t === 'in' ? 'text-income' : t === 'out' ? 'text-expense' : t === 'muted' ? 'text-muted' : '';
  return <span className={cx('num whitespace-nowrap', colour, className)}>{formatMoney(value, currency, { sign, hide: hidden, compact })}</span>;
}

export function Card({ children, className, title, action, pad = true }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; pad?: boolean }) {
  return (
    <section className={cx('card', pad && 'p-4 sm:p-5', className)}>
      {(title || action) && (
        <div className={cx('mb-3 flex items-center justify-between gap-3', !pad && 'px-4 pt-4 sm:px-5 sm:pt-5')}>
          {title && <h2 className="font-display text-[16px] font-semibold text-paper">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Segmented<T extends string>({ value, options, onChange, className }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; className?: string;
}) {
  return (
    <div role="tablist" className={cx('flex rounded-xl border border-line bg-ink-2 p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-[13px] font-medium transition',
            value === o.value ? 'bg-current/15 text-current shadow-[inset_0_0_0_1px_rgba(79,209,224,0.35)]' : 'text-muted hover:text-paper',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const BADGE = {
  good: 'bg-income/15 text-income',
  warn: 'bg-signal/15 text-signal',
  bad: 'bg-expense/15 text-expense',
  info: 'bg-current/15 text-current',
  neutral: 'bg-ink-5 text-muted',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: keyof typeof BADGE; children: ReactNode; className?: string }) {
  return <span className={cx('chip', BADGE[tone], className)}>{children}</span>;
}

/** Budget meter: cyan while fine, amber from 80%, red once over. The track is the same hue, faint. */
export const severity = (v: number) => (v > 1 ? '#FF6B6B' : v >= 0.8 ? '#FFB03A' : '#4FD1E0');

export function Meter({ value, className }: { value: number; className?: string }) {
  const c = severity(value);
  return (
    <div className={cx('h-2 w-full overflow-hidden rounded-full', className)} style={{ background: `${c}26` }}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.min(100, value * 100)}%`, background: c }} />
    </div>
  );
}

export function Ring({ value, size = 96, stroke = 9, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  const c = severity(value);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`${c}26`} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${Math.min(1, value) * len} ${len}`} className="transition-[stroke-dasharray] duration-700" />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function InstitutionBadge({ id, size = 36, className }: { id: InstitutionId; size?: number; className?: string }) {
  const inst = institution(id);
  return (
    <span
      className={cx('grid shrink-0 place-items-center rounded-[10px] font-display font-bold', className)}
      style={{ width: size, height: size, background: inst.bg, color: inst.fg, fontSize: inst.short.length > 2 ? size * 0.3 : size * 0.42 }}
      aria-hidden
    >
      {inst.short}
    </span>
  );
}

export function CategoryIcon({ category, size = 36, icon }: { category?: Category; size?: number; icon?: string }) {
  const Icon = iconFor(icon ?? category?.icon);
  const colour = category?.color ?? '#6B7689';
  return (
    <span className="grid shrink-0 place-items-center rounded-full" style={{ width: size, height: size, background: `${colour}24`, color: colour }} aria-hidden>
      <Icon size={size * 0.48} strokeWidth={2} />
    </span>
  );
}

export function Sheet({ open, onClose, title, children, footer, wide }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', esc);
    panel.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus({ preventScroll: true });
    const back = () => onClose();
    window.__mhSheetBack = back;
    return () => { removeEventListener('keydown', esc); if (window.__mhSheetBack === back) window.__mhSheetBack = undefined; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal aria-labelledby={id}>
      <button aria-label="Close" className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <div ref={panel} className={cx(
        'relative flex max-h-[92vh] w-full flex-col rounded-t-3xl border border-line-strong bg-ink-2 shadow-card sm:rounded-3xl',
        wide ? 'sm:max-w-2xl' : 'sm:max-w-lg',
      )}>
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 id={id} className="font-display text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-ink-4 hover:text-paper" aria-label="Close"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-line px-5 py-4" style={{ paddingBottom: 'calc(1rem + var(--safe-bottom))' }}>{footer}</div>}
      </div>
    </div>
  );
}

declare global { interface Window { __mhSheetBack?: () => void } }

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs leading-relaxed text-faint">{hint}</span>}
    </label>
  );
}

/** Amount entry in pesos (or the account's currency). Keeps centavos; null while empty. */
export function MoneyInput({ value, onChange, currency = 'PHP', large, autoFocus, placeholder = '0.00' }: {
  value: number | null; onChange: (v: number | null) => void; currency?: Currency; large?: boolean; autoFocus?: boolean; placeholder?: string;
}) {
  const [text, setText] = useState(value != null ? (value / 100).toFixed(2) : '');
  useEffect(() => {
    const parsed = parseAmount(text);
    if (parsed !== value) setText(value != null ? (value / 100).toFixed(2) : '');
    // only when the value changes from outside
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className={cx('field flex items-center gap-2', large && 'py-4')}>
      <span className={cx('text-muted', large ? 'font-display text-2xl' : '')}>{symbol(currency)}</span>
      <input
        inputMode="decimal"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={text}
        onChange={(e) => { setText(e.target.value); onChange(parseAmount(e.target.value)); }}
        className={cx('num w-full bg-transparent outline-none placeholder:text-faint', large ? 'font-display text-3xl font-bold' : '')}
      />
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {icon && <div className="mb-3 text-faint">{icon}</div>}
      <p className="font-display text-[15px] font-semibold">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ size = 18 }: { size?: number }) {
  return <Loader2 size={size} className="animate-spin" aria-hidden />;
}

/** A problem in plain words. With `detail`, the exact technical error sits under it, so a screenshot or Copy carries everything needed to fix it. */
export function ErrorText({ children, detail }: { children?: ReactNode; detail?: string | null }) {
  const [copied, setCopied] = useState<string | null>(null);
  if (!children) return null;
  const tech = detail ? `${detail} · ${appTag()}` : null;
  return (
    <div role="alert" className="rounded-xl border border-expense/30 bg-expense/10 px-3.5 py-2.5 text-sm text-expense">
      <p>{children}</p>
      {tech && (
        <>
          <p className="mt-1.5 break-words font-mono text-[11px] leading-snug text-expense/75">{tech}</p>
          <button type="button" className="mt-1.5 text-xs font-semibold underline underline-offset-2"
            onClick={async () => { if (await copyText(`${typeof children === 'string' ? `${children}\n` : ''}${tech}`)) setCopied(tech); }}>
            {copied === tech ? 'Copied. Paste it into your message.' : 'Copy the details'}
          </button>
        </>
      )}
    </div>
  );
}

export function Toast() {
  const toast = useApp((s) => s.toast);
  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4" style={{ bottom: 'calc(92px + var(--safe-bottom))' }}>
      <div role="status" className="rounded-xl border border-line-strong bg-ink-4 px-4 py-2.5 text-sm text-paper shadow-card">{toast}</div>
    </div>
  );
}

export function BusyOverlay() {
  const busy = useApp((s) => s.busy);
  if (!busy) return null;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/55 backdrop-blur-sm">
      <div className="flex items-center gap-3 rounded-2xl border border-line-strong bg-ink-3 px-5 py-4 text-sm">
        <Spinner /> {busy}
      </div>
    </div>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || 'J';
  return (
    <span className="grid shrink-0 place-items-center rounded-full font-display font-bold text-ink"
      style={{ width: size, height: size, fontSize: size * 0.38, background: 'linear-gradient(135deg,#c8913f,#e3c574 60%,#f6eaa2)' }} aria-hidden>
      {initials}
    </span>
  );
}
