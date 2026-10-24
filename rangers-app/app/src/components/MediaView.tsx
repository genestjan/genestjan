import { useRef, useState } from 'react';
import { prepare, saveMedia, useMediaUrl, type Prepared } from '../lib/media';

/** Shows a stored photo. */
export function MediaView({ path, version = '', className = '' }: { path: string; version?: string; className?: string }) {
  const { url, err } = useMediaUrl(path || undefined, version);
  if (!path) return <p className="muted text-sm">This photo is no longer available.</p>;
  if (err) return <p className="muted text-sm">This photo could not be opened. Check your connection and try again.</p>;
  if (!url) return <div className={`card grid place-items-center p-6 muted ${className}`}>Loading...</div>;
  return <img src={url} alt="Photo sent in" className={`w-full rounded-card object-contain ${className}`} style={{ maxHeight: 360 }} />;
}

/** A coach's how-to video, played from YouTube's privacy-friendly address (no tracking cookies until it plays). */
export function YouTube({ id }: { id: string }) {
  return (
    <div className="aspect-video w-full overflow-hidden rounded-card bg-black">
      <iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1`} title="How-to video" loading="lazy"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
    </div>
  );
}

/** One button that opens the phone's camera or photos, checks and shrinks the photo, uploads it, and returns the stored path. */
export function MediaPicker({ label, pathFor, onSaved, disabled, quality, ghost }: { label: string; pathFor: (p: Prepared) => string; onSaved: (path: string) => void; disabled?: boolean; quality?: { edge?: number; target?: number }; ghost?: boolean }) {
  const ref = useRef<HTMLInputElement>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const pick = async (f: File | undefined) => {
    if (!f) return; setErr(''); setBusy(true);
    try { const p = await prepare(f, quality); const path = await saveMedia(p, pathFor(p)); onSaved(path); }
    catch (e) { setErr((e as Error).message); }
    setBusy(false); if (ref.current) ref.current.value = '';
  };
  return (
    <div className="grid gap-1">
      <input ref={ref} type="file" accept="image/*" className="sr-only" aria-label={label} onChange={(e) => void pick(e.target.files?.[0])} />
      <button className={`btn ${ghost ? 'ghost' : ''}`} disabled={busy || disabled} onClick={() => ref.current?.click()}>{busy ? 'Sending... please wait' : label}</button>
      {err && <p role="alert" className="text-sm text-red">{err}</p>}
    </div>
  );
}
