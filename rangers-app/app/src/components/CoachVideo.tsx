import { useEffect, useRef, useState } from 'react';
import { CloudUpload, ExternalLink, PlayCircle } from 'lucide-react';
import { YouTube } from './MediaView';
import { ClipPicker, ClipView } from './Clip';
import { accessToken, cloudEnabled, useCloud } from '../lib/cloud';
import { useAppState } from '../lib/store';
import { removeMedia, type Prepared } from '../lib/media';
import { youtubeId } from '../lib/mediaRules';
import { canShrinkLong, LONG, shrinkLong, shrunkMb, videoSeconds } from '../lib/clips';
import { driveOpen, drivePlayer, driveRemove, driveUpload, isDriveScriptUrl, scriptSender, uploadMb } from '../lib/drive';
import type { VideoRef } from '../lib/model';

/** The club's video storage in Google Drive, when the admin has set it up and this phone is signed in. */
export function useDrive() {
  const url = useAppState().settings.driveUrl ?? ''; const c = useCloud();
  return cloudEnabled && c.status === 'ready' && isDriveScriptUrl(url) ? url : '';
}
export async function removeCoachVideo(v: VideoRef | undefined, driveUrl: string) {
  if (!v) return;
  if (v.clip) await removeMedia([v.clip]).catch(() => undefined);
  if (v.drive) { if (!driveUrl) throw new Error('The club video storage is not set up on this phone.'); await driveRemove(scriptSender(driveUrl), await accessToken(), v.drive); }
}

/** Plays a coach's video. Drive and YouTube videos load only when tapped, to save the family's data. */
export function CoachVideo({ v, lazy = true }: { v: VideoRef; lazy?: boolean }) {
  const [on, setOn] = useState(!lazy);
  if (v.clip) return <ClipView path={v.clip} />;
  if (!on) return <button className="btn ghost" onClick={() => setOn(true)}><PlayCircle size={20} aria-hidden="true" />Play video</button>;
  if (v.youtube) return <YouTube id={v.youtube} />;
  if (v.drive) return (
    <div className="grid gap-1">
      <div className="aspect-video w-full overflow-hidden rounded-card bg-black">
        <iframe className="h-full w-full" src={drivePlayer(v.drive)} title="Coach video" allow="autoplay; fullscreen" allowFullScreen />
      </div>
      <p className="muted text-xs">Just added? Google may need a few minutes to get it ready. <a className="underline" href={driveOpen(v.drive)} target="_blank" rel="noreferrer">Open in Google Drive<ExternalLink size={12} className="ml-1 inline" aria-hidden="true" /></a></p>
    </div>);
  return null;
}

