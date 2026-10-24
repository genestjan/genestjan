/** What the app accepts: photos only (videos would fill the free 1 GB of storage quickly). Pure, so it is unit tested;
 *  the storage bucket enforces the same (images only, 2 MB). Coaches share how-to videos as YouTube links instead. */
export const MAX_IMAGE_EDGE = 1280;
export const TARGET_IMAGE_BYTES = 350 * 1024;      // a shrunk photo should end up under this
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;   // the storage bucket refuses anything larger
export const JPEG_STEPS = [0.8, 0.7, 0.6, 0.5];    // quality tried in turn until the photo is small enough
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export type MediaCheck = { ok: true } | { ok: false; reason: string };
export function checkMedia(f: { type: string; size: number }): MediaCheck {
  const t = (f.type || '').toLowerCase();
  if (IMAGE_TYPES.includes(t)) return { ok: true };
  if (t.startsWith('video/')) return { ok: false, reason: 'Videos cannot be sent. Please take a photo of the task instead.' };
  return { ok: false, reason: 'Please choose a photo from your phone.' };
}
/** New size so the longest side fits the edge (never enlarges). */
export function fitImage(w: number, h: number, edge = MAX_IMAGE_EDGE): { w: number; h: number } {
  const k = Math.min(1, edge / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}
/** Storage paths: a child's proofs live under p/<childId>/, a coach's photos under t/<teamId>/. */
export const proofPath = (playerId: string, id: string) => `p/${playerId}/${id}.jpg`;
export const teamPhotoPath = (teamId: string, id: string) => `t/${teamId}/${id}.jpg`;

/** The 11-character id from any usual YouTube address (watch, youtu.be, shorts, embed, live), or '' if it is not one. */
export function youtubeId(url: string): string {
  try {
    const u = new URL(url.trim()); const host = u.hostname.replace(/^(www|m)\./, ''); let id = '';
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.pathname === '/watch') id = u.searchParams.get('v') ?? '';
      else id = u.pathname.match(/^\/(shorts|embed|live)\/([^/?#]+)/)?.[2] ?? '';
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
  } catch { return ''; }
}
