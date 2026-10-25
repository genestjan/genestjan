// Rangers App: keeps coaches' videos in this Google account's Drive (free: uses this account's 15 GB).
// Set it up with the CLUB's Google account, not a personal one, so the videos stay with the club.
// The app shows these steps with every value filled in: Settings, Videos in Google Drive.
// 1. script.google.com > New project. Paste this whole file over Code.gs.
// 2. Project Settings (gear) > tick "Show appsscript.json manifest file". Back in Editor, open appsscript.json and
//    paste the manifest from the app. It limits this script to the files it makes itself: it cannot open anything
//    else in this Drive.
// 3. Choose "setup" at the top and press Run. Allow access (Advanced > Go to project, if Google warns you).
// 4. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone. Deploy. Copy the Web app URL into the app.
// Every upload and removal is checked with the person's own sign-in to the Rangers App (coaches only),
// so the web app link is safe to have in the app.
const SUPABASE_URL = '__SUPABASE_URL__';
const SUPABASE_ANON_KEY = '__SUPABASE_ANON_KEY__';
const FOLDER_NAME = 'Rangers App videos';
const MAX_BYTES = 1024 * 1024 * 1024;   // one video at most 1 GB
const KEEP_FREE = 300 * 1024 * 1024;    // leave room in the account for its own email
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

/** Run once from the editor: asks for permission and makes the folder. */
function setup() {
  const id = folderId_();
  console.log('Ready. Videos go into the Drive folder "' + FOLDER_NAME + '" (' + id + '). Now Deploy > New deployment.');
}

function doGet() { return out_({ ok: true, app: 'rangers-videos', v: 1 }); }

function doPost(e) {
  try {
    const r = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (r.a === 'start') return out_(start_(r));
    if (r.a === 'chunk') return out_(chunk_(r));
    if (r.a === 'status') return out_(status_(r));
    if (r.a === 'delete') return out_(remove_(r));
    if (r.a === 'space') return out_(space_(r));
    return out_({ error: 'unknown' });
  } catch (err) {
    return out_({ error: String((err && err.message) || err).slice(0, 300) });
  }
}

/** Starts an upload: checks the person, the size and the free space, then opens a Drive upload session. */
function start_(r) {
  if (!allowed_(r.token, 'upload')) return { error: 'not-allowed' };
  const size = Number(r.size); const type = String(r.type || '').split(';')[0];
  if (!(size > 0)) return { error: 'empty' };
  if (size > MAX_BYTES) return { error: 'too-big' };
  if (!/^video\/[a-z0-9.+-]+$/.test(type)) return { error: 'not-video' };
  const q = quota_();
  if (q && q.free !== null && q.free < size + KEEP_FREE) return { error: 'full' };
  const ext = /^[a-z0-9]{2,4}$/.test(String(r.ext || '')) ? r.ext : 'mp4';
  // A plain name: never a child's name in Drive.
  const name = 'Rangers video ' + Utilities.formatDate(new Date(), 'Asia/Manila', 'yyyy-MM-dd HHmm') + ' ' + Utilities.getUuid().slice(0, 6) + '.' + ext;
  const res = UrlFetchApp.fetch(UPLOAD + '/files?uploadType=resumable&fields=id', {
    method: 'post', contentType: 'application/json; charset=UTF-8', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'X-Upload-Content-Type': type, 'X-Upload-Content-Length': String(size) },
    payload: JSON.stringify({ name: name, parents: [folderId_()], description: 'Added in the Rangers App' }),
  });
  const at = header_(res, 'Location');
  if (res.getResponseCode() !== 200 || !at) return { error: 'drive: ' + res.getResponseCode() };
  const id = Utilities.getUuid();
  CacheService.getScriptCache().put('up:' + id, JSON.stringify({ at: at, size: size }), 21600);
  return { upload: id };
}

