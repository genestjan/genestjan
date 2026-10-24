// Video 3: promo, about two minutes, Tagalog. Slow enough to read: each clip holds about 6 seconds,
// and a card near the end lists every feature.
import { launch, stage, APP } from './rec.mjs';
import { seed, ANA } from './seed.mjs';

const { browser, ctx } = await launch();
await seed(ctx, { school: true });
{ // a District Meet so the Road to Palaro shows a coming meet
  const p = await ctx.newPage(); await p.goto(APP + '/event/new?meet=district'); await p.waitForTimeout(300);
  await p.locator('label:has-text("Where") input').fill('GSCNHS (City High)'); await p.getByRole('button', { name: 'Save event' }).click(); await p.waitForURL(/#\/schedule/); await p.close();
}
const r = await stage(ctx, 'promo');
const a = r.app;
const tab = (n) => a.getByRole('navigation').getByRole('link', { name: new RegExp('^' + n + '\\b') });
const B = (t) => `<b>${t}</b>`;
// caption first, a pause to read it, then the action, then time to see the result
const S = (html, fn, min = 6000) => r.step(html, async () => { await r.wait(1000); if (fn) await fn(); await r.wait(1400); }, min);

const FEATURES = [
  `${B('Schedule')} ng training at laro, may RSVP`,
  `${B('Attendance')} sa isang tap, may report`,
  `${B('Takdang-gawain')} sa bahay, may litrato`,
  `${B('Pili ng squad')}, kusang ina-announce`,
  `${B('Tactics board')}: iguhit o i-play ang galaw`,
  `${B('Road to Palaro')} para sa SPED Rangers`,
  `${B('Student ID at PSA')}, laging handa`,
  `${B('Detalye at emergency contact')} ng bata`,
  `${B('Mensahe')} sa coach at announcements`,
  `${B('Papuri at Progress')} ng anak mo`,
  `${B('Heat forecast')} para ligtas ang mga bata`,
  `${B('Help chat')} sa Tagalog, Bisaya o English`,
  `Gumagana kahit ${B('mahina ang signal')}`,
];

try {
await r.go('/');
await r.start();
await r.card(`<div class="k">COACH KA BA? MAGULANG?</div><h1>Hirap sumabay sa schedule, papeles at tasks ng team?</h1>`, 5500);
await r.card(`<img src="/app/crest.png"><div class="k">IPINAKIKILALA</div><h1>Ang Rangers App</h1><p>Isang app para sa ${B('buong team')}: coach, magulang at player.</p>`, 5800);
await r.uncard();
await r.chip('Para sa Coach');
await S(`Lahat ng kailangan ng team, ${B('nasa isang lugar')}.`, () => r.scroll(330, 1600));
await S(`${B('Schedule')} ng training at laro, may sagot ng bawat pamilya.`, () => r.tap(tab('Schedule'), 1000));
await S(`${B('Attendance')} sa isang tap.`, async () => {
  await r.go('/attendance'); await r.tap(a.getByRole('button', { name: /Start a training session now/ }), 1000);
  for (const [n, v] of [['Ana', 'Present'], ['Ben', 'Late'], ['Carlo', 'Present']]) await r.tap(a.getByRole('group', { name: `${n} attendance`, exact: true }).getByRole('button', { name: v }), 450);
});
await S(`${B('Takdang-gawain')} sa bahay, may litrato bilang patunay.`, async () => {
  await r.go('/assign'); await r.tap(a.getByRole('link', { name: /Ball mastery at home/ }), 1000);
  await r.show(a.getByRole('button', { name: 'Approve' })); await r.wait(800); await r.tap(a.getByRole('button', { name: 'Approve' }), 700);
});
await S(`Piliin ang ${B('squad')}. Kusang ina-announce sa mga pamilya.`, async () => {
  await r.go('/schedule'); await r.tap(a.getByText('Friendly').first(), 900); await r.tap(a.getByRole('link', { name: 'Pick the squad' }), 900);
  for (const n of ['Ana', 'Ben', 'Carlo', 'Dina']) await r.check(a.getByLabel(`Pick ${n}`), 250);
  await r.tap(a.getByRole('button', { name: 'Save and tell the families' }), 1000);
}, 7000);
await S(`${B('Tactics board')}: iguhit ang diskarte gamit ang daliri.`, async () => {
  await r.go('/board'); await r.tap(a.getByRole('button', { name: 'Full screen' }), 700); await r.tap(a.getByRole('button', { name: 'Draw', exact: true }), 600);
  const b = await a.getByRole('img', { name: 'Tactics board' }).boundingBox(); const P = (x, y) => ({ x: b.x + x * b.width, y: b.y + y * b.height });
  await r.trace([P(0.5, 0.66), P(0.58, 0.55), P(0.68, 0.42)]);
  await r.tap(a.getByRole('button', { name: 'Pass line' }), 400); await r.tap(a.getByRole('button', { name: 'White lines' }), 400);
  await r.trace([P(0.33, 0.6), P(0.24, 0.47), P(0.27, 0.34)]);
}, 9000);
await S(`O i-play ang galaw: ${B('gumagalaw')} ang mga player sa screen.`, async () => {
  await r.tap(a.getByRole('button', { name: 'Exit full screen' }), 500); await r.tap(a.getByRole('button', { name: 'Step by step' }), 500); await r.tap(a.getByRole('button', { name: 'Give-and-go', exact: true }), 800); await r.scroll(0, 800);
  await r.tap(a.getByRole('button', { name: 'Full screen' }), 600); await r.tap(a.getByRole('button', { name: 'Play', exact: true }), 500); await r.wait(5500);
}, 9500);
await r.chip('SPED Rangers');
await S(`Handa sa ${B('Road to Palaro')}: edad, papeles at bawat meet.`, async () => { await r.go('/pathway'); await r.wait(600); await r.scrollBy(260, 1400); });
await S(`${B('Student ID')} at ${B('PSA')}, laging handa sa tournament.`, () => r.go('/documents'));
await r.card(`<div class="k">PARA SA MAGULANG AT PLAYER</div><h1>Alam mo ang lahat</h1><p>Schedule, tasks at balita mula sa coach, nasa phone mo.</p>`, 4800);
await r.go('/player/' + ANA); await a.getByRole('button', { name: /Preview as this child/ }).click(); await r.wait(500); await r.go('/');
await r.uncard(); await r.chip('Para sa Magulang');
await S(`I-tap ang ${B('Going')} para alam ng coach na darating ang anak mo.`, async () => { await r.scrollBy(200, 1200); await r.tap(a.getByRole('button', { name: 'Going', exact: true }).first(), 900); });
await S(`${B('Papuri')} at pag-unlad ng anak mo, makikita mo.`, () => r.go('/progress'));
await S(`May tanong? Sumasagot ang ${B('Help')}, kahit Tagalog o Bisaya.`, async () => {
  await r.go('/help'); await r.type(a.getByLabel('Ask a question'), 'kailan ang training?', 80); await r.tap(a.getByRole('button', { name: 'Ask', exact: true }), 900);
}, 7000);
await r.chip('');
await r.card(`<div class="k">LIGTAS AT PRIBADO</div><h1>Walang ads</h1><p>Pribado ang impormasyon ng bata. Gumagana kahit mahina ang signal.</p>`, 6000);
await r.card(`<div class="k">LAHAT NG ITO, NASA RANGERS APP</div><ul class="feat">${FEATURES.map((f, i) => `<li style="animation-delay:${(0.25 + i * 0.35).toFixed(2)}s"><span>${f}</span></li>`).join('')}</ul>`, 21000, 'list');
await r.card(`<img src="/app/crest.png"><h1>Libre para sa Rangers family</h1><p>Buksan ang ${B('rangersfc.net/app')}</p><div class="pill">Mag-sign in gamit ang Google</div>`, 7500);
await r.stop();
} catch (e) { console.log('FAILED', String(e.message).split('\n').slice(0, 4).join(' | ')); await r.page.screenshot({ path: new URL('./out/err.png', import.meta.url).pathname }); }
await browser.close();
