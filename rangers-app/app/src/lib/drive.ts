/** Coaches' videos in the club's Google Drive, through the club's Google Apps Script (supabase/drive-videos/Code.gs).
 *  The phone sends the video in pieces; the script checks the person's sign-in with the database and passes each piece
 *  to Drive. Videos play inside the app with Google's own player, which streams a smaller copy on weak signal. */

/** Each piece: 2 MB (a multiple of 256 KB, as Drive asks). Small enough to retry cheaply on weak signal. */
export const DRIVE_CHUNK = 2 * 1024 * 1024;
export const DRIVE_MAX = 1024 * 1024 * 1024;
export const isDriveScriptUrl = (u: string) => /^https:\/\/script\.google\.com\/macros\/s\/[\w-]{20,}\/exec$/.test(u.trim());
export const isDriveId = (id: string) => /^[A-Za-z0-9_-]{20,}$/.test(id);
export const drivePlayer = (id: string) => `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`;
export const driveOpen = (id: string) => `https://drive.google.com/file/d/${encodeURIComponent(id)}/view`;
/** Phone data used to send a video this size (pieces travel as text, about a third bigger). */
export const uploadMb = (bytes: number) => Math.ceil((bytes * 4) / 3 / 1048576);

export interface DriveReply { error?: string; upload?: string; next?: number; file?: string; ok?: boolean; used?: number; free?: number | null; app?: string }
export type Send = (body: Record<string, unknown>) => Promise<DriveReply>;

const SAY: Record<string, string> = {
  'not-allowed': 'Only coaches can add videos. Check that you are signed in, then try again.',
  'too-big': 'This video is over 1 GB. Trim it on the phone first, or make it smaller here.',
  'not-video': 'Please choose a video.',
  full: "The club's Google Drive is full. Ask the admin to free some space.",
  expired: 'The upload took too long and was stopped. Please try again.',
  unknown: 'The club video storage did not understand the app. The admin should copy the newest script from Settings.',
};
export const driveError = (code = '') => SAY[code] ?? `The club's Google Drive could not take the video (${code}). Try again in a minute.`;

/** Talks to the club's script. Plain text keeps it a "simple" request, which Google answers from any website. */
export const scriptSender = (url: string): Send => async (body) => {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as DriveReply;
};

const toB64 = async (b: Blob) => { const bytes = new Uint8Array(await b.arrayBuffer()); let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Sends a video to the club's Drive and returns its Drive id. Carries on after dropped connections (asks Drive where it got to). */
export async function driveUpload(send: Send, file: Blob, o: { token: string; ext: string; onProgress?: (done: number) => void; pause?: number; signal?: { stop: boolean } }): Promise<string> {
  if (file.size > DRIVE_MAX) throw new Error(driveError('too-big'));
  const s = await send({ a: 'start', token: o.token, size: file.size, type: file.type || 'video/mp4', ext: o.ext });
  if (s.error || !s.upload) throw new Error(driveError(s.error ?? 'unknown'));
  let from = 0; let fails = 0;
  for (;;) {
    if (o.signal?.stop) throw new Error('Upload stopped.');
    let r: DriveReply | null = null;
    try { r = await send({ a: 'chunk', upload: s.upload, from, data: await toB64(file.slice(from, from + DRIVE_CHUNK)) }); }
    catch {
      if (++fails > 5) throw new Error('The connection keeps dropping. Try again on Wi-Fi or with better signal.');
      await wait((o.pause ?? 1500) * fails);
      try { r = await send({ a: 'status', upload: s.upload }); } catch { continue; }
    }
    if (r.error) throw new Error(driveError(r.error));
    if (r.file) { o.onProgress?.(1); return r.file; }
    if (typeof r.next === 'number') { if (r.next > from) fails = 0; from = r.next; o.onProgress?.(from / file.size); }
  }
}

/** Moves a coach's video to the club Drive's bin (the database decides who may). */
export async function driveRemove(send: Send, token: string, file: string) {
  const r = await send({ a: 'delete', token, file });
  if (r.error) throw new Error(r.error === 'not-allowed' ? 'Only the coach who added this video, or a club admin, can remove it.' : driveError(r.error));
}
/** Free space in the club's Drive, for coaches. */
export async function driveSpace(send: Send, token: string) { const r = await send({ a: 'space', token }); return r.error ? null : { used: r.used ?? 0, free: r.free ?? null }; }
/** The admin's "Check" button: is this the Rangers video script? */
export async function drivePing(url: string): Promise<boolean> { try { const r = await fetch(url, { redirect: 'follow' }); return ((await r.json()) as DriveReply).app === 'rangers-videos'; } catch { return false; } }
