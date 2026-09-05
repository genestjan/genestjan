/**
 * The chain has to drive the gears, not slide across them.
 *
 * Each gear's starting angle is derived rather than chosen, so this is the
 * check that the derivation holds: it walks every gear, rotates the box, and
 * confirms that wherever a chain roller meets a gear the roller is sitting in
 * a tooth gap and not riding a crest. If the lock were wrong it would hold for
 * one frame and drift away, so it is sampled across a full revolution.
 *
 *   node --experimental-strip-types scripts/check-gears.mjs
 */
import {
  trainLayout, profileAt, TEETH, CHAIN_R, CHAIN_PITCH, OUTER, ROOT,
} from '../lib/gear.ts';

const TAU = Math.PI * 2;
const K = (Math.PI * CHAIN_R) / 180;        // degrees of gear turn -> arc length
let failed = false;

/** Tooth coordinate of the gear material at its top, plus where the nearest
 *  roller sits within that same pitch. Both in units of one tooth pitch. */
function atContact(g, angle, s) {
  const theta = g.phase + g.dir * angle;
  // world angle -90 is the top of the gear
  let u = ((-90 - theta) / 360) * TEETH % 1;
  if (u < 0) u += 1;
  // roller pattern: travel along the run is the same arc length the gear turns
  const travel = angle * K;
  // Mirrored for leftward runs, so both coordinates count the same way
  // round the contact point.
  let r = ((g.dir === 1 ? s - travel : travel - s) / CHAIN_PITCH) % 1;
  if (r < 0) r += 1;
  return { u, r };
}

for (const cols of [7, 4, 3]) {
  const { gears, rows, runs } = trainLayout(14, cols);
  let worst = 1;
  let slip = 0;

  for (const g of gears) {
    const s = g.dir === 1
      ? g.x - gears[0].x
      : gears.slice(0, cols).at(-1).x - g.x;
    let base = null;
    for (let k = 0; k < 180; k++) {
      const angle = (k / 180) * 360;
      const { u, r } = atContact(g, angle, s);
      // Where the roller sits, expressed in the gear's own tooth coordinate.
      let rel = (u - r) % 1;
      if (rel < 0) rel += 1;
      if (base === null) base = rel;
      // The relationship must not drift as the box turns.
      let drift = Math.abs(rel - base);
      drift = Math.min(drift, 1 - drift);
      if (drift > 1e-6) slip++;
      // And the roller must land in the valley, which is u in [0.6, 1).
      // rel is where a roller sits in the gear's own tooth coordinate. The
      // valley runs 0.6 to 1.0, so anything outside that is a roller trying to
      // occupy the same space as a tooth.
      if (rel < 0.6 || rel >= 1) { worst = -1; }
      else worst = Math.min(worst, Math.min(rel - 0.6, 1 - rel));
    }
  }

  const ok = slip === 0 && worst > 0.05;
  if (!ok) failed = true;
  console.log(
    `cols=${cols} rows=${rows} runs=${runs.length + 1}  slip samples=${slip}  ` +
    `roller clearance from the tooth flanks=${worst.toFixed(3)} pitch  ${ok ? 'OK' : 'BAD'}`,
  );
}

// The gear outline itself must stay between its root and tip circles.
const d = (await import('../lib/gear.ts')).gearPath();
const radii = d.replace(/[MLZ]/g, ' ').trim().split(/\s+/)
  .map((p) => p.split(',').map(Number)).map(([x, y]) => Math.hypot(x, y));
if (Math.min(...radii) < ROOT - 0.1 || Math.max(...radii) > OUTER + 0.1) {
  console.error('FAIL: tooth outline leaves the root/tip band');
  failed = true;
}
console.log(`tooth outline spans ${Math.min(...radii).toFixed(1)}..${Math.max(...radii).toFixed(1)} (root ${ROOT}, tip ${OUTER})`);

console.log(failed ? 'FAILED' : 'PASS: the chain drives every gear without slipping');
process.exit(failed ? 1 : 0);
