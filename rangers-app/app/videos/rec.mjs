// Records the Rangers App inside a phone frame with Tagalog captions, using CDP screencast frames.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

export const V = path.dirname(new URL(import.meta.url).pathname);
const DIST = path.join(V, 'dist');                                   // APP_BASE=/app/ npx vite build --mode e2e --outDir videos/dist
export const SITE = process.env.SITE_DIR || '/home/user/rangersfc';   // a checkout of the club website (crest, club photo, live sign-in page)
export const ORIGIN = 'http://localhost:4611';
export const APP = ORIGIN + '/app/#';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.txt': 'text/plain' };
const exe = process.env.CHROMIUM_PATH || (() => { const root = '/opt/pw-browsers'; if (!fs.existsSync(root)) return undefined; const d = fs.readdirSync(root).find((x) => x.startsWith('chromium-')); return d && ['chrome-linux/chrome', 'chrome-linux64/chrome'].map((p) => path.join(root, d, p)).find(fs.existsSync); })();

function serve(route, file) {
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: 'not found' });
  return route.fulfill({ status: 200, contentType: MIME[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
}
export const NOW = new Date('2026-10-24T15:30:00+08:00');   // a Saturday afternoon, so times on screen look normal
const H = 240, base = Date.parse('2026-10-23T12:00:00Z');
const hourly = (t, h) => ({ hourly: { time: Array.from({ length: H }, (_, i) => new Date(base + i * 3600e3).toISOString().slice(0, 13) + ':00'), temperature_2m: Array(H).fill(t), relative_humidity_2m: Array(H).fill(h), precipitation_probability: Array(H).fill(10), weather_code: Array(H).fill(1), cape: Array(H).fill(0) } });

export async function launch() {
  const browser = await chromium.launch({ executablePath: exe });
  const ctx = await browser.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2, serviceWorkers: 'block', locale: 'en-PH', timezoneId: 'Asia/Manila', hasTouch: false });
  await ctx.clock.install({ time: NOW });
  await ctx.addInitScript(() => { try { if (location.hostname === 'localhost' && location.pathname.startsWith('/app/')) for (const k of ['welcome', 'tour-coach', 'tour-parent']) localStorage.setItem('rangers-' + k, '1'); } catch { /* ignore */ } });
  // The on-device preview shows a "Preview" strip that real families never see; hide it on film.
  await ctx.addInitScript(() => { if (location.hostname !== 'localhost' || !location.pathname.startsWith('/app/')) return; const hide = () => { for (const d of document.querySelectorAll('div.bg-crest')) if (d.textContent?.startsWith('Preview: this is what a parent sees')) d.style.display = 'none'; }; new MutationObserver(hide).observe(document, { childList: true, subtree: true }); });
  await ctx.route(ORIGIN + '/**', (r) => {
    const u = new URL(r.request().url());
    if (u.pathname === '/stage.html') {   // the stage uses the app's own fonts, whose file names change with each build
      const font = (re) => fs.readdirSync(path.join(DIST, 'assets')).find((f) => re.test(f));
      const html = fs.readFileSync(path.join(V, 'stage.html'), 'utf8').replace('__BARLOW600__', font(/^barlow-latin-600-normal-.*\.woff2$/)).replace('__BARLOW700__', font(/^barlow-latin-700-normal-.*\.woff2$/)).replace('__BEBAS__', font(/^bebas-neue-latin-400-normal-.*\.woff2$/));
      return r.fulfill({ status: 200, contentType: 'text/html', body: html });
    }
    if (u.pathname.startsWith('/app/')) return serve(r, path.join(DIST, decodeURIComponent(u.pathname.slice(5)) || 'index.html'));
    return serve(r, path.join(SITE, decodeURIComponent(u.pathname)));
  });
  await ctx.route('https://rangersfc.net/**', (r) => serve(r, path.join(SITE, decodeURIComponent(new URL(r.request().url()).pathname))));
  await ctx.route('**/api.open-meteo.com/**', (r) => r.fulfill({ json: hourly(30, 62) }));
  await ctx.route('**/*.supabase.co/**', (r) => r.abort());
  return { browser, ctx };
}

