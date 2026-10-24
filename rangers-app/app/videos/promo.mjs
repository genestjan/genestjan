// Video 3: promo, about a minute, Tagalog. Quick real clips from the app between short title cards.
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
const tile = (n) => a.getByRole('link', { name: new RegExp('^' + n) });
const B = (t) => `<b>${t}</b>`;
const S = (html, fn, min = 2600) => r.step(html, fn, min);

try {
await r.go('/');
await r.start();
await r.card(`<div class="k">COACH KA BA? MAGULANG?</div><h1>Hirap sumabay sa schedule, papeles at tasks ng team?</h1>`, 3300);
await r.card(`<img src="/app/crest.png"><div class="k">IPINAKIKILALA</div><h1>Ang Rangers App</h1><p>Isang app para sa ${B('buong team')}: coach, magulang at player.</p>`, 3400);
await r.uncard();
await r.chip('Para sa Coach');
await S(`Lahat ng kailangan ng team, ${B('nasa isang lugar')}.`, () => r.scroll(330, 1200));
await S(`${B('Schedule')} ng training at laro, may sagot ng bawat pamilya.`, () => r.tap(tab('Schedule'), 700));
await S(`${B('Attendance')} sa isang tap.`, async () => {
  await r.go('/attendance'); await r.tap(a.getByRole('button', { name: /Start a training session now/ }), 700);
  for (const [n, v] of [['Ana', 'Present'], ['Ben', 'Late'], ['Carlo', 'Present'], ['Dina', 'Present']]) await r.tap(a.getByRole('group', { name: `${n} attendance`, exact: true }).getByRole('button', { name: v }), 120);
});
await S(`${B('Takdang-gawain')} sa bahay, may litrato bilang patunay.`, async () => {
  await r.go('/assign'); await r.tap(a.getByRole('link', { name: /Ball mastery at home/ }), 800);
  await r.show(a.getByRole('button', { name: 'Approve' })); await r.tap(a.getByRole('button', { name: 'Approve' }), 400);
});
await S(`Piliin ang ${B('squad')}. Kusang ina-announce sa mga pamilya.`, async () => {
  await r.go('/schedule'); await r.tap(a.getByText('Friendly').first(), 700); await r.tap(a.getByRole('link', { name: 'Pick the squad' }), 700);
  for (const n of ['Ana', 'Ben', 'Carlo', 'Dina', 'Eli']) await r.check(a.getByLabel(`Pick ${n}`), 60);
  await r.tap(a.getByRole('button', { name: 'Save and tell the families' }), 700);
});
await r.chip('SPED Rangers');
await S(`Handa sa ${B('Road to Palaro')}: edad, papeles at bawat meet.`, async () => { await r.go('/pathway'); await r.scrollBy(260, 900); });
await S(`${B('Student ID')} at ${B('PSA')}, laging handa sa tournament.`, () => r.go('/documents'));
await r.card(`<div class="k">PARA SA MAGULANG AT PLAYER</div><h1>Alam mo ang lahat</h1>`, 2600);
await r.go('/player/' + ANA); await a.getByRole('button', { name: /Preview as this child/ }).click(); await r.wait(500); await r.go('/');
await r.uncard(); await r.chip('Para sa Magulang');
await S(`Schedule, tasks at ${B('mensahe sa coach')}, nasa phone mo.`, async () => { await r.tap(a.getByRole('button', { name: 'Going', exact: true }).first(), 500); await r.scrollBy(240, 900); });
await S(`${B('Papuri')} at pag-unlad ng anak mo.`, () => r.go('/progress'));
await S(`May tanong? Sumasagot ang ${B('Help')}, kahit Tagalog o Bisaya.`, async () => {
  await r.go('/help'); await r.type(a.getByLabel('Ask a question'), 'kailan ang training?', 45); await r.tap(a.getByRole('button', { name: 'Ask', exact: true }), 600);
});
await r.chip('');
await r.card(`<div class="k">LIGTAS AT PRIBADO</div><h1>Walang ads</h1><p>Pribado ang impormasyon ng bata. Gumagana kahit mahina ang signal.</p>`, 3600);
await r.card(`<img src="/app/crest.png"><h1>Libre para sa Rangers family</h1><p>Buksan ang ${B('rangersfc.net/app')}</p><div class="pill">Mag-sign in gamit ang Google</div>`, 5200);
await r.stop();
} catch (e) { console.log('FAILED', String(e.message).split('\n').slice(0, 4).join(' | ')); await r.page.screenshot({ path: new URL('./out/err.png', import.meta.url).pathname }); }
await browser.close();
