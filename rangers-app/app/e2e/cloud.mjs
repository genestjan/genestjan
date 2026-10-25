// Online-mode end-to-end test against the local stack (supabase/local-stack/start.sh must be running).
// Three separate browsers: club admin, a parent, a coach. Sign-in codes are read from the test mailbox.
// Usage: node e2e/cloud.mjs   (builds with the local stack's URL and key, serves under /app/ on :4400)
import { chromium } from 'playwright-core';
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ANON_KEY, SERVICE_KEY } from '../supabase/local-stack/keys.mjs';

const API = 'http://localhost:54321', MAIL = 'http://localhost:8025', PORT = 4400, BASE = '/app/';
const APP = `http://localhost:${PORT}${BASE}`;
const SHOTS = process.env.E2E_SHOTS || '';
const exe = process.env.CHROMIUM_PATH || (() => { const r = '/opt/pw-browsers'; if (!fs.existsSync(r)) return undefined; const d = fs.readdirSync(r).find((x) => x.startsWith('chromium-')); return d && ['chrome-linux/chrome', 'chrome-linux64/chrome'].map((p) => path.join(r, d, p)).find(fs.existsSync); })();
const fails = []; const errors = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('FAIL', m); } else console.log('ok  ', m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, what, ms = 15000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) { console.log('ok  ', what); return v; } } catch { /* retry */ } if (Date.now() - t > ms) { fails.push('timed out: ' + what); console.log('FAIL timed out:', what); return null; } await sleep(300); } }
const svc = (q) => fetch(`${API}/rest/v1/${q}`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }).then((r) => r.json());
// A stand-in for the club's Google Apps Script (the real script is tested in src/lib/drive.test.ts). It asks the real
// local database, with the person's own sign-in, whether they may upload or remove, exactly as the script does.
const drive = { files: new Map(), sessions: new Map() };
const driveOk = async (token, action, file) => { const r = await fetch(`${API}/rest/v1/rpc/drive_ok`, { method: 'POST', headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ action, file_id: file ?? null }) }); return r.ok && (await r.text()).trim() === 'true'; };
async function fakeScript(route) {
  const req = route.request(); const cors = { 'access-control-allow-origin': '*' };
  if (req.method() === 'GET') return route.fulfill({ json: { ok: true, app: 'rangers-videos', v: 1 }, headers: cors });
  const b = JSON.parse(req.postData() || '{}'); let out = { error: 'unknown' };
  if (b.a === 'start') { if (await driveOk(b.token, 'upload')) { const id = 'up' + drive.sessions.size; drive.sessions.set(id, { size: b.size, got: 0 }); out = { upload: id }; } else out = { error: 'not-allowed' }; }
  if (b.a === 'chunk') { const ss = drive.sessions.get(b.upload); ss.got += Buffer.from(b.data, 'base64').length; if (ss.got >= ss.size) { const id = 'Drive' + 'x'.repeat(24) + drive.files.size; drive.files.set(id, { size: ss.got, trashed: false }); out = { file: id }; } else out = { next: ss.got }; }
  if (b.a === 'space') out = (await driveOk(b.token, 'upload')) ? { used: 1e9, free: 14 * 1073741824 } : { error: 'not-allowed' };
  if (b.a === 'delete') { if (await driveOk(b.token, 'delete', b.file)) { drive.files.get(b.file).trashed = true; out = { ok: true }; } else out = { error: 'not-allowed' }; }
  return route.fulfill({ json: out, headers: cors });
}
async function code(email) {
  return waitFor(async () => {
    const r = await (await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent('to:' + email)}`)).json();
    if (!r.messages?.length) return null;
    const m = await (await fetch(`${MAIL}/api/v1/message/${r.messages[0].ID}`)).json();
    return (m.Text || m.HTML || '').match(/\b(\d{6})\b/)?.[1];
  }, 'sign-in code for ' + email);
}
async function signIn(p, email) {
  await fetch(`${MAIL}/api/v1/messages`, { method: 'DELETE' });
  await p.getByLabel('Email').fill(email); await p.getByRole('button', { name: 'Send me a 6-digit code' }).click();
  const c = await code(email); await p.getByLabel('6-digit code').fill(c); await p.getByRole('button', { name: 'Sign in' }).click();
}
const watch = (p, who) => {
  p.on('pageerror', (e) => errors.push(`${who} page error: ${String(e).slice(0, 200)}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|realtime|Failed to load resource/i.test(m.text())) errors.push(`${who} console: ${m.text().slice(0, 200)}`); });
  p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? 'Cleared by Dr Cruz, 20 Nov' : undefined));
  p.route('**/api.open-meteo.com/**', (r) => r.fulfill({ json: { hourly: { time: [], temperature_2m: [], relative_humidity_2m: [], precipitation_probability: [], weather_code: [], cape: [] } } }));
};

