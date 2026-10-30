import { Check, Cloud, Copy, Download, Fingerprint, HardDrive, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { checkCloudConfig, cloudConfig, saveCloudConfig } from '../lib/cloud';
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

const useAuth = () => useApp(useShallow((s) => ({ error: s.error, busy: !!s.busy })));

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
          const problem = checkCloudConfig(url, key);
          if (problem) return setErr(problem);
          saveCloudConfig({ url: url.replace(/\/$/, ''), key });
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

function PasswordRules({ pw }: { pw: string }) {
  const rules = [
    { ok: pw.length >= 12, text: 'At least 12 characters' },
    { ok: /[a-z]/i.test(pw) && /[^a-z]/i.test(pw), text: 'Letters plus a number or symbol' },
  ];
  return (
    <ul className="space-y-1">
      {rules.map((r) => (
        <li key={r.text} className={cx('flex items-center gap-2 text-xs', r.ok ? 'text-income' : 'text-faint')}><Check size={13} /> {r.text}</li>
      ))}
    </ul>
  );
}

export function CreateAccount() {
  const cloud = !!cloudConfig();
  const { error, busy } = useAuth();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [ack, setAck] = useState(false);
  const strong = pw.length >= 12 && /[a-z]/i.test(pw) && /[^a-z]/i.test(pw);
  const ready = (!cloud || /.+@.+\..+/.test(email)) && strong && pw === pw2 && ack && !busy;
  return (
    <Frame>
      <Head title="Create your vault" text={cloud ? 'One password opens Money Hub on every device you sign in to.' : 'Kept on this device only. You can turn on sync later.'} />
      <form className="card space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); if (ready) void createAccount(email, pw, cloud); }}>
        {cloud && <Field label="Email"><input className="field" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>}
        <Field label="Password" hint={<PasswordRules pw={pw} />}>
          <input className="field" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </Field>
        <Field label="Password again">
          <input className="field" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          {pw2 && pw !== pw2 && <span className="mt-1.5 block text-xs text-expense">The two passwords are different.</span>}
        </Field>
        <label className="flex items-start gap-3 rounded-xl border border-signal/25 bg-signal/5 p-3 text-xs leading-relaxed text-paper/85">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#FFB03A]" />
          I understand my data is encrypted with this password. If I forget it, only my recovery key (shown next) can get me back in. Nobody else can, not even the developer.
        </label>
        <ErrorText>{error}</ErrorText>
        <button className="btn-primary w-full" disabled={!ready}><LockKeyhole size={18} /> Create vault</button>
      </form>
      <button className="mt-4 text-center text-sm text-muted hover:text-paper" onClick={() => go(cloud ? 'signin' : 'welcome')}>
        {cloud ? 'I already have an account' : 'Back'}
      </button>
    </Frame>
  );
}

export function SignIn() {
  const { error, busy } = useAuth();
  const [email, setEmail] = useState(useApp.getState().pendingEmail ?? '');
  const [pw, setPw] = useState('');
  return (
    <Frame>
      <Head title="Sign in" text="Sign in on this device. Your data downloads and unlocks here." />
      <form className="card space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); void signInAccount(email, pw); }}>
        <Field label="Email"><input className="field" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password"><input className="field" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        <ErrorText>{error}</ErrorText>
        <button className="btn-primary w-full" disabled={busy || !email || !pw}>Sign in</button>
      </form>
      <div className="mt-4 flex justify-between text-sm">
        <button className="text-muted hover:text-paper" onClick={() => go('create')}>Create an account</button>
        <button className="text-current hover:underline" onClick={() => go('forgot')}>Forgot password?</button>
      </div>
      <button className="mt-6 text-center text-xs text-faint hover:text-muted" onClick={() => go('cloud')}>Change cloud connection</button>
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
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <Frame wide>
      <Head title="Your recovery key" text="Write this down or save it in your password manager. It is the only way back in if you forget your password. It is shown once." />
      <div className="card p-5">
        <div className="rounded-2xl border border-signal/30 bg-ink-2 px-4 py-5 text-center font-mono text-[17px] leading-loose tracking-wider text-signal sm:text-lg">
          {key.split('-').map((g, i) => <span key={i} className="inline-block px-1.5">{g}</span>)}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button className="btn-outline" onClick={async () => { await navigator.clipboard.writeText(key); setCopied(true); setTimeout(() => void navigator.clipboard.writeText(''), 60_000); }}>
            <Copy size={16} /> {copied ? 'Copied' : 'Copy'}
          </button>
          <button className="btn-outline" onClick={() => saveTextFile('Money Hub recovery key.txt', 'text/plain',
            `Money Hub recovery key\r\n\r\n${key}\r\n\r\nKeep this private. With your email it can reset your password.\r\n`)}>
            <Download size={16} /> Save as file
          </button>
        </div>
        <label className="mt-5 flex items-start gap-3 text-sm">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#FFB03A]" />
          I have saved my recovery key somewhere safe.
        </label>
        <button className="btn-primary mt-4 w-full" disabled={!saved} onClick={async () => {
          if (bio.available && !bio.enrolled) await enableBio();
          useApp.setState({ recoveryKey: null, phase: 'ready' });
        }}>
          {bio.available && !bio.enrolled ? <><Fingerprint size={18} /> Continue and turn on {bio.label || 'fingerprint'} unlock</> : 'Continue'}
        </button>
      </div>
    </Frame>
  );
}

export function Locked() {
  const { error, busy } = useAuth();
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
        <Field label="Password"><input className="field" type="password" autoComplete="current-password" autoFocus={!bio.enrolled} value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        <ErrorText>{error}</ErrorText>
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
  const { error, busy } = useAuth();
  const meta = useApp((s) => s.meta);
  const [email, setEmail] = useState(meta?.email ?? '');
  const [rk, setRk] = useState('');
  const [pw, setPw] = useState('');
  const strong = pw.length >= 12 && /[a-z]/i.test(pw) && /[^a-z]/i.test(pw);
  const needsEmail = meta?.mode !== 'local';
  return (
    <Frame>
      <Head title="Reset your password" text="Use the recovery key you saved when you created your vault." />
      <form className="card space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); if (strong) void recoverAccount(email, rk, pw); }}>
        {needsEmail && <Field label="Email"><input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>}
        <Field label="Recovery key"><input className="field font-mono uppercase" placeholder="XXXX-XXXX-XXXX-..." value={rk} onChange={(e) => setRk(e.target.value)} autoCapitalize="characters" spellCheck={false} /></Field>
        <Field label="New password" hint={<PasswordRules pw={pw} />}><input className="field" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        <ErrorText>{error}</ErrorText>
        <button className="btn-primary w-full" disabled={busy || !strong || !rk || (needsEmail && !email)}>Set new password</button>
      </form>
      <button className="mt-4 text-center text-sm text-muted hover:text-paper" onClick={() => go(meta ? 'locked' : 'signin')}>Back</button>
    </Frame>
  );
}