/** A recorder bound to one stage page. Every helper waits so a viewer can follow. */
export async function stage(ctx, name) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('page error:', String(e).slice(0, 200)));
  await page.goto(ORIGIN + '/stage.html');
  await page.evaluate(() => document.fonts.ready);
  const frameDir = path.join(V, 'out', name, 'frames'); fs.rmSync(path.dirname(frameDir), { recursive: true, force: true }); fs.mkdirSync(frameDir, { recursive: true });
  const cdp = await ctx.newCDPSession(page);
  const frames = []; let recording = false;
  cdp.on('Page.screencastFrame', async (f) => {
    if (recording) { const file = path.join(frameDir, `f${String(frames.length).padStart(6, '0')}.jpg`); fs.writeFileSync(file, Buffer.from(f.data, 'base64')); frames.push({ file, t: f.metadata.timestamp }); }
    try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch { /* closed */ }
  });
  const app = page.frameLocator('#app');
  const frame = () => page.frame({ name: 'app' });
  const caps = []; let capAt = 0, capNeed = 0, t0 = 0, lastCap = null;
  const now = () => Date.now() / 1000;
  const wait = (ms) => page.waitForTimeout(ms);
  const settle = async () => { const left = capAt + capNeed - Date.now(); if (left > 0) await wait(left); };
  const closeCap = () => { if (lastCap) { lastCap.end = now(); caps.push(lastCap); lastCap = null; } };
  const r = {
    page, app, frame, wait,
    async start() { recording = true; await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1 }); t0 = now(); await wait(300); },
    async go(hash) { await page.evaluate((u) => window.S.load(u), APP + hash); await wait(1000); },
    async goUrl(u) { await page.evaluate((x) => window.S.load(x), u); await wait(1200); },
    async nav(hash) { await frame().evaluate((h) => { location.hash = h; }, hash); await wait(700); },
    /** Show a caption. The next caption waits until this one has been on screen long enough to read. */
    async say(html, min = 0) {
      await settle(); closeCap();
      await page.evaluate((h) => window.S.cap(h), html);
      const plain = html.replace(/<[^>]+>/g, '');
      capAt = Date.now(); capNeed = Math.max(min, 1900, 800 + plain.length * 56);
      lastCap = { start: now(), text: plain };
    },
    settle,
    /** One caption with the actions it describes; the caption stays until it has been read and the actions are done. */
    async step(html, fn, min = 0) { await r.say(html, min); if (fn) await fn(); await settle(); await wait(250); },
    async clearCap() { await settle(); closeCap(); await page.evaluate(() => window.S.cap(null)); },
    async chip(t) { await r.clearCap(); await page.evaluate((x) => window.S.chip(x), t); },
    async card(html, ms = 2600, cls = '') { await settle(); closeCap(); await page.evaluate(() => window.S.cap(null)); await page.evaluate(([h, c]) => window.S.card(h, c), [html, cls]); const plain = html.replace(/<img[^>]*>/g, '').replace(/<\/(h1|p|div|li)>/g, '\n').replace(/<[^>]+>/g, '').replace(/\n+/g, '\n').trim(); caps.push({ start: now(), end: now() + ms / 1000, text: plain }); await wait(ms); },
    async uncard() { await page.evaluate(() => window.S.card(null)); await wait(500); },
    /** Scroll a target into view inside the app, if it is near or behind the edges. */
    async show(loc, block = 'center') {
      await loc.first().waitFor({ state: 'visible', timeout: 8000 });
      const moved = await loc.first().evaluate((el, b) => { const q = el.getBoundingClientRect(); if (q.top < 70 || q.bottom > innerHeight - 90) { el.scrollIntoView({ behavior: 'smooth', block: b }); return true; } return false; }, block);
      if (moved) await wait(750);
    },
    async pointOnly(loc) { const { x, y } = await r.point(loc); await page.evaluate(([a, c]) => window.S.press(a, c), [x, y]); await wait(400); },
    async point(loc) { const b = await loc.first().boundingBox(); if (!b) throw new Error('no box'); const x = b.x + b.width / 2, y = b.y + Math.min(b.height / 2, 28); await page.evaluate(([a, c]) => window.S.ptr(a, c), [x, y]); await wait(620); return { x, y }; },
    async tap(loc, after = 450) {
      loc = loc.first(); await r.show(loc); const { x, y } = await r.point(loc);
      await page.evaluate(([a, c]) => window.S.press(a, c), [x, y]); await wait(140);
      await loc.click(); await wait(after);
    },
    async check(loc, after = 350) { loc = loc.first(); await r.show(loc); const { x, y } = await r.point(loc); await page.evaluate(([a, c]) => window.S.press(a, c), [x, y]); await wait(120); await loc.check(); await wait(after); },
    async type(loc, text, delay = 55) { loc = loc.first(); await r.tap(loc, 150); await loc.fill(''); await loc.pressSequentially(text, { delay }); await wait(300); },
    async fill(loc, text) { loc = loc.first(); await r.tap(loc, 120); await loc.fill(text); await wait(350); },
    async photo(loc, file, after = 900) {
      loc = loc.first(); await r.show(loc);
      let target = loc; if (!(await loc.isVisible())) target = (await loc.locator('xpath=ancestor::label[1]').count()) ? loc.locator('xpath=ancestor::label[1]') : loc.locator('xpath=..');
      try { const { x, y } = await r.point(target); await page.evaluate(([a, c]) => window.S.press(a, c), [x, y]); await wait(150); } catch { /* no visible box: just send the file */ }
      await loc.setInputFiles(file); await wait(after);
    },
    /** Draws with the finger through the given page points (a line on the tactics board), the pointer following along. */
    async trace(pts, perSeg = 14) {
      await page.evaluate(([a, c]) => window.S.ptr(a, c), [pts[0].x, pts[0].y]); await wait(650);
      await page.evaluate(([a, c]) => window.S.press(a, c), [pts[0].x, pts[0].y]);
      await page.mouse.move(pts[0].x, pts[0].y); await page.mouse.down(); await wait(100);
      for (let k = 1; k < pts.length; k++) for (let i = 1; i <= perSeg; i++) {
        const x = pts[k - 1].x + (pts[k].x - pts[k - 1].x) * i / perSeg, y = pts[k - 1].y + (pts[k].y - pts[k - 1].y) * i / perSeg;
        await page.mouse.move(x, y); await page.evaluate(([a, c]) => window.S.ptr(a, c, true), [x, y]); await wait(30);
      }
      await page.mouse.up(); await wait(500);
    },
    async scroll(y, ms = 900) { await frame().evaluate((v) => window.scrollTo({ top: v, behavior: 'smooth' }), y); await wait(ms); },
    async scrollBy(y, ms = 900) { await frame().evaluate((v) => window.scrollBy({ top: v, behavior: 'smooth' }), y); await wait(ms); },
    hidePtr: () => page.evaluate(() => window.S.hidePtr()),
    async stop() {
      await settle(); closeCap(); await wait(400);
      await cdp.send('Page.stopScreencast'); recording = false; const end = now();
      if (!frames.length) throw new Error('no frames recorded');
      const z = frames[0].t;
      const list = frames.map((f, i) => `file '${f.file}'\nduration ${((frames[i + 1]?.t ?? end) - f.t).toFixed(4)}`).join('\n') + `\nfile '${frames[frames.length - 1].file}'\n`;
      const out = path.join(V, 'out', name); fs.writeFileSync(path.join(out, 'list.txt'), list);
      const ts = (s) => { s = Math.max(0, s - z); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, sec = Math.floor(s % 60), ms = Math.round((s % 1) * 1000); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms).padStart(3, '0')}`; };
      fs.writeFileSync(path.join(out, 'captions.srt'), caps.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n`).join('\n'));
      console.log(`${name}: ${frames.length} frames, ${(end - z).toFixed(1)} s, ${(frames.length / (end - z)).toFixed(1)} fps avg`);
      return { out, seconds: end - z };
    },
  };
  return r;
}
