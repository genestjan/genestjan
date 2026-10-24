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
execSync('npx vite build --outDir dist-cloud', { stdio: 'ignore', env: { ...process.env, APP_BASE: BASE, VITE_SUPABASE_URL: API, VITE_SUPABASE_ANON_KEY: ANON_KEY } });
const server = spawn('npx', ['vite', 'preview', '--outDir', 'dist-cloud', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', env: { ...process.env, APP_BASE: BASE } });
let browser;
try {
  await waitFor(() => fetch(APP).then((r) => r.ok), 'preview server');
  browser = await chromium.launch({ executablePath: exe });
  const mk = async (who) => { const c = await browser.newContext({ viewport: { width: 390, height: 844 } }); const p = await c.newPage(); watch(p, who); return p; };
  const admin = await mk('admin'), parent = await mk('parent'), coach = await mk('coach');
  const body = (p) => p.textContent('body');

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
  await coach.reload();
  await waitFor(async () => (await body(coach)).includes('Next up'), 'approved coach reaches the dashboard');
  await coach.goto(APP + '#/squad'); await waitFor(async () => (await body(coach)).includes('Ben'), 'coach sees the team squad');

  // 8. Head injury: coach records it, the block reaches every coach, only a head coach clears it
  await coach.goto(APP + '#/safety?player=' + ben.id); await coach.getByRole('button', { name: /Record head injury/ }).click();
  await waitFor(async () => (await svc("records?kind=eq.injury&select=data")).some((r) => r.data.head), 'head injury saved');
  await admin.reload(); await sleep(1500); await admin.goto(APP + '#/squad');
  await waitFor(async () => (await body(admin)).includes('out: head knock'), 'head-knock block reaches the other coach\'s phone');
  await coach.goto(APP + '#/player/' + ben.id); await coach.getByRole('button', { name: 'Head coach: record medical clearance' }).click();
  await waitFor(async () => (await svc("records?kind=eq.injury&select=data")).some((r) => r.data.clearedOn), 'head coach clearance saved');

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
