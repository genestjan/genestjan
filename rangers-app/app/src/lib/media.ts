import { useEffect, useState } from 'react';
import { cloudEnabled, sb } from './cloud';
import { db } from './store';
import { checkMedia, fitImage, MAX_VIDEO_BYTES } from './mediaRules';

export const BUCKET = 'media';
const LOCAL = 'local:';

export interface Prepared { blob: Blob; kind: 'image' | 'video'; ext: string }
/** Checks a chosen file; photos are shrunk on the device before they are sent (saves a child's mobile data). */
export async function prepare(file: File, maxVideo = MAX_VIDEO_BYTES): Promise<Prepared> {
  const c = checkMedia(file, maxVideo);
  if (!c.ok) throw new Error(c.reason);
  if (c.kind === 'video') return { blob: file, kind: 'video', ext: c.ext };
  try {
    const bmp = await createImageBitmap(file);
    const { w, h } = fitImage(bmp.width, bmp.height);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    cv.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, 'image/jpeg', 0.8));
    if (blob) return { blob, kind: 'image', ext: 'jpg' };
  } catch { /* some browsers cannot read HEIC photos: handled below */ }
  if (/heic|heif/i.test(file.type)) throw new Error('This phone saved the photo as HEIC, which cannot be sent. Take a screenshot of the photo and send that, or set the camera to "Most compatible".');
  if (file.size > 10 * 1024 * 1024) throw new Error('That photo is too large and could not be shrunk. Take a new photo with the camera.');
  return { blob: file, kind: 'image', ext: 'jpg' };
}

/** Saves to Supabase Storage when accounts are on, otherwise on this phone. Returns the path to keep on the record. */
export async function saveMedia(p: Prepared, path: string): Promise<string> {
  if (!cloudEnabled) { const id = crypto.randomUUID(); await db.media.put({ id, blob: p.blob }); return LOCAL + id; }
  if (!navigator.onLine) throw new Error('You need an internet connection to send a photo or video. Try again when you have signal.');
  const c = await sb();
  const { error } = await c.storage.from(BUCKET).upload(path, p.blob, { contentType: p.blob.type || (p.kind === 'video' ? 'video/mp4' : 'image/jpeg'), upsert: true });
  if (error) throw new Error(`Could not upload: ${error.message}`);
  return path;
}

/** Deletes stored files (best effort: a file that is already gone is fine). */
export async function removeMedia(paths: string[]) {
  const local = paths.filter((p) => p.startsWith(LOCAL)).map((p) => p.slice(LOCAL.length)); const remote = paths.filter((p) => p && !p.startsWith(LOCAL));
  if (local.length) await db.media.bulkDelete(local).catch(() => undefined);
  if (remote.length && cloudEnabled && navigator.onLine) { const c = await sb(); const { error } = await c.storage.from(BUCKET).remove(remote); if (error) throw new Error(error.message); }
}

export async function mediaUrl(path: string): Promise<string> {
  if (path.startsWith(LOCAL)) { const r = await db.media.get(path.slice(LOCAL.length)); if (!r) throw new Error('missing'); return URL.createObjectURL(r.blob); }
  const c = await sb();
  const { data, error } = await c.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error || !data) throw new Error(error?.message ?? 'missing');
  return data.signedUrl;
}

/** Resolves a stored path to something an <img> or <video> can show. */
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
