import { useState } from 'react';
import { ArrowRight, Camera, IdCard, Mail, ShieldCheck } from 'lucide-react';
import type { Backend } from '../lib/backend';
import type { Profile, Role } from '../lib/types';
import { compressImage } from '../lib/services';

const ID_TYPES = ['PhilSys National ID', "Driver's Licence", 'Passport', 'UMID', 'SSS ID', 'PRC ID', 'Postal ID', "Voter's ID", 'School ID (students)'];

export function Logo({ small }: { small?: boolean }) {
  return <img src={import.meta.env.BASE_URL + 'logo.png'} alt="Fetch GenSan" className={small ? 'h-10 w-10' : 'mx-auto h-28 w-28 drop-shadow-[0_0_20px_rgba(127,240,4,.5)]'} />;
}

function PhotoField({ label, value, onChange, capture }: { label: string; value: string; onChange: (v: string) => void; capture?: 'user' | 'environment' }) {
  const [busy, setBusy] = useState(false);
  return (
    <label className="block">
      <span className="label">{label}</span>
      <div className="flex h-32 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-white/20 bg-white/5">
        {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : (
          <span className="flex flex-col items-center gap-1 text-sm text-white/60"><Camera />{busy ? 'Processing...' : 'Tap to take or choose a photo'}</span>
        )}
      </div>
      <input type="file" accept="image/*" capture={capture} className="hidden" onChange={async (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        setBusy(true); try { onChange(await compressImage(f)); } finally { setBusy(false); }
      }} />
    </label>
  );
}

/** Email one-time code, then real name, mobile number and a valid ID with a selfie. */
export function Auth({ be, role, onSignedIn }: { be: Backend; role: Role; onSignedIn: (id: string) => void }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (f: () => Promise<void>) => { setErr(''); setBusy(true); try { await f(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };

  return (
    <div className="flex min-h-full flex-col justify-center gap-6 p-6 pt-safe pb-safe">
      <Logo />
      <div className="text-center">
        <h1 className="font-brand text-3xl italic">Fetch <span className="text-neon">GenSan</span>{role === 'driver' && <span className="ml-2 align-middle text-sm not-italic text-lime">DRIVER</span>}</h1>
        <p className="mt-1 text-white/60">{role === 'driver' ? 'Drive, deliver and set your own rates.' : 'Ride. Pabili. Deliver. Sa GenSan ug tibuok Mindanao.'}</p>
      </div>
      {step === 'email' ? (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(async () => { await be.sendCode(email.trim()); setStep('code'); }); }}>
          <label className="label" htmlFor="email">Email address</label>
          <div className="relative"><Mail className="absolute left-4 top-3.5 h-5 w-5 text-white/40" />
            <input id="email" className="input pl-12" type="email" required autoComplete="email" placeholder="juan@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <button className="btn-neon w-full" disabled={busy}>Send my login code <ArrowRight className="h-5 w-5" /></button>
        </form>
      ) : (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(async () => onSignedIn(await be.verifyCode(email.trim(), code.trim()))); }}>
          <label className="label" htmlFor="code">6-digit code sent to {email}</label>
          <input id="code" className="input text-center text-2xl tracking-[.5em]" inputMode="numeric" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          {be.mode === 'demo' && <p className="text-xs text-lime">Demo mode: type any 6 digits, for example 123456.</p>}
          <button className="btn-neon w-full" disabled={busy || code.length !== 6}>Log in</button>
          <button type="button" className="w-full text-sm text-white/60" onClick={() => setStep('email')}>Use a different email</button>
        </form>
      )}
      {err && <p className="rounded-xl bg-red-500/20 p-3 text-sm text-red-200">{err}</p>}
    </div>
  );
}

export function ProfileForm({ be, id, role, email, initial, onSaved }: { be: Backend; id: string; role: Role; email: string; initial?: Profile | null; onSaved: (p: Profile) => void }) {
  const [p, setP] = useState<Profile>(initial ?? { id, role, email, fullName: '', phone: '', idType: ID_TYPES[0], idPhoto: '', selfie: '', verified: 'pending', createdAt: Date.now() });
  const [err, setErr] = useState('');
  const phoneOk = /^(09|\+639)\d{9}$/.test(p.phone.replace(/[\s-]/g, ''));
  const nameOk = p.fullName.trim().split(/\s+/).length >= 2;
  const ok = phoneOk && nameOk && p.idPhoto && p.selfie;
  return (
    <form className="space-y-4 p-6 pt-safe pb-safe" onSubmit={async (e) => {
      e.preventDefault();
      if (!ok) return;
      try {
        const saved = { ...p, phone: p.phone.replace(/[\s-]/g, ''), fullName: p.fullName.trim(), verified: be.mode === 'demo' ? 'approved' as const : p.verified };
        await be.put('profiles', saved); onSaved(saved);
      } catch (x) { setErr((x as Error).message); }
    }}>
      <div className="flex items-center gap-3"><ShieldCheck className="h-8 w-8 text-neon" /><div><h2 className="text-xl font-extrabold">Verify your identity</h2><p className="text-sm text-white/60">Every {role === 'driver' ? 'driver' : 'customer'} is verified. This keeps everyone safe.</p></div></div>
      <div><label className="label" htmlFor="fn">Full real name (as on your ID)</label><input id="fn" className="input" required value={p.fullName} onChange={(e) => setP({ ...p, fullName: e.target.value })} placeholder="Juan Dela Cruz" />
        {p.fullName && !nameOk && <p className="mt-1 text-xs text-amber-300">Enter your first and last name.</p>}</div>
      <div><label className="label" htmlFor="ph">Mobile number</label><input id="ph" className="input" inputMode="tel" required value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} placeholder="0912 345 6789" />
        {p.phone && !phoneOk && <p className="mt-1 text-xs text-amber-300">Use a PH mobile number like 09123456789.</p>}</div>
      <div><label className="label" htmlFor="idt"><IdCard className="mr-1 inline h-4 w-4" />Valid ID type</label>
        <select id="idt" className="input" value={p.idType} onChange={(e) => setP({ ...p, idType: e.target.value })}>{ID_TYPES.map((t) => <option key={t} className="bg-coal">{t}</option>)}</select></div>
      <PhotoField label="Photo of your valid ID (front)" value={p.idPhoto} onChange={(v) => setP({ ...p, idPhoto: v })} capture="environment" />
      <PhotoField label="Selfie holding your ID" value={p.selfie} onChange={(v) => setP({ ...p, selfie: v })} capture="user" />
      <p className="text-xs text-white/50">Your ID is only seen by the Fetch GenSan verification team. Your name and number are shared with your driver or customer only during a booking.</p>
      {err && <p className="rounded-xl bg-red-500/20 p-3 text-sm text-red-200">{err}</p>}
      <button className="btn-neon w-full" disabled={!ok}>Submit for verification</button>
    </form>
  );
}

export function Pending({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <Logo /><h2 className="text-2xl font-extrabold">We are checking your ID</h2>
      <p className="text-white/70">This usually takes less than a day. We will email you once you are approved.</p>
      <button className="btn-ghost" onClick={onSignOut}>Log out</button>
    </div>
  );
}
