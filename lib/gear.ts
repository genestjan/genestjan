/**
 * Gear geometry for the fourteen stops.
 *
 * The train is a real one: every consecutive pair meshes, so the phase of each
 * gear is fixed by its neighbour rather than chosen. Get that wrong and teeth
 * visibly pass through each other, which is the one thing that would make the
 * whole thing look fake.
 */

/** Drawn in a 100 unit box centred on the origin. */
export const OUTER = 47;
export const ROOT = 38;
/** Pitch circle. Two meshing gears sit exactly this far apart, doubled. */
export const PITCH = (OUTER + ROOT) / 2;
/** Centre to centre distance for a meshing pair of equal gears. */
export const SPAN = PITCH * 2;

/**
 * Trapezoidal spur-gear outline.
 *
 * Real involute teeth need a curve solver and none of it survives at this
 * size; a trapezoid with the same tooth-to-gap ratio is indistinguishable on
 * screen and is one pass of trigonometry.
 *
 * Each tooth occupies one angular step: rise to 18%, crest to 34%, fall to
 * 52%, then a flat valley to the next tooth.
 */
export function gearPath(teeth: number, outer = OUTER, root = ROOT): string {
  const step = 360 / teeth;
  const at = (r: number, deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r).toFixed(2)}`;
  };
  let d = '';
  for (let i = 0; i < teeth; i++) {
    const b = i * step;
    d += `${i === 0 ? 'M' : 'L'}${at(root, b)}`;
    d += `L${at(outer, b + step * 0.18)}`;
    d += `L${at(outer, b + step * 0.34)}`;
    d += `L${at(root, b + step * 0.52)}`;
  }
  return `${d}Z`;
}

/** Radius of the tooth outline at normalised tooth coordinate u, for the
 *  interference check and for anything that needs the real profile. */
export function profileAt(u: number, outer = OUTER, root = ROOT): number {
  if (u < 0.18) return root + (outer - root) * (u / 0.18);
  if (u < 0.34) return outer;
  if (u < 0.52) return outer - (outer - root) * ((u - 0.34) / 0.18);
  return root;
}

/** Bolt circle inside the web, purely decorative. */
export function boltCircle(count: number, radius: number) {
  return Array.from({ length: count }, (_, i) => {
    const a = ((i * 360) / count) * (Math.PI / 180);
    return { cx: +(Math.cos(a) * radius).toFixed(2), cy: +(Math.sin(a) * radius).toFixed(2) };
  });
}

export type Placed = {
  /** Centre, in the same 100 unit grid the gears are drawn in. */
  x: number; y: number;
  /** Fixed rotation offset in degrees that puts this gear in mesh. */
  phase: number;
  /** +1 turns one way, -1 the other. Every mesh reverses it. */
  dir: 1 | -1;
};

export type Train = { gears: Placed[]; width: number; height: number; rows: number };

/**
 * Serpentine layout: left to right, drop straight down, right to left. The
 * drop lands the next gear directly below the last one, so that pair meshes
 * too and the chain is unbroken from stop one to stop fourteen.
 *
 * Phase comes from the rolling-contact condition. For two gears with the same
 * tooth count, centres separated along direction phi:
 *
 *   theta_b = 2*phi + PI - theta_a - 2*PI*c/N
 *
 * where c is where the mating surfaces sit within a tooth pitch. The tooth
 * spans 0 to 0.52 of the pitch and the valley the rest, so a crest sits at
 * 0.26 and a valley centre at 0.76, giving c = 1.02.
 */
export function trainLayout(count: number, cols: number, teeth: number): Train {
  const C = 1.02;
  const gears: Placed[] = [];
  let phase = 0;

  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const within = i % cols;
    // Odd rows run backwards, so the row change is a straight drop.
    const col = row % 2 === 0 ? within : cols - 1 - within;
    const x = 50 + col * SPAN;
    const y = 50 + row * SPAN;

    if (i > 0) {
      const prev = gears[i - 1];
      const phi = Math.atan2(y - prev.y, x - prev.x);
      const rad = 2 * phi + Math.PI - (prev.phase * Math.PI) / 180 - (2 * Math.PI * C) / teeth;
      phase = ((rad * 180) / Math.PI) % 360;
    }
    gears.push({ x, y, phase, dir: i % 2 === 0 ? 1 : -1 });
  }

  const rows = Math.ceil(count / cols);
  return {
    gears,
    width: 100 + (cols - 1) * SPAN,
    height: 100 + (rows - 1) * SPAN,
    rows,
  };
}


/**
 * A roller chain woven through the whole train.
 *
 * Meshed gears alternate direction, so a chain cannot wrap them all on the
 * same side; it has to weave, taking each gear on the opposite side to its
 * neighbour, the way a serpentine belt drives pulleys turning both ways.
 *
 * The geometry falls out of the layout: two meshing gears touch at the
 * midpoint of their centres, so the point where the chain leaves one gear is
 * exactly the point where it meets the next. Every span is therefore an arc of
 * the pitch circle, and the path is continuous with no straight runs at all.
 */
export function chainPath(gears: Placed[]): string {
  if (gears.length < 2) return '';

  const contact = (a: Placed, b: Placed) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const opposite = (g: Placed, p: { x: number; y: number }) =>
    ({ x: 2 * g.x - p.x, y: 2 * g.y - p.y });
  const ang = (g: Placed, p: { x: number; y: number }) =>
    (Math.atan2(p.y - g.y, p.x - g.x) * 180) / Math.PI;

  let d = '';
  for (let i = 0; i < gears.length; i++) {
    const g = gears[i];
    const enter = i === 0
      ? opposite(g, contact(g, gears[1]))
      : contact(gears[i - 1], g);
    const exit = i === gears.length - 1
      ? opposite(g, contact(gears[i - 1], g))
      : contact(g, gears[i + 1]);

    // Alternating the wrap side is what makes it a weave rather than a loop,
    // and it is also the only way each gear is driven the way it turns.
    const sweep = i % 2 === 0 ? 1 : 0;
    let delta = (sweep ? ang(g, exit) - ang(g, enter) : ang(g, enter) - ang(g, exit)) % 360;
    if (delta < 0) delta += 360;
    const large = delta > 180 ? 1 : 0;

    if (i === 0) d += `M${enter.x.toFixed(2)},${enter.y.toFixed(2)}`;
    d += `A${PITCH},${PITCH} 0 ${large} ${sweep} ${exit.x.toFixed(2)},${exit.y.toFixed(2)}`;
  }
  return d;
}
