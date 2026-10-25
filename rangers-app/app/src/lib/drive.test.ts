// @vitest-environment node
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
import { DRIVE_CHUNK, driveError, driveUpload, isDriveId, isDriveScriptUrl, uploadMb, type DriveReply, type Send } from './drive';

/** Runs the real Apps Script (supabase/drive-videos/Code.gs) against a pretend Google Drive and Rangers database. */
function fakeGoogle(opts: { freeBytes?: number; dropEvery?: number } = {}) {
  const files = new Map<string, { bytes: number[]; trashed: boolean; shared: boolean; parent?: string }>();
  const sessions = new Map<string, { size: number; got: number[]; parent: string }>();
  const cache = new Map<string, string>(); const props = new Map<string, string>(); let n = 0;
  const reply = (code: number, body = '', headers: Record<string, string> = {}) => ({ getResponseCode: () => code, getContentText: () => body, getAllHeaders: () => headers });
  const fetch = (url: string, o: { method?: string; payload?: unknown; headers?: Record<string, string> } = {}) => {
    const h = o.headers ?? {};
    if (url.includes('/rest/v1/rpc/drive_ok')) { const b = JSON.parse(String(o.payload)); return reply(200, String(h.Authorization === 'Bearer coach' && (b.action === 'upload' || b.action === 'delete'))); }
    if (url.includes('/about?')) return reply(200, JSON.stringify({ storageQuota: { limit: String(15e9), usage: String(15e9 - (opts.freeBytes ?? 10e9)) } }));
    if (url.includes('/upload/drive/v3/files?uploadType=resumable')) { const id = 'S' + ++n; sessions.set(id, { size: +h['X-Upload-Content-Length'], got: [], parent: JSON.parse(String(o.payload)).parents[0] }); return reply(200, '', { Location: 'https://up.example/' + id }); }
    if (url.startsWith('https://up.example/')) {
      const ss = sessions.get(url.split('/').pop()!)!; const range = h['Content-Range'];
      if (range.startsWith('bytes */')) return ss.got.length >= ss.size ? reply(200, JSON.stringify({ id: 'done' })) : reply(308, '', ss.got.length ? { Range: `bytes=0-${ss.got.length - 1}` } : {});
      const [a] = range.slice(6).split('-').map(Number); const bytes = Array.from(o.payload as number[]);
      if (a !== ss.got.length) return reply(400, 'wrong offset');
      for (const b of bytes) ss.got.push(b);
      if (ss.got.length >= ss.size) { const id = 'F' + 'x'.repeat(25) + ++n; files.set(id, { bytes: ss.got, trashed: false, shared: false, parent: ss.parent }); return reply(200, JSON.stringify({ id })); }
      return reply(308, '', { Range: `bytes=0-${ss.got.length - 1}` });
    }
    const perm = url.match(/\/files\/([\w-]+)\/permissions$/); if (perm) { files.get(perm[1])!.shared = true; return reply(200, '{}'); }
    const file = url.match(/\/drive\/v3\/files\/([\w-]+)$/); if (file && o.method === 'patch') { const f = files.get(file[1]); if (!f) return reply(404); f.trashed = true; return reply(200, '{}'); }
    if (url.endsWith('/drive/v3/files?fields=id')) { const id = 'Folder' + ++n; files.set(id, { bytes: [], trashed: false, shared: false }); return reply(200, JSON.stringify({ id })); }
    return reply(500, 'unexpected ' + url);
  };
  const ctx = vm.createContext({
    UrlFetchApp: { fetch },
    ScriptApp: { getOAuthToken: () => 'owner-token' },
    CacheService: { getScriptCache: () => ({ get: (k: string) => cache.get(k) ?? null, put: (k: string, v: string) => cache.set(k, v), remove: (k: string) => cache.delete(k) }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k: string) => props.get(k) ?? null, setProperty: (k: string, v: string) => props.set(k, v) }) },
    Utilities: { getUuid: () => 'u' + ++n + '-0000-0000', base64Decode: (s: string) => Array.from(Buffer.from(s, 'base64')).map((b) => (b > 127 ? b - 256 : b)), formatDate: () => '2026-10-25 0900' },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t: string) => ({ setMimeType: () => ({ text: t }) }) },
    console,
  });
  vm.runInContext(fs.readFileSync('supabase/drive-videos/Code.gs', 'utf8'), ctx);
  let calls = 0;
  const send: Send = async (body) => {
    calls++;
    if (opts.dropEvery && body.a === 'chunk' && calls % opts.dropEvery === 0) {
      // the piece reaches Drive, but the answer is lost on the way back to the phone
      (ctx as unknown as { doPost: (e: unknown) => unknown }).doPost({ postData: { contents: JSON.stringify(body) } });
      throw new Error('network');
    }
    const out = (ctx as unknown as { doPost: (e: unknown) => { text: string } }).doPost({ postData: { contents: JSON.stringify(body) } });
    return JSON.parse(out.text) as DriveReply;
  };
  return { send, files, run: (f: string) => (ctx as unknown as Record<string, () => void>)[f]() };
}
const video = (bytes: number) => new Blob([new Uint8Array(bytes).map((_, i) => i % 251)], { type: 'video/mp4' });

