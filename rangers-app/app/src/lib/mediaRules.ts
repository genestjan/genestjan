/** What photos and videos the app accepts. Pure, so it is unit tested; the database bucket enforces the same limits. */
export const MAX_VIDEO_BYTES = 20 * 1024 * 1024;        // a child's proof clip: about 15 seconds on most phones
export const MAX_COACH_VIDEO_BYTES = 40 * 1024 * 1024;  // a coach's how-to video (the storage bucket refuses anything larger)
/** Approved proof videos are removed after this many days to stay inside the free 1 GB of storage. Photos are kept. */
export const KEEP_APPROVED_VIDEO_DAYS = 30;
export const MAX_IMAGE_EDGE = 1280;
export const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export type MediaCheck = { ok: true; kind: 'image' | 'video'; ext: string } | { ok: false; reason: string };
export function checkMedia(f: { type: string; size: number; name?: string }, maxVideo = MAX_VIDEO_BYTES): MediaCheck {
  const t = (f.type || '').toLowerCase();
  if (IMAGE_TYPES.includes(t)) return { ok: true, kind: 'image', ext: 'jpg' };
  if (VIDEO_TYPES.includes(t)) {
    if (f.size > maxVideo) return { ok: false, reason: `That video is ${(f.size / 1048576).toFixed(0)} MB. The limit is ${Math.round(maxVideo / 1048576)} MB. Record a shorter clip (about ${maxVideo > MAX_VIDEO_BYTES ? 30 : 15} seconds) or choose a lower video quality in your camera settings.` };
    return { ok: true, kind: 'video', ext: t === 'video/webm' ? 'webm' : t === 'video/quicktime' ? 'mov' : 'mp4' };
  }
  if (t.startsWith('video/')) return { ok: false, reason: 'That video format cannot be sent. Record it with the phone\'s normal camera app and try again.' };
  return { ok: false, reason: 'Please choose a photo or a video from your phone.' };
}
/** New size so the longest side fits MAX_IMAGE_EDGE (never enlarges). */
export function fitImage(w: number, h: number, edge = MAX_IMAGE_EDGE): { w: number; h: number } {
  const k = Math.min(1, edge / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}
/** Storage paths: a child's proofs live under p/<childId>/, a coach's instruction videos under t/<teamId>/. */
export const proofPath = (playerId: string, id: string, ext: string) => `p/${playerId}/${id}.${ext}`;
export const teamVideoPath = (teamId: string, id: string, ext: string) => `t/${teamId}/${id}.${ext}`;
/** Approved proof videos old enough to remove (paths on the server only, not files kept on a phone). */
export function videosToRemove<T extends { status: string; mediaType: string; mediaPath: string; at: string; reviewedAt?: string }>(subs: T[], now: number, days = KEEP_APPROVED_VIDEO_DAYS): T[] {
  return subs.filter((x) => x.status === 'approved' && x.mediaType === 'video' && x.mediaPath && !x.mediaPath.startsWith('local:') && now - Date.parse(x.reviewedAt ?? x.at) > days * 86400000);
}
