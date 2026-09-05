/**
 * The gear train's teeth must never pass through each other.
 *
 * Phase is derived, not eyeballed, so this is the check that the derivation is
 * right: it walks every meshing pair at every column count the layout can use,
 * rotates them through three tooth pitches, and looks for any point that is
 * inside both gears at once. It also proves the teeth actually engage, since
 * "no interference" is trivially true for gears that never touch.
 *
 *   node scripts/check-gears.mjs
 */
import { trainLayout, profileAt, OUTER, ROOT, SPAN } from '../lib/gear.ts';

const N = 14;
const TAU = Math.PI * 2;
let failed = false;

const inside = (g, t, px, py) => {
  const dx = px - g.x, dy = py - g.y;
  const r = Math.hypot(dx, dy);
  if (r > OUTER) return false;
  if (r <= ROOT) return true;
  const theta = (g.phase * Math.PI) / 180 + g.dir * t;
  let u = (((Math.atan2(dy, dx) - theta) / TAU) * N) % 1;
  if (u < 0) u += 1;
  return r <= profileAt(u);
};

for (const cols of [7, 4, 3, 2]) {
  const { gears } = trainLayout(14, cols, N);
  let hits = 0, meshed = 0;
  for (let i = 1; i < gears.length; i++) {
    const a = gears[i - 1], b = gears[i];
    if (Math.abs(Math.hypot(b.x - a.x, b.y - a.y) - SPAN) > 0.01) continue;
    meshed++;
    for (let s = 0; s < 240; s++) {
      const t = (s / 240) * (TAU / N) * 3;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      for (let ox = -12; ox <= 12; ox += 0.6) {
        for (let oy = -12; oy <= 12; oy += 0.6) {
          if (inside(a, t, mx + ox, my + oy) && inside(b, t, mx + ox, my + oy)) hits++;
        }
      }
    }
  }
  if (meshed !== 13) { console.error(`FAIL cols=${cols}: ${meshed} meshing pairs, expected 13`); failed = true; }
  if (hits) { console.error(`FAIL cols=${cols}: ${hits} interference points`); failed = true; }
  console.log(`cols=${cols}  meshing pairs=${meshed}  interference=${hits}`);
}

const { gears } = trainLayout(14, 7, N);
const [a, b] = gears;
let engaged = 0;
for (let s = 0; s < 120; s++) {
  const t = (s / 120) * (TAU / N) * 2;
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  for (let oy = -10; oy <= 10; oy += 0.5) {
    if (inside(a, t, mx + 2, my + oy) || inside(b, t, mx - 2, my + oy)) engaged++;
  }
}
if (engaged < 500) { console.error(`FAIL: teeth barely engage (${engaged})`); failed = true; }
console.log(`teeth in the mesh region: ${engaged}`);

console.log(failed ? 'FAILED' : 'PASS: the train meshes cleanly at every column count');
process.exit(failed ? 1 : 0);
