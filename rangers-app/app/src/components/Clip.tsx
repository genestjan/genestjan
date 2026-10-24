import { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, Square, Video } from 'lucide-react';
import { saveMedia, useMediaUrl, type Prepared } from '../lib/media';
import { canRecord, prepareClip, record } from '../lib/clips';
import { CLIP } from '../lib/mediaRules';
import { useAppState } from '../lib/store';

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Plays a stored short video. */
export function ClipView({ path, version = '', gone }: { path: string; version?: string; gone?: string }) {
  const { url, err } = useMediaUrl(path || undefined, version);
  if (!path) return <p className="muted text-sm">{gone ?? 'This video is no longer available.'}</p>;
  if (err) return <p className="muted text-sm">This video could not be opened. Check your connection and try again.</p>;
  if (!url) return <div className="card grid place-items-center p-6 muted">Loading the video...</div>;
  return <video src={url} controls playsInline preload="metadata" className="w-full rounded-card bg-black" style={{ maxHeight: 360 }} aria-label="Video sent in" />;
}

/** Which children of a team may be filmed for how-to videos (their family said yes). */
export function WhoMayBeFilmed({ teamId }: { teamId: string }) {
  const ok = useAppState().players.filter((p) => p.teamId === teamId && !p.left && p.videoConsent).map((p) => p.firstName);
  return <p className="text-sm">{ok.length ? `Children whose families agreed to videos: ${ok.join(', ')}. Film only them, or just yourself.` : 'No family in this team has agreed to videos yet, so film yourself and the cones, not the children.'}</p>;
}

/** Full-screen camera: record up to CLIP.seconds, watch it back, then send or try again. */
function Recorder({ onDone, onClose }: { onDone: (p: Prepared) => void; onClose: () => void }) {
  const live = useRef<HTMLVideoElement>(null); const [stream, setStream] = useState<MediaStream | null>(null);
  const [face, setFace] = useState<'environment' | 'user'>('environment'); const [err, setErr] = useState('');
  const [rec, setRec] = useState<ReturnType<typeof record> | null>(null); const [secs, setSecs] = useState(0);
  const [take, setTake] = useState<Prepared | null>(null); const [takeUrl, setTakeUrl] = useState('');
  useEffect(() => {
    if (take) return; let s: MediaStream | null = null; let dead = false;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: face, width: { ideal: 640 }, height: { ideal: 480 } }, audio: true })
      .then((m) => { if (dead) { m.getTracks().forEach((t) => t.stop()); return; } s = m; setStream(m); if (live.current) live.current.srcObject = m; })
      .catch(() => setErr('The camera could not start. Allow the camera for this site, or use "Choose a video" instead.'));
    return () => { dead = true; s?.getTracks().forEach((t) => t.stop()); };
  }, [face, take]);
  useEffect(() => () => { if (takeUrl) URL.revokeObjectURL(takeUrl); }, [takeUrl]);
  const start = () => { if (!stream) return; setSecs(0); const r = record(stream, setSecs); setRec(r); void r.done.then((p) => { setRec(null); setTake(p); setTakeUrl(URL.createObjectURL(p.blob)); }); };
  return (
    <div className="fixed inset-0 z-50 flex flex-col gap-3 overflow-y-auto p-3" style={{ background: 'var(--bg)', paddingTop: 'max(12px, env(safe-area-inset-top))' }} role="dialog" aria-label="Record a video">
      <div className="flex items-center justify-between"><b className="text-lg">Record a video</b><span className="muted text-sm">Up to {CLIP.seconds} seconds</span></div>
      {err ? <p role="alert" className="card p-4">{err}</p>
        : take ? <video src={takeUrl} controls playsInline className="w-full rounded-card bg-black" style={{ maxHeight: '60vh' }} aria-label="Your recording" />
        : <div className="relative"><video ref={live} autoPlay muted playsInline className="w-full rounded-card bg-black" style={{ maxHeight: '60vh', transform: face === 'user' ? 'scaleX(-1)' : undefined }} aria-label="Camera" />
            {rec && <span className="absolute left-3 top-3 rounded-full bg-red px-3 py-1 font-bold text-white">● {mmss(secs)} / {mmss(CLIP.seconds)}</span>}</div>}
      {!err && !take && (rec
        ? <button className="btn h-14" onClick={rec.stop}><Square size={20} aria-hidden="true" />Stop</button>
        : <div className="grid grid-cols-[1fr_auto] gap-2"><button className="btn h-14" disabled={!stream} onClick={start}><Video size={20} aria-hidden="true" />Start recording</button>
            <button className="btn ghost h-14" aria-label="Turn the camera around" onClick={() => setFace(face === 'user' ? 'environment' : 'user')}><RefreshCw size={20} aria-hidden="true" /></button></div>)}
      {take && <div className="grid grid-cols-2 gap-2"><button className="btn ghost h-14" onClick={() => { setTake(null); setTakeUrl(''); }}>Record again</button><button className="btn h-14" onClick={() => onDone(take)}>Send this video</button></div>}
      {!rec && <button className="btn ghost" onClick={onClose}>Cancel</button>}
    </div>
  );
}

/** Two buttons: record a short video in the app, or choose one from the phone (shrunk here if it is big). Returns the stored path. */
export function ClipPicker({ label = 'Add a video', pathFor, onSaved, disabled, ghost = true }: { label?: string; pathFor: (p: Prepared) => string; onSaved: (path: string) => void; disabled?: boolean; ghost?: boolean }) {
  const ref = useRef<HTMLInputElement>(null); const [busy, setBusy] = useState(''); const [err, setErr] = useState(''); const [open, setOpen] = useState(false);
  const save = async (p: Prepared) => { setBusy('Sending... please wait'); try { onSaved(await saveMedia(p, pathFor(p))); } catch (e) { setErr((e as Error).message); } setBusy(''); };
  const pick = async (f: File | undefined) => {
    if (!f) return; setErr(''); setBusy('Checking the video...');
    try { const p = await prepareClip(f, (s, of) => setBusy(`Making the video smaller... ${Math.round(s)} of ${Math.round(of)} seconds`)); await save(p); }
    catch (e) { setErr((e as Error).message); setBusy(''); }
    if (ref.current) ref.current.value = '';
  };
  const rec = canRecord();
  return (
    <div className="grid gap-1">
      <input ref={ref} type="file" accept="video/*" className="sr-only" aria-label={`Choose a video: ${label}`} onChange={(e) => void pick(e.target.files?.[0])} />
      <div className={`grid gap-2 ${rec ? 'grid-cols-2' : ''}`}>
        {rec && <button className={`btn ${ghost ? 'ghost' : ''}`} disabled={!!busy || disabled} onClick={() => { setErr(''); setOpen(true); }}><Camera size={18} aria-hidden="true" />Record a video</button>}
        <button className={`btn ${ghost ? 'ghost' : ''}`} disabled={!!busy || disabled} onClick={() => ref.current?.click()}><Video size={18} aria-hidden="true" />{rec ? 'Choose a video' : label}</button>
      </div>
      {busy && <p role="status" className="text-sm">{busy}</p>}
      {err && <p role="alert" className="text-sm text-red">{err}</p>}
      <p className="muted text-xs">Videos: up to {CLIP.seconds} seconds. The app makes them small to save data.</p>
      {open && <Recorder onClose={() => setOpen(false)} onDone={(p) => { setOpen(false); void save(p); }} />}
    </div>
  );
}
