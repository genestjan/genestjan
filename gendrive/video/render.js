// Renders a GenDrive video frame by frame from a timeline and pipes JPEG frames into ffmpeg.
// The page clock is paused: it moves only when a frame is stepped, never with real time,
// so the in-app clock and every animation match the film exactly, however slow the render.
// Usage: node render.js <timeline.json> <film.html> <out.mp4> [fps] [firstFrame] [endFrame]
// Frames are numbered from 0; a segment renders firstFrame up to (not including) endFrame.
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const [, , timelinePath, htmlPath, outPath, fpsArg, firstArg, endArg] = process.argv;
const fps = Number(fpsArg || 30);
const T0 = new Date("2026-10-31T19:42:00+08:00").getTime();

(async () => {
  const tl = JSON.parse(fs.readFileSync(timelinePath, "utf8"));
  const total = Math.round(tl.total * fps);
  const first = Number(firstArg || 0);
  const last = Math.min(Number(endArg || total), total);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, timezoneId: "Asia/Manila", locale: "en-US" });
  await page.clock.install({ time: T0 });
  await page.clock.pauseAt(T0 + 3000); // film time 0 = 19:42:03 in Manila
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto("file://" + path.resolve(htmlPath));
  await page.evaluate((t) => window.film.load(t), tl);
  let clockMs = Math.round((first * 1000) / fps);
  if (clockMs > 0) await page.clock.runFor(clockMs); // a later segment starts with the clock where it belongs

  const ff = spawn("ffmpeg", [
    "-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-",
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(fps), outPath,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const t0 = Date.now();
  for (let f = first; f < last; f++) {
    await page.evaluate((x) => window.film.at(x), f / fps);
    const target = Math.round(((f + 1) * 1000) / fps);
    await page.clock.runFor(target - clockMs);
    clockMs = target;
    const buf = await page.screenshot({ type: "jpeg", quality: 90 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if ((f - first) % (fps * 10) === 0) console.log(`frame ${f - first}/${last - first} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  await browser.close();
  console.log("done", outPath);
})();
