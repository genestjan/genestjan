// Bikemoko UI kit. Every screen builds from these so the whole app feels like one product.
import { clsx } from 'clsx';
import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import { money } from '@/domain/util';

export const cx = clsx;

// ---------- Buttons ----------

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
type Size = 'sm' | 'md' | 'lg' | 'xl';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand text-brand-ink hover:brightness-110 active:brightness-95 shadow-glow',
  secondary: 'bg-raised text-ink border border-line hover:bg-surface hover:border-faint/40',
  ghost: 'text-muted hover:text-ink hover:bg-raised',
  danger: 'bg-bad/10 text-bad border border-bad/25 hover:bg-bad/15',
  soft: 'bg-brand-soft text-brand hover:brightness-105',
};
const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-[15px] gap-2 rounded-xl',
  xl: 'h-16 px-6 text-lg gap-3 rounded-2xl',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  block?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, block, loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        'inline-flex select-none items-center justify-center font-semibold transition duration-150 disabled:pointer-events-none disabled:opacity-45',
        VARIANT[variant],
        SIZE[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" /> : icon}
      {children}
    </button>
  );
});

export function IconButton({ label, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx('grid h-10 w-10 place-items-center rounded-xl text-muted transition hover:bg-raised hover:text-ink', className)}
      {...rest}
    />
  );
}

// ---------- Surfaces ----------

export function Card({ className, children, pad = true, ...rest }: React.HTMLAttributes<HTMLDivElement> & { pad?: boolean }) {
  return (
    <div className={cx('rounded-2xl border border-line bg-surface shadow-card', pad && 'p-5', className)} {...rest}>
      {children}
    </div>
  );
}

