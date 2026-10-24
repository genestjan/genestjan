// Video 1: coach tutorial, Tagalog captions. Button names stay in English because the app is in English.
import { launch, stage } from './rec.mjs';
import { seed } from './seed.mjs';

const { browser, ctx } = await launch();
await seed(ctx);
const r = await stage(ctx, 'coach');
const a = r.app;
const tab = (n) => a.getByRole('navigation').getByRole('link', { name: new RegExp('^' + n + '\\b') });
const tile = (n) => a.getByRole('link', { name: new RegExp('^' + n) });
const B = (t) => `<b>${t}</b>`;
const S = (html, fn, min) => r.step(html, fn, min);

try {
await r.go('/');
await r.start();
await r.card(`<img src="/app/crest.png"><div class="k">RANGERS APP</div><h1>Gabay para sa Coach</h1><p>Paano gamitin ang app, hakbang-hakbang</p>`, 3600);
await r.card(`<div class="k">BAGO MAGSIMULA</div><h1>Mag-sign in</h1><p>Buksan ang ${B('rangersfc.net/app')} sa Chrome at i-tap ang ${B('Sign in with Google')}.</p><p>Ang club admin ang mag-a-approve ng coach account mo.</p>`, 5200);
await r.uncard();

// 1 Home
await r.chip('1 · Home');
await S(`Ito ang ${B('Home')}. Nandito ang lahat ng kailangan mo bilang coach.`);
await S(`Ang bawat ${B('tile')} ay shortcut: Schedule, Attendance, Assign tasks at iba pa.`, () => r.scroll(300, 1100));
await S(`Sa ${B('Next up')}, kita agad ang susunod na training at kung ilan ang pupunta.`, () => r.show(a.getByText('Next up', { exact: true }), 'start'));
await S(`Sa ${B('Needs your attention')}, nandito ang mga dapat mong asikasuhin: mensahe, task photos at iba pa.`, () => r.show(a.getByText('Needs your attention', { exact: true }), 'start'));

// 2 Team
await r.chip('2 · Team');
await S(`Sa ${B('Team')} nakalista ang lahat ng player mo.`, () => r.tap(tab('Team'), 700));
await S(`Para magdagdag, i-type ang numero at pangalan, isa bawat linya. Tapos i-tap ang ${B('Add')}.`, async () => {
  await r.type(a.locator('#paste'), '15 Lito\n16 Mika', 70);
  await r.tap(a.getByRole('button', { name: 'Add', exact: true }), 700);
});
await S('Ayan, kasama na sila. Pangalan o palayaw lang ang lumalabas sa screen ng mga bata.', () => r.show(a.getByText('Mika', { exact: true })));
await r.card(`<div class="k">IMBITAHIN ANG MGA MAGULANG</div><h1>Isang link bawat bata</h1><p>Buksan ang player at i-tap ang ${B('Create invite link')}. I-send sa magulang sa Messenger o text.</p><p>Isang beses lang gumagana ang link, kaya ligtas.</p>`, 6200);
await r.uncard();

// 3 Schedule
await r.chip('3 · Schedule');
await S(`Sa ${B('Schedule')} makikita ang lahat ng training at laro.`, () => r.tap(tab('Schedule'), 800));
await S(`I-tap ang ${B('+')} para magdagdag. Piliin kung ${B('training')}, ${B('match')} o ${B('school meet')}.`, async () => {
  await r.tap(a.getByRole('link', { name: 'New event' }), 800);
  await r.tap(a.getByRole('button', { name: 'match', exact: true }), 500);
});
await S('Ilagay ang pamagat, petsa, oras, lugar at kalaban.', async () => {
  await r.type(a.locator('label:has-text("Title") input'), 'Friendly', 60);
  await r.type(a.locator('label:has-text("Opponent") input'), 'Gila Academy', 60);
});
await S(`I-tap ang ${B('Save event')}. Makikita agad ito ng mga magulang.`, () => r.tap(a.getByRole('button', { name: 'Save event' }), 900));
await S('Buksan ang event para makita ang detalye.', () => r.tap(a.getByText('Training').first(), 900));
await S(`May ${B('heat forecast')}, para alam mo kung masyadong mainit para sa mga bata.`, () => r.show(a.getByText('Heat and weather', { exact: true }), 'start'));
await S(`Kita rin ang sagot ng bawat pamilya: ${B('Yes')}, ${B('Maybe')} o ${B('No')}.`, () => r.show(a.getByText('Replies', { exact: true }), 'start'));

// 4 Inbox
await r.chip('4 · Inbox');
await S(`Sa ${B('Inbox')}, mag-post ng announcement para sa lahat ng pamilya.`, async () => {
  await r.tap(tab('Inbox'), 800);
  await r.type(a.getByLabel('Title'), 'Dalhin ang jersey', 60);
  await r.type(a.getByLabel('Message').first(), 'May friendly tayo sa Sabado. Dalhin ang jersey at tubig.', 35);
});
await S(`I-tap ang ${B('Post')}. Makikita ito agad ng mga magulang.`, () => r.tap(a.getByRole('button', { name: 'Post' }), 900));
await S(`Sa ${B('Messages')}, may sariling usapan ka sa bawat pamilya.`, async () => {
  await r.tap(a.getByRole('button', { name: 'Messages' }), 700);
  await r.tap(a.getByRole('link', { name: /^Ben/ }), 900);
});
await S('Sa magulang napupunta ang mensahe, hindi direkta sa bata. Mas ligtas ito.', async () => {
  await r.type(a.getByLabel('Message'), 'Sige po, salamat sa pagsabi. Ingat po!', 40);
  await r.tap(a.getByRole('button', { name: 'Send' }), 700);
});

// 5 Attendance
await r.chip('5 · Attendance');
await S(`Sa ${B('Attendance')}, buksan ang training ngayong araw. Kung wala sa schedule, i-tap ang ${B('Start a training session now')}.`, async () => {
  await r.tap(tab('Home'), 700);
  await r.tap(tile('Attendance'), 900);
  await r.tap(a.getByRole('button', { name: /Start a training session now/ }), 900);
});
await S(`I-tap ang ${B('Present')}, ${B('Late')}, ${B('Absent')} o ${B('Excused')} sa bawat bata.`, async () => {
  await r.tap(a.getByRole('group', { name: 'Ana attendance', exact: true }).getByRole('button', { name: 'Present' }), 300);
  await r.tap(a.getByRole('group', { name: 'Ben attendance', exact: true }).getByRole('button', { name: 'Late' }), 300);
  await r.tap(a.getByRole('group', { name: 'Carlo attendance', exact: true }).getByRole('button', { name: 'Excused' }), 300);
});
await S('O markahan nang sabay-sabay ang lahat ng natitira bilang Present.', () => r.tap(a.getByRole('button', { name: /Mark everyone not yet marked as present/ }), 900));
await S(`May ${B('report')} bawat bata na puwedeng i-download para sa school. Hindi ito ranking.`, () => r.nav('/attendance/report'));

// 6 Assign tasks
await r.chip('6 · Assign tasks');
await S(`Magbigay ng takdang-gawain sa bahay gamit ang ${B('Assign tasks')}.`, async () => {
  await r.tap(tab('Home'), 700);
  await r.tap(tile('Assign tasks'), 900);
  await r.tap(a.getByRole('link', { name: 'New assignment' }), 900);
});
await S('Pumili ng handang listahan o gumawa ng sarili mo. Puwede ring maglagay ng YouTube video bilang gabay.', () => r.tap(a.getByRole('button', { name: 'Juggling challenge' }), 800));
await S(`Piliin ang mga player at i-tap ang ${B('Send')}.`, async () => {
  await r.check(a.getByLabel(/^Carlo/)); await r.check(a.getByLabel(/^Dina/)); await r.check(a.getByLabel(/^Eli/));
  await r.tap(a.getByRole('button', { name: /^Send to 3 players/ }), 1000);
});
await S('Kapag nagpadala ng litrato ang bata, dito mo makikita.', async () => {
  await r.nav('/assign');
  await r.tap(a.getByRole('link', { name: /Ball mastery at home/ }), 1000);
  await r.show(a.getByRole('button', { name: 'Approve' }));
});
await S(`I-tap ang ${B('Approve')}, o ${B('Try again')} kung kailangang ulitin.`, () => r.tap(a.getByRole('button', { name: 'Approve' }), 700));

// 7 Recognise
await r.chip('7 · Recognise');
await S(`Purihin ang bata sa ${B('Recognise')}. Tatlong hakbang lang.`, async () => {
  await r.tap(tab('Home'), 700);
  await r.tap(tile('Recognise'), 900);
});
await S('Una, piliin ang bata. Pangalawa, piliin ang value na ipinakita niya.', async () => {
  await r.tap(a.getByRole('button', { name: /^Dina( ★)?$/ }), 600);
  await r.tap(a.getByRole('button', { name: /Teamwork/ }), 600);
});
await S(`Pangatlo, isulat kung bakit, tapos i-tap ang ${B('Recognise')}. Makikita ito ng pamilya.`, async () => {
  await r.type(a.getByLabel('Why'), 'Tinulungan ang kakampi na natumba.', 40);
  await r.tap(a.getByRole('button', { name: 'Recognise Dina' }), 1200);
});

// 8 Pick the squad
await r.chip('8 · Pick the squad');
await S(`May laro? Buksan ang event at i-tap ang ${B('Pick the squad')}.`, async () => {
  await r.tap(tab('Schedule'), 800);
  await r.tap(a.getByText('Friendly').last(), 900);
  await r.tap(a.getByRole('link', { name: 'Pick the squad' }), 900);
});
await S('I-check ang mga batang kasama sa laro.', async () => {
  for (const n of ['Ana', 'Carlo', 'Eli', 'Fe', 'Gab', 'Hana', 'Jo', 'Kai']) await r.check(a.getByLabel(`Pick ${n}`), 150);
});
await S(`I-tap ang ${B('Save and tell the families')}. Kusang ia-announce sa team at may mensahe sa bawat napiling pamilya.`, async () => {
  await r.tap(a.getByRole('button', { name: 'Save and tell the families' }), 1200);
  await r.show(a.getByText(/^Saved \d+ in the squad/));
});

// 9 ID papers
await r.chip('9 · ID papers');
await S(`Sa ${B('ID papers')}, kita mo kung sino pa ang kulang sa ${B('Student ID')} at ${B('PSA')}.`, async () => {
  await r.tap(tab('Home'), 700);
  await r.tap(tile('ID papers'), 900);
});
await S('Laging handa ang mga papeles kapag hinanap sa tournament.', () => r.scrollBy(420, 1100));

// 10 School team
await r.chip('10 · School team');
await r.card(`<div class="k">PARA SA SCHOOL TEAM</div><h1>SPED Rangers at Road to Palaro</h1><p>Intramurals, District Meet, GSCAA, SRAA hanggang ${B('Palarong Pambansa')}.</p>`, 4400);
await r.go('/settings'); await r.uncard();
await S(`Sa ${B('More')}, ${B('Settings')}, i-on ang ${B('School team (DepEd)')}.`, async () => {
  await r.show(a.getByText('School team (DepEd)'));
  await r.tap(a.getByText('School team (DepEd)'), 700);
  await r.tap(a.getByText(/^Mixed ages/), 500);
});
await S('Ilagay ang pangalan ng school at ang age cutoff ng bawat category.', async () => {
  await r.type(a.getByLabel('School', { exact: true }), 'GSC SPED Integrated School', 35);
  await r.fill(a.getByLabel('Cutoff for Elementary Boys'), '2013-01-01');
});
await S(`Sa ${B('Road to Palaro')}, makikita ang bawat yugto at ang susunod na meet.`, () => r.go('/pathway'));
await S(`I-tap ang ${B('Add a District Meet date')}, tapos ${B('Save event')}.`, async () => {
  await r.tap(a.getByRole('link', { name: /Add a District Meet date/ }), 900);
  await r.tap(a.getByRole('button', { name: 'Save event' }), 900);
});
await S('Bawat bata may screening checklist: PSA, Form 137, dental, parental consent at medical clearance.', async () => {
  await r.go('/pathway');
  await r.tap(a.locator('a', { hasText: /^Ben\b/ }), 900);
  await r.show(a.getByText('Form 137 / SF10', { exact: true }));
  await r.tap(a.getByText('Form 137 / SF10', { exact: true }), 500);
});
await S('Piliin ang category at kusang chine-check ang edad laban sa cutoff ng DepEd.', async () => {
  await r.show(a.getByLabel('Category'));
  await r.tap(a.getByLabel('Category'), 200); await a.getByLabel('Category').selectOption('Elementary Boys'); await r.wait(600);
  await r.show(a.getByText(/Age OK/));
});

// 11 Help
await r.chip('11 · Help');
await r.go('/');
await S(`May tanong? I-tap ang ${B('?')} sa itaas para sa ${B('Help')}.`, () => r.tap(a.getByRole('link', { name: 'Help' }), 900));
await S('Itanong lang, kahit sa Tagalog o Bisaya. Sasagot agad, kahit walang internet.', async () => {
  await r.type(a.getByLabel('Ask a question'), 'paano mag attendance?', 60);
  await r.tap(a.getByRole('button', { name: 'Ask', exact: true }), 900);
  await r.show(a.getByRole('button', { name: 'Show me how' }));
});
await S(`I-tap ang ${B('Show me how')} at ituturo ng app ang bawat hakbang sa mismong screen.`, async () => {
  await r.tap(a.getByRole('button', { name: 'Show me how' }), 1500);
});

await r.card(`<img src="/app/crest.png"><h1>Handa ka na, Coach!</h1><p>Buksan ang ${B('rangersfc.net/app')}</p><div class="pill">Libre para sa club. Walang ads.</div>`, 4800);
await r.stop();
} catch (e) { console.log('FAILED', String(e.message).split('\n').slice(0, 4).join(' | ')); await r.page.screenshot({ path: new URL('./out/err.png', import.meta.url).pathname }); }
await browser.close();