console.log('building with the local stack settings...');
execSync('npx vite build --outDir dist-cloud', { stdio: 'ignore', env: { ...process.env, APP_BASE: BASE, VITE_SUPABASE_URL: API, VITE_SUPABASE_ANON_KEY: ANON_KEY, VITE_EMAIL_CODES: "1", VITE_GOOGLE_CLIENT_ID: "test-client.apps.googleusercontent.com" } });
const server = spawn('npx', ['vite', 'preview', '--outDir', 'dist-cloud', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', env: { ...process.env, APP_BASE: BASE } });
let browser;
try {
  await waitFor(() => fetch(APP).then((r) => r.ok), 'preview server');
  browser = await chromium.launch({ executablePath: exe });
  const mk = async (who) => { const c = await browser.newContext({ viewport: { width: 390, height: 844 } }); await c.addInitScript(() => { try { for (const k of ['welcome', 'tour-coach', 'tour-parent']) localStorage.setItem('rangers-' + k, '1'); } catch { /* ignore */ } }); await c.route('https://accounts.google.com/**', (r) => r.abort()); const p = await c.newPage(); watch(p, who); return p; };
  const admin = await mk('admin'), parent = await mk('parent'), coach = await mk('coach');
  const body = (p) => p.textContent('body');

  // A failed Google sign-in comes back as ?error_description=... : the app must say what went wrong, not just loop
  await admin.goto(APP + '?error=server_error&error_description=Unable+to+exchange+external+code#/'); await sleep(1200);
  ok((await body(admin)).includes('Unable to exchange external code'), 'a failed sign-in shows its reason on the sign-in page');
  ok(!(await admin.url()).includes('error='), 'and the error is cleaned from the address');

  // Google's own button: a stand-in for Google's script checks it loads under the security policy, draws, and hands the token to Supabase
  { const c = await browser.newContext({ viewport: { width: 390, height: 844 } }); await c.addInitScript(() => { try { localStorage.setItem('rangers-welcome', '1'); } catch { /* ignore */ } });
    await c.route('https://accounts.google.com/gsi/client', (r) => r.fulfill({ contentType: 'text/javascript', body: `window.google = { accounts: { id: {
      initialize(o) { window.__gsi = o; },
      renderButton(el) { const b = document.createElement('button'); b.textContent = 'Fake Google button'; b.onclick = () => window.__gsi.callback({ credential: 'not-a-real-token' }); el.appendChild(b); } } } };` }));
    const g = await c.newPage(); watch(g, 'gsi'); await g.goto(APP);
    await waitFor(async () => (await g.getByRole('button', { name: 'Fake Google button' }).count()) === 1, 'Google\'s own button loads under the security policy');
    ok(await g.getByRole('button', { name: /Sign in the other way/ }).count() === 1, 'a way round is offered under Google\'s button');
    ok(/^[0-9a-f]{64}$/.test(await g.evaluate(() => window.__gsi.nonce)), 'Google is given a hashed one-time code (nonce)');
    await g.getByRole('button', { name: 'Fake Google button' }).click();
    await waitFor(async () => (await g.getByRole('alert').count()) > 0, 'a refused Google token shows an error instead of nothing');
    await c.close(); }

  // Google's own button cannot load here (blocked), so the normal Google button must take its place
  await admin.goto(APP); await waitFor(async () => (await admin.getByRole('button', { name: 'Continue with Google' }).count()) === 1, 'falls back to the normal Google button when Google\'s script is blocked');

  // 1. Club admin signs in and sets up the club
  await admin.goto(APP); await signIn(admin, 'admin@test.local');
  await admin.getByRole('button', { name: 'Set up the club (admin)' }).click();
  await waitFor(async () => (await body(admin)).includes('Next up'), 'admin reaches the coach dashboard');
  ok((await svc('memberships?select=role,status')).some((m) => m.role === 'admin' && m.status === 'active'), 'first sign-in became club admin');
  await admin.goto(APP + '#/squad'); await admin.locator('#paste').fill('7 Ana\n9 Ben'); await admin.getByRole('button', { name: 'Add', exact: true }).click();
  const players = await waitFor(async () => { const r = await svc('players?select=id,first_name'); return r.length === 2 && r; }, 'players saved to the server');
  ok(players && players.length === 2, 'squad synced to the server');
  const ana = players?.find((x) => x.first_name === 'Ana'), ben = players?.find((x) => x.first_name === 'Ben');

  // 2. Family invite for Ana
  await admin.goto(APP + '#/player/' + ana.id); await admin.getByRole('button', { name: 'Create invite link' }).click();
  const link = await waitFor(() => admin.getByLabel('Invite link').inputValue(), 'invite link shown');
  ok(link?.includes('#/join/'), 'invite link uses a first-open-safe address');

  // 3. Admin posts, messages and schedules
  await admin.goto(APP + '#/inbox'); await admin.getByLabel('Title').fill('Welcome families'); await admin.getByLabel('Message').first().fill('Training is on Saturday'); await admin.getByRole('button', { name: 'Post' }).click();
  await admin.getByRole('button', { name: 'Messages' }).click(); await admin.getByRole('link', { name: 'Ana', exact: true }).click();
  await admin.getByLabel('Message').fill('Hello from Coach'); await admin.getByRole('button', { name: 'Send' }).click();
  await admin.goto(APP + '#/event/new'); await admin.getByRole('button', { name: 'Save event' }).click();
  await waitFor(async () => (await svc("records?kind=in.(announcement,message,event)&select=kind")).length >= 3, 'announcement, message and event saved');

  // 4. Parent joins with the link, consents, sees only their child
  await parent.goto(link); await signIn(parent, 'parent@test.local');
  await waitFor(async () => (await body(parent)).includes("family"), 'consent step shown');
  ok((await body(parent)).includes('How we look after'), 'parent sees the privacy notice before using the app');
  await parent.getByText('I agree').click(); await parent.getByText(/photo on team screens/).click(); await parent.getByRole('button', { name: 'Continue' }).click();
  await waitFor(async () => (await body(parent)).includes('Ana') && (await body(parent)).includes('Progress'), 'parent home shows Ana');
  ok(!(await body(parent)).includes('Ben'), 'parent does not see another family\'s child');
  ok((await svc('consents?select=kind,granted')).some((c) => c.kind === 'data' && c.granted), 'consent stored with notice version');
  ok((await svc('players?first_name=eq.Ana&select=photo_consent'))[0]?.photo_consent === true, 'parent photo consent reached the coach view');
  await parent.getByRole('button', { name: 'Not going', exact: true }).first().click();
  await parent.goto(APP + '#/inbox'); ok((await body(parent)).includes('Welcome families'), 'parent sees the announcement');
  await parent.getByRole('button', { name: 'Messages' }).click(); await parent.getByRole('link', { name: /Message the coach about Ana/ }).click();
  ok((await body(parent)).includes('Hello from Coach'), 'parent sees the coach message');
  await parent.getByLabel('Message').fill('Thanks coach!'); await parent.getByRole('button', { name: 'Send' }).click();
  await waitFor(async () => (await svc("records?kind=eq.message&select=data")).some((r) => r.data.body === 'Thanks coach!'), 'parent message saved');
  await waitFor(async () => (await svc("records?kind=eq.availability&select=data")).some((r) => r.data.status === 'no'), 'parent reply saved');
  // direct API probes with the parent's own login
  const token = await parent.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.endsWith('-auth-token')); return k && JSON.parse(localStorage.getItem(k)).access_token; });
  const asParent = (q, init = {}) => fetch(`${API}/rest/v1/${q}`, { ...init, headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers || {}) } });
  ok((await (await asParent('players?select=first_name')).json()).map((x) => x.first_name).join() === 'Ana', 'API: parent can read only their own child');
  const spoof = await asParent('records', { method: 'POST', body: JSON.stringify({ id: crypto.randomUUID(), kind: 'message', team_id: ana && (await svc('players?first_name=eq.Ana&select=team_id'))[0].team_id, player_id: ana.id, visibility: 'family', data: { from: 'coach', body: 'fake' } }) });
  ok(spoof.status === 403 || spoof.status === 401, 'API: parent cannot post a message as the coach');
  const gcash = await asParent('records', { method: 'POST', body: JSON.stringify({ id: crypto.randomUUID(), kind: 'settings', visibility: 'club', data: { gcashNumber: '0999' } }) });
  ok(gcash.status === 403 || gcash.status === 401, 'API: parent cannot change the GCash number');
  ok((await (await asParent('records?kind=eq.message&player_id=eq.' + ben.id)).json()).length === 0, 'API: parent cannot read another child\'s messages');

  // 5. Admin sees the reply and the RSVP
  await admin.goto(APP + '#/'); await admin.reload(); await sleep(1500);
  await admin.goto(APP + '#/inbox'); await admin.getByRole('button', { name: 'Messages' }).click();
  await waitFor(async () => (await body(admin)).includes('Thanks coach!'), 'admin sees the parent reply');
  await admin.goto(APP + '#/'); ok(/1\s*Not going/.test((await body(admin)).replace(/\s+/g, ' ')), 'admin dashboard counts the parent\'s Not going reply');

  // 5b. Assignments and family details, through the real database rules
  await admin.goto(APP + '#/assign/new'); await admin.getByRole('button', { name: 'Ball mastery at home' }).click(); await admin.getByLabel(/^Ana/).check(); await admin.getByRole('button', { name: 'Send to 1 player' }).click();
  await waitFor(async () => (await svc("records?kind=eq.assignment&select=player_id")).length === 1, 'assignment saved to the server');
  await parent.goto(APP + '#/tasks'); await parent.reload();
  await waitFor(async () => (await body(parent)).includes('Ball mastery at home'), 'parent sees the assignment');
  const anaTeam = (await svc('players?first_name=eq.Ana&select=team_id'))[0].team_id;
  const mkSub = (status, player = ana.id) => asParent('records', { method: 'POST', body: JSON.stringify({ id: crypto.randomUUID(), kind: 'submission', team_id: anaTeam, player_id: player, visibility: 'family', data: { status, feedback: '', mediaPath: 'p/x/y.jpg' } }) });
  ok((await mkSub('approved')).status === 403, 'API: parent cannot send a proof already approved');
  ok((await mkSub('submitted', ben.id)).status === 403, 'API: parent cannot send a proof for another child');
  ok((await mkSub('submitted')).status === 201, 'API: parent can send a proof for their own child');
  const mkAssign = await asParent('records', { method: 'POST', body: JSON.stringify({ id: crypto.randomUUID(), kind: 'assignment', team_id: anaTeam, player_id: ana.id, visibility: 'family', data: { title: 'x', tasks: [] } }) });
  ok(mkAssign.status === 403, 'API: parent cannot create an assignment');
  await parent.goto(APP + '#/details/' + ana.id); await parent.getByLabel('Home address').fill('Purok 1, Mabuhay');
  await waitFor(async () => JSON.stringify(await svc('player_private?select=data')).includes('Purok 1, Mabuhay'), 'family-entered details reached the server');
  await admin.goto(APP + '#/player/' + ana.id); await admin.reload();
  await waitFor(async () => (await admin.getByLabel('Home address').inputValue().catch(() => '')) === 'Purok 1, Mabuhay', 'coach sees the address the parent entered');

  // 5c. The video library and the club's video space, through the real database rules
  for (const [title, who] of [['Our match day routine', 'Coaches only'], ['Toe taps at home', /^Players and families of/]]) {
    await admin.goto(APP + '#/videos/new'); await admin.getByLabel('Or paste a YouTube link').fill('https://youtu.be/aqz-KE-bpKQ'); await admin.getByLabel('Title').fill(title);
    await admin.getByRole('button', { name: who }).click(); await admin.getByRole('button', { name: 'Save to the library' }).click(); await admin.waitForURL(/#\/videos$/);
  }
  await waitFor(async () => { const v = await svc('records?kind=eq.video&select=visibility,team_id'); return v.length === 2 && v.some((x) => x.visibility === 'staff' && !x.team_id) && v.some((x) => x.visibility === 'team' && x.team_id === anaTeam); }, 'library videos saved as coaches-only and team');
  await parent.goto(APP + '#/videos'); await parent.reload();
  await waitFor(async () => (await body(parent)).includes('Toe taps at home'), 'parent sees the team video');
  ok(!(await body(parent)).includes('Our match day routine'), 'parent never sees the coaches-only video');
  ok((await (await asParent('records?kind=eq.video&select=id')).json()).length === 1, 'API: parent can read only the team video');
  const room = await (await asParent('rpc/clips_room', { method: 'POST', body: '{}' })).json();
  ok(room === 600 * 1024 * 1024, 'API: the app can check the club\'s video space before sending a video');
  await admin.goto(APP + '#/videos'); await waitFor(async () => (await body(admin)).includes('MB of 600 MB'), 'coaches see how full the video space is');
  await admin.goto(APP + '#/assign/new'); await admin.getByRole('button', { name: 'Ball mastery at home' }).click();
  ok((await body(admin)).includes('No family in this team has agreed to videos yet'), 'before any family agrees, coaches are told not to film the children');
  await parent.goto(APP + '#/privacy'); await parent.getByLabel(/^Coaches may film Ana/).check();
  await waitFor(async () => (await svc('players?first_name=eq.Ana&select=video_consent'))[0]?.video_consent === true, 'the family\'s video permission reached the child\'s record');
  await admin.goto(APP + '#/'); await admin.reload(); await sleep(1500); await admin.goto(APP + '#/assign/new'); await admin.getByRole('button', { name: 'Ball mastery at home' }).click();
  await waitFor(async () => (await body(admin)).includes('Children whose families agreed to videos: Ana'), 'the coach sees which children may be filmed');

  // 5d. Coaches upload videos in the app; they go to the club's Google Drive (stand-in script, real database rules)
  const SCRIPT = 'https://script.google.com/macros/s/AKfycbTestRangersVideos1234567890/exec';
  for (const pg of [admin, parent]) { await pg.context().route('https://script.google.com/**', fakeScript); await pg.context().route('https://drive.google.com/**', (r) => r.fulfill({ contentType: 'text/html', body: '<p>drive video</p>' })); }
  await admin.goto(APP + '#/settings'); await admin.getByRole('link', { name: /Coaches' videos in Google Drive/ }).click();
  const tpl = await admin.getByLabel('The script (Code.gs)').inputValue();
  ok(tpl.includes(`const SUPABASE_URL = '${API}'`) && tpl.includes(ANON_KEY) && !tpl.includes('__SUPABASE'), 'the admin gets the Drive script with the club\'s values filled in');
  await admin.getByLabel('Web app URL').fill('https://example.com/not-it'); await admin.getByRole('button', { name: 'Check and save' }).click();
  ok((await body(admin)).includes('That is not a web app link'), 'a wrong link is pointed out');
  await admin.getByLabel('Web app URL').fill(SCRIPT); await admin.getByRole('button', { name: 'Check and save' }).click();
  await waitFor(async () => (await body(admin)).includes('Connected. Coaches can now upload videos in the app. 14.0 GB free'), 'admin connected the club\'s Google Drive');
  await waitFor(async () => (await svc('records?kind=eq.settings&select=data'))[0]?.data?.driveUrl === SCRIPT, 'the Drive link reached every coach\'s phone (club settings)');
  await admin.goto(APP + '#/videos/new'); await admin.getByLabel('Upload a video from this phone').setInputFiles(path.join(path.dirname(new URL(import.meta.url).pathname), 'fixtures', 'clip.webm'));
  await waitFor(async () => (await admin.locator('iframe[src*="drive.google.com/file/d/Drive"]').count()) === 1, 'coach uploaded a video inside the app');
  await admin.getByLabel('Title').fill('Our warm-up (from Drive)'); await admin.getByRole('button', { name: /^Players and families of/ }).click(); await admin.getByRole('button', { name: 'Save to the library' }).click();
  const driveRec = await waitFor(async () => (await svc('records?kind=eq.video&deleted_at=is.null&select=data')).find((r) => r.data.driveId)?.data, 'the video is saved in the library with its Drive id');
  ok(drive.files.get(driveRec.driveId)?.size === fs.statSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'fixtures', 'clip.webm')).size, 'the whole video reached the club\'s Drive');
  await parent.goto(APP + '#/videos'); await parent.reload();
  await waitFor(async () => (await body(parent)).includes('Our warm-up (from Drive)'), 'the family sees the uploaded video');
  await parent.locator('li', { hasText: 'Our warm-up (from Drive)' }).getByRole('button', { name: 'Play video' }).click();
  ok(await parent.locator(`iframe[src*="drive.google.com/file/d/${driveRec.driveId}/preview"]`).count() === 1, 'the family watches it inside the app');
  const parentToken = await parent.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.endsWith('-auth-token')); return k && JSON.parse(localStorage.getItem(k)).access_token; });
  ok(!(await driveOk(parentToken, 'upload')) && !(await driveOk(parentToken, 'delete', driveRec.driveId)), 'API: families cannot upload to or remove from the club\'s Drive');
  await admin.goto(APP + '#/videos'); await admin.locator('li', { hasText: 'Our warm-up (from Drive)' }).getByRole('button', { name: 'Remove' }).click();
  await waitFor(async () => drive.files.get(driveRec.driveId).trashed && (await svc('records?kind=eq.video&deleted_at=is.null&select=data')).every((r) => !r.data.driveId), 'removing it moves the file to the Drive bin and takes it out of the library');

  // 5e. A coach's drill is for every coach, never for families
  await admin.goto(APP + '#/drills/new'); await admin.getByLabel('Name of the drill').fill('Rondo 4 v 1'); await admin.getByLabel('How it works (instructions)').fill('Four keep the ball from one.');
  await admin.getByLabel('Or paste a YouTube link').fill('https://youtu.be/aqz-KE-bpKQ'); await admin.getByRole('button', { name: 'Save the drill for all coaches' }).click();
  await waitFor(async () => (await svc('records?kind=eq.drill&select=visibility,team_id,data')).some((r) => r.visibility === 'staff' && !r.team_id && r.data.video?.youtube === 'aqz-KE-bpKQ'), 'the drill is saved for every coach');
  ok((await (await asParent('records?kind=eq.drill&select=id')).json()).length === 0, 'API: families cannot read coaches\' drills');

  // 5f. Push alert set-up: keys made on the admin's phone, the private key never saved; a test alert is queued
  await admin.goto(APP + '#/settings/push'); await admin.getByRole('button', { name: 'Make the keys' }).click();
  const pubKey = await admin.getByLabel('Public key', { exact: true }).inputValue(); const privKey = await admin.getByLabel('Private key (secret)').inputValue();
  ok(pubKey.length === 87 && privKey.length === 43, 'admin made the push alert keys');
  await waitFor(async () => (await svc('records?kind=eq.settings&select=data'))[0]?.data?.vapidPublic === pubKey, 'the public key reached the club settings');
  ok(!JSON.stringify(await svc('records?select=data')).includes(privKey) && !(await admin.evaluate(() => JSON.stringify(localStorage))).includes(privKey), 'the private key is not saved anywhere by the app');
  ok((await admin.getByLabel('SQL').inputValue()).includes(`'${API}/functions/v1/send-push'`), 'the schedule SQL is filled in for this project');
  await admin.getByRole('button', { name: 'Send me a test alert' }).click();
  await waitFor(async () => (await svc('notification_queue?dedupe_key=like.test:*&select=title')).length === 1, 'a test alert is queued for the admin');

  // 5g. The club song plays when a new message comes in
  await parent.goto(APP + '#/inbox'); await parent.getByRole('button', { name: 'Messages' }).click(); await parent.getByRole('link', { name: /Message the coach about Ana/ }).click();
  await parent.getByLabel('Message').fill('Can Ana bring a friend?'); await parent.getByRole('button', { name: 'Send' }).click();
  await waitFor(async () => (await svc("records?kind=eq.message&select=data")).some((r) => r.data.body === 'Can Ana bring a friend?'), 'parent message saved');
  await admin.goto(APP + '#/'); await admin.reload();
  await waitFor(async () => (await admin.evaluate(() => window.__rangersAlerts ?? 0)) >= 1, 'the coach\'s phone plays the club song for the new message', 20000);

  // 6. Review published to the family without the private note, then taken back
  await admin.goto(APP + '#/review/' + ana.id); await admin.getByRole('group', { name: 'First touch' }).getByRole('button', { name: 'Got it' }).click();
  await admin.getByRole('group', { name: 'Inside-foot passing' }).getByRole('button', { name: 'Getting it' }).click();
  await admin.getByText('One or two sentences').locator('textarea').fill('Great first touch.'); await admin.getByText('Your private note').locator('textarea').fill('SECRET note');
  await admin.getByRole('button', { name: 'Publish to the family' }).click();
  await waitFor(async () => (await svc("records?kind=eq.assessment_pub&deleted_at=is.null&select=id")).length === 1, 'family copy of the review saved');
  await parent.goto(APP + '#/progress'); await parent.reload();
  await waitFor(async () => (await body(parent)).includes('Great first touch'), 'parent sees the published review');
  ok(!(await body(parent)).includes('SECRET'), 'parent never sees the coach\'s private note');
  ok(!JSON.stringify(await parent.evaluate(() => localStorage)).includes('SECRET'), 'private note is not stored on the parent\'s phone');
  await admin.getByRole('button', { name: 'Take back (hide from the family)' }).click();
  await waitFor(async () => (await svc("records?kind=eq.assessment_pub&deleted_at=is.null&select=id")).length === 0, 'review taken back on the server');
  await parent.reload(); await sleep(2500); await parent.goto(APP + '#/progress');
  ok((await body(parent)).includes('No term review has been shared yet'), 'taken-back review disappears from the parent\'s phone');

  // 7. A coach joins with an invite, waits for approval, becomes head coach
  await admin.goto(APP + '#/settings'); await admin.getByRole('button', { name: 'Create a coach invite link' }).click();
  const coachLink = await waitFor(() => admin.getByLabel('Coach invite link').inputValue(), 'coach invite link');
  await coach.goto(coachLink); await signIn(coach, 'coach@test.local');
  await waitFor(async () => /approve|waiting/i.test(await body(coach)), 'coach sees the waiting screen');
  await admin.reload(); await admin.goto(APP + '#/settings');
  await waitFor(async () => (await body(admin)).includes('coach@test.local'), 'admin sees the new coach by name');
  await admin.getByRole('button', { name: 'Approve' }).click();
  await waitFor(async () => (await body(admin)).includes('approved'), 'admin sees the approval confirmed');
  ok((await svc('memberships?role=eq.coach&select=status'))[0]?.status === 'active', 'coach approved on the server');
  await admin.getByRole('button', { name: /Head coach of/ }).first().click();
  await waitFor(async () => (await body(admin)).includes('is now head coach'), 'admin sees head coach confirmed');
  await waitFor(async () => (await svc('team_staff?select=head')).some((x) => x.head), 'coach made head coach');
  // Leftover work from using the app without an account on this phone: the coach is asked before it is uploaded
  await coach.evaluate(() => new Promise((done) => { const q = indexedDB.open('rangers-app'); q.onsuccess = () => { const st = q.result.transaction('kv', 'readwrite').objectStore('kv'); const g = st.get('state');
    g.onsuccess = () => { const v = g.result?.v ?? {}; v.players = [...(v.players ?? []), { id: '9a9a9a9a-0000-4000-8000-000000000001', firstName: 'Zed', teamId: (v.teams ?? [{}])[0].id ?? '10000000-0000-4000-8000-000000000001', gkWilling: false, photoConsent: false }]; st.put({ k: 'state', v }).onsuccess = () => done(); }; }; }));
  await coach.reload();
  await waitFor(async () => (await body(coach)).includes('Before you start'), 'coach is asked about work made before signing in');
  await coach.getByRole('button', { name: /Start fresh/ }).click();
  await waitFor(async () => (await body(coach)).includes('Next up'), 'approved coach reaches the dashboard');
  ok((await svc('players?first_name=eq.Zed&select=id')).length === 0, 'start fresh keeps test data off the server');
  await coach.goto(APP + '#/squad'); await waitFor(async () => (await body(coach)).includes('Ben'), 'coach sees the team squad');

  // 8. Head injury: coach records it, the block reaches every coach, only a head coach clears it
  await coach.goto(APP + '#/safety?player=' + ben.id); await coach.getByRole('button', { name: /Record head injury/ }).click();
  await waitFor(async () => (await svc("records?kind=eq.injury&select=data")).some((r) => r.data.head), 'head injury saved');
  await admin.reload(); await sleep(1500); await admin.goto(APP + '#/squad');
  await waitFor(async () => /out: head knock/i.test(await body(admin)), 'head-knock block reaches the other coach\'s phone');
  await coach.goto(APP + '#/player/' + ben.id); await coach.getByRole('button', { name: 'Head coach: record medical clearance' }).click();
  await waitFor(async () => (await svc("records?kind=eq.injury&select=data")).some((r) => r.data.clearedOn), 'head coach clearance saved');

  // 8b. Feedback: a parent sends it, the admin is told and marks it done, the parent sees it was dealt with
  await parent.goto(APP + '#/more'); await parent.getByRole('link', { name: /Send feedback about the app/ }).click();
  await parent.getByRole('button', { name: 'Great', exact: true }).click(); await parent.getByRole('button', { name: 'An idea', exact: true }).click();
  await parent.getByLabel('Your feedback').fill('Pwede po bang may calendar view? Salamat!');
  if (SHOTS) await parent.screenshot({ path: path.join(SHOTS, 'cloud-feedback-form.png'), fullPage: true });
  await parent.getByRole('button', { name: 'Send feedback' }).click();
  await waitFor(async () => (await body(parent)).includes('Salamat! Thank you.'), 'parent sends feedback');
  ok((await svc('feedback?select=role,kind,rating'))[0]?.role === 'parent', 'feedback saved with who sent it');
  ok((await svc('notification_queue?url=eq./feedback/inbox&select=user_id')).length >= 1, 'the admin gets an alert for it');
  await coach.goto(APP + '#/feedback/inbox');
  await waitFor(async () => (await body(coach)).includes('Only club admins'), 'a coach who is not a reader cannot open the feedback inbox');
  await admin.goto(APP + '#/'); await admin.reload();
  await waitFor(async () => (await body(admin)).includes('1 new feedback about the app'), 'admin home shows the new feedback');
  await admin.goto(APP + '#/feedback/inbox');
  await waitFor(async () => (await body(admin)).includes('calendar view'), 'admin reads it in the feedback inbox');
  if (SHOTS) await admin.screenshot({ path: path.join(SHOTS, 'cloud-feedback-inbox.png'), fullPage: true });
  await admin.getByRole('button', { name: 'Done', exact: true }).click();
  await waitFor(async () => (await svc('feedback?select=status'))[0]?.status === 'done', 'admin marks it done');
  await parent.goto(APP + '#/feedback'); await parent.reload();
  await waitFor(async () => (await body(parent)).includes('Done, thank you'), 'the parent sees their feedback was dealt with');
  if (SHOTS) await parent.screenshot({ path: path.join(SHOTS, 'cloud-feedback-mine.png'), fullPage: true });

  // 8c. Handing the club over: the first admin keeps getting feedback, invites a new admin, then steps down
  await admin.goto(APP + '#/feedback/inbox'); await admin.getByRole('button', { name: /Keep sending me feedback/ }).click();
  await waitFor(async () => (await svc('feedback_readers?select=user_id')).length === 1, 'the first admin chooses to keep getting feedback');
  await admin.goto(APP + '#/settings'); await admin.getByRole('button', { name: 'Create an admin invite link' }).click();
  const adminLink = await waitFor(() => admin.getByLabel('Admin invite link').inputValue(), 'admin invite link');
  if (SHOTS) await admin.getByLabel('Admin invite link').evaluate((el) => el.closest('.card').scrollIntoView()).then(() => admin.screenshot({ path: path.join(SHOTS, 'cloud-admins.png') }));
  await coach.goto(adminLink);
  await waitFor(async () => (await body(coach)).includes('You are now a club admin'), 'the coach opens the admin link and is told they are an admin');
  if (SHOTS) await coach.screenshot({ path: path.join(SHOTS, 'cloud-admin-joined.png') });
  ok((await svc('memberships?role=eq.admin&select=user_id')).length === 2, 'the club now has two admins');
  await admin.goto(APP + '#/'); await admin.reload(); await admin.goto(APP + '#/settings');
  await waitFor(async () => (await body(admin)).includes('Step down as admin'), 'the first admin can now step down');
  await admin.getByRole('button', { name: 'Step down as admin' }).click();
  await waitFor(async () => (await svc('memberships?role=eq.admin&select=user_id')).length === 1, 'the first admin stepped down');
  await admin.goto(APP + '#/squad'); await sleep(1500);
  ok((await body(admin)).includes('No players yet') && !(await body(admin)).includes('Ben'), 'after stepping down, the old admin\'s phone forgets the children of teams they do not coach');
  await coach.goto(APP + '#/'); await coach.reload(); await coach.goto(APP + '#/settings');
  await waitFor(async () => (await body(coach)).includes('Club admins'), 'the new admin manages the club');
  await parent.goto(APP + '#/feedback'); await parent.getByRole('button', { name: 'Send more feedback' }).click().catch(() => undefined);
  await parent.getByLabel('Your feedback').fill('Thank you for the app!'); await parent.getByRole('button', { name: 'Send feedback' }).click();
  await waitFor(async () => (await body(parent)).includes('Salamat! Thank you.'), 'parent sends more feedback');
  await admin.goto(APP + '#/'); await admin.reload();
  await waitFor(async () => (await body(admin)).includes('1 new feedback about the app'), 'the first admin still hears from families after stepping down');
  await coach.goto(APP + '#/'); await coach.reload();
  await waitFor(async () => (await body(coach)).includes('1 new feedback about the app'), 'and so does the new admin');

  // 9. Signing out clears the phone
  await parent.goto(APP + '#/more'); await parent.getByRole('button', { name: /Sign out/ }).click();
  await waitFor(async () => (await body(parent)).includes('Send me a 6-digit code'), 'parent back at sign-in');
  ok(!JSON.stringify(await parent.evaluate(() => localStorage)).includes('Hello from Coach'), 'nothing of the child is left on the phone after sign-out');
  if (SHOTS) { await admin.screenshot({ path: path.join(SHOTS, 'cloud-admin.png'), fullPage: true }); }
} catch (e) { fails.push('crashed: ' + String(e.message).split('\n')[0]); console.log(e); }
finally { await browser?.close(); server.kill(); }
if (errors.length) console.log('Browser errors:\n' + [...new Set(errors)].join('\n'));
console.log(fails.length || errors.length ? `CLOUD E2E FAILED (${fails.length} checks, ${errors.length} browser errors)` : 'CLOUD E2E PASSED');
process.exit(fails.length || errors.length ? 1 : 0);
