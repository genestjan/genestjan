const { chromium } = require('playwright'); const fs = require('fs'); const S = process.argv[2];
(async () => { const b = await chromium.launch();
  for (const [n, w, h] of [['introH', 1920, 1080], ['introV', 1080, 1920]]) {
    const c = await b.newContext({ viewport: { width: w, height: h }, recordVideo: { dir: S + '/vid/raw-' + n, size: { width: w, height: h } } });
    const p = await c.newPage(); await p.goto('http://localhost:4173/fetch/'); await p.waitForTimeout(3900);
    const v = p.video(); await c.close(); fs.renameSync(await v.path(), S + '/vid/' + n + '.webm'); }
  await b.close(); console.log('intro ok'); })();
