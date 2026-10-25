import { useEffect, useState } from 'react';
import { cloudEnabled, sb, useCloud } from './cloud';
import { db, put, useAppState } from './store';
import { checkMedia, clipsToDelete, fitImage, isClipPath, JPEG_STEPS, MAX_IMAGE_EDGE, MAX_UPLOAD_BYTES, TARGET_IMAGE_BYTES } from './mediaRules';

export const BUCKET = 'media';
/** Short videos live in their own private bucket, which has a size cap for the whole club. */
export const CLIP_BUCKET = 'clips';
const bucketOf = (path: string) => (isClipPath(path) ? CLIP_BUCKET : BUCKET);
const LOCAL = 'local:';

export interface Prepared { blob: Blob; ext: 'jpg' | 'mp4' | 'webm' | 'mov'; type?: string }
const HEIC = 'This phone saved the photo in a format that cannot be sent. Take a screenshot of the photo and send that, or set the camera to "Most compatible".';
/** Checks a chosen photo and shrinks it on the phone (saves the family's mobile data and the club's storage). */
export async function prepare(file: File, opts: { edge?: number; target?: number } = {}): Promise<Prepared> {
  const c = checkMedia(file);
  if (!c.ok) throw new Error(c.reason);
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(file); } catch { throw new Error(/heic|heif/i.test(file.type) ? HEIC : 'This photo could not be opened. Take a new photo with the camera.'); }
  const cv = document.createElement('canvas'); let edge = opts.edge ?? MAX_IMAGE_EDGE; const target = opts.target ?? TARGET_IMAGE_BYTES; let last: Blob | null = null;
  for (let round = 0; round < 3; round++, edge = Math.round(edge * 0.75)) {
    const { w, h } = fitImage(bmp.width, bmp.height, edge); cv.width = w; cv.height = h;
    cv.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
    for (const q of JPEG_STEPS) {
      last = await new Promise<Blob | null>((r) => cv.toBlob(r, 'image/jpeg', q));
      if (last && last.size <= target) return { blob: last, ext: 'jpg' };
    }
  }
  if (last && last.size <= MAX_UPLOAD_BYTES) return { blob: last, ext: 'jpg' };
  throw new Error('This photo could not be made small enough. Take a new photo with the camera.');
}

/** Saves to Supabase Storage when accounts are on, otherwise on this phone. Returns the path to keep on the record. */
export async function saveMedia(p: Prepared, path: string): Promise<string> {
  if (!cloudEnabled) { const id = crypto.randomUUID(); await db.media.put({ id, blob: p.blob }); return LOCAL + id; }
  const video = p.ext !== 'jpg';
  if (!navigator.onLine) throw new Error(`You need an internet connection to send a ${video ? 'video' : 'photo'}. Try again when you have signal.`);
  const c = await sb();
  if (video) {   // the club's video space is shared and capped: say so plainly instead of failing half way
    const { data, error } = await c.rpc('clips_room');
    if (error) throw new Error(/could not find the function|schema cache/i.test(error.message) ? 'Videos are not switched on yet. The club admin needs to run the latest update.sql in Supabase.' : `Could not check the video space: ${error.message}`);
    if ((data as number) < p.blob.size) throw new Error('The club\'s video space is full right now. Please send a photo instead, and tell the club admin.');
  }
  const { error } = await c.storage.from(bucketOf(path)).upload(path, p.blob, { contentType: p.type ?? 'image/jpeg', upsert: true });
  if (error) throw new Error(/row-level security|violates|unauthorized|not allowed/i.test(error.message) ? 'This could not be saved yet. If this is a new part of the app, the club admin needs to run the latest update.sql in Supabase.' : `Could not upload: ${error.message}`);
  return path;
}

/** Deletes stored files (best effort: a file that is already gone is fine). */
export async function removeMedia(paths: string[]) {
  const local = paths.filter((p) => p.startsWith(LOCAL)).map((p) => p.slice(LOCAL.length)); const remote = paths.filter((p) => p && !p.startsWith(LOCAL));
  if (local.length) await db.media.bulkDelete(local).catch(() => undefined);
  if (remote.length && cloudEnabled && navigator.onLine) {
    const c = await sb();
    for (const b of [BUCKET, CLIP_BUCKET]) { const mine = remote.filter((x) => bucketOf(x) === b); if (!mine.length) continue; const { error } = await c.storage.from(b).remove(mine); if (error) throw new Error(error.message); }
  }
}

export async function mediaUrl(path: string): Promise<string> {
  if (path.startsWith(LOCAL)) { const r = await db.media.get(path.slice(LOCAL.length)); if (!r) throw new Error('missing'); return URL.createObjectURL(r.blob); }
  const c = await sb();
  const { data, error } = await c.storage.from(bucketOf(path)).createSignedUrl(path, 3600);
  if (error || !data) throw new Error(error?.message ?? 'missing');
  return data.signedUrl;
}

/** Resolves a stored path to something an <img> can show. */
export function useMediaUrl(path: string | undefined, version = '') {
  const [url, setUrl] = useState(''); const [err, setErr] = useState(false);
  useEffect(() => {
    let dead = false; let made = '';
    setUrl(''); setErr(false);
    if (path) void mediaUrl(path).then((u) => { made = u; if (!dead) setUrl(u); else if (u.startsWith('blob:')) URL.revokeObjectURL(u); }).catch(() => !dead && setErr(true));
    return () => { dead = true; if (made.startsWith('blob:')) URL.revokeObjectURL(made); };
  }, [path, version]);
  return { url, err };
}

/** Children's videos are deleted CLIP.keepDays after the coach checks them, by the next coach's phone that opens the app.
 *  Keeps the club's free video space free. The record stays (with its status and comment); only the file goes. */
export function useClipCleanup(staff: boolean) {
  const subs = useAppState().submissions; const c = useCloud();
  useEffect(() => {
    if (!staff || (cloudEnabled && c.status !== 'ready')) return;
    const due = clipsToDelete(subs, Date.now()); if (!due.length) return;
    void removeMedia(due.map((x) => x.mediaPath)).then(() => due.forEach((x) => put('submissions', { ...x, mediaPath: '' }))).catch(() => undefined);
  }, [staff, c.status, subs]);
}
