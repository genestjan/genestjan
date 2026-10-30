// Screenshots of every screen with the sample data, phone and laptop sizes.
// Usage: npx vite preview --port 4173 & node scripts/screenshots.cjs [outDir]
const { chromium } = require('playwright');
const path = require('node:path');
const fs = require('node:fs');

const out = process.argv[2] || path.join(__dirname, '..', 'screenshots');
fs.mkdirSync(out, { recursive: true });
const base = 'http://localhost:4173/';
const routes = ['/', '/tx', '/accounts', '/budgets', '/debts', '/analytics', '/inbox', '/settings', '/more'];

(async () => {
  const browser = await chromium.launch();
  const sizes = { phone: { width: 412, height: 915, deviceScaleFactor: 2 }, laptop: { width: 1440, height: 900, deviceScaleFactor: 1 } };
  const errors = [];
  for (const [name, vp] of Object.entries(sizes)) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor });
    page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`${name} console: ${m.text()}`));
    await page.goto(base);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(out, `${name}-welcome.png`) });
    await page.goto(`${base}?demo#/`);
    await page.waitForSelector('main');
    await page.waitForTimeout(800);
    for (const r of routes) {
      await page.evaluate((h) => { location.hash = h; }, r);
      await page.waitForTimeout(500);
      const file = `${name}-${r === '/' ? 'home' : r.slice(1)}.png`;
      await page.screenshot({ path: path.join(out, file), fullPage: name === 'phone' ? false : true });
    }
    // Debts: payment schedule tab, and the add-transaction form
    await page.evaluate(() => { location.hash = '/debts'; });
    await page.waitForTimeout(300);
    await page.getByRole('tab', { name: 'Payment schedule' }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, `${name}-schedule.png`) });
    await page.evaluate(() => { location.hash = '/'; });
    await page.waitForTimeout(300);
    if (name === 'phone') await page.getByLabel('Add a transaction').click();
    else await page.getByRole('button', { name: 'Add transaction' }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, `${name}-add.png`) });
    await page.close();
  }
  await browser.close();
  if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exitCode = 1; }
  else console.log('ok', out);
})();
