/** What photos and videos the app accepts. Pure, so it is unit tested; the database bucket enforces the same limits. */
export const MAX_VIDEO_BYTES = 40 * 1024 * 1024;   // Supabase free plan caps any file at 50 MB; stay under it
export const MAX_IMAGE_EDGE = 1280;
export const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export type MediaCheck = { ok: true; kind: 'image' | 'video'; ext: string } | { ok: false; reason: string };
export function checkMedia(f: { type: string; size: number; name?: string }): MediaCheck {
  const t = (f.type || '').toLowerCase();
  if (IMAGE_TYPES.includes(t)) return { ok: true, kind: 'image', ext: 'jpg' };
  if (VIDEO_TYPES.includes(t)) {
    if (f.size > MAX_VIDEO_BYTES) return { ok: false, reason: `That video is ${(f.size / 1048576).toFixed(0)} MB. The limit is 40 MB. Record a shorter clip (under 30 seconds) or lower the video quality in your camera settings.` };
    return { ok: true, kind: 'video', ext: t === 'video/webm' ? 'webm' : t === 'video/quicktime' ? 'mov' : 'mp4' };
  }
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
