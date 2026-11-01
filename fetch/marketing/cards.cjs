const { chromium } = require('playwright'); const fs = require('fs');
const S = process.argv[2]; const cards = JSON.parse(fs.readFileSync(S + '/cards.json'));
(async () => { const b = await chromium.launch();
  for (const [name, d] of Object.entries(cards)) {
    const vert = name.startsWith('t_'); const p = await b.newPage({ viewport: vert ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 } });
    await p.goto('file://' + S + '/cards/card.html?d=' + encodeURIComponent(JSON.stringify(d))); await p.waitForTimeout(300);
    await p.screenshot({ path: S + '/cards/' + name + '.png' }); await p.close(); }
  // Marketing background for phone footage (logo-free grid)
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('file://' + S + '/cards/card.html?d=' + encodeURIComponent(JSON.stringify({ html: '' }))); await p.screenshot({ path: S + '/cards/bg.png' });
  await p.setViewportSize({ width: 1080, height: 1920 }); await p.screenshot({ path: S + '/cards/bgv.png' });
  await b.close(); console.log('cards done'); })();
