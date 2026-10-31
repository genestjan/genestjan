// Single frames from a film, with the same paused clock as render.js.
// Usage: node stills.js <timeline.json> <film.html> <outDir> <t1> <t2> ...  (seconds, ascending)
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const [, , tlPath, htmlPath, outDir, ...times] = process.argv;
const T0 = new Date("2026-10-31T19:42:00+08:00").getTime();
(async () => {
  const tl = JSON.parse(fs.readFileSync(tlPath, "utf8"));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, timezoneId: "Asia/Manila", locale: "en-US" });
  await page.clock.install({ time: T0 });
  await page.clock.pauseAt(T0 + 3000);
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto("file://" + path.resolve(htmlPath));
  await page.evaluate((t) => window.film.load(t), tl);
  fs.mkdirSync(outDir, { recursive: true });
  let clock = 0;
  for (const ts of times) {
    const t = Number(ts);
    const target = Math.round(t * 1000);
    if (target > clock) { await page.clock.runFor(target - clock); clock = target; }
    await page.evaluate((x) => window.film.at(x), t);
    await page.clock.runFor(34); clock += 34;
    await page.screenshot({ path: path.join(outDir, `t${String(t).replace(".", "_")}.png`) });
  }
  await browser.close();
})();
