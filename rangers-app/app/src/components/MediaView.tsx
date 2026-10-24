import { useRef, useState } from 'react';
import { prepare, saveMedia, useMediaUrl, type Prepared } from '../lib/media';

/** Shows a stored photo or video. */
export function MediaView({ path, kind, version = '', className = '' }: { path: string; kind: 'image' | 'video'; version?: string; className?: string }) {
  const { url, err } = useMediaUrl(path || undefined, version);
  if (!path) return <p className="muted text-sm">The video was removed to save space after the coach approved it.</p>;
  if (err) return <p className="muted text-sm">This file could not be opened. Check your connection and try again.</p>;
  if (!url) return <div className={`card grid place-items-center p-6 muted ${className}`}>Loading...</div>;
  return kind === 'video'
    ? <video src={url} controls playsInline preload="metadata" className={`w-full rounded-card bg-black ${className}`} style={{ maxHeight: 360 }} />
    : <img src={url} alt="Photo sent in" className={`w-full rounded-card object-contain ${className}`} style={{ maxHeight: 360 }} />;
}

/** One button that opens the phone's camera or gallery, checks and shrinks the file, uploads it, and returns the stored path. */
export function MediaPicker({ label, pathFor, onSaved, accept = 'image/*,video/*', disabled, maxVideoBytes }: {
  label: string; pathFor: (p: Prepared) => string; onSaved: (path: string, kind: 'image' | 'video') => void; accept?: string; disabled?: boolean; maxVideoBytes?: number;
}) {
  const ref = useRef<HTMLInputElement>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const pick = async (f: File | undefined) => {
    if (!f) return; setErr(''); setBusy(true);
    try { const p = await prepare(f, maxVideoBytes); const path = await saveMedia(p, pathFor(p)); onSaved(path, p.kind); }
    catch (e) { setErr((e as Error).message); }
    setBusy(false); if (ref.current) ref.current.value = '';
  };
  return (
    <div className="grid gap-1">
      <input ref={ref} type="file" accept={accept} className="sr-only" aria-label={label} onChange={(e) => void pick(e.target.files?.[0])} />
      <button className="btn" disabled={busy || disabled} onClick={() => ref.current?.click()}>{busy ? 'Sending... please wait' : label}</button>
      {err && <p role="alert" className="text-sm text-red">{err}</p>}
    </div>
  );
}