/** Choose a coach's video: upload from the phone to the club's Google Drive (any length), a short video, or a YouTube link. */
export function VideoPicker({ value, onChange, clipPathFor, onBusy }: { value?: VideoRef; onChange: (v: VideoRef | undefined) => void; clipPathFor?: (p: Prepared) => string; onBusy?: (busy: boolean) => void }) {
  const driveUrl = useDrive(); const ref = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null); const [secs, setSecs] = useState(0);
  const [busy, setBusy] = useState(''); const [pct, setPct] = useState(0); const [err, setErr] = useState(''); const [yt, setYt] = useState('');
  const stop = useRef({ stop: false });
  useEffect(() => { onBusy?.(!!busy); }, [busy, onBusy]);
  useEffect(() => () => { stop.current.stop = true; }, []);
  const send = async (f: Blob, ext: string) => {
    setErr(''); stop.current = { stop: false }; setPct(0); setBusy('Sending the video to the club\'s Google Drive...');
    try { const id = await driveUpload(scriptSender(driveUrl), f, { token: await accessToken(), ext, onProgress: setPct, signal: stop.current }); setFile(null); onChange({ drive: id }); }
    catch (e) { setErr((e as Error).message); }
    setBusy('');
  };
  const choose = async (f: File | undefined) => {
    if (ref.current) ref.current.value = ''; if (!f) return; setErr('');
    if (!f.type.startsWith('video/')) { setErr('Please choose a video.'); return; }
    const s = await videoSeconds(f); setSecs(s);
    // big files on mobile data: offer to make it smaller first; small ones go straight away
    if (canShrinkLong() && s > 0 && s <= LONG.seconds && f.size > 40 * 1048576) setFile(f);
    else void send(f, ext(f));
  };
  const shrinkThenSend = async (f: File) => {
    setErr(''); setBusy('Making the video smaller...');
    try { const p = await shrinkLong(f, (a, of) => setBusy(`Making the video smaller... ${Math.round(a)} of ${Math.round(of)} seconds. Keep the app open.`)); await send(p.blob, p.ext); }
    catch (e) { setErr((e as Error).message); setBusy(''); }
  };
  const ext = (f: Blob) => (f.type.includes('webm') ? 'webm' : f.type.includes('quicktime') ? 'mov' : 'mp4');
  const remove = async () => {
    if (!value || !confirm('Remove this video?')) return; setErr('');
    try { await removeCoachVideo(value, driveUrl); onChange(undefined); } catch (e) { setErr((e as Error).message); }
  };
  if (value) return (<div className="grid gap-2"><CoachVideo v={value} lazy={false} /><button className="btn ghost" onClick={() => void remove()}>Remove the video</button>{err && <p role="alert" className="text-sm text-red">{err}</p>}</div>);
  return (
    <div className="grid gap-3">
      {driveUrl ? (<div className="grid gap-2">
        <input ref={ref} type="file" accept="video/*" className="sr-only" aria-label="Upload a video from this phone" onChange={(e) => void choose(e.target.files?.[0])} />
        {!busy && !file && <button className="btn" onClick={() => ref.current?.click()}><CloudUpload size={18} aria-hidden="true" />Upload a video from this phone</button>}
        {file && !busy && (<div className="card grid gap-2 p-3 text-sm">
          <p>This video is {Math.round(file.size / 1048576)} MB{secs ? ` and ${Math.round(secs / 60) || 1} min long` : ''}. Sending it as it is uses about {uploadMb(file.size)} MB of data.</p>
          <button className="btn" onClick={() => void shrinkThenSend(file)}>Make it smaller first (about {uploadMb(shrunkMb(secs) * 1048576)} MB, takes {Math.ceil(secs / 60)} min)</button>
          <button className="btn ghost" onClick={() => void send(file, ext(file))}>Send as it is (best on Wi-Fi)</button>
          <button className="btn ghost" onClick={() => setFile(null)}>Cancel</button></div>)}
        {busy && (<div className="grid gap-1" role="status"><p className="text-sm">{busy}</p>
          {busy.startsWith('Sending') && <><div className="h-3 overflow-hidden rounded-full" style={{ background: 'var(--line)' }}><div className="h-full bg-gold" style={{ width: `${Math.round(pct * 100)}%` }} /></div>
            <p className="muted text-xs">{Math.round(pct * 100)}% sent. Keep the app open until it finishes.</p></>}
          <button className="btn ghost" onClick={() => { stop.current.stop = true; }}>Stop</button></div>)}
        <p className="muted text-xs">Any length. Stored free in the club's Google Drive, plays here in the app.</p>
      </div>) : (cloudEnabled && <p className="muted text-sm">Uploading longer videos is not switched on yet: the club admin sets it up once in Settings (free, uses the club's Google Drive).</p>)}
      {err && <p role="alert" className="text-sm text-red">{err}</p>}
      {!busy && clipPathFor && <div className="grid gap-1"><p className="text-sm font-semibold">{driveUrl ? 'Or a short video (up to 30 seconds)' : 'A short video (up to 30 seconds)'}</p><ClipPicker pathFor={clipPathFor} onSaved={(p) => onChange({ clip: p })} /></div>}
      {!busy && <label className="grid gap-1 text-sm font-semibold">Or paste a YouTube link
        <input className="field" inputMode="url" placeholder="https://youtu.be/..." value={yt} onChange={(e) => { setYt(e.target.value); const id = youtubeId(e.target.value); if (id) { onChange({ youtube: id }); setYt(''); } }} /></label>}
      {yt.trim() && !youtubeId(yt) && <p className="text-sm text-red" role="alert">That is not a YouTube video link. In YouTube tap Share, then Copy link.</p>}
    </div>
  );
}
