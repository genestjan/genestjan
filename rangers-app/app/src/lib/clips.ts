import { CLIP, clipExt, planClip, recorderType } from './mediaRules';
import type { Prepared } from './media';

/** Browser side of short videos: recording with the camera, measuring, and shrinking a video on the phone. */
export const canRecord = () => typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && !!recorderType((t) => MediaRecorder.isTypeSupported(t));
const canShrink = () => typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype && 'captureStream' in HTMLMediaElement.prototype && !!recorderType((t) => MediaRecorder.isTypeSupported(t));
const bestType = () => recorderType((t) => MediaRecorder.isTypeSupported(t));

/** How long a video is, in seconds (0 if the phone cannot tell). */
export function videoSeconds(blob: Blob): Promise<number> {
  return new Promise((ok) => {
    const v = document.createElement('video'); const url = URL.createObjectURL(blob); let done = false;
    const end = (n: number) => { if (done) return; done = true; URL.revokeObjectURL(url); ok(Number.isFinite(n) ? n : 0); };
    v.preload = 'metadata'; v.muted = true;
    v.onloadedmetadata = () => {
      if (Number.isFinite(v.duration)) return end(v.duration);
      // recordings from some phones report no length until the end is reached
      v.ontimeupdate = () => { v.ontimeupdate = null; end(v.duration); }; v.currentTime = 1e9;
    };
    v.onerror = () => end(0); setTimeout(() => end(0), 8000); v.src = url;
  });
}

/** Records a stream at the club's small size; resolves when stop() is called or the time limit is reached. */
export function record(stream: MediaStream, onTick?: (s: number) => void, lim: { seconds: number; videoBits: number } = CLIP) {
  const type = bestType(); const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: lim.videoBits, audioBitsPerSecond: CLIP.audioBits });
  const parts: Blob[] = []; const t0 = Date.now();
  rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
  const tick = setInterval(() => { const s = (Date.now() - t0) / 1000; onTick?.(s); if (s >= lim.seconds) stop(); }, 250);
  const done = new Promise<Prepared>((ok) => { rec.onstop = () => { clearInterval(tick); const mime = (rec.mimeType || type).split(';')[0]; ok({ blob: new Blob(parts, { type: mime }), ext: clipExt(mime) as Prepared['ext'], type: mime }); }; });
  const stop = () => { if (rec.state !== 'inactive') rec.stop(); };
  rec.start(1000);
  return { stop, done };
}

/** Plays the chosen video into a small canvas and records that (in real time), keeping only the first lim.seconds. */
async function shrink(file: File, onProgress?: (s: number, of: number) => void, lim: { seconds: number; edge: number; videoBits: number; maxBytes: number } = CLIP): Promise<Prepared> {
  const v = document.createElement('video'); const url = URL.createObjectURL(file);
  v.src = url; v.muted = true; v.playsInline = true;
  await new Promise<void>((ok, bad) => { v.onloadeddata = () => ok(); v.onerror = () => bad(new Error('This video could not be opened. Record it here in the app instead.')); });
  const k = Math.min(1, lim.edge / Math.max(v.videoWidth || lim.edge, v.videoHeight || lim.edge));
  const cv = document.createElement('canvas'); cv.width = Math.round((v.videoWidth || 640) * k / 2) * 2; cv.height = Math.round((v.videoHeight || 480) * k / 2) * 2;
  const g = cv.getContext('2d')!;
  const out = cv.captureStream(25);
  const audio = (v as HTMLVideoElement & { captureStream(): MediaStream }).captureStream().getAudioTracks();
  audio.forEach((t) => out.addTrack(t));
  const of = Math.min(lim.seconds, Number.isFinite(v.duration) ? v.duration : lim.seconds);
  const r = record(out, undefined, lim);
  let raf = 0; const draw = () => { g.drawImage(v, 0, 0, cv.width, cv.height); onProgress?.(Math.min(v.currentTime, of), of); if (v.currentTime >= of || v.ended) { r.stop(); v.pause(); return; } raf = requestAnimationFrame(draw); };
  await v.play(); draw();
  const res = await r.done; cancelAnimationFrame(raf); URL.revokeObjectURL(url); out.getTracks().forEach((t) => t.stop());
  if (res.blob.size > lim.maxBytes) throw new Error('This video is still too big after shrinking. Record a shorter one here in the app.');
  return res;
}

/** A video chosen from the phone: checked, shrunk if needed, ready to save. */
export async function prepareClip(file: File, onProgress?: (s: number, of: number) => void): Promise<Prepared> {
  const secs = await videoSeconds(file);
  const plan = planClip(file, secs, canShrink());
  if (plan.do === 'refuse') throw new Error(plan.reason);
  if (plan.do === 'send') { const mime = file.type.split(';')[0]; return { blob: file, ext: clipExt(mime) as Prepared['ext'], type: mime }; }
  return shrink(file, onProgress);
}

/** Longer coach videos (for the club's Google Drive): the same shrinking, at a size that still shows a drill clearly. */
export const LONG = { seconds: 15 * 60, edge: 854, videoBits: 900_000, maxBytes: 1024 * 1024 * 1024 };
export const canShrinkLong = canShrink;
export const shrinkLong = (file: File, onProgress?: (s: number, of: number) => void) => shrink(file, onProgress, LONG);
/** Data a shrunk video of this length uses, in MB. */
export const shrunkMb = (seconds: number) => Math.ceil((seconds * (LONG.videoBits + CLIP.audioBits)) / 8 / 1048576);
