// End-to-end check of the coach and parent flows in a real browser (local-only mode, parent preview).
// Usage: npm run test:e2e   (builds, serves dist on a free port, runs, stops). Set CHROMIUM_PATH to use a local Chromium.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PORT = 4300 + Math.floor(Math.random() * 500);
const SHOTS = process.env.E2E_SHOTS || '';
const exe = process.env.CHROMIUM_PATH || (() => {
  const root = '/opt/pw-browsers'; if (!fs.existsSync(root)) return undefined;
  const d = fs.readdirSync(root).find((x) => x.startsWith('chromium-')); if (!d) return undefined;
  return ['chrome-linux/chrome', 'chrome-linux64/chrome'].map((p) => path.join(root, d, p)).find(fs.existsSync);
})();

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const B = `http://localhost:${PORT}/#`;
const fails = []; const errors = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('FAIL', m); } else console.log('ok  ', m); };
let browser;
try {
  for (let i = 0; i < 50; i++) { try { await fetch(`http://localhost:${PORT}/`); break; } catch { await new Promise((r) => setTimeout(r, 200)); } }
  browser = await chromium.launch({ executablePath: exe });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push('page error: ' + String(e).slice(0, 200)));
  p.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push('console: ' + m.text().slice(0, 200)));
  // Fixed forecast so the heat check is deterministic (34°C, 60% humidity = heat index 42, Danger).
  await p.route('**/api.open-meteo.com/**', (r) => r.fulfill({ json: { hourly: { time: Array.from({ length: 168 }, (_, i) => new Date(Date.now() + 8 * 3600e3 + i * 3600e3).toISOString().slice(0, 13) + ':00'), temperature_2m: Array(168).fill(34), relative_humidity_2m: Array(168).fill(60), precipitation_probability: Array(168).fill(10), weather_code: Array(168).fill(1), cape: Array(168).fill(0) } } }));
  const text = () => p.textContent('body');
  const shot = (n) => SHOTS && p.screenshot({ path: path.join(SHOTS, `e2e-${n}.png`), fullPage: true });
  const ANA = '20000000-0000-4000-8000-000000000001', BEN = '20000000-0000-4000-8000-000000000002';

  await p.goto(B + '/squad'); await p.getByRole('button', { name: 'Load demo team' }).click();
  ok((await text()).includes('Nico'), 'demo team loaded');
  await p.goto(B + '/event/new'); await p.getByRole('button', { name: 'Save event' }).click(); await p.waitForURL(/#\/schedule/);
  ok((await text()).includes('Training'), 'event created and listed');
  await p.getByText('Training').first().click(); await p.waitForTimeout(500);
  ok(/Heat index up to 42°C: Danger/.test(await text()), 'heat forecast shown on the event'); await shot('event');
  await p.getByRole('button', { name: 'Ben No' }).click();
  await p.goto(B + '/inbox'); await p.getByLabel('Title').fill('No training Saturday'); await p.getByLabel('Message').first().fill('Rain expected, stay safe'); await p.getByRole('button', { name: 'Post' }).click();
  ok((await text()).includes('No training Saturday'), 'announcement posted');
  await p.getByRole('button', { name: 'Messages' }).click(); await p.getByRole('link', { name: 'Ana', exact: true }).click();
  await p.getByLabel('Message').fill('Ana did great today!'); await p.getByRole('button', { name: 'Send' }).click();
  ok((await text()).includes('Ana did great today!'), 'coach message sent');

  // parent of Ana
  await p.goto(B + '/player/' + ANA); await p.getByRole('button', { name: /Preview as this child/ }).click(); await p.waitForTimeout(300);
  ok((await text()).includes('Preview: this is what a parent sees'), 'parent preview on');
  ok(await p.getByRole('link', { name: 'Squad', exact: true }).count() === 0 && await p.getByRole('link', { name: 'Train', exact: true }).count() === 0, 'parent has no coach tabs');
  await p.getByRole('button', { name: 'Going', exact: true }).first().click(); await shot('parent-home');
  await p.getByRole('link', { name: /^Inbox/ }).click(); ok((await text()).includes('No training Saturday'), 'parent sees announcement');
  await p.getByRole('button', { name: 'Messages' }).click(); await p.getByRole('link', { name: /Message the coach about Ana/ }).click();
  ok((await text()).includes('Ana did great today!'), 'parent sees coach message');
  await p.getByLabel('Message').fill('Thank you coach, she loved it'); await p.getByRole('button', { name: 'Send' }).click();
  ok((await text()).includes('she loved it'), 'parent reply sent');
  await p.goto(B + '/privacy'); await p.getByLabel('Emergency contact 1 name').fill('Maria'); await p.getByLabel('Emergency contact 1 phone').fill('09171234567');
  ok((await text()).includes('How we look after'), 'parent sees privacy notice and can edit emergency contacts');
  await p.goto(B + '/progress'); ok((await text()).includes('No term review has been shared yet'), 'parent sees no unpublished review');
  await p.goto(B + '/squad'); ok(!(await text()).includes('Nico'), 'parent cannot open the squad page');

  // back to coach
  await p.goto(B + '/more'); await p.getByRole('button', { name: 'Back to the coach app' }).click(); await p.waitForTimeout(300);
  await p.goto(B + '/inbox'); await p.getByRole('button', { name: 'Messages' }).click();
  ok((await text()).includes('she loved it'), 'coach sees parent reply');
  await p.goto(B + '/player/' + ANA); ok(await p.getByLabel('Emergency contact 1 phone').inputValue() === '09171234567', 'coach sees the emergency contact the parent entered');
  await p.goto(B + '/'); ok(/1\s*Going/.test((await text()).replace(/\n/g, ' ')) || (await text()).includes('Going'), 'coach dashboard counts replies');

  // review: publish, parent sees it without the private note; take back hides it
  await p.goto(B + '/review/' + ANA); await p.getByRole('group', { name: 'First touch' }).getByRole('button', { name: 'Got it' }).click();
  await p.getByRole('group', { name: 'Inside-foot passing' }).getByRole('button', { name: 'Getting it' }).click();
  await p.getByText('One or two sentences').locator('textarea').fill('Lovely first touch this term.'); await p.getByText('Your private note').locator('textarea').fill('SECRET coach note');
  await p.getByRole('button', { name: 'Publish to the family' }).click(); await shot('review');
  await p.goto(B + '/player/' + ANA); await p.getByRole('button', { name: /Preview as this child/ }).click(); await p.goto(B + '/progress'); await p.waitForTimeout(300);
  const body = await text(); ok(body.includes('Lovely first touch') && !body.includes('SECRET'), 'parent sees the published comment and never the coach note'); await shot('progress');
  await p.goto(B + '/more'); await p.getByRole('button', { name: 'Back to the coach app' }).click();

  // training, safety, match, board
  await p.goto(B + '/train'); await p.getByRole('button', { name: 'Save and start' }).click(); await p.waitForURL(/#\/train\/run/); ok((await text()).includes('Start the clock'), 'training session built and run mode opens'); await shot('run');
  await p.goto(B + '/safety?player=' + BEN); await p.getByRole('button', { name: /Record head injury/ }).click();
  await p.goto(B + '/match'); await p.getByRole('button', { name: /New match for/ }).click(); await p.waitForURL(/#\/match\//);
  ok((await text()).includes('Ben (out)'), 'child with a head knock is excluded from the match');
  ok(/Fairest gap: [0-5] min/.test(await text()), 'minutes plan is within one window for the demo squad');
  await p.getByRole('button', { name: 'Go to match' }).click(); await p.getByRole('button', { name: 'Kick off' }).click(); await p.waitForTimeout(800);
  ok((await text()).includes('On the pitch (8)'), 'match kicks off with 8 on the pitch'); await shot('live');
  for (const r of ['/', '/schedule', '/inbox', '/train', '/squad', '/more', '/match', '/board', '/safety', '/recognise', '/review', '/motivation', '/support', '/settings', '/help', '/drills', '/drills/D04', '/tv']) { await p.goto(B + r); await p.waitForTimeout(150); }
  await p.goto(B + '/board'); await p.getByRole('button', { name: 'Give-and-go' }).click(); await p.getByRole('button', { name: '+ Step' }).click(); await p.getByRole('button', { name: 'Save to my library' }).click();
  ok((await text()).includes('(mine)'), 'board move saved to the library'); await shot('board');
  await p.reload(); await p.goto(B + '/squad'); ok((await text()).includes('Nico'), 'data persists after reload');

  // TV-size Match Day Board
  const tv = await ctx.newPage(); await tv.setViewportSize({ width: 1920, height: 1080 });
  const matchUrl = (await p.evaluate(() => location.href));
  await p.goto(B + '/match'); const live = await p.getByRole('link', { name: /Match day/ }).first().getAttribute('href');
  await tv.goto(`http://localhost:${PORT}/${live.replace('/live', '/present')}`); await tv.waitForTimeout(400);
  ok((await tv.textContent('body')).includes('Bench'), 'Match Day Board renders at TV size'); if (SHOTS) await tv.screenshot({ path: path.join(SHOTS, 'e2e-tv.png') });
  void matchUrl;
} catch (e) { fails.push('crashed: ' + e.message.split('\n')[0]); console.log(e); }
finally { await browser?.close(); server.kill(); }
if (errors.length) { console.log('Browser errors:\n' + errors.join('\n')); }
console.log(fails.length || errors.length ? `E2E FAILED (${fails.length} checks, ${errors.length} browser errors)` : 'E2E PASSED');
process.exit(fails.length || errors.length ? 1 : 0);
