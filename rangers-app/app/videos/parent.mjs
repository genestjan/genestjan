// Video 2: parent and player tutorial, Tagalog captions. Demo family: Ana (invented). Sample photos only.
import { launch, stage } from './rec.mjs';
import { seedParent, IMG } from './seed.mjs';

const { browser, ctx } = await launch();
await seedParent(ctx);
const r = await stage(ctx, 'parent');
const a = r.app;
const tab = (n) => a.getByRole('navigation').getByRole('link', { name: new RegExp('^' + n + '\\b') });
const B = (t) => `<b>${t}</b>`;
const S = (html, fn, min) => r.step(html, fn, min);

try {
await r.goUrl('https://rangersfc.net/app/#/join/Xk2pQ9demo');
await r.wait(2500);
await r.start();
await r.card(`<img src="/app/crest.png"><div class="k">RANGERS APP</div><h1>Gabay para sa Magulang at Player</h1><p>Paano gamitin ang app, hakbang-hakbang</p>`, 3600);
await r.uncard();

// 1 Join
await r.chip('1 · Sumali');
await S(`Magpapadala ang coach ng ${B('invite link')} para sa anak mo. Buksan ito sa ${B('Chrome')}.`);
await S(`I-tap ang ${B('Continue with Google')} at piliin ang Gmail mo. Walang password na kailangang tandaan.`, () => r.pointOnly(a.locator('iframe').first()), 3800);
await r.card(`<div class="k">PAALALA</div><h1>Nasa Messenger ka ba?</h1><p>Hindi gumagana ang Google sign-in sa loob ng Messenger o Facebook. I-tap ang ${B('tatlong tuldok')} sa itaas at piliin ang ${B('Open in browser')}.</p>`, 6400);
await r.card(`<div class="k">PAGKATAPOS MAG-SIGN IN</div><h1>Basahin at pumayag</h1><p>Basahin ang privacy notice at i-tap ang pagpayag. Pribado ang impormasyon ng anak mo: ang coach at kayo lang ang makakakita.</p>`, 6400);
await r.go('/');
await r.uncard();

// 2 Home
await r.chip('2 · Home');
await S(`Ito ang ${B('Home')} ng magulang. Nandito ang susunod na training, mga task at mga paalala.`);
await S(`Sa susunod na training, i-tap ang ${B('Going')}, ${B('Maybe')} o ${B('Not going')} para alam ng coach kung sino ang darating.`, async () => {
  await r.tap(a.getByRole('button', { name: 'Going', exact: true }).first(), 700);
}, 4200);

// 3 ID papers
await r.chip('3 · ID papers');
await S(`Kailangan ang litrato ng ${B('Student ID')} at ${B('PSA birth certificate')}. Hinahanap ito tuwing may tournament.`, async () => {
  await r.tap(a.getByText(/Required: Ana's ID papers/), 1000);
}, 4000);
await S(`I-tap ang ${B('Take or choose a photo')} at kunan ang Student ID.`, async () => {
  await r.photo(a.getByLabel('Take or choose a photo').first(), IMG('student-id.jpg'), 1200);
});
await S('Gawin din sa PSA. Kusang pinapaliit ng app ang litrato para tipid sa data.', async () => {
  await r.photo(a.getByLabel('Take or choose a photo').first(), IMG('psa.jpg'), 1200);
  await r.scrollBy(260, 900);
});

// 4 Details
await r.chip('4 · Detalye ng bata');
await S('Ilagay ang buong detalye ng anak mo: pangalan, kaarawan at address.', async () => {
  await r.go('/details/20000000-0000-4000-8000-000000000001');
  await r.type(a.getByLabel('Full name'), 'Ana Reyes', 60);
  await r.fill(a.getByLabel('Birthday'), '2015-03-04');
  await r.type(a.getByLabel('Home address'), 'Purok 5, Brgy. Mabuhay, GenSan', 35);
});
await S(`Ilagay ang ${B('emergency contact')}: ang tatawagan ng coach kung may mangyari.`, async () => {
  await r.type(a.getByLabel('Emergency contact 1 name'), 'Maria Reyes (Nanay)', 40);
  await r.type(a.getByLabel('Emergency contact 1 phone'), '09171234567', 50);
});
await S(`Mahalaga ang ${B('allergies')}, ${B('kondisyon')} at ${B('gamot')}, para handa ang coach kung may emergency.`, async () => {
  await r.type(a.getByLabel('Allergies'), 'Mani (peanuts)', 50);
  await r.type(a.getByLabel('Condition'), 'Mild asthma', 50);
  await r.type(a.getByLabel(/^Medication/), 'Inhaler bago mag-ensayo', 40);
}, 4200);
await S('Kusang nase-save habang nagta-type ka.');

// 5 Tasks
await r.chip('5 · Tasks');
await S(`Sa ${B('Tasks')}, makikita ang takdang-gawain na bigay ng coach.`, async () => {
  await r.tap(tab('Tasks'), 800);
  await r.tap(a.getByRole('link', { name: /Ball mastery at home/ }), 1000);
});
await S('Gawin ang bawat task kasama ang anak mo. May paliwanag kung paano.', () => r.scrollBy(260, 900));
await S(`Pagkatapos, i-tap ang ${B('Add a photo')} at magpadala ng litrato bilang patunay.`, async () => {
  await r.photo(a.getByLabel('Add a photo', { exact: true }).first(), IMG('ball.jpg'), 1500);
});
await S('Gawin sa lahat ng task hanggang maubos ang listahan.', async () => {
  for (const f of ['cones.jpg', 'ball.jpg']) {
    const n = await a.getByLabel('Add a photo', { exact: true }).count();
    await r.photo(a.getByLabel('Add a photo', { exact: true }).first(), IMG(f), 600);
    for (let t = 0; t < 40 && await a.getByLabel('Add a photo', { exact: true }).count() >= n; t++) await r.wait(200);
  }
  await r.show(a.getByText(/Well done/));
});
await S(`Ayan! ${B('Well done')}. Titingnan ng coach at sasabihin kung ${B('Approved')} o kailangang ulitin.`);

// 6 Inbox
await r.chip('6 · Inbox');
await S(`Sa ${B('Inbox')}, mababasa ang mga announcement ng coach.`, () => r.tap(tab('Inbox'), 900));
await S(`Sa ${B('Messages')}, puwede kang magtanong o magpaalam sa coach nang pribado.`, async () => {
  await r.tap(a.getByRole('button', { name: 'Messages' }), 700);
  await r.tap(a.getByRole('link', { name: /Message the coach about Ana/ }), 900);
});
await S('I-type ang mensahe at i-tap ang Send.', async () => {
  await r.type(a.getByLabel('Message'), 'Salamat po, Coach! Excited na po si Ana.', 45);
  await r.tap(a.getByRole('button', { name: 'Send' }), 800);
});

// 7 Squad and Road to Palaro
await r.chip('7 · Squad at Palaro');
await S(`Kapag napili ang anak mo sa squad, may mensahe ka agad mula sa coach.`, () => r.show(a.getByText(/has been picked for District Meet/)));
await S(`Sa ${B('Road to Palaro')}, kita kung anong papeles pa ang kulang para sa screening.`, async () => { await r.go('/pathway'); await r.show(a.getByText(/Still needed/)); }, 3600);

// 8 Progress
await r.chip('8 · Progress');
await S(`Sa ${B('Progress')}, makikita ang papuri ng coach at ang attendance ng anak mo.`, () => r.go('/progress'));
await S('Hindi ito ikinukumpara sa ibang bata. Ang pag-unlad lang ng anak mo ang makikita.', () => r.scrollBy(300, 1000));

// 9 Help and install
await r.chip('9 · Help');
await S(`May tanong? I-tap ang ${B('?')} at itanong lang, kahit sa Tagalog o Bisaya.`, async () => {
  await r.go('/');
  await r.tap(a.getByRole('link', { name: 'Help' }).first(), 900);
  await r.type(a.getByLabel('Ask a question'), 'kailan ang training?', 60);
  await r.tap(a.getByRole('button', { name: 'Ask', exact: true }), 900);
}, 4000);
await r.card(`<div class="k">I-INSTALL SA PHONE</div><h1>Parang totoong app</h1><p>Sa Chrome, i-tap ang ${B('tatlong tuldok')} at piliin ang ${B('Add to Home screen')}. Sa iPhone, i-tap ang ${B('Share')} at ${B('Add to Home Screen')}.</p>`, 6800);
await r.card(`<img src="/app/crest.png"><h1>Tara na, sali na!</h1><p>Hintayin ang invite link mula sa coach, o buksan ang ${B('rangersfc.net/app')}</p><div class="pill">Libre. Walang ads. Pribado.</div>`, 5000);
await r.stop();
} catch (e) { console.log('FAILED', String(e.message).split('\n').slice(0, 4).join(' | ')); await r.page.screenshot({ path: new URL('./out/err.png', import.meta.url).pathname }); }
await browser.close();