/** One piece of the video (base64), sent on to Drive. Answers with where to carry on, or the finished file. */
function chunk_(r) {
  const u = session_(r.upload); if (!u) return { error: 'expired' };
  const bytes = Utilities.base64Decode(String(r.data || ''));
  const from = Number(r.from);
  if (!(from >= 0) || !bytes.length || from + bytes.length > u.size) return { error: 'bad-range' };
  const res = UrlFetchApp.fetch(u.at, {
    method: 'put', payload: bytes, contentType: 'application/octet-stream', muteHttpExceptions: true, followRedirects: false,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'Content-Range': 'bytes ' + from + '-' + (from + bytes.length - 1) + '/' + u.size },
  });
  return after_(r.upload, res);
}

/** After a lost connection: asks Drive how much it already has. */
function status_(r) {
  const u = session_(r.upload); if (!u) return { error: 'expired' };
  const res = UrlFetchApp.fetch(u.at, {
    method: 'put', payload: '', muteHttpExceptions: true, followRedirects: false,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'Content-Range': 'bytes */' + u.size },
  });
  return after_(r.upload, res);
}

function after_(upload, res) {
  const code = res.getResponseCode();
  if (code === 308) { const range = header_(res, 'Range'); return { next: range ? Number(String(range).split('-')[1]) + 1 : 0 }; }
  if (code === 200 || code === 201) {
    const f = JSON.parse(res.getContentText());
    // Anyone with the link can watch (like an unlisted YouTube video). The link is only shown inside the app.
    UrlFetchApp.fetch(API + '/files/' + f.id + '/permissions', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, payload: JSON.stringify({ role: 'reader', type: 'anyone' }),
    });
    CacheService.getScriptCache().remove('up:' + upload);
    return { file: f.id };
  }
  return { error: 'drive: ' + code };
}

/** Moves a video to this Drive's bin (Google keeps it there for 30 days, in case it was a mistake). */
function remove_(r) {
  const id = String(r.file || '');
  if (!/^[A-Za-z0-9_-]{20,}$/.test(id)) return { error: 'bad-file' };
  if (!allowed_(r.token, 'delete', id)) return { error: 'not-allowed' };
  const res = UrlFetchApp.fetch(API + '/files/' + id, {
    method: 'patch', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, payload: JSON.stringify({ trashed: true }),
  });
  const code = res.getResponseCode();
  return code === 200 || code === 404 ? { ok: true } : { error: 'drive: ' + code };
}

/** How much space is left (for coaches, shown in the app). */
function space_(r) {
  if (!allowed_(r.token, 'upload')) return { error: 'not-allowed' };
  const q = quota_();
  return q ? { used: q.used, free: q.free } : { error: 'unknown' };
}

/** Asks the Rangers database, with the person's own sign-in, whether they may do this. */
function allowed_(token, action, file) {
  if (!token || typeof token !== 'string') return false;
  const res = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/rpc/drive_ok', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ action: action, file_id: file || null }),
  });
  return res.getResponseCode() === 200 && String(res.getContentText()).trim() === 'true';
}

function quota_() {
  const res = UrlFetchApp.fetch(API + '/about?fields=storageQuota', { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } });
  if (res.getResponseCode() !== 200) return null;
  const q = JSON.parse(res.getContentText()).storageQuota || {};
  const used = Number(q.usage || 0);
  return { used: used, free: q.limit ? Number(q.limit) - used : null };
}

function folderId_() {
  const p = PropertiesService.getScriptProperties(); const known = p.getProperty('FOLDER');
  if (known) return known;
  const res = UrlFetchApp.fetch(API + '/files?fields=id', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    payload: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  });
  if (res.getResponseCode() !== 200) throw new Error('Could not make the folder: ' + res.getContentText().slice(0, 200));
  const id = JSON.parse(res.getContentText()).id; p.setProperty('FOLDER', id);
  return id;
}

function session_(id) { const v = id && CacheService.getScriptCache().get('up:' + id); return v ? JSON.parse(v) : null; }
function header_(res, name) { const h = res.getAllHeaders(); const k = Object.keys(h).find(function (x) { return x.toLowerCase() === name.toLowerCase(); }); return k ? h[k] : ''; }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
