/**
 * Geometry for the fourteen stops, drawn as a chain-driven gear box.
 *
 * The gears no longer mesh with each other. They sit in a grid with a gap and
 * are driven by a roller chain that runs above, between and below the rows and
 * wraps the whole block, which is how a bank of gears like this is actually
 * built, and it lets the numbers run left to right in reading order instead of
 * snaking.
 *
 * One chain link per gear tooth, so a roller can sit in every gap. Each gear's
 * starting angle is derived from how far along its driving run it sits, which
 * is what keeps the teeth locked to the rollers instead of sliding across them.
 */

/** Every gear is drawn in a 100 unit box centred on its own origin. */
export const TEETH = 18;
export const OUTER = 47;
export const ROOT = 37;
/** Centre spacing. Horizontal leaves a visible gap; vertical is set so one
 *  chain run serves the row above it and the row below it. */
export const SX = 100;
export const SY = 92;
/** Chain centreline, measured from a gear centre. */
export const CHAIN_R = SY / 2;
/** Room around the block for the chain to wrap. */
export const MARGIN = 22;
/** One link per tooth. */
export const CHAIN_PITCH = (2 * Math.PI * CHAIN_R) / TEETH;

/**
 * Trapezoidal spur-gear outline. Real involute teeth need a curve solver and
 * none of it survives at this size; a trapezoid with the same tooth-to-gap
 * ratio is indistinguishable on screen.
 *
 * A tooth occupies one angular step: rise to 20%, crest to 40%, fall to 60%,
 * then a flat valley. The wide crest is what makes it read as cast brass
 * rather than as a saw blade.
 */
export function gearPath(teeth = TEETH, outer = OUTER, root = ROOT): string {
  const step = 360 / teeth;
  const at = (r: number, deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r).toFixed(2)}`;
  };
  let d = '';
  for (let i = 0; i < teeth; i++) {
    const b = i * step;
    d += `${i === 0 ? 'M' : 'L'}${at(root, b)}`;
    d += `L${at(outer, b + step * 0.2)}`;
    d += `L${at(outer, b + step * 0.4)}`;
    d += `L${at(root, b + step * 0.6)}`;
  }
  return `${d}Z`;
}

/** Radius of the tooth outline at normalised tooth coordinate u. */
export function profileAt(u: number, outer = OUTER, root = ROOT): number {
  if (u < 0.2) return root + (outer - root) * (u / 0.2);
  if (u < 0.4) return outer;
  if (u < 0.6) return outer - (outer - root) * ((u - 0.4) / 0.2);
  return root;
}

export function boltCircle(count: number, radius: number) {
  return Array.from({ length: count }, (_, i) => {
    const a = ((i * 360) / count) * (Math.PI / 180);
    return { cx: +(Math.cos(a) * radius).toFixed(2), cy: +(Math.sin(a) * radius).toFixed(2) };
  });
}

export type Placed = { x: number; y: number; phase: number; dir: 1 | -1; row: number };
export type Train = {
  gears: Placed[];
  /** The chain that wraps the block. */
  loop: string;
  /** The straight runs between rows, each already pointing the way it travels. */
  runs: string[];
  width: number;
  height: number;
  rows: number;
};

export function trainLayout(count: number, cols: number): Train {
  const rows = Math.ceil(count / cols);
  const firstX = MARGIN + 50;
  const lastX = firstX + (cols - 1) * SX;
  const firstY = MARGIN + 50;

  const gears: Placed[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const x = firstX + col * SX;
    const y = firstY + row * SY;

    // Alternate rows are driven from opposite sides of the run above them, so
    // they turn opposite ways, which is what the runs between them demand.
    const dir: 1 | -1 = row % 2 === 0 ? 1 : -1;

    // Distance along this gear's driving run to the point where the chain
    // touches it, which is always the top of the gear. Even rows are driven by
    // a run travelling right, odd rows by one travelling left.
    const s = row % 2 === 0 ? x - firstX : lastX - x;
    // Rolling contact: the tooth pattern at the contact must line up with the
    // roller pattern along the run, offset by 0.8 of a pitch so a roller lands
    // in the middle of a gap rather than on a crest. The angle term cancels,
    // which is what makes the lock hold for every frame rather than just this
    // one. -90 puts the reference at the top of the gear.
    // Roller indices run along the chain path; tooth indices run clockwise
    // round the gear. On rows driven by a leftward run those two directions
    // are mirrored, which is what the dir term below accounts for.
    const phase = -90 - (0.8 + dir * (s / CHAIN_PITCH)) * (360 / TEETH);

    gears.push({ x, y, phase, dir, row });
  }

  // The wrap: a rounded rectangle hugging the block, corner radius CHAIN_R.
  const R = CHAIN_R;
  const topY = firstY - R;
  const botY = firstY + (rows - 1) * SY + R;
  const loop = [
    `M${firstX},${topY}`,
    `H${lastX}`,
    `A${R},${R} 0 0 1 ${lastX + R},${topY + R}`,
    `V${botY - R}`,
    `A${R},${R} 0 0 1 ${lastX},${botY}`,
    `H${firstX}`,
    `A${R},${R} 0 0 1 ${firstX - R},${botY - R}`,
    `V${topY + R}`,
    `A${R},${R} 0 0 1 ${firstX},${topY}`,
    'Z',
  ].join('');

  // One straight run per row boundary. Direction alternates so that each row
  // is driven the way it turns: the run above an odd row must travel left, the
  // run above an even row must travel right.
  const runs: string[] = [];
  for (let r = 1; r < rows; r++) {
    const y = firstY + r * SY - R;
    // Carried out to the wrap's straight sides so the run meets it rather than
    // stopping in mid air next to it.
    const a = firstX - R;
    const b = lastX + R;
    runs.push(r % 2 === 1 ? `M${b},${y}H${a}` : `M${a},${y}H${b}`);
  }

  return {
    gears,
    loop,
    runs,
    width: lastX + 50 + MARGIN,
    height: firstY + (rows - 1) * SY + 50 + MARGIN,
    rows,
  };
}