describe('club Google Drive videos', () => {
  it('checks the web app address and Drive ids', () => {
    expect(isDriveScriptUrl('https://script.google.com/macros/s/AKfycbx1234567890abcdefghij/exec')).toBe(true);
    expect(isDriveScriptUrl('https://evil.example/macros/s/AKfycbx1234567890abcdefghij/exec')).toBe(false);
    expect(isDriveScriptUrl('https://script.google.com/macros/s/AKfycbx1234567890abcdefghij/dev')).toBe(false);
    expect(isDriveId('1AbCdEfGhIjKlMnOpQrStUvWxYz0')).toBe(true); expect(isDriveId('x/../y')).toBe(false);
    expect(DRIVE_CHUNK % (256 * 1024)).toBe(0);
    expect(uploadMb(30 * 1048576)).toBe(40);
  });
  it('a coach uploads a video in pieces; it lands whole, shared by link, in the club folder', async () => {
    const g = fakeGoogle(); g.run('setup'); const v = video(DRIVE_CHUNK * 2 + 12345); const seen: number[] = [];
    const id = await driveUpload(g.send, v, { token: 'coach', ext: 'mp4', onProgress: (p) => seen.push(p) });
    const f = g.files.get(id)!;
    expect(f.bytes.length).toBe(v.size); expect(Buffer.from(f.bytes.map((b) => (b + 256) % 256)).equals(Buffer.from(new Uint8Array(await v.arrayBuffer())))).toBe(true);
    expect(f.shared).toBe(true); expect(f.parent).toMatch(/^Folder/); expect(seen.at(-1)).toBe(1);
  });
  it('carries on after the answer to a piece is lost', async () => {
    const g = fakeGoogle({ dropEvery: 3 }); const v = video(DRIVE_CHUNK * 4 + 7);
    const id = await driveUpload(g.send, v, { token: 'coach', ext: 'mp4', pause: 1 });
    expect(g.files.get(id)!.bytes.length).toBe(v.size);
  });
  it('a family cannot upload; a full Drive is refused before anything is sent', async () => {
    await expect(driveUpload(fakeGoogle().send, video(10), { token: 'parent', ext: 'mp4' })).rejects.toThrow(/Only coaches/);
    await expect(driveUpload(fakeGoogle({ freeBytes: 1000 }).send, video(5000), { token: 'coach', ext: 'mp4' })).rejects.toThrow(/full/);
  });
  it('removing moves the file to the bin, only when the database says so', async () => {
    const g = fakeGoogle(); const id = await driveUpload(g.send, video(100), { token: 'coach', ext: 'mp4' });
    expect(await g.send({ a: 'delete', token: 'parent', file: id })).toEqual({ error: 'not-allowed' });
    expect(await g.send({ a: 'delete', token: 'coach', file: '../etc' })).toEqual({ error: 'bad-file' });
    expect(await g.send({ a: 'delete', token: 'coach', file: id })).toEqual({ ok: true }); expect(g.files.get(id)!.trashed).toBe(true);
  });
  it('explains each problem in plain words', () => { expect(driveError('full')).toMatch(/full/); expect(driveError('drive: 503')).toMatch(/Try again/); });
});
