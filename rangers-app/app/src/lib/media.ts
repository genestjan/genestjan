import { useEffect, useState } from 'react';
import { cloudEnabled, sb } from './cloud';
import { db } from './store';
import { checkMedia, fitImage, JPEG_STEPS, MAX_IMAGE_EDGE, MAX_UPLOAD_BYTES, TARGET_IMAGE_BYTES } from './mediaRules';

export const BUCKET = 'media';
const LOCAL = 'local:';

export interface Prepared { blob: Blob; ext: 'jpg' }
const HEIC = 'This phone saved the photo in a format that cannot be sent. Take a screenshot of the photo and send that, or set the camera to "Most compatible".';
/** Checks a chosen photo and shrinks it on the phone (saves the family's mobile data and the club's storage). */
export async function prepare(file: File): Promise<Prepared> {
  const c = checkMedia(file);
  if (!c.ok) throw new Error(c.reason);
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(file); } catch { throw new Error(/heic|heif/i.test(file.type) ? HEIC : 'This photo could not be opened. Take a new photo with the camera.'); }
  const cv = document.createElement('canvas'); let edge = MAX_IMAGE_EDGE; let last: Blob | null = null;
  for (let round = 0; round < 3; round++, edge = Math.round(edge * 0.75)) {
    const { w, h } = fitImage(bmp.width, bmp.height, edge); cv.width = w; cv.height = h;
    cv.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
    for (const q of JPEG_STEPS) {
      last = await new Promise<Blob | null>((r) => cv.toBlob(r, 'image/jpeg', q));
      if (last && last.size <= TARGET_IMAGE_BYTES) return { blob: last, ext: 'jpg' };
    }
  }
  if (last && last.size <= MAX_UPLOAD_BYTES) return { blob: last, ext: 'jpg' };
  throw new Error('This photo could not be made small enough. Take a new photo with the camera.');
}

/** Saves to Supabase Storage when accounts are on, otherwise on this phone. Returns the path to keep on the record. */
export async function saveMedia(p: Prepared, path: string): Promise<string> {
  if (!cloudEnabled) { const id = crypto.randomUUID(); await db.media.put({ id, blob: p.blob }); return LOCAL + id; }
  if (!navigator.onLine) throw new Error('You need an internet connection to send a photo. Try again when you have signal.');
  const c = await sb();
  const { error } = await c.storage.from(BUCKET).upload(path, p.blob, { contentType: 'image/jpeg', upsert: true });
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
