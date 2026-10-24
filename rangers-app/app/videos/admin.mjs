// Video 4: admin tutorial, Tagalog captions. Filmed signed in to the local test server (supabase/local-stack/start.sh
// must be running, and the cloud build in videos/dist-cloud, see README). Every person here is invented.
import { launch, makeContext, stage, APP } from './rec.mjs';
import { SERVICE_KEY } from '../supabase/local-stack/keys.mjs';

const API = 'http://localhost:54321', MAIL = 'http://localhost:8025';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const svc = (q, init = {}) => fetch(`${API}/rest/v1/${q}`, { ...init, headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json', Prefer: 'return=representation', ...(init.headers || {}) } }).then((r) => r.json());
async function until(f, what, ms = 20000) { const t = Date.now(); for (;;) { try { const v = await f(); if (v) return v; } catch { /* again */ } if (Date.now() - t > ms) throw new Error('timed out: ' + what); await sleep(300); } }
async function signIn(p, email) {
  await fetch(`${MAIL}/api/v1/messages`, { method: 'DELETE' });
  await p.getByLabel('Email').fill(email); await p.getByRole('button', { name: 'Send me a 6-digit code' }).click();
  const code = await until(async () => {
    const r = await (await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent('to:' + email)}`)).json(); if (!r.messages?.length) return null;
    const m = await (await fetch(`${MAIL}/api/v1/message/${r.messages[0].ID}`)).json(); return (m.Text || m.HTML || '').match(/\b(\d{6})\b/)?.[1];
  }, 'code for ' + email);
  await p.getByLabel('6-digit code').fill(code); await p.getByRole('button', { name: 'Sign in' }).click();
}
const rename = (email, name) => svc('profiles?display_name=eq.' + encodeURIComponent(email), { method: 'PATCH', body: JSON.stringify({ display_name: name }) });
const idOf = async (name) => (await svc('profiles?select=id&display_name=eq.' + encodeURIComponent(name)))[0].id;
const text = (p) => p.textContent('body');

const { browser, ctx } = await launch({ dist: 'dist-cloud', clock: false });
const person = async () => (await makeContext(browser, { dist: 'dist-cloud', clock: false, viewport: { width: 390, height: 844 } })).newPage();

// ---------- off camera: the club, a squad, coaches, two families and their feedback ----------
const a = await ctx.newPage();
await a.goto(APP + '/'); await signIn(a, 'miguel@rangers.test');
await a.getByRole('button', { name: 'Set up the club (admin)' }).click(); await until(async () => (await text(a)).includes('Next up'), 'admin home');
await rename('miguel@rangers.test', 'Coach Miguel');
await a.goto(APP + '/settings'); await a.getByLabel('Name shown on your messages').fill('Coach Miguel');
await a.goto(APP + '/squad'); await a.locator('#paste').fill('1 Ana\n2 Ben\n3 Carlo\n4 Dina\n5 Eli\n6 Fe\n7 Gab\n8 Hana'); await a.getByRole('button', { name: 'Add', exact: true }).click();
const kids = await until(async () => { const r = await svc('players?select=id,first_name,team_id'); return r.length === 8 && r; }, 'players on the server');
const kid = (n) => kids.find((k) => k.first_name === n);
await a.goto(APP + '/event/new'); await a.getByRole('button', { name: 'Save event' }).click(); await sleep(800);
// two coaches: Ramon (already on the team) and Liza (waiting for approval, approved on camera)
// A new link each time (the screen may still show the last one, already used).
const newLink = async (button, label) => { const box = a.getByLabel(label); const old = (await box.count()) ? await box.inputValue() : ''; await a.getByRole('button', { name: button }).click(); return until(async () => { const v = await box.inputValue(); return v && v !== old && v; }, label); };
const coachLink = async () => { await a.goto(APP + '/settings'); return newLink('Create a coach invite link', 'Coach invite link'); };
const ramon = await person(); await ramon.goto(await coachLink()); await signIn(ramon, 'ramon@rangers.test'); await until(async () => /approve|waiting/i.test(await text(ramon)), 'ramon waiting');
await rename('ramon@rangers.test', 'Coach Ramon'); const ramonId = await idOf('Coach Ramon');
await svc('memberships?user_id=eq.' + ramonId, { method: 'PATCH', body: JSON.stringify({ status: 'active' }) });
await svc('team_staff', { method: 'POST', body: JSON.stringify({ team_id: kids[0].team_id, user_id: ramonId, head: true }) });
const liza = await person(); await liza.goto(await coachLink()); await signIn(liza, 'liza@rangers.test'); await until(async () => /approve|waiting/i.test(await text(liza)), 'liza waiting');
await rename('liza@rangers.test', 'Coach Liza');
// families: each opens their child's link, agrees to the notice, then sends feedback
async function family(child, email, name, rating, about, words) {
  await a.goto(APP + '/player/' + kid(child).id); await a.reload(); const link = await newLink('Create invite link', 'Invite link');
  const p = await person(); await p.goto(link); await signIn(p, email);
  await until(async () => (await text(p)).includes('How we look after'), 'consent for ' + name);
  await rename(email, name);
  await p.getByText('I agree').click(); await p.getByRole('button', { name: 'Continue' }).click(); await sleep(1500);
  await p.goto(APP + '/feedback'); await p.reload(); await p.getByRole('button', { name: rating, exact: true }).click(); await p.getByRole('button', { name: about, exact: true }).click();
  await p.getByLabel('Your feedback').fill(words); await p.getByRole('button', { name: 'Send feedback' }).click();
  await until(async () => (await text(p)).includes('Salamat! Thank you.'), 'feedback from ' + name);
}
await family('Ana', 'maria@rangers.test', 'Maria Santos', 'Great', 'An idea', 'Pwede po bang may paalala sa phone isang araw bago ang training? Salamat po!');
await family('Ben', 'jun@rangers.test', 'Jun Dela Cruz', 'Okay', 'Something is wrong', 'Hindi ko po agad nakita kung saan ilalagay ang PSA ni Ben. Pero nahanap ko rin sa Home.');
await ramon.goto(APP + '/'); await ramon.reload(); await sleep(2500);
await ramon.goto(APP + '/feedback'); await ramon.getByRole('button', { name: 'Great', exact: true }).click(); await ramon.getByRole('button', { name: 'Something I like', exact: true }).click();
await ramon.getByLabel('Your feedback').fill('Ang bilis ng attendance. Mas madali na kaysa sa papel.'); await ramon.getByRole('button', { name: 'Send feedback' }).click();
await until(async () => (await text(ramon)).includes('Salamat! Thank you.'), 'feedback from Ramon');
await a.close();

// ---------- on camera ----------
const r = await stage(ctx, 'admin');
const s = r.app;
const tab = (n) => s.getByRole('navigation').getByRole('link', { name: new RegExp('^' + n + '\\b') });
const B = (t) => `<b>${t}</b>`;
const S = (html, fn, min) => r.step(html, fn, min);
const coachRow = (n) => s.locator('div.border-t', { has: s.locator('b', { hasText: n }) });
// On film, links show the club's real address (this test server lives on localhost).
const pretty = () => r.frame().evaluate(() => document.querySelectorAll('input[readonly]').forEach((i) => { if (i.value.startsWith('http://localhost:4611/app/')) i.value = i.value.replace('http://localhost:4611/app/', 'https://rangersfc.net/app/'); }));

let adminLink = '';
try {
await r.go('/');
await r.start();
await r.card(`<img src="/app/crest.png"><div class="k">RANGERS APP</div><h1>Gabay para sa Admin</h1><p>Paano patakbuhin ang club sa app</p>`, 3800);
await r.card(`<div class="k">ANG GINAGAWA NG ADMIN</div><ul class="feat">${['Mag-imbita at mag-approve ng mga <b>coach</b>', 'Ilagay ang coach sa tamang <b>team</b>', 'Gumawa ng team at ayusin ang <b>settings</b>', 'Imbitahin ang mga <b>pamilya</b>', 'Basahin ang <b>feedback</b>', '<b>Ipasa</b> ang pamamahala sa ibang admin'].map((f, i) => `<li style="animation-delay:${(0.25 + i * 0.4).toFixed(2)}s"><span>${f}</span></li>`).join('')}</ul>`, 11000, 'list');
await r.uncard();

// 1 Coaches
await r.chip('1 · Mga coach');
await S(`Nasa ${B('More')}, ${B('Settings and club admin')} ang lahat ng gawain ng admin.`, async () => {
  await r.tap(tab('More'), 800); await r.tap(s.getByRole('link', { name: /Settings and club admin/ }), 1000);
  await r.show(s.getByRole('heading', { name: 'Coaches' }), 'start');
});
await S(`Para mag-imbita ng coach, i-tap ang ${B('Create a coach invite link')} at i-send sa kanya nang pribado.`, async () => {
  await r.tap(s.getByRole('button', { name: 'Create a coach invite link' }), 300); await pretty(); await r.show(s.getByLabel('Coach invite link'));
}, 5000);
await S(`Kapag nag-sign in na ang bagong coach, lalabas siya dito. I-tap ang ${B('Approve')}.`, async () => {
  await r.show(coachRow('Coach Liza')); await r.wait(500); await r.tap(coachRow('Coach Liza').getByRole('button', { name: 'Approve' }), 1200);
}, 5000);
await S(`Tapos ilagay siya sa team: ${B('Add to Rangers U10')}, o gawing ${B('Head coach')}.`, async () => {
  await r.tap(coachRow('Coach Liza').getByRole('button', { name: /^Add to / }), 1200); await r.show(coachRow('Coach Liza'));
}, 5000);
await S(`Kapag umalis ang coach: ${B('Take off')} sa team, o ${B('Remove from club')}. Ang head coach at admin lang ang makakapag-clear ng head injury.`, async () => {
  await r.show(coachRow('Coach Ramon')); await r.pointOnly(coachRow('Coach Ramon').getByRole('button', { name: 'Remove from club' }));
}, 6500);

// 2 Teams and settings
await r.chip('2 · Teams at settings');
await S(`Sa ${B('Teams')}, magdagdag ng bagong team: pangalan, programa, edad at format. Lumipat ng team gamit ang ${B('Use')}.`, async () => {
  await r.show(s.getByLabel('Team name', { exact: true }));
  await r.type(s.getByLabel('Team name', { exact: true }), 'Rangers U12', 70);
  await r.tap(s.getByLabel('Age group', { exact: true }), 200); await s.getByLabel('Age group', { exact: true }).selectOption('U12'); await r.wait(500);
  await r.tap(s.getByRole('button', { name: 'Add team' }), 900);
  await r.show(s.getByRole('heading', { name: 'Teams' }), 'start'); await r.tap(s.getByRole('button', { name: 'Use', exact: true }), 900);
}, 8000);
await S(`Sa ${B('Safety rules')}: ang ${B('Head coach PIN')} at ilang araw bago makalaro ulit pagkatapos ng head injury.`, async () => {
  await r.show(s.getByRole('heading', { name: 'Safety rules' }), 'start'); await r.pointOnly(s.getByText(/^Head coach PIN/));
}, 6000);
await S(`Sa ${B('Contributions')}: ang GCash number ng club, kung gagamitin ninyo.`, () => r.show(s.getByRole('heading', { name: 'Contributions' }), 'start'));

// 3 Families
await r.chip('3 · Mga pamilya');
await S(`Bawat bata ay may sariling ${B('invite link')} para sa magulang. Buksan ang bata sa ${B('Team')}.`, async () => {
  await r.go('/squad'); await r.tap(s.getByRole('link', { name: /Carlo/ }).first(), 1000);
}, 5000);
await S(`I-tap ang ${B('Create invite link')} at i-send sa magulang sa Messenger. Isang beses lang ito gumagana, sa loob ng 14 na araw.`, async () => {
  await r.tap(s.getByRole('button', { name: 'Create invite link' }), 300); await r.show(s.getByLabel('Invite link')); await pretty();
}, 6000);

// 4 Feedback
await r.chip('4 · Feedback');
await S(`Kapag may bagong ${B('feedback')}, makikita mo agad sa ${B('Home')}.`, async () => {
  await r.go('/'); await r.show(s.getByText(/new feedback about the app/), 'center');
}, 5000);
await S('Basahin ang sinasabi ng mga magulang at coach. Dito nanggagaling ang mga susunod na pagbabago sa app.', async () => {
  await r.tap(s.getByText(/new feedback about the app/), 1200);
}, 6000);
await S(`I-tap ang ${B('Done')} kapag naayos na. Makikita ito ng nagpadala, kaya alam niyang nabasa.`, async () => {
  await r.tap(s.getByRole('button', { name: 'Done', exact: true }).first(), 900);
}, 5500);
await S(`Puwedeng i-${B('download')} lahat bilang spreadsheet, at pumili kung sino pa ang makakatanggap ng feedback.`, async () => {
  await r.tap(s.getByRole('button', { name: 'All (3)' }), 600);
  await r.show(s.getByRole('button', { name: /Download all as a spreadsheet/ })); await r.wait(800);
  await r.show(s.getByRole('heading', { name: 'Who gets feedback' }), 'start');
}, 6500);

// 5 Handing over
await r.chip('5 · Pagpapasa');
await S(`Kung ipapasa mo ang pamamahala, pumunta sa ${B('Club admins')} at i-tap ang ${B('Create an admin invite link')}.`, async () => {
  await r.go('/settings'); await r.show(s.getByRole('heading', { name: 'Club admins' }), 'start');
  await r.tap(s.getByRole('button', { name: 'Create an admin invite link' }), 0);
  adminLink = await s.getByLabel('Admin invite link').inputValue(); await pretty(); await r.wait(900);
}, 6000);
await S(`I-send ito nang pribado sa ${B('isang tao lang')}, hindi sa group chat. Isang beses lang gumagana, sa loob ng 3 araw.`, () => r.show(s.getByText(/Send it to one person/)), 5500);
await r.card(`<div class="k">KAPAG BINUKSAN NIYA ANG LINK</div><h1>Admin na siya agad</h1><p>Pagka-sign in niya gamit ang Google, makikita na niya ang lahat ng gawain ng admin.</p>`, 1000);
{ const bea = await person(); await bea.goto(adminLink); await signIn(bea, 'bea@rangers.test'); await until(async () => (await text(bea)).includes('You are now a club admin'), 'bea is admin').catch(async (e) => { console.log('BEA PAGE:', bea.url(), (await text(bea)).slice(0, 400)); throw e; }); await rename('bea@rangers.test', 'Coach Bea'); await bea.context().close(); }
await r.wait(4500);
await r.go('/settings'); await r.uncard();
await S(`Ngayon dalawa na kayong admin. Puwede ka nang mag-${B('Step down as admin')}. Mananatili kang coach.`, async () => {
  await r.show(s.getByRole('heading', { name: 'Club admins' }), 'start'); await r.pointOnly(s.getByRole('button', { name: 'Step down as admin' }));
}, 6500);
await S(`Bago mag-step down, sa ${B('Feedback inbox')} i-tap ang ${B('Keep sending me feedback')}, para patuloy mong mabasa ang feedback.`, async () => {
  await r.go('/feedback/inbox'); await r.tap(s.getByRole('button', { name: /Keep sending me feedback/ }), 1200);
}, 7000);
await S('Laging may kahit isang admin ang club. Hindi ka makakapag-step down kung ikaw lang ang admin.', null, 5000);

// 6 Help
await r.chip('6 · Tulong');
await S(`May tanong? Itanong sa ${B('Help')}, kahit sa Tagalog.`, async () => {
  await r.go('/help'); await r.type(s.getByLabel('Ask a question'), 'paano mag add ng admin?', 60); await r.tap(s.getByRole('button', { name: 'Ask', exact: true }), 900);
}, 6000);
await r.chip('');
await r.card(`<img src="/app/crest.png"><h1>Handa ka na, Admin!</h1><p>Salamat sa pamamahala ng Rangers.</p><div class="pill">rangersfc.net/app</div>`, 5500);
await r.stop();
} catch (e) { console.log('FAILED', String(e.message).split('\n').slice(0, 4).join(' | ')); await r.page.screenshot({ path: new URL('./out/err.png', import.meta.url).pathname }); }
await browser.close();