export function PageHeader({ title, sub, actions, icon }: { title: string; sub?: ReactNode; actions?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        {icon && <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand">{icon}</div>}
        <div>
          <h1 className="text-2xl font-bold md:text-[28px]">{title}</h1>
          {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Section({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-faint">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// ---------- Data display ----------

export type Tone = 'brand' | 'ok' | 'warn' | 'bad' | 'info' | 'neutral' | 'violet';
const TONE: Record<Tone, string> = {
  brand: 'bg-brand/12 text-brand ring-brand/25',
  ok: 'bg-ok/12 text-ok ring-ok/25',
  warn: 'bg-warn/12 text-warn ring-warn/25',
  bad: 'bg-bad/12 text-bad ring-bad/25',
  info: 'bg-info/12 text-info ring-info/25',
  violet: 'bg-violet-500/12 text-violet-500 ring-violet-500/25 dark:text-violet-300',
  neutral: 'bg-raised text-muted ring-line',
};

export function Badge({ tone = 'neutral', children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', TONE[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Stat({ label, value, hint, tone, icon, onClick }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone; icon?: ReactNode; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={cx('group rounded-2xl border border-line bg-surface p-4 text-left shadow-card transition', onClick && 'hover:border-brand/40')}>
      <div className="flex items-center justify-between text-[13px] font-medium text-muted">
        {label}
        {icon && <span className={cx('grid h-8 w-8 place-items-center rounded-lg', tone ? TONE[tone] : 'bg-raised text-muted')}>{icon}</span>}
      </div>
      <div className="num mt-2 truncate font-display text-[clamp(19px,5.6vw,26px)] font-bold leading-none">{value}</div>
      {hint && <div className="mt-1.5 text-xs text-faint">{hint}</div>}
    </Tag>
  );
}

export function Money({ value, className, strong }: { value: number; className?: string; strong?: boolean }) {
  return <span className={cx('num whitespace-nowrap', strong && 'font-semibold', className)}>{money(value)}</span>;
}

export function Empty({ icon, title, sub, action }: { icon?: ReactNode; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      {icon && <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-raised text-faint">{icon}</div>}
      <div className="font-semibold">{title}</div>
      {sub && <p className="mt-1 max-w-sm text-sm text-muted">{sub}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md border border-line bg-raised px-1.5 py-0.5 font-sans text-[11px] font-semibold text-muted">{children}</kbd>;
}

/** Simple table with sticky header. Rows are clickable when onRow is set. */
export function Table<T>({
  rows,
  cols,
  onRow,
  empty,
  rowKey,
}: {
  rows: T[];
  cols: { key: string; label: ReactNode; cell: (r: T) => ReactNode; className?: string; align?: 'right' | 'center' }[];
  onRow?: (r: T) => void;
  empty?: ReactNode;
  rowKey: (r: T) => string;
}) {
  if (!rows.length) return <>{empty ?? <Empty title="Nothing here yet" />}</>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-card">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-[1] bg-raised/95 backdrop-blur">
          <tr>
            {cols.map((c) => (
              <th key={c.key} className={cx('whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-faint', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center', c.className)}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} onClick={onRow ? () => onRow(r) : undefined} className={cx('border-t border-line/70', onRow && 'cursor-pointer transition hover:bg-raised')}>
              {cols.map((c) => (
                <td key={c.key} className={cx('px-4 py-3 align-middle', c.align === 'right' && 'num text-right', c.align === 'center' && 'text-center', c.className)}>
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Inputs ----------

export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-muted">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-bad">{error}</span> : hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  );
}

const inputCls =
  'w-full rounded-xl border border-line bg-raised px-3.5 text-[15px] text-ink placeholder:text-faint transition focus:border-brand/60 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-brand/15';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(inputCls, 'h-11', className)} {...rest} />;
});

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(inputCls, 'min-h-[88px] py-2.5', className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(inputCls, 'h-11 appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9', className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...rest}>
      {children}
    </select>
  );
}

export const SearchBox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { onClear?: () => void }>(function SearchBox({ className, onClear, value, ...rest }, ref) {
  return (
    <div className={cx('relative', className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-faint" />
      <input ref={ref} value={value} className={cx(inputCls, 'h-11 pl-10 pr-9')} {...rest} />
      {onClear && value ? (
        <button type="button" onClick={onClear} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-faint hover:text-ink" aria-label="Clear search">
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
});

/** Peso amount input. Value in centavos. */
export function MoneyInput({ value, onChange, className, autoFocus, placeholder }: { value: number; onChange: (c: number) => void; className?: string; autoFocus?: boolean; placeholder?: string }) {
  const [text, setText] = useState(value ? (value / 100).toString() : '');
  useEffect(() => {
    const cur = Math.round(Number(text.replace(/[^\d.]/g, '')) * 100) || 0;
    if (cur !== value) setText(value ? (value / 100).toString() : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className={cx('relative', className)}>
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint">₱</span>
      <input
        inputMode="decimal"
        autoFocus={autoFocus}
        placeholder={placeholder ?? '0.00'}
        value={text}
        onChange={(e) => {
          const t = e.target.value.replace(/[^\d.]/g, '');
          setText(t);
          onChange(Math.round((Number(t) || 0) * 100));
        }}
        className={cx(inputCls, 'num h-11 pl-8')}
      />
    </div>
  );
}

export function Stepper({ value, onChange, min = 0, max = 9999 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <div className="inline-flex h-10 items-center rounded-xl border border-line bg-raised">
      <button type="button" className="h-full w-10 text-lg text-muted hover:text-ink disabled:opacity-30" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} aria-label="Less">
        −
      </button>
      <input
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(Math.min(max, Math.max(min, parseInt(e.target.value || '0', 10) || 0)))}
        className="num h-full w-12 bg-transparent text-center font-semibold focus:outline-none"
      />
      <button type="button" className="h-full w-10 text-lg text-muted hover:text-ink disabled:opacity-30" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} aria-label="More">
        +
      </button>
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div className={cx('inline-flex rounded-xl border border-line bg-raised p-1', className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx('whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-semibold transition', o.value === value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="inline-flex items-center gap-2.5 text-sm">
      <span className={cx('relative h-6 w-10 rounded-full transition', checked ? 'bg-brand' : 'bg-line')}>
        <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition', checked ? 'left-[18px]' : 'left-0.5')} />
      </span>
      {label}
    </button>
  );
}

// ---------- Overlays ----------

// Only the top-most open overlay closes on Escape.
const escStack: (() => void)[] = [];
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && escStack.length) {
      e.stopImmediatePropagation();
      escStack[escStack.length - 1]();
    }
  });
}
function useEsc(onClose: () => void, active = true) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!active) return;
    const fn = () => ref.current();
    escStack.push(fn);
    return () => {
      const i = escStack.lastIndexOf(fn);
      if (i >= 0) escStack.splice(i, 1);
    };
  }, [active]);
}

/** Centered dialog on desktop, bottom sheet on phones. */
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEsc(onClose, open);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      <div className="absolute inset-0 animate-fade bg-black/55 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cx('relative flex max-h-[92vh] w-full animate-sheet flex-col rounded-t-3xl border border-line bg-surface shadow-pop md:animate-in md:rounded-3xl', wide ? 'md:max-w-3xl' : 'md:max-w-lg')}>
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-line md:hidden" />
        <div className="flex items-center justify-between px-5 pb-2 pt-3 md:pt-5">
          <h3 className="text-lg font-bold">{title}</h3>
          <IconButton label="Close" onClick={onClose}>
            <X className="h-5 w-5" />
          </IconButton>
        </div>
        <div className="overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="safe-b flex gap-2 border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Right-side drawer on desktop, full sheet on phones. */
export function Drawer({ open, onClose, title, children, footer, sub }: { open: boolean; onClose: () => void; title: ReactNode; sub?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useEsc(onClose, open);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 animate-fade bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-xl animate-drawer flex-col border-l border-line bg-surface shadow-pop">
        <div className="safe-t flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h3 className="text-lg font-bold">{title}</h3>
            {sub && <div className="mt-0.5 text-sm text-muted">{sub}</div>}
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X className="h-5 w-5" />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="safe-b flex gap-2 border-t border-line px-5 py-4">{footer}</div>}
      </aside>
    </div>,
    document.body,
  );
}

// ---------- Toasts ----------

type ToastT = { id: number; text: string; tone: 'ok' | 'bad' | 'info' };
let pushToast: (t: Omit<ToastT, 'id'>) => void = () => {};

export const toast = {
  ok: (text: string) => pushToast({ text, tone: 'ok' }),
  bad: (text: string) => pushToast({ text, tone: 'bad' }),
  info: (text: string) => pushToast({ text, tone: 'info' }),
  /** Show an error from a failed action. */
  error: (e: unknown) => pushToast({ text: e instanceof Error ? e.message : String(e), tone: 'bad' }),
};

export function Toaster() {
  const [items, setItems] = useState<ToastT[]>([]);
  const n = useRef(0);
  useEffect(() => {
    pushToast = (t) => {
      const id = ++n.current;
      setItems((x) => [...x, { ...t, id }]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3600);
    };
  }, []);
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cx(
            'pointer-events-auto flex max-w-sm animate-in items-center gap-2.5 rounded-2xl border bg-surface px-4 py-3 text-sm font-medium shadow-pop',
            t.tone === 'ok' && 'border-ok/30',
            t.tone === 'bad' && 'border-bad/40',
            t.tone === 'info' && 'border-line',
          )}
        >
          <span className={cx('h-2 w-2 rounded-full', t.tone === 'ok' ? 'bg-ok' : t.tone === 'bad' ? 'bg-bad' : 'bg-info')} />
          {t.text}
        </div>
      ))}
    </div>,
    document.body,
  );
}

/** Run an async action with a toast on success or failure. */
export async function run<T>(fn: () => Promise<T>, success?: string): Promise<T | undefined> {
  try {
    const r = await fn();
    if (success) toast.ok(success);
    return r;
  } catch (e) {
    toast.error(e);
    return undefined;
  }
}
