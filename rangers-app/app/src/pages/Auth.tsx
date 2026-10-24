import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Page } from '../components/ui';
import { claimAdmin, getCloud, googleButtonEnabled, redeemInvite, renderGoogleButton, resolveLocalChoice, sendCode, setConsent, signInGoogle, signOut, syncNow, useCloud, verifyCode } from '../lib/cloud';
import { isDemoId } from '../lib/syncMap';
import { useAppState } from '../lib/store';

/** Facebook, Messenger and Instagram open links in their own browser, where Google refuses to sign in. */
/** Email codes need a verified sender (see SETUP.md). Off until VITE_EMAIL_CODES=1 is set at build time. */
const EMAIL_CODES = import.meta.env.VITE_EMAIL_CODES === '1';
/** Supabase sends a failed sign-in back as ?error=...&error_description=... on the address. Read it once, then clean the address. */
function takeAuthError(): string {
  try {
    const q = new URLSearchParams(location.search); const h = new URLSearchParams(location.hash.replace(/^#\/?/, '').replace(/^[^?]*\?/, ''));
    const msg = q.get('error_description') || h.get('error_description') || q.get('error') || '';
    if (msg || q.has('error') || q.has('error_code')) history.replaceState(null, '', location.pathname + (location.hash.startsWith('#/') ? location.hash.split('?')[0] : '#/'));
    return msg.replace(/\+/g, ' ');
  } catch { return ''; }
}
const inAppBrowser = () => /FBAN|FBAV|FB_IAB|Messenger|Instagram|Line\//i.test(navigator.userAgent);

export function Login({ joining }: { joining?: boolean }) {
  const [email, setEmail] = useState(''); const [code, setCode] = useState(''); const [sent, setSent] = useState(false); const [err, setErr] = useState(takeAuthError); const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const gRef = useRef<HTMLDivElement>(null); const [gState, setGState] = useState<'loading' | 'ready' | 'failed'>('loading');
  // Google's own button (shows rangersfc.net). If it cannot load, the redirect button below is used instead.
  useEffect(() => { if (googleButtonEnabled && gRef.current) renderGoogleButton(gRef.current, setErr).then(() => setGState('ready'), () => setGState('failed')); }, []);
  const run = async (f: () => Promise<void>) => { setBusy(true); setErr(''); try { await f(); } catch (e) { setErr((e as Error).message); } setBusy(false); };
  const copyLink = async () => { try { await navigator.clipboard.writeText(location.href); setCopied(true); } catch { setErr('Could not copy. Tap the three dots at the top and choose "Open in browser".'); } };
  return (
    <Page title={joining ? 'Join Rangers' : 'Sign in'}>
      {inAppBrowser() && (
        <Card className="mb-4 grid gap-2">
          <p><b>You opened this inside Messenger or Facebook.</b> Google sign-in does not work here.</p>
          <p>Tap the three dots at the top right and choose <b>Open in browser</b> (Chrome or Safari). Or copy the link and paste it into Chrome or Safari.</p>
          <button className="btn ghost" onClick={copyLink}>{copied ? 'Link copied' : 'Copy link'}</button>
        </Card>
      )}
      <p className="mb-4 text-lg">{joining ? 'Sign in first, then your invite is linked to your account.' : 'Coaches and parents sign in here. Each person has their own login.'}</p>
      <Card className="grid gap-3">
        {googleButtonEnabled && <div ref={gRef} className="flex min-h-[44px] justify-center" />}
        {(!googleButtonEnabled || gState === 'failed') && <button className="btn h-14" disabled={busy} onClick={() => run(signInGoogle)}>Continue with Google</button>}
        {googleButtonEnabled && gState === 'ready' && <button className="muted text-center text-sm underline" disabled={busy} onClick={() => run(signInGoogle)}>Google button not working? Sign in the other way</button>}
        {EMAIL_CODES && (<>
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
        </>)}
        {err && <p role="alert" className="text-red">{err}</p>}
      </Card>
    </Page>
  );
}

const INVITE_KEY = 'rangers-invite';
/** An invite opened before signing in is kept here through the Google redirect. */
export const pendingInvite = () => { try { return sessionStorage.getItem(INVITE_KEY) ?? ''; } catch { return ''; } };

/** Opened from a family or coach invite link: #/join/<token> */
export function Join() {
  const nav = useNavigate(); const c = useCloud(); const { token: fromUrl } = useParams();
  const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [child, setChild] = useState('');
  useEffect(() => { if (fromUrl) { try { sessionStorage.setItem(INVITE_KEY, fromUrl); } catch { /* private mode */ } } }, [fromUrl]);
  useEffect(() => {
    const t = fromUrl || pendingInvite();
    if (c.status === 'signed-out' || c.status === 'loading' || c.status === 'off') return;
    if (!t) { setErr('This link has no invite in it. Ask your coach to send it again.'); return; }
    redeemInvite(t).then((name) => {
      try { sessionStorage.removeItem(INVITE_KEY); } catch { /* ignore */ }
      // Leave the invite address straight away, so reloading or reopening it never tries to use it again.
      history.replaceState(null, '', location.pathname + '#/');
      if (!name) {
        if (getCloud().status === 'ready' || getCloud().status === 'pending') { setMsg('You have already joined. Opening the app...'); setTimeout(() => nav('/', { replace: true }), 1200); return; }
        setErr('This invite link has already been used or has expired. Ask your coach for a new one.'); return;
      }
      if (name === 'coach') { setMsg('You are in. The club admin will approve your coach account shortly.'); setTimeout(() => nav('/', { replace: true }), 2500); return; }
      setChild(name);
    }).catch((e: Error) => setErr(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.status]);
  if (c.status === 'off') return <Page title="Join"><Card><p>Online accounts are not switched on for this app yet. Ask your coach.</p></Card></Page>;
  if (c.status === 'signed-out') return <Login joining />;
  if (child) return <ConsentStep childName={child} onDone={(kidId) => nav(kidId ? `/docs/${kidId}` : '/', { replace: true })} />;
  return <Page title="Joining"><Card>{msg ? <p className="text-xl">{msg}</p> : err ? <p role="alert" className="text-red">{err}</p> : <p>Checking your invite...</p>}</Card></Page>;
}

export const NOTICE_VERSION = '2026-10-v3';
/** Shown once after a parent links a child: the privacy notice and the consent choices, stored with the notice version. */
function ConsentStep({ childName, onDone }: { childName: string; onDone: (kidId?: string) => void }) {
  const s = useAppState(); const kid = s.players.find((p) => p.firstName === childName) ?? s.players[0];
  const [data, setData] = useState(false); const [photo, setPhoto] = useState(false); const [video, setVideo] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const save = async () => {
    if (!kid) { onDone(); return; }
    setBusy(true); setErr('');
    try { await setConsent(kid.id, 'data', true, NOTICE_VERSION); await setConsent(kid.id, 'photo', photo, NOTICE_VERSION); await setConsent(kid.id, 'video', video, NOTICE_VERSION); await syncNow(); onDone(kid.id); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  return (
    <Page title={`Welcome, ${childName}'s family`}>
      <Card className="mb-3 grid gap-2"><PrivacyText /></Card>
      <Card className="grid gap-3">
        <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-6 w-6" checked={data} onChange={(e) => setData(e.target.checked)} /><span><b>I agree</b> to the club using {childName}'s information as described above, including keeping a photo of their student ID and PSA birth certificate. (Needed to use the app.)</span></label>
        <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-6 w-6" checked={photo} onChange={(e) => setPhoto(e.target.checked)} /><span>Show {childName}'s photo on team screens. (Optional, you can change this later.)</span></label>
        <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-6 w-6" checked={video} onChange={(e) => setVideo(e.target.checked)} /><span>Coaches may use video of {childName} in the club's drill library. (Optional.)</span></label>
        <button className="btn h-14" disabled={!data || busy} onClick={save}>Continue</button>
        {err && <p role="alert" className="text-red">{err}</p>}
      </Card>
    </Page>
  );
}

export function PrivacyText() {
  return (<>
    <h2 className="text-2xl">How we look after your child's information</h2>
    <p>The Rangers App is run by volunteers of Rangers Football Club (with FC New Mabu and Gila Academy) to organise training and matches. It is free and has no ads.</p>
    <p><b>What we keep:</b> your name and email; your child's name, birth date, shirt number and team; attendance, playing time and football progress; your child's address, phone number and the health details you choose to give (emergency contacts, medication, allergies, inhaler, injuries at the club, height for growth spurts); photos your child sends as proof for tasks from the coach; a photo of your child's student ID and PSA birth certificate, which tournament and school-meet organisers ask the coach to show; for school teams, which DepEd screening papers are ready (not the papers themselves); a photo of your child on team screens only if you say yes.</p>
    <p><b>Who sees it:</b> your child's coaches and the club admins. You see only your own child. Other parents never see your child's reviews, health information or contributions. Kids' screens show first names and shirt numbers only.</p>
    <p><b>How long:</b> while your child is with the club, then deleted 12 months after they leave. Photos of ID papers are deleted as soon as your child leaves. We never sell or share it.</p>
    <p><b>Your rights:</b> change photo and video permission any time, download, correct or ask us to delete your child's information (More, Privacy). Contact Coach James, +63 993 291 0764.</p>
    <details><summary className="underline">Basahin sa Filipino</summary><p className="mt-2">Ang Rangers App ay pinapatakbo ng mga volunteer ng Rangers Football Club para ayusin ang training at mga laro. Libre ito at walang ads. Ang mga coach at admin lang ng club ang makakakita ng impormasyon ng inyong anak; kayo lang ang makakakita ng sa inyong anak. Buburahin ito 12 buwan pagkatapos umalis ang bata. Puwede ninyong baguhin ang pahintulot sa litrato, i-download, itama o ipabura ang impormasyon anumang oras.</p></details>
  </>);
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

/** First sign-in on a phone that was used without an account: upload that work to the club, or start fresh. */
export function LocalChoice() {
  const s = useAppState(); const [busy, setBusy] = useState(false);
  const players = s.players.filter((p) => !isDemoId(p.id)).length;
  const parts = [[players, 'player'], [s.events.length, 'event'], [s.matches.length, 'match'], [s.messages.length + s.announcements.length, 'message']].filter(([n]) => n) as [number, string][];
  const go = (keep: boolean) => { setBusy(true); void resolveLocalChoice(keep); };
  return (
    <Page title="Before you start">
      <Card className="grid gap-3">
        <p className="text-lg">This phone already has things made before you signed in: <b>{parts.map(([n, w]) => `${n} ${w}${n === 1 ? '' : w === 'match' ? 'es' : 's'}`).join(', ')}</b>.</p>
        <p>If they were real, upload them so the other coaches see them. If you were only trying the app, start fresh so test data does not reach the club. Practice players from the demo team are never uploaded.</p>
        <button className="btn h-14" disabled={busy} onClick={() => go(true)}>Upload them to the club</button>
        <button className="btn ghost h-14" disabled={busy} onClick={() => go(false)}>Start fresh (delete them from this phone)</button>
      </Card>
    </Page>
  );
}
