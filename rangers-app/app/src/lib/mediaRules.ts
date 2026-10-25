/** What the app accepts. Photos are shrunk on the phone. Videos are short clips (30 seconds, shrunk on the phone) kept in a
 *  separate private bucket with a total cap, so the free 1 GB of storage never fills; longer videos go on YouTube.
 *  Pure, so it is unit tested; the storage buckets enforce the same limits. */
export const MAX_IMAGE_EDGE = 1280;
export const TARGET_IMAGE_BYTES = 350 * 1024;      // a shrunk photo should end up under this
/** ID papers (student ID, PSA birth certificate) keep more detail so the print stays readable. */
export const DOC_IMAGE = { edge: 2000, target: 900 * 1024 };
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;   // the storage bucket refuses anything larger
export const JPEG_STEPS = [0.8, 0.7, 0.6, 0.5];    // quality tried in turn until the photo is small enough
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export type MediaCheck = { ok: true } | { ok: false; reason: string };
export function checkMedia(f: { type: string; size: number }): MediaCheck {
  const t = (f.type || '').toLowerCase();
  if (IMAGE_TYPES.includes(t)) return { ok: true };
  if (t.startsWith('video/')) return { ok: false, reason: 'This is a video. Tap "Add a video" to send a video instead.' };
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
export type DocKind = 'studentId' | 'birthCert';
export const DOC_LABEL: Record<DocKind, string> = { studentId: 'Student ID', birthCert: 'PSA birth certificate (formerly NSO)' };
/** One fixed file per child and document, so a new photo replaces the old one. */
export const docPath = (playerId: string, kind: DocKind) => `p/${playerId}/doc-${kind === 'studentId' ? 'student-id' : 'birth-cert'}.jpg`;

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

/** Short videos: recorded or shrunk on the phone. About 3 MB for 30 seconds at these settings. */
export const CLIP = { seconds: 30, videoBits: 700_000, audioBits: 64_000, maxBytes: 5 * 1024 * 1024, edge: 640, keepDays: 14 };
export const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
export type ClipPlan = { do: 'send' } | { do: 'shrink' } | { do: 'refuse'; reason: string };
/** A video chosen from the phone: send it as it is (small and short), shrink it on the phone first, or explain why not. */
export function planClip(f: { type: string; size: number }, seconds: number, canShrink: boolean): ClipPlan {
  const t = (f.type || '').toLowerCase().split(';')[0];
  if (!t.startsWith('video/')) return { do: 'refuse', reason: 'Please choose a video from your phone.' };
  if (VIDEO_TYPES.includes(t) && f.size <= CLIP.maxBytes && seconds > 0 && seconds <= CLIP.seconds + 0.5) return { do: 'send' };
  if (canShrink) return { do: 'shrink' };
  return { do: 'refuse', reason: `This video is too big to send from this phone. Tap "Record a video" and record it here instead (up to ${CLIP.seconds} seconds).` };
}
/** The best recording format this phone offers: MP4 plays on every phone; WebM is the usual Android fallback. */
export function recorderType(supported: (t: string) => boolean): string {
  for (const t of ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm']) if (supported(t)) return t;
  return '';
}
export const clipExt = (mime: string) => (mime.startsWith('video/mp4') ? 'mp4' : mime.startsWith('video/quicktime') ? 'mov' : 'webm');
export const isClipPath = (path: string) => /\.(mp4|webm|mov)$/i.test(path);
/** A child's video proof (same folder as photos, so the same people may see it) and a coach's how-to clip for a team. */
export const clipPath = (playerId: string, id: string, ext: string) => `p/${playerId}/${id}.${ext}`;
export const teamClipPath = (teamId: string, id: string, ext: string) => `t/${teamId}/${id}.${ext}`;
/** Photos and short videos of a coach's drill: coaches only. */
export const drillPhotoPath = (drillId: string, id: string) => `d/${drillId}/${id}.jpg`;
export const drillClipPath = (drillId: string, id: string, ext: string) => `d/${drillId}/${id}.${ext}`;
/** Children's videos whose time is up: checked by the coach (approved or sent back) more than CLIP.keepDays ago. */
export function clipsToDelete<T extends { mediaType: string; mediaPath: string; status: string; reviewedAt?: string }>(subs: T[], now: number): T[] {
  return subs.filter((x) => x.mediaType === 'video' && x.mediaPath && x.status !== 'submitted' && x.reviewedAt && now - Date.parse(x.reviewedAt) > CLIP.keepDays * 864e5);
}
