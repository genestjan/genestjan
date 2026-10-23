import { useState, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Mascot } from '../Mascot';
import { Logo } from '../Logo';
import type { AccountRecord } from '../../store/accounts';

export function AuthShell({ title, subtitle, children, mood = 'happy' }: { title: string; subtitle?: string; children: ReactNode; mood?: 'happy' | 'calm' | 'cheer' }) {
  return (
    <div className="flex min-h-dvh flex-col items-center bg-gradient-to-b from-brand-100 via-brand-50 to-page px-4 pb-10 pt-8 text-navy">
      <Logo size={52} tagline />
      <div className="mt-5">
        <Mascot size={96} mood={mood} />
      </div>
      <h1 className="mt-2 text-center text-3xl font-extrabold leading-tight text-navy">{title}</h1>
      {subtitle && <p className="mt-2 max-w-sm text-center text-lg text-slate-600">{subtitle}</p>}
      <main className="mt-6 w-full max-w-md rounded-4xl bg-white p-6 shadow-lift">{children}</main>
      <p className="mt-6 max-w-sm text-center text-sm text-slate-500">Ride smart, stop smart, finish strong.</p>
    </div>
  );
}

export function Avatar({ account, size = 56 }: { account: Pick<AccountRecord, 'name' | 'color'>; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-grid shrink-0 place-items-center rounded-full font-extrabold text-white"
      style={{ width: size, height: size, background: account.color, fontSize: size * 0.45 }}
    >
      {account.name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

export function PasswordInput({ id, value, onChange, autoComplete, label, hint }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string; label: string; hint?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="label text-base">
        {label}
      </label>
      <div className="relative">
        <input id={id} className="input pr-14 text-lg" type={show ? 'text' : 'password'} value={value} autoComplete={autoComplete} onChange={(e) => onChange(e.target.value)} />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full text-slate-600 hover:bg-slate-100">
          {show ? <EyeOff aria-hidden className="h-5 w-5" /> : <Eye aria-hidden className="h-5 w-5" />}
        </button>
      </div>
      {hint && <p className="mt-1 text-sm text-slate-600">{hint}</p>}
    </div>
  );
}

export function ErrorLine({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="rounded-2xl border border-danger/40 bg-danger-soft p-3 text-base font-medium text-red-900">
      <span className="sr-only">Problem: </span>
      {text}
    </p>
  );
}
