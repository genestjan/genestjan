import { Check, Cloud, Copy, Download, Eye, EyeOff, Fingerprint, HardDrive, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { checkCloudConfig, cleanCloudKey, cleanCloudUrl, cloudConfig, saveCloudConfig } from '../lib/cloud';
import { native, platform } from '../lib/native';
import { saveTextFile } from '../lib/actions';
import {
  createAccount, enableBio, go, recoverAccount, signInAccount, signOutEverywhereOnThisDevice, unlockWithBio, unlockWithPassword, useApp,
} from '../lib/session';
import { ErrorText, Field, Logo, cx } from '../components/ui';

function Frame({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="blueprint relative min-h-full overflow-y-auto">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px]" style={{ background: 'radial-gradient(60% 55% at 50% 22%, rgba(255,176,58,0.16), transparent 70%)' }} />
      <div className={cx('relative mx-auto flex min-h-full w-full flex-col justify-center px-6 py-10', wide ? 'max-w-xl' : 'max-w-md')}
        style={{ paddingTop: 'calc(2.5rem + var(--safe-top))', paddingBottom: 'calc(2.5rem + var(--safe-bottom))' }}>
        {children}
      </div>
    </div>
  );
}

function Head({ title, text }: { title: string; text?: string }) {
  return (
    <div className="mb-7 flex flex-col items-center text-center">
      <Logo size={64} glow />
      <h1 className="mt-4 font-display text-[26px] font-bold tracking-tight">{title}</h1>
      {text && <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">{text}</p>}
    </div>
  );
}

const useAuth = () => useApp(useShallow((s) => ({ error: s.error, errorDetail: s.errorDetail, busy: !!s.busy })));

export function Welcome() {
  return (
    <Frame>
      <div className="flex flex-col items-center text-center">
        <Logo size={112} glow />
        <h1 className="mt-6 font-display text-[40px] font-bold leading-none tracking-tight">Money Hub</h1>
        <p className="mt-3 text-[15px] text-paper/85">Smarter money. Brighter future.</p>
        <p className="label mt-2">Genest Jan Ramirez</p>
      </div>
      <div className="mt-14 text-center">
        <p className="font-display text-xl font-semibold">Take control of your finances</p>
        <p className="mt-1 text-sm text-muted">Track. Plan. Save. Grow.</p>
      </div>
      <div className="mt-8 space-y-3">
        <button className="btn-primary w-full" onClick={() => { useApp.setState({ afterCloud: 'create' }); go(cloudConfig() ? 'create' : 'cloud'); }}>Get started</button>
        <button className="btn-outline w-full" onClick={() => { useApp.setState({ afterCloud: 'signin' }); go(cloudConfig() ? 'signin' : 'cloud'); }}>Sign in</button>
        <a href="#demo" onClick={() => setTimeout(() => location.reload(), 0)} className="block pt-2 text-center text-sm text-current hover:underline">Look around with sample data first</a>
      </div>
      <div className="mt-10 flex items-center justify-center gap-2 text-xs text-faint">
        <ShieldCheck size={14} /> End-to-end encrypted. Only your devices can read your data.
      </div>
    </Frame>
  );
}

export function CloudSetup() {
  const saved = cloudConfig();
  const [url, setUrl] = useState(saved?.url ?? '');
  const [key, setKey] = useState(saved?.key ?? '');
  const [err, setErr] = useState<string | null>(null);
  return (
    <Frame wide>
      <Head title="Connect your private cloud" text="Your phone and laptop keep each other up to date through your own free Supabase project. Everything sent there is encrypted first." />
      <div className="card space-y-4 p-5">
        <Field label="Project URL" hint="Supabase > Project Settings > Data API.">
          <input className="field" placeholder="https://abcdefgh.supabase.co" value={url} onChange={(e) => setUrl(e.target.value.trim())} autoCapitalize="off" spellCheck={false} />
        </Field>
        <Field label="Publishable key" hint="Supabase > Project Settings > API Keys. It starts with sb_publishable_. Never the secret key.">
          <input className="field font-mono text-sm" placeholder="sb_publishable_..." value={key} onChange={(e) => setKey(e.target.value.trim())} autoCapitalize="off" spellCheck={false} />
        </Field>
        <ErrorText>{err}</ErrorText>
        <button className="btn-primary w-full" onClick={() => {
          const cfg = { url: cleanCloudUrl(url), key: cleanCloudKey(key) };
          const problem = checkCloudConfig(cfg.url, cfg.key);
          if (problem) return setErr(problem);
          saveCloudConfig(cfg);
          go(useApp.getState().afterCloud);
        }}><Cloud size={18} /> Connect</button>
      </div>
      <button className="btn-ghost mt-4 w-full text-muted" onClick={() => { saveCloudConfig(null); go('create'); }}>
        <HardDrive size={18} /> Use on this device only (no sync)
      </button>
      <button className="mt-2 text-center text-sm text-muted hover:text-paper" onClick={() => go('welcome')}>Back</button>
    </Frame>
  );
}

export const goodPassword = (pw: string) => pw.length >= 8;

function PasswordHint({ pw }: { pw: string }) {
  return (
    <span className={cx('flex items-center gap-2', goodPassword(pw) ? 'text-income' : 'text-faint')}>
      <Check size={13} /> At least 8 characters. A short sentence is easy to remember, like "jollibee every friday".
    </span>
  );
}

function PasswordInput({ value, onChange, autoComplete, autoFocus }: {
  value: string; onChange: (v: string) => void; autoComplete: string; autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="field flex items-center gap-2 py-0 pr-1 focus-within:border-current focus-within:ring-2 focus-within:ring-current/25">
      <input className="w-full bg-transparent py-3 outline-none focus-visible:outline-none" type={show ? 'text' : 'password'} autoComplete={autoComplete}
        autoFocus={autoFocus} value={value} onChange={(e) => onChange(e.target.value)} />
      <button type="button" className="rounded-lg p-2 text-muted hover:text-paper" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

export function CreateAccount() {
  const cloud = !!cloudConfig();
  const { error, errorDetail, busy } = useAuth();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const ready = (!cloud || /.+@.+\..+/.test(email)) && goodPassword(pw) && !busy;
  return (
    <Frame>
      <Head title="Create your account" text="You type this password once on each device. After that, your fingerprint opens Money Hub." />
      <form className="card space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); if (ready) void createAccount(email, pw, cloud); }}>
        {cloud && <Field label="Email"><input className="field" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>}
        <Field label="Password" hint={<PasswordHint pw={pw} />}>
          <PasswordInput value={pw} onChange={setPw} autoComplete="new-password" />
        </Field>
        <ErrorText detail={errorDetail}>{error}</ErrorText>
        <button className="btn-primary w-full" disabled={!ready}><LockKeyhole size={18} /> Create my account</button>
      </form>
      <button className="mt-4 text-center text-sm text-muted hover:text-paper" onClick={() => go(cloud ? 'signin' : 'welcome')}>
        {cloud ? 'I already have an account' : 'Back'}
      </button>
    </Frame>
  );
}

export function SignIn() {
  const { error, errorDetail, busy } = useAuth();
  const [email, setEmail] = useState(useApp.getState().pendingEmail ?? '');
  const [pw, setPw] = useState('');
  return (
    <Frame>
      <Head title="Sign in" text="Only this once on this device. After that, your fingerprint or face opens Money Hub." />
      <form className="card space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); void signInAccount(email, pw); }}>
        <Field label="Email"><input className="field" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password"><PasswordInput value={pw} onChange={setPw} autoComplete="current-password" /></Field>
        <ErrorText detail={errorDetail}>{error}</ErrorText>
        <button className="btn-primary w-full" disabled={busy || !email || !pw}>Sign in</button>
      </form>
      <div className="mt-4 flex justify-between text-sm">
        <button className="text-muted hover:text-paper" onClick={() => go('create')}>Create an account</button>
        <button className="text-current hover:underline" onClick={() => go('forgot')}>Forgot password?</button>
      </div>
    </Frame>
  );
}

export function ConfirmEmail() {
  const email = useApp((s) => s.pendingEmail);
  return (
    <Frame>
      <Head title="Check your email" text={`Supabase sent a confirmation link to ${email ?? 'your email'}. Open it, then come back and sign in.`} />
      <button className="btn-primary w-full" onClick={() => go('signin')}>I have confirmed it</button>
    </Frame>
  );
}

export function RecoveryKey() {
  const key = useApp((s) => s.recoveryKey) ?? '';
  const bio = useApp((s) => s.bio);
  const [kept, setKept] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <Frame wide>
      <Head title="Save your spare key" text="If you ever forget your password, this key gets you back in. Save it once, somewhere safe like your Google Drive." />
      <div className="card p-5">
        <div className="rounded-2xl border border-signal/30 bg-ink-2 px-4 py-5 text-center font-mono text-[17px] leading-loose tracking-wider text-signal sm:text-lg">
          {key.split('-').map((g, i) => <span key={i} className="inline-block px-1.5">{g}</span>)}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button className="btn-primary" onClick={async () => {
            await saveTextFile('Money Hub spare key.txt', 'text/plain',
              `Money Hub spare key\r\n\r\n${key}\r\n\r\nKeep this private. With your email it resets your Money Hub password.\r\n`);
            setKept(true);
          }}>
            <Download size={16} /> Save it
          </button>
          <button className="btn-outline" onClick={async () => {
            await navigator.clipboard.writeText(key);
            setCopied(true);
            setKept(true);
            setTimeout(() => void navigator.clipboard.writeText(''), 60_000);
          }}>
            <Copy size={16} /> {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        {!kept && <button className="mt-3 w-full text-center text-xs text-muted hover:text-paper" onClick={() => setKept(true)}>I wrote it down on paper</button>}
        <button className="btn-primary mt-4 w-full" disabled={!kept} onClick={async () => {
          if (bio.available && !bio.enrolled) await enableBio();
          // Bill reminders are on for the phone; Android 13 and later ask once before notifying.
          if (platform === 'android') await native.notifyPermission().catch(() => undefined);
          useApp.setState({ recoveryKey: null, phase: 'ready' });
        }}>
          {bio.available && !bio.enrolled ? <><Fingerprint size={18} /> Continue and use my {bio.label === 'Windows Hello' ? 'Windows Hello' : 'fingerprint'}</> : 'Continue'}
        </button>
      </div>
    </Frame>
  );
}

export function Locked() {
  const { error, errorDetail, busy } = useAuth();
  const meta = useApp((s) => s.meta);
  const bio = useApp((s) => s.bio);
  const [pw, setPw] = useState('');
  return (
    <Frame>
      <Head title="Welcome back" text={meta?.email ? `Unlock ${meta.email}` : 'Unlock Money Hub'} />
      {bio.enrolled && (
        <button className="btn-primary mb-4 w-full py-4" onClick={() => void unlockWithBio()}>
          <Fingerprint size={22} /> Unlock with {bio.label || 'fingerprint'}
        </button>
      )}
      <form className="card space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); void unlockWithPassword(pw); }}>
        <Field label="Password"><PasswordInput value={pw} onChange={setPw} autoComplete="current-password" autoFocus={!bio.enrolled} /></Field>
        <ErrorText detail={errorDetail}>{error}</ErrorText>
        <button className={bio.enrolled ? 'btn-outline w-full' : 'btn-primary w-full'} disabled={busy || !pw}><KeyRound size={18} /> Unlock with password</button>
      </form>
      <div className="mt-4 flex justify-between text-sm">
        <button className="text-current hover:underline" onClick={() => go('forgot')}>Forgot password?</button>
        <button className="text-muted hover:text-paper" onClick={() => {
          if (confirm('Remove Money Hub data from this device? Your cloud copy is not touched.')) void signOutEverywhereOnThisDevice();
        }}>Use another account</button>
      </div>
    </Frame>
  );
}

export function Forgot() {
  const { error, errorDetail, busy } = useAuth();
  const meta = useApp((s) => s.meta);
  const [email, setEmail] = useState(meta?.email ?? '');
  const [rk, setRk] = useState('');
  const [pw, setPw] = useState('');
  const strong = goodPassword(pw);
  const needsEmail = meta?.mode !== 'local';
  return (
    <Frame>
      <Head title="Reset your password" text="Use the spare key you saved when you created your account." />
      <form className="card space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); if (strong) void recoverAccount(email, rk, pw); }}>
        {needsEmail && <Field label="Email"><input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>}
        <Field label="Spare key"><input className="field font-mono uppercase" placeholder="XXXX-XXXX-XXXX-..." value={rk} onChange={(e) => setRk(e.target.value)} autoCapitalize="characters" spellCheck={false} /></Field>
        <Field label="New password" hint={<PasswordHint pw={pw} />}><PasswordInput value={pw} onChange={setPw} autoComplete="new-password" /></Field>
        <ErrorText detail={errorDetail}>{error}</ErrorText>
        <button className="btn-primary w-full" disabled={busy || !strong || !rk || (needsEmail && !email)}>Set new password</button>
      </form>
      <button className="mt-4 text-center text-sm text-muted hover:text-paper" onClick={() => go(meta ? 'locked' : 'signin')}>Back</button>
    </Frame>
  );
}
