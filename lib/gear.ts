/**
 * Trapezoidal spur-gear outline, centred on the origin.
 *
 * Real involute teeth need a curve solver and none of it survives at the size
 * these render; a trapezoid with the same tooth-to-gap ratio is
 * indistinguishable on screen and is one pass of trigonometry.
 *
 * Each tooth occupies one angular step: rise at 18%, flat crest to 34%, fall
 * to 52%, then a flat valley to the next tooth.
 */
export function gearPath(teeth: number, outer = 47, root = 38): string {
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

/** Bolt circle inside the web, purely decorative. */
export function boltCircle(count: number, radius: number) {
  return Array.from({ length: count }, (_, i) => {
    const a = ((i * 360) / count) * (Math.PI / 180);
    return { cx: +(Math.cos(a) * radius).toFixed(2), cy: +(Math.sin(a) * radius).toFixed(2) };
  });
}
