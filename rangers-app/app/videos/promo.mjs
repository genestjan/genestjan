// Video 3: promo, Tagalog, with the tactics board as the headline feature. Slow enough to read: each clip
// holds about 6 seconds or more, and a card near the end lists every feature (the board first).
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
const pitch = () => a.getByRole('img', { name: 'Tactics board' });
const fig = async (label) => { const b = await pitch().locator('text').filter({ hasText: new RegExp(`^${label}$`) }).first().locator('xpath=..').boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const at = async (fx, fy) => { const b = await pitch().boundingBox(); return { x: b.x + fx * b.width, y: b.y + fy * b.height }; };

// the same little players as the app, for the title card
const man = (x, y, shirt, shorts, num, n) => `<g transform="translate(${x} ${y}) scale(1.7)"><ellipse cx="0" cy="6.4" rx="3.1" ry="1" fill="#000" opacity=".3"/><path d="M-1.2 2.8 L-1.4 5.9 M1.2 2.8 L1.4 5.9" stroke="#b97a4c" stroke-width="1.3" stroke-linecap="round"/><path d="M-2.7 -2.3 L-3.6 1 M2.7 -2.3 L3.6 1" stroke="${shirt}" stroke-width="1.35" stroke-linecap="round"/><rect x="-2.5" y="1.3" width="5" height="2.2" rx=".6" fill="${shorts}"/><path d="M-3 -2.9 Q0 -3.9 3 -2.9 L2.5 1.8 L-2.5 1.8 Z" fill="${shirt}" stroke="rgba(0,0,0,.4)" stroke-width=".3"/><circle cx="0" cy="-5.5" r="2.15" fill="#b97a4c"/><path d="M-2.15 -5.6 Q-2.1 -7.95 0 -7.8 Q2.1 -7.95 2.15 -5.6 Q1 -6.75 -2.15 -5.6 Z" fill="#2a1a10"/>${n ? `<text x="0" y=".75" text-anchor="middle" font-size="3.3" font-weight="700" fill="${num}" font-family="Barlow">${n}</text>` : ''}</g>`;
const ART = `<svg viewBox="0 0 160 100" width="400" height="250" style="border-radius:18px;background:#0b3a2c;box-shadow:0 10px 30px rgba(0,0,0,.4)"><defs><marker id="ay" markerWidth="5" markerHeight="5" refX="3.6" refY="2.5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L5,2.5 L0,5 z" fill="#f6c431"/></marker><marker id="aw" markerWidth="5" markerHeight="5" refX="3.6" refY="2.5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L5,2.5 L0,5 z" fill="#fff"/></marker></defs><g fill="none" stroke="#fff" stroke-opacity=".45" stroke-width=".6"><rect x="2" y="2" width="156" height="96" rx="2"/><line x1="80" y1="2" x2="80" y2="98"/><circle cx="80" cy="50" r="12"/></g><path d="M48 62 Q70 30 104 30" fill="none" stroke="#f6c431" stroke-width="1.6" stroke-linecap="round" marker-end="url(#ay)"/><path d="M50 66 L92 70" fill="none" stroke="#fff" stroke-width="1.4" stroke-dasharray="3 2.2" marker-end="url(#aw)"/>${man(44, 62, '#c31e24', '#0a1f44', '#fff', 7)}${man(98, 70, '#c31e24', '#0a1f44', '#fff', 9)}${man(76, 52, '#f4f6fa', '#5b6474', '#0a1f44', '')}</svg>`;

const FEATURES = [
  [`${B('Tactics board')}: iguhit o i-play ang galaw`, true],
  [`${B('Schedule')} ng training at laro, may RSVP`],
  [`${B('Attendance')} sa isang tap, may report`],
  [`${B('Takdang-gawain')} sa bahay, may litrato`],
  [`${B('Pili ng squad')}, kusang ina-announce`],
  [`${B('Road to Palaro')} para sa SPED Rangers`],
  [`${B('Student ID at PSA')}, laging handa`],
  [`${B('Detalye at emergency contact')} ng bata`],
  [`${B('Mensahe')} sa coach at announcements`],
  [`${B('Papuri at Progress')} ng anak mo`],
  [`${B('Heat forecast')} para ligtas ang mga bata`],
  [`${B('Help chat')} sa Tagalog, Bisaya o English`],
  [`Gumagana kahit ${B('mahina ang signal')}`],
];

try {
await r.go('/board');
await r.start();
await r.card(`<div class="k">COACH KA BA? MAGULANG?</div><h1>Hirap sumabay sa schedule, papeles at tasks ng team?</h1>`, 5500);
await r.card(`<img src="/app/crest.png"><div class="k">IPINAKIKILALA</div><h1>Ang Rangers App</h1><p>Isang app para sa ${B('buong team')}: coach, magulang at player.</p>`, 5800);

// the headline: the tactics board
await r.card(`<span class="badge">BAGO!</span><h1>Tactics board</h1>${ART}<p>Iguhit ang diskarte. Ipakita sa mga bata kung ${B('paano gumalaw')}.</p>`, 6500);
await r.uncard(); await r.chip('BAGO · Tactics board');
await S(`Isang tap lang: ${B('buong team')} na sa pitch.`, async () => {
  await r.tap(a.getByRole('button', { name: /^Full teams/ }), 900); await r.scroll(0, 900);
  await r.tap(a.getByRole('button', { name: 'Full screen' }), 900);
}, 7000);
await S(`Parang tunay na players, may ${B('numero')}. I-drag sa bagong puwesto.`, async () => {
  const p7 = await fig(7); await r.trace([p7, { x: p7.x + 6, y: p7.y - 70 }], 18);
  const p8 = await fig(8); await r.trace([p8, { x: p8.x - 30, y: p8.y - 60 }], 18);
}, 8000);
await S(`Iguhit gamit ang daliri: ${B('Run')}, ${B('Pass')} o ${B('Line')}, sa apat na kulay.`, async () => {
  await r.tap(a.getByRole('button', { name: 'Draw', exact: true }), 600);
  const p7 = await fig(7); await r.trace([{ x: p7.x, y: p7.y - 22 }, { x: p7.x - 4, y: p7.y - 70 }, { x: p7.x - 26, y: p7.y - 120 }]);
  await r.tap(a.getByRole('button', { name: 'Pass line' }), 350); await r.tap(a.getByRole('button', { name: 'White lines' }), 350);
  const p6 = await fig(6); const t7 = await fig(7); await r.trace([{ x: p6.x + 8, y: p6.y - 10 }, { x: t7.x - 10, y: t7.y - 4 }]);
  await r.tap(a.getByRole('button', { name: 'Line line' }), 350); await r.tap(a.getByRole('button', { name: 'Red lines' }), 350);
  await r.trace([await at(0.12, 0.5), await at(0.5, 0.47), await at(0.88, 0.5)]);
}, 10000);
await S(`O i-play ang galaw: ${B('gumagalaw')} ang mga player, hakbang-hakbang.`, async () => {
  await r.tap(a.getByRole('button', { name: 'Exit full screen' }), 500); await r.tap(a.getByRole('button', { name: 'Step by step' }), 500);
  await r.tap(a.getByRole('button', { name: 'Give-and-go', exact: true }), 800); await r.scroll(0, 800);
  await r.tap(a.getByRole('button', { name: 'Move', exact: true }), 400); await r.tap(a.getByRole('button', { name: 'Full screen' }), 600);
  await r.tap(a.getByRole('button', { name: 'Play', exact: true }), 500); await r.wait(6500);
}, 10000);
await S(`I-save sa ${B('My library')} at gamitin sa training o laro.`, async () => {
  await r.tap(a.getByRole('button', { name: 'Stop' }), 400); await r.tap(a.getByRole('button', { name: 'Exit full screen' }), 600);
  await r.tap(a.getByRole('button', { name: 'Save to my library' }), 900); await r.show(a.getByText('My library', { exact: true }), 'start');
}, 7000);

// the rest of the app
await r.chip('Para sa Coach');
await S(`Lahat ng kailangan ng team, ${B('nasa isang lugar')}.`, async () => { await r.go('/'); await r.scroll(330, 1600); });
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
await r.card(`<div class="k">LAHAT NG ITO, NASA RANGERS APP</div><ul class="feat">${FEATURES.map(([f, hi], i) => `<li class="${hi ? 'hi' : ''}" style="animation-delay:${(0.25 + i * 0.35).toFixed(2)}s"><span>${f}</span>${hi ? '<em>BAGO</em>' : ''}</li>`).join('')}</ul>`, 21000, 'list');
await r.card(`<img src="/app/crest.png"><h1>Libre para sa Rangers family</h1><p>Buksan ang ${B('rangersfc.net/app')}</p><div class="pill">Mag-sign in gamit ang Google</div>`, 7500);
await r.stop();
} catch (e) { console.log('FAILED', String(e.message).split('\n').slice(0, 4).join(' | ')); await r.page.screenshot({ path: new URL('./out/err.png', import.meta.url).pathname }); }
await browser.close();
