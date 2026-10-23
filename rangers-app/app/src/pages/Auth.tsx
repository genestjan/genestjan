import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Page } from '../components/ui';
import { claimAdmin, redeemInvite, sendCode, signInGoogle, signOut, useCloud, verifyCode } from '../lib/cloud';

export function Login({ joining }: { joining?: boolean }) {
  const [email, setEmail] = useState(''); const [code, setCode] = useState(''); const [sent, setSent] = useState(false); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const run = async (f: () => Promise<void>) => { setBusy(true); setErr(''); try { await f(); } catch (e) { setErr((e as Error).message); } setBusy(false); };
  return (
    <Page title={joining ? 'Join Rangers' : 'Sign in'}>
      <p className="mb-4 text-lg">{joining ? 'Sign in first, then your invite is linked to your account.' : 'Coaches and parents sign in here. Each person has their own login.'}</p>
      <Card className="grid gap-3">
        <button className="btn h-14" disabled={busy} onClick={() => run(signInGoogle)}>Continue with Google</button>
        <div className="muted text-center">or use your email</div>
        {!sent ? (<>
          <input className="field" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn ghost h-14" disabled={busy || !/.+@.+\..+/.test(email)} onClick={() => run(async () => { await sendCode(email); setSent(true); })}>Send me a 6-digit code</button>
        </>) : (<>
          <p>We sent a code to <b>{email}</b>. It can take a minute.</p>
          <input className="field text-center text-3xl tracking-widest" inputMode="numeric" autoComplete="one-time-code" maxLength={6} aria-label="6-digit code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          <button className="btn h-14" disabled={busy || code.length < 6} onClick={() => run(() => verifyCode(email, code))}>Sign in</button>
          <button className="btn ghost" onClick={() => setSent(false)}>Use a different email</button>
        </>)}
        {err && <p role="alert" className="text-red">{err}</p>}
      </Card>
    </Page>
  );
}

/** Opened from a family or coach invite link: /join#token */
export function Join() {
  const nav = useNavigate(); const c = useCloud();
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const token = () => location.hash.slice(1) || sessionStorage.getItem('rangers-invite') || '';
  useEffect(() => { const t = location.hash.slice(1); if (t) { sessionStorage.setItem('rangers-invite', t); history.replaceState(null, '', location.pathname); } }, []);
  useEffect(() => {
    const t = token();
    if (c.status === 'signed-out' || c.status === 'loading') return;
    if (!t) { setErr('This link has no invite in it. Ask your coach to send it again.'); return; }
    redeemInvite(t).then((name) => { sessionStorage.removeItem('rangers-invite'); setMsg(name === 'coach' ? 'You are in. An admin will approve you shortly.' : `${name} is now linked to your account.`); setTimeout(() => nav('/', { replace: true }), 1800); })
      .catch((e: Error) => setErr(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.status]);
  if (c.status === 'signed-out') return <Login joining />;
  return <Page title="Joining"><Card>{msg ? <p className="text-xl">{msg}</p> : err ? <p role="alert" className="text-red">{err}</p> : <p>Checking your invite...</p>}</Card></Page>;
}

export function Gate() {
  const c = useCloud(); const [err, setErr] = useState('');
  if (c.status === 'pending') return <Page title="Almost there"><Card><p className="text-lg">Your coach account is waiting for the club admin to approve it. You will see the app as soon as they do.</p><button className="btn ghost mt-3" onClick={() => signOut()}>Sign out</button></Card></Page>;
  return (
    <Page title="Welcome">
      <Card className="grid gap-3">
        <p className="text-lg">You are signed in as <b>{c.email}</b>, but this account is not linked to anyone yet.</p>
        <p>Parents: open the private link your coach sent for your child. Coaches: open the coach invite from the club admin.</p>
        <hr style={{ borderColor: 'var(--line)' }} />
        <p className="muted">First time setting up the club? The first person to tap this becomes the admin. After that it is locked.</p>
        <button className="btn ghost" onClick={() => claimAdmin().catch((e: Error) => setErr(e.message))}>Set up the club (admin)</button>
        {err && <p className="text-red" role="alert">{err}</p>}
        <button className="btn ghost" onClick={() => signOut()}>Sign out</button>
      </Card>
    </Page>
  );
}
