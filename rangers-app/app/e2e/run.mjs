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
const BASE = process.env.APP_BASE || '/';   // set APP_BASE=/app/ to test the published layout
const B = `http://localhost:${PORT}${BASE}#`;
const fails = []; const errors = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('FAIL', m); } else console.log('ok  ', m); };
let browser;
try {
  for (let i = 0; i < 50; i++) { try { await fetch(`http://localhost:${PORT}${BASE}`); break; } catch { await new Promise((r) => setTimeout(r, 200)); } }
  browser = await chromium.launch({ executablePath: exe, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });   // a fake camera for the video recorder
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['camera', 'microphone'] });
  // Most checks skip the welcome screen and tours (they are tested on a fresh phone below).
  await ctx.addInitScript(() => { try { for (const k of ['welcome', 'tour-coach', 'tour-parent']) localStorage.setItem('rangers-' + k, '1'); } catch { /* ignore */ } });
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


  // assignments: coach sends, parent clears the list with photos, coach reviews
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const photo = { name: 'proof.png', mimeType: 'image/png', buffer: PNG };
  await p.goto(B + '/assign/new'); await p.getByRole('button', { name: 'Ball mastery at home' }).click();
  await p.route('**/www.youtube-nocookie.com/**', (r) => r.fulfill({ contentType: 'text/html', body: '<p>video</p>' }));
  await p.getByLabel('YouTube link to a how-to video').fill('https://vimeo.com/123'); ok((await text()).includes('That is not a YouTube video link'), 'a non-YouTube link is pointed out');
  await p.getByLabel('YouTube link to a how-to video').fill('https://youtu.be/dQw4w9WgXcQ');
  ok(await p.locator('iframe[src^="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"]').count() === 1, 'coach added a YouTube how-to video (privacy-friendly player)');
  await p.getByLabel(/^Add a photo \(for example/).setInputFiles(photo); await p.waitForTimeout(400);
  ok((await text()).includes('Remove the photo'), 'coach attached a how-to photo');
  // a short how-to video recorded with the (fake) camera
  await p.getByRole('button', { name: 'Record a video' }).click(); await p.getByRole('button', { name: 'Start recording' }).click({ timeout: 8000 });
  await p.waitForTimeout(1600); await p.getByRole('button', { name: 'Stop' }).click();
  await p.getByRole('button', { name: 'Send this video' }).click({ timeout: 8000 }); await p.getByRole('button', { name: 'Remove the video' }).waitFor({ timeout: 8000 }).catch(() => undefined);
  ok(await p.getByRole('button', { name: 'Remove the video' }).count() === 1 && await p.locator('video[aria-label="Video sent in"]').count() === 1, 'coach recorded a short how-to video in the app');
  ok(await p.getByRole('button', { name: /^Send to 0 players/ }).isDisabled(), 'cannot send to nobody');
  await p.getByLabel(/^Ana/).check(); await p.getByLabel(/^Ben/).check(); await p.getByRole('button', { name: 'Send to 2 players' }).click(); await p.waitForURL(/#\/assign\/[0-9a-f-]{36}/);
  ok((await text()).includes('Ball mastery at home') && (await text()).includes('Ben') && (await text()).includes('0 of 3 sent'), 'assignment sent to two players');
  ok(await p.locator('video').count() === 1, 'the assignment shows the coach\'s video');
  await p.goto(B + '/player/' + ANA); await p.getByRole('button', { name: /Preview as this child/ }).click(); await p.waitForTimeout(300);
  ok((await text()).includes('1 task from your coach') && (await text()).includes('Please finish Ana'), 'parent home shows the task and the details reminder');
  await p.getByRole('link', { name: /Tasks/ }).first().click(); ok((await text()).includes('Ball mastery at home'), 'parent sees the assignment');
  await p.getByRole('link', { name: /Ball mastery at home/ }).click(); ok((await text()).includes('0 of 3 done') && (await text()).includes('How to do it') && await p.locator('iframe[src*="youtube-nocookie.com/embed/dQw4w9WgXcQ"]').count() === 1, 'task list shows the how-to video and 0 of 3');
  await p.locator('video[aria-label="Video sent in"]').first().waitFor({ timeout: 5000 }).catch(() => undefined);
  ok(await p.locator('video[aria-label="Video sent in"]').count() === 1, 'the child sees the coach\'s how-to video at home');
  await p.getByLabel('Add a photo').first().setInputFiles({ name: 'clip.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(4096, 1) }); await p.waitForTimeout(300);
  ok((await text()).includes('Tap "Add a video"') && (await text()).includes('0 of 3 done'), 'a video chosen as a photo points to the video button');
  // first task: a short video chosen from the phone (small enough to send as it is)
  await p.getByLabel('Choose a video: Add a video').first().setInputFiles(path.join(path.dirname(new URL(import.meta.url).pathname), 'fixtures', 'clip.webm'));
  for (let t = 0; t < 60 && await p.getByLabel('Add a photo', { exact: true }).count() > 2; t++) await p.waitForTimeout(250);
  ok((await text()).includes('1 of 3 done') && (await text()).includes('Videos are deleted 14 days after the coach checks them'), 'the child sent a video for a task');
  for (let i = 2; i <= 3; i++) {
    await p.getByLabel('Add a photo', { exact: true }).first().setInputFiles(photo);
    // wait until the screen shows the task as sent (one picker fewer) before choosing the next file, as a person would
    for (let t = 0; t < 60 && await p.getByLabel('Add a photo', { exact: true }).count() > 3 - i; t++) await p.waitForTimeout(250);
    await p.waitForTimeout(150);
  }
  ok((await text()).includes('Well done') && (await text()).includes('every task'), 'sending a proof for every task clears the list'); await shot('tasks');
  await p.goto(B + '/details/' + ANA);
  await p.getByLabel('Full name').fill('Ana Reyes'); await p.getByLabel('Birthday').fill('2015-03-04'); await p.getByLabel('Home address').fill('Purok 1, Mabuhay, General Santos');
  await p.getByLabel("Child's phone number (if they have one)").fill('09170000000'); await p.getByLabel('Allergies').fill('peanuts'); await p.getByLabel('Condition').fill('mild asthma');
  await p.getByLabel(/^Medication/).fill('inhaler before exercise'); await p.getByLabel(/^Anything else/).fill('Speaks Cebuano at home');
  await p.goto(B + '/'); ok(!(await text()).includes('Please finish Ana'), 'details reminder goes away once filled in');
  await p.goto(B + '/more'); await p.getByRole('button', { name: 'Back to the coach app' }).click(); await p.waitForTimeout(300);
  await p.goto(B + '/'); ok((await text()).includes('3 task proof(s) to check'), 'coach dashboard shows proofs to review');
  await p.goto(B + '/assign'); await p.getByRole('link', { name: /Ball mastery at home/ }).click(); await p.waitForTimeout(300);
  ok((await text()).includes('List cleared'), 'coach sees the cleared list');
  ok(await p.locator('video[aria-label="Video sent in"]').count() >= 2, 'coach can watch the child\'s video to check it');
  await p.getByRole('button', { name: 'Approve' }).first().click(); await p.getByRole('button', { name: 'Try again' }).nth(1).click(); await p.waitForTimeout(300);
  ok((await text()).includes('Approved') && (await text()).includes('Sent back for another try'), 'coach approves one proof and sends one back');
  await p.goto(B + '/player/' + ANA); ok(await p.getByLabel('Home address').inputValue() === 'Purok 1, Mabuhay, General Santos' && await p.getByLabel(/^Medication/).inputValue() === 'inhaler before exercise', 'coach sees the details the family entered');
  await p.getByRole('button', { name: /Preview as this child/ }).click(); await p.goto(B + '/tasks'); await p.getByRole('link', { name: /Ball mastery at home/ }).click();
  ok((await text()).includes('Try again') && (await text()).includes('Send a new photo'), 'child can resend a task that was sent back');
  await p.goto(B + '/more'); await p.getByRole('button', { name: 'Back to the coach app' }).click(); await p.waitForTimeout(300);

  // the video library: YouTube links for coaches only, or for the team's families
  await p.goto(B + '/more'); await p.getByRole('link', { name: /Video library/ }).click(); await p.getByRole('link', { name: 'Add a video' }).click();
  await p.getByLabel('YouTube link', { exact: true }).fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ'); await p.getByLabel('Title').fill('Our match day routine');
  await p.getByRole('button', { name: 'Coaches only' }).click(); await p.getByRole('button', { name: 'Save to the library' }).click(); await p.waitForURL(/#\/videos$/);
  ok(!(await text()).includes('Our match day routine'), 'a coaches-only video is not on the families tab');
  await p.getByRole('button', { name: 'For coaches' }).click(); ok((await text()).includes('Our match day routine') && (await text()).includes('Coaches only'), 'coach added a coaches-only how-we-work video');
  await p.getByRole('link', { name: 'Add a video' }).click(); await p.getByLabel('YouTube link', { exact: true }).fill('https://youtu.be/aqz-KE-bpKQ'); await p.getByLabel('Title').fill('Toe taps at home');
  await p.getByLabel('Topic').selectOption('ball-skills'); await p.getByRole('button', { name: 'Save to the library' }).click(); await p.waitForURL(/#\/videos$/);
  ok((await text()).includes('Toe taps at home') && (await text()).includes('Ball skills'), 'coach added a video for the team');
  await p.goto(B + '/player/' + ANA); await p.getByRole('button', { name: /Preview as this child/ }).click(); await p.waitForTimeout(300);
  await p.goto(B + '/more'); await p.getByRole('link', { name: /Videos from the coaches/ }).click();
  ok((await text()).includes('Toe taps at home') && !(await text()).includes('Our match day routine') && await p.getByRole('link', { name: 'Add a video' }).count() === 0, 'the family sees the team video, not the coaches-only one, and cannot add videos');
  await p.getByRole('button', { name: 'Play video' }).click(); ok(await p.locator('iframe[src*="youtube-nocookie.com/embed/aqz-KE-bpKQ"]').count() === 1, 'the video plays only when tapped (saves data)');
  await p.goto(B + '/more'); await p.getByRole('button', { name: 'Back to the coach app' }).click(); await p.waitForTimeout(300);

  // a brand new phone: welcome screen, then the "getting started" guide on the real screens, once only
  const fresh = await browser.newContext({ viewport: { width: 390, height: 844 } }); const f = await fresh.newPage();
  await f.goto(B + '/'); await f.getByRole('button', { name: 'Get started' }).waitFor({ timeout: 5000 }).catch(() => undefined); ok((await f.textContent('body')).includes('Welcome to Rangers'), 'new phone sees the welcome screen');
  await f.getByRole('button', { name: 'Get started' }).click(); await f.waitForTimeout(800);
  const dlg = () => f.getByRole('dialog', { name: 'Show me how' });
  ok((await dlg().textContent()).includes('step 1 of 7') && (await dlg().textContent()).includes('Your Home screen') && !(await dlg().textContent()).includes('not on the screen yet'), 'the getting-started guide points at the real Today screen');
  for (let i = 0; i < 6; i++) { await f.getByRole('button', { name: 'Next' }).click(); await f.waitForTimeout(250); }
  ok((await dlg().textContent()).includes('Help is always here') && !(await dlg().textContent()).includes('not on the screen yet'), 'the last step points at the Help button');
  await f.getByRole('button', { name: 'Done' }).click(); await f.waitForTimeout(200);
  ok(await f.getByRole('dialog').count() === 0, 'guide closes');
  await f.reload(); await f.waitForTimeout(500); ok(!(await f.textContent('body')).includes('Welcome to Rangers') && await f.getByRole('dialog').count() === 0, 'welcome and guide do not come back');
  await f.getByRole('link', { name: 'Help' }).first().click(); await f.waitForURL(/#\/help/);
  await f.getByLabel('Ask a question').fill('How do I take attendance?'); await f.getByRole('button', { name: 'Ask', exact: true }).click();
  ok((await f.textContent('body')).includes('Tap Present, Late, Absent or Excused'), 'Help chat answers a how-to question');
  await f.getByRole('button', { name: 'Show me how' }).first().click(); await f.waitForTimeout(800);
  ok(/#\/attendance/.test(f.url()) && (await dlg().textContent()).includes('Open today'), 'Show me how opens the right screen with the guide');
  await f.getByRole('button', { name: 'Close' }).click(); await fresh.close();

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
  for (const r of ['/', '/schedule', '/inbox', '/train', '/squad', '/more', '/match', '/board', '/safety', '/recognise', '/review', '/motivation', '/support', '/settings', '/help', '/drills', '/drills/D04', '/tv', '/feedback', '/feedback/inbox']) { await p.goto(B + r); await p.waitForTimeout(150); }
  await p.goto(B + '/more'); await p.getByRole('link', { name: /Send feedback about the app/ }).click();
  ok((await text()).includes('Help us make the app better') && (await text()).includes('signed in'), 'feedback screen opens from More (sending needs the club app online)');
  // tactics board: free drawing with a finger, undo, erase, drag a player, ready set-ups, full screen, a move played step by step
  await p.goto(B + '/board'); const pitch = p.getByRole('img', { name: 'Tactics board' });
  const lines = () => pitch.locator('path[stroke-linejoin="round"]').count();
  const at = async (fx, fy) => { const b = await pitch.boundingBox(); return [b.x + fx * b.width, b.y + fy * b.height]; };
  const stroke = async (a, z) => { await p.mouse.move(...(await at(...a))); await p.mouse.down(); const [x, y] = await at(...z); await p.mouse.move(x, y, { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(100); };
  ok(await pitch.locator('ellipse').count() === 3, 'board opens with players drawn as figures (2 v 1)');
  await p.getByRole('button', { name: 'Draw', exact: true }).click(); await stroke([0.5, 0.65], [0.7, 0.35]);
  await p.getByRole('button', { name: 'Pass line' }).click(); await p.getByRole('button', { name: 'White lines' }).click(); await stroke([0.3, 0.6], [0.2, 0.3]);
  ok(await lines() === 2 && await pitch.locator('path[stroke-dasharray]').count() === 1, 'coach draws a run and a dashed pass with a finger');
  await p.getByRole('button', { name: 'Undo' }).click(); ok(await lines() === 1, 'undo takes the last line away');
  await p.getByRole('button', { name: 'Erase', exact: true }).click(); await p.mouse.click(...(await at(0.6, 0.5))); ok(await lines() === 0, 'tapping a line with Erase removes it');
  await p.getByRole('button', { name: 'Move', exact: true }).click();
  const fig = pitch.locator('g[transform^="translate"]').first(); const figAt = await fig.getAttribute('transform');
  const [fx, fy] = figAt.match(/[\d.]+/g).map(Number); const b0 = await pitch.boundingBox();
  const from = [b0.x + fx / 100 * b0.width, b0.y + fy / 160 * b0.height];
  await p.mouse.move(...from); await p.mouse.down(); await p.mouse.move(from[0] + 60, from[1] - 80, { steps: 8 }); await p.mouse.up();
  ok(await fig.getAttribute('transform') !== figAt, 'a player can be dragged to a new spot');
  await p.getByRole('button', { name: /^Full teams/ }).click(); ok(await pitch.locator('ellipse').count() === 16, 'full teams set up in one tap (8 v 8)');
  await p.getByRole('button', { name: 'Full screen' }).click(); ok(await p.getByRole('button', { name: 'Exit full screen' }).isVisible(), 'board goes full screen'); await p.getByRole('button', { name: 'Exit full screen' }).click();
  await p.getByRole('button', { name: 'Step by step' }).click(); await p.getByRole('button', { name: 'Give-and-go' }).click();
  await p.getByRole('button', { name: 'Play', exact: true }).click(); await p.waitForTimeout(400); ok(await p.getByRole('button', { name: 'Stop' }).isVisible(), 'a ready-made move plays'); await p.getByRole('button', { name: 'Stop' }).click();
  await p.getByRole('button', { name: 'Add step' }).click(); ok(await p.getByRole('button', { name: 'Step 4' }).isVisible(), 'a step is added');
  await p.getByRole('button', { name: 'Save to my library' }).click();
  ok((await text()).includes('Give-and-go (mine)') && (await text()).includes('Step by step, 4 steps'), 'board move saved to the library'); await shot('board');
  await p.reload(); await p.goto(B + '/squad'); ok((await text()).includes('Nico'), 'data persists after reload');

  // typing in the event form keeps focus (the box used to lose focus after each letter)
  await p.goto(B + '/event/new'); const title = p.locator('label:has-text("Title") input'); await title.fill(''); await title.pressSequentially('Training at City High', { delay: 5 });
  ok(await title.inputValue() === 'Training at City High', 'typing letter by letter in the event form works');

  // attendance: start a session now, mark children, see the report
  await p.goto(B + '/attendance'); await p.getByRole('button', { name: /Start a training session now/ }).click(); await p.waitForURL(/#\/attendance\/[0-9a-f-]{36}/);
  await p.getByRole('group', { name: 'Ana attendance', exact: true }).getByRole('button', { name: 'Present' }).click();
  await p.getByRole('group', { name: 'Ben attendance', exact: true }).getByRole('button', { name: 'Late' }).click();
  await p.getByRole('group', { name: 'Carlo attendance', exact: true }).getByRole('button', { name: 'Excused' }).click();
  await p.getByRole('button', { name: /Mark everyone not yet marked as present/ }).click();
  ok(await p.getByRole('group', { name: 'Nico attendance', exact: true }).getByRole('button', { name: 'Present' }).getAttribute('aria-pressed') === 'true', 'attendance: mark individually, then everyone else present');
  await p.goto(B + '/attendance/report'); ok((await text()).includes('Ana') && (await text()).includes('100%') && (await text()).includes('Download for the school'), 'attendance report per child'); await shot('attendance');

  // recognise in three steps, with undo
  await p.goto(B + '/recognise'); await p.getByRole('button', { name: /^Ana( ★)?$/ }).click(); await p.getByRole('button', { name: /Teamwork/ }).click(); await p.getByLabel('Why').fill('Passed to Ben when he was free');
  await p.getByRole('button', { name: 'Recognise Ana' }).click(); ok((await text()).includes('Saved: Ana for Teamwork'), 'recognition saved with a clear confirmation');
  await p.getByRole('button', { name: 'Undo' }).click(); ok(!(await text()).includes('Passed to Ben when he was free'), 'recognition can be undone');
  await p.getByRole('button', { name: /^Ana( ★)?$/ }).click(); await p.getByRole('button', { name: /Teamwork/ }).click(); await p.getByLabel('Why').fill('Passed to Ben when he was free'); await p.getByRole('button', { name: 'Recognise Ana' }).click();
  ok((await text()).includes('Recently recognised'), 'recent recognitions are listed');

  // school team: settings, a District Meet, screening, the Road to Palaro
  await p.goto(B + '/settings'); await p.getByText('School team (DepEd)').click(); await p.getByText(/^Mixed ages/).click();
  await p.getByLabel('School', { exact: true }).fill('GSC SPED Integrated School'); await p.getByLabel('Cutoff for Secondary Boys').fill('2009-01-01');
  await p.goto(B + '/event/new?meet=district'); ok(await p.locator('label:has-text("Title") input').inputValue() === 'District Meet', 'a District Meet link pre-fills the school meet');
  await p.getByRole('button', { name: 'Save event' }).click(); await p.waitForURL(/#\/schedule/);
  await p.goto(B + '/pathway'); ok((await text()).includes('District Meet') && (await text()).includes('Coming up') && (await text()).includes('GSC SPED Integrated School'), 'Road to Palaro shows the ladder and the next meet');
  await p.locator('a', { hasText: /^Ana\b/ }).first().click(); await p.getByLabel('Category').selectOption('Secondary Boys'); await p.getByText('PSA birth certificate', { exact: true }).click();
  await p.getByRole('button', { name: 'Region XII' }).click();
  ok((await text()).includes('Age OK'), 'age checked against the DepEd cutoff (birthday from the family)'); await shot('screening');
  await p.goto(B + '/review/' + ANA); ok((await text()).includes('U12'), 'mixed ages: Ana (11) is reviewed against U12, not the team group');

  // pick the squad for the meet; the team is told and each picked family gets a message
  await p.goto(B + '/schedule'); await p.getByText('District Meet').first().click(); await p.getByRole('link', { name: 'Pick the squad' }).click();
  await p.getByLabel('Pick Ana').check(); await p.getByLabel('Pick Dina').check();
  await p.getByRole('button', { name: 'Save and tell the families' }).click(); ok((await text()).includes('Saved 2 in the squad. Posted to the team. Sent 2 family messages.'), 'squad saved, announced and families messaged'); await shot('squad');
  await p.goto(B + '/inbox'); ok((await text()).includes('Squad: District Meet') && (await text()).includes('Ana (#1)'), 'squad announcement posted');

  // the family view: squad, screening, ID papers
  await p.goto(B + '/player/' + ANA); await p.getByRole('button', { name: /Preview as this child/ }).click(); await p.waitForTimeout(300);
  ok((await text()).includes("Required: Ana's ID papers") && (await text()).includes('Road to Palaro'), 'family home shows the ID papers reminder and the school card');
  await p.goto(B + '/pathway'); ok((await text()).includes('Still needed: Form 137 / SF10') && (await text()).includes('Selected for: SRAA'), 'family sees what papers are still needed and the selection');
  await p.goto(B + '/schedule'); await p.getByText('District Meet').first().click(); ok((await text()).includes('Ana is in the squad.'), 'family sees their child is in the squad');
  await p.goto(B + '/inbox'); await p.getByRole('button', { name: 'Messages' }).click(); await p.getByRole('link', { name: /Message the coach about Ana/ }).click(); ok((await text()).includes('Ana has been picked for District Meet'), 'family received the private squad message');
  await p.goto(B + '/docs/' + ANA);
  await p.getByLabel('Take or choose a photo').first().setInputFiles(photo); await p.waitForTimeout(600); await p.getByLabel('Take or choose a photo').first().setInputFiles(photo); await p.waitForTimeout(600);
  await p.goto(B + '/'); ok(!(await text()).includes("Required: Ana's ID papers"), 'ID papers reminder goes once both photos are in');
  await p.goto(B + '/help'); await p.getByLabel('Ask a question').fill('kailan ang ensayo?'); await p.getByRole('button', { name: 'Ask', exact: true }).click();
  ok((await text()).includes('Next: ') || (await text()).includes('Nothing is scheduled yet'), 'family asks in Filipino and gets the next session');
  await p.goto(B + '/more'); await p.getByRole('button', { name: 'Back to the coach app' }).click(); await p.waitForTimeout(300);
  await p.goto(B + '/documents'); ok((await text()).includes('Student ID, PSA'), 'coach sees which children have their ID papers');

  // ID photos are deleted when a child leaves the club
  await p.goto(B + '/docs/20000000-0000-4000-8000-000000000014'); await p.getByLabel('Take or choose a photo').first().setInputFiles(photo); await p.waitForTimeout(600);
  const mediaCount = () => p.evaluate(() => new Promise((r) => { const q = indexedDB.open('rangers-app'); q.onsuccess = () => { const c = q.result.transaction('media').objectStore('media').count(); c.onsuccess = () => r(c.result); }; }));
  const before = await mediaCount();
  p.once('dialog', (d) => d.accept()); await p.goto(B + '/player/20000000-0000-4000-8000-000000000014'); await p.getByRole('button', { name: 'Mark as left the club' }).click(); await p.waitForTimeout(500);
  ok((await mediaCount()) === before - 1, 'a child\'s ID photo is deleted when they leave the club');

  // TV-size Match Day Board
  const tv = await ctx.newPage(); await tv.setViewportSize({ width: 1920, height: 1080 });
  const matchUrl = (await p.evaluate(() => location.href));
  await p.goto(B + '/match'); const live = await p.getByRole('link', { name: /Match day/ }).first().getAttribute('href');
  await tv.goto(`http://localhost:${PORT}${BASE}${live.replace('/live', '/present')}`); await tv.waitForTimeout(400);
  ok((await tv.textContent('body')).includes('Bench'), 'Match Day Board renders at TV size'); if (SHOTS) await tv.screenshot({ path: path.join(SHOTS, 'e2e-tv.png') });
  void matchUrl;
} catch (e) { fails.push('crashed: ' + e.message.split('\n')[0]); console.log(e); }
finally { await browser?.close(); server.kill(); }
if (errors.length) { console.log('Browser errors:\n' + errors.join('\n')); }
console.log(fails.length || errors.length ? `E2E FAILED (${fails.length} checks, ${errors.length} browser errors)` : 'E2E PASSED');
process.exit(fails.length || errors.length ? 1 : 0);
