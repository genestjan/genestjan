// Off-camera set-up with the demo team (invented names only), done through the app's own screens.
import { APP, V, NOW } from './rec.mjs';
import path from 'node:path';

export const IMG = (n) => path.join(V, 'img', n);
export const ANA = '20000000-0000-4000-8000-000000000001', BEN = '20000000-0000-4000-8000-000000000002', CARLO = '20000000-0000-4000-8000-000000000003';

const localIn = (days, h) => { const d = new Date(NOW.getTime() + days * 864e5 + 8 * 3600e3); return `${d.toISOString().slice(0, 10)}T${String(h).padStart(2, '0')}:00`; };

export async function seed(ctx, { school = false } = {}) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('seed page error:', String(e).slice(0, 200)));
  const go = async (h) => { await p.goto(APP + h); await p.waitForTimeout(250); };
  await go('/squad'); await p.getByRole('button', { name: 'Load demo team' }).click();

  // weekly training from tomorrow, and a friendly next Saturday
  await go('/event/new'); await p.locator('label:has-text("Repeat weekly for") select').selectOption('4'); await p.getByRole('button', { name: 'Save event' }).click(); await p.waitForURL(/#\/schedule/);
  await go('/event/new'); await p.getByRole('button', { name: 'match', exact: true }).click();
  await p.locator('label:has-text("Title") input').fill('Friendly'); await p.locator('label:has-text("Starts") input').fill(localIn(7, 8));
  await p.locator('label:has-text("Opponent") input').fill('FC New Mabu'); await p.getByRole('button', { name: 'Save event' }).click(); await p.waitForURL(/#\/schedule/);

  // replies for tomorrow's training
  await p.getByText('Training').first().click(); await p.waitForTimeout(300);
  for (const [n, v] of [['Ana', 'going'], ['Ben', 'no'], ['Carlo', 'going'], ['Dina', 'maybe'], ['Eli', 'going'], ['Fe', 'going'], ['Gab', 'going'], ['Hana', 'going'], ['Ian', 'maybe'], ['Jo', 'going']]) await p.getByRole('button', { name: `${n} ${v}`, exact: true }).click();

  // an earlier announcement
  await go('/inbox'); await p.getByLabel('Title').fill('Bagong jersey'); await p.getByLabel('Message').first().fill('Dumating na ang bagong jersey. Kunin sa Sabado pagkatapos ng training.'); await p.getByRole('button', { name: 'Post' }).click();

  // a task list Ana has finished with photos, waiting for review
  await go('/assign/new'); await p.getByRole('button', { name: 'Ball mastery at home' }).click();
  await p.getByLabel(/^Ana/).check(); await p.getByLabel(/^Ben/).check(); await p.getByRole('button', { name: 'Send to 2 players' }).click(); await p.waitForURL(/#\/assign\/[0-9a-f-]{36}/);
  await go('/player/' + ANA); await p.getByRole('button', { name: /Preview as this child/ }).click(); await p.waitForTimeout(300);
  await go('/tasks'); await p.getByRole('link', { name: /Ball mastery at home/ }).click();
  for (const [i, f] of ['ball.jpg', 'cones.jpg', 'ball.jpg'].entries()) {
    await p.getByLabel('Add a photo', { exact: true }).first().setInputFiles(IMG(f));
    for (let t = 0; t < 60 && await p.getByLabel('Add a photo', { exact: true }).count() > 2 - i; t++) await p.waitForTimeout(250);
    await p.waitForTimeout(200);
  }
  await go('/more'); await p.getByRole('button', { name: 'Back to the coach app' }).click(); await p.waitForTimeout(300);

  // a parent message waiting for the coach
  await go('/player/' + BEN); await p.getByRole('button', { name: /Preview as this child/ }).click(); await p.waitForTimeout(300);
  await go('/inbox'); await p.getByRole('button', { name: 'Messages' }).click(); await p.getByRole('link', { name: /Message the coach about Ben/ }).click();
  await p.getByLabel('Message').fill('Hi Coach, male-late po si Ben bukas kasi may klase pa siya. Salamat po!'); await p.getByRole('button', { name: 'Send' }).click(); await p.waitForTimeout(300);
  await go('/details/' + BEN); await p.getByLabel('Full name').fill('Ben Santos'); await p.getByLabel('Birthday').fill('2015-06-10'); await p.waitForTimeout(300);
  await go('/more'); await p.getByRole('button', { name: 'Back to the coach app' }).click(); await p.waitForTimeout(300);

  // ID papers for some children, so the list shows who is still missing them
  for (const id of [ANA, BEN, CARLO]) {
    await go('/docs/' + id);
    await p.getByLabel('Take or choose a photo').first().setInputFiles(IMG('student-id.jpg')); await p.waitForTimeout(700);
    await p.getByLabel('Take or choose a photo').first().setInputFiles(IMG('psa.jpg')); await p.waitForTimeout(700);
  }
  if (school) {
    await go('/settings'); await p.getByText('School team (DepEd)').click(); await p.getByText(/^Mixed ages/).click();
    await p.getByLabel('School', { exact: true }).fill('GSC SPED Integrated School'); await p.waitForTimeout(300);
  }
  await p.close();
}

/** Set-up for the family video: the coach has posted, assigned, praised and picked Ana; then the app opens as Ana's parent. */
export async function seedParent(ctx) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('seed page error:', String(e).slice(0, 200)));
  const go = async (h) => { await p.goto(APP + h); await p.waitForTimeout(250); };
  await go('/squad'); await p.getByRole('button', { name: 'Load demo team' }).click();
  await go('/settings'); await p.getByText('School team (DepEd)').click(); await p.getByText(/^Mixed ages/).click();
  await p.getByLabel('School', { exact: true }).fill('GSC SPED Integrated School'); await p.waitForTimeout(200);
  await go('/event/new'); await p.locator('label:has-text("Repeat weekly for") select').selectOption('4'); await p.getByRole('button', { name: 'Save event' }).click(); await p.waitForURL(/#\/schedule/);
  await go('/event/new?meet=district'); await p.locator('label:has-text("Starts") input').fill(localIn(9, 7));
  await p.locator('label:has-text("Where") input').fill('GSCNHS (City High)'); await p.getByRole('button', { name: 'Save event' }).click(); await p.waitForURL(/#\/schedule/);
  await go('/inbox'); await p.getByLabel('Title').fill('Dalhin ang jersey'); await p.getByLabel('Message').first().fill('May District Meet tayo. Dalhin ang jersey, tubig at baon.'); await p.getByRole('button', { name: 'Post' }).click();
  await p.getByRole('button', { name: 'Messages' }).click(); await p.getByRole('link', { name: 'Ana', exact: true }).click();
  await p.getByLabel('Message').fill('Hi po! Ang galing ni Ana kanina sa training. Keep it up!'); await p.getByRole('button', { name: 'Send' }).click();
  await go('/assign/new'); await p.getByRole('button', { name: 'Ball mastery at home' }).click();
  await p.getByLabel(/^Ana/).check(); await p.getByLabel(/^Ben/).check(); await p.getByRole('button', { name: 'Send to 2 players' }).click(); await p.waitForURL(/#\/assign\/[0-9a-f-]{36}/);
  await go('/recognise'); await p.getByRole('button', { name: /^Ana( ★)?$/ }).click(); await p.getByRole('button', { name: /Teamwork/ }).click();
  await p.getByLabel('Why').fill('Ipinasa ang bola kay Ben nang libre siya.'); await p.getByRole('button', { name: 'Recognise Ana' }).click();
  await go('/pathway'); await p.locator('a', { hasText: /^Ana\b/ }).first().click(); await p.getByText('Dental record', { exact: true }).click(); await p.waitForTimeout(200);
  await go('/schedule'); await p.getByText('District Meet').first().click(); await p.getByRole('link', { name: 'Pick the squad' }).click();
  for (const n of ['Ana', 'Ben', 'Carlo', 'Dina', 'Eli', 'Fe', 'Gab', 'Hana']) await p.getByLabel(`Pick ${n}`).check();
  await p.getByRole('button', { name: 'Save and tell the families' }).click(); await p.waitForTimeout(400);
  // last Saturday's session, so Progress has attendance to show
  await ctx.clock.setSystemTime(new Date(NOW.getTime() - 7 * 864e5));
  await go('/attendance'); await p.getByRole('button', { name: /Start a training session now/ }).click(); await p.waitForURL(/#\/attendance\/[0-9a-f-]{36}/);
  await p.getByRole('button', { name: /Mark everyone not yet marked as present/ }).click(); await p.waitForTimeout(300);
  await ctx.clock.setSystemTime(NOW);
  await go('/player/' + ANA); await p.getByRole('button', { name: /Preview as this child/ }).click(); await p.waitForTimeout(400);
  await p.close();
}
