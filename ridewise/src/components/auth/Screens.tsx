import { useEffect, useRef, useState } from 'react';
import { Check, Fingerprint, KeyRound, Plus, Zap } from 'lucide-react';
import { useAuth } from '../../store/auth';
import { AVATAR_COLORS } from '../../store/accounts';
import { biometricAvailable } from '../../lib/biometric';
import { AuthShell, Avatar, ErrorLine, PasswordInput } from './parts';
import type { UnlockMode } from '../../store/accounts';

const COLOR_NAMES = ['Blue', 'Green', 'Orange', 'Purple', 'Red', 'Teal'];

/** First screen for a new phone, or when adding another rider. */
export function Welcome() {
  const { accounts, register } = useAuth();
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [color, setColor] = useState(AVATAR_COLORS[accounts.length % AVATAR_COLORS.length]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const first = accounts.length === 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Please type your name.');
    if (pw !== pw2) return setError('The two passwords are not the same. Type them again.');
    setBusy(true);
    try {
      await register({ name, password: pw, color });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <AuthShell title={first ? "Hi! I'm Wheelie." : 'A new rider!'} subtitle={first ? 'I help bike groups plan long rides. Let us make your account first.' : 'Make an account for another rider on this phone.'}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="reg-name" className="label text-base">
            What is your name?
          </label>
          <input id="reg-name" className="input text-lg" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" maxLength={30} />
        </div>
        <PasswordInput id="reg-pw" label="Make a secret password" value={pw} onChange={setPw} autoComplete="new-password" hint="At least 8 letters or numbers. Pick something you will remember." />
        <PasswordInput id="reg-pw2" label="Type the password again" value={pw2} onChange={setPw2} autoComplete="new-password" />
        <fieldset>
          <legend className="label text-base">Pick your color</legend>
          <div className="flex flex-wrap gap-3">
            {AVATAR_COLORS.map((c, i) => (
              <label key={c} className="relative cursor-pointer">
                <input type="radio" name="color" className="peer sr-only" checked={color === c} onChange={() => setColor(c)} aria-label={COLOR_NAMES[i]} />
                <span className="grid h-12 w-12 place-items-center rounded-full text-white ring-offset-2 peer-checked:ring-4 peer-checked:ring-navy peer-focus-visible:ring-4 peer-focus-visible:ring-sky" style={{ background: c }}>
                  {color === c && <Check aria-hidden className="h-6 w-6" />}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <p className="rounded-xl bg-caution-soft p-3 text-base text-amber-900">
          <strong>Do not forget it!</strong> Your rides are locked with this password on your phone. If you forget it, nobody can open them again, not even me.
        </p>
        <ErrorLine text={error} />
        <button type="submit" className="btn-go w-full text-lg" disabled={busy}>
          {busy ? 'Making your account…' : 'Make my account'}
        </button>
      </form>
      {accounts.length > 0 && (
        <button type="button" className="btn-ghost mt-3 w-full" onClick={() => useAuth.setState({ status: 'choose', current: null })}>
          I already have an account
        </button>
      )}
      <p className="mt-4 text-center text-sm text-slate-600">Your rides stay on this phone. I never send your name or password anywhere.</p>
    </AuthShell>
  );
}

/** "Who is riding?" when several riders share a phone. */
export function ChooseRider() {
  const { accounts, chooseRider } = useAuth();
  return (
    <AuthShell title="Who is riding today?" subtitle="Tap your name.">
      <ul className="space-y-3">
        {accounts.map((a) => (
          <li key={a.id}>
            <button type="button" onClick={() => chooseRider(a.id)} className="flex min-h-[72px] w-full items-center gap-4 rounded-2xl border-2 border-slate-200 p-3 text-left hover:border-navy hover:bg-slate-50">
              <Avatar account={a} size={52} />
              <span className="text-xl font-bold">{a.name}</span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="btn-secondary mt-4 w-full text-lg" onClick={() => useAuth.getState().addRider()}>
        <Plus aria-hidden className="h-5 w-5" /> Add another rider
      </button>
    </AuthShell>
  );
}

/** Password (and fingerprint, when set up) for a rider who is signed out. */
export function Unlock() {
  const { current, unlockMode, loginWithPassword, loginWithFingerprint, switchRider, accounts } = useAuth();
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const tried = useRef(false);

  const finger = async () => {
    if (!current) return;
    setError(null);
    setBusy(true);
    try {
      await loginWithFingerprint(current.id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  // Offer the phone's prompt straight away, once.
  useEffect(() => {
    if (unlockMode === 'fingerprint' && !tried.current) {
      tried.current = true;
      void finger();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlockMode]);

  if (!current) return null;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await loginWithPassword(current.id, pw);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <AuthShell title={`Welcome back, ${current.name}!`} subtitle="Let us open your rides.">
      <div className="mb-4 flex justify-center">
        <Avatar account={current} size={72} />
      </div>
      {unlockMode === 'fingerprint' && (
        <>
          <button type="button" className="btn-go w-full text-lg" onClick={finger} disabled={busy}>
            <Fingerprint aria-hidden className="h-6 w-6" /> Use my fingerprint
          </button>
          <p className="my-3 text-center text-slate-500">or</p>
        </>
      )}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <PasswordInput id="login-pw" label="Your password" value={pw} onChange={setPw} autoComplete="current-password" />
        <ErrorLine text={error} />
        <button type="submit" className={`${unlockMode === 'fingerprint' ? 'btn-secondary' : 'btn-go'} w-full text-lg`} disabled={busy || !pw}>
          {busy && pw ? 'Opening…' : 'Open my rides'}
        </button>
      </form>
      <div className="mt-4 flex flex-col gap-1">
        {accounts.length > 1 && (
          <button type="button" className="btn-ghost" onClick={() => switchRider()}>
            Not {current.name}? Pick someone else
          </button>
        )}
        <button type="button" className="btn-ghost" onClick={() => setForgot((f) => !f)} aria-expanded={forgot}>
          I forgot my password
        </button>
      </div>
      {forgot && <ForgotHelp />}
    </AuthShell>
  );
}

function ForgotHelp() {
  const { current } = useAuth();
  const [sure, setSure] = useState(false);
  if (!current) return null;
  return (
    <div className="mt-2 space-y-3 rounded-2xl bg-slate-100 p-4 text-base">
      <p>
        Your rides are locked with your password. That keeps them private, but it also means nobody can open them without it. I cannot get it back for you.
      </p>
      <p>
        <strong>If you saved a backup file</strong> (Settings → Save a copy), make a new account and load the file back in.
      </p>
      <p>
        <strong>If not,</strong> you can start fresh. This removes {current.name}'s saved rides from this phone for good.
      </p>
      {!sure ? (
        <button type="button" className="btn-secondary w-full" onClick={() => setSure(true)}>
          Start fresh…
        </button>
      ) : (
        <div className="space-y-2">
          <p className="font-bold text-danger">Are you sure? This cannot be undone.</p>
          <button type="button" className="btn-danger w-full" onClick={() => useAuth.getState().resetForgotten(current.id)}>
            Yes, remove {current.name}
          </button>
          <button type="button" className="btn-ghost w-full" onClick={() => setSure(false)}>
            No, go back
          </button>
        </div>
      )}
    </div>
  );
}

/** Shown once, right after registering: how should this phone open RideWise next time? */
export function OpenChoice() {
  const { current, setOpenMode, finishWelcome } = useAuth();
  const [canFinger, setCanFinger] = useState(false);
  const [mode, setMode] = useState<UnlockMode>('open');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    biometricAvailable().then((ok) => {
      setCanFinger(ok);
      if (ok) setMode('fingerprint');
    });
  }, []);
  if (!current) return null;

  const options: { value: UnlockMode; icon: typeof Fingerprint; title: string; text: string; show: boolean }[] = [
    { value: 'fingerprint', icon: Fingerprint, title: 'Fingerprint or face', text: 'Quick and safe. Your phone checks that it is you.', show: canFinger },
    { value: 'open', icon: Zap, title: 'Just open', text: 'Fastest. But anyone holding your phone can open it.', show: true },
    { value: 'password', icon: KeyRound, title: 'My password', text: 'Safest. You type it every time.', show: true },
  ];

  const go = async () => {
    setError(null);
    setBusy(true);
    const res = await setOpenMode(mode);
    setBusy(false);
    if (!res.ok) return setError(res.message ?? 'That did not work.');
    finishWelcome();
  };

  return (
    <AuthShell title={`Almost done, ${current.name}!`} subtitle="How should I open next time?" mood="cheer">
      <fieldset className="space-y-3">
        <legend className="sr-only">How should RideWise open next time</legend>
        {options.filter((o) => o.show).map((o) => (
          <label key={o.value} className="block cursor-pointer">
            <input type="radio" name="open-mode" className="peer sr-only" checked={mode === o.value} onChange={() => setMode(o.value)} />
            <span className="flex items-center gap-4 rounded-2xl border-2 border-slate-200 p-4 peer-checked:border-brand-600 peer-checked:bg-brand-50 peer-focus-visible:ring-4 peer-focus-visible:ring-sky">
              <o.icon aria-hidden className="h-9 w-9 shrink-0 text-navy" />
              <span>
                <span className="block text-xl font-bold">{o.title}</span>
                <span className="block text-base text-slate-700">{o.text}</span>
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      {!canFinger && <p className="mt-3 text-sm text-slate-600">Fingerprint is not available in this browser. Chrome on Android usually has it.</p>}
      <div className="mt-4 space-y-3">
        <ErrorLine text={error} />
        <button type="button" className="btn-go w-full text-lg" onClick={go} disabled={busy}>
          {busy ? 'One moment…' : 'Continue'}
        </button>
        <p className="text-center text-sm text-slate-600">You can change this any time in Settings.</p>
      </div>
    </AuthShell>
  );
}
