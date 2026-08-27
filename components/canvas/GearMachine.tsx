'use client';

/**
 * The machine plate with its gears dissected into independently rotating parts.
 *
 * Each gear was cut from the source image as a disc centred on its own axis, so
 * a rotating copy covers its static original exactly and the plate appears to
 * come alive. The big gear is cut as an annulus: the toothed ring and the
 * "DIGITAL MARKETING" lettering rotate while the logo and name stay upright in
 * the middle.
 *
 * Everything animates via CSS `transform: rotate()`, which the compositor
 * handles off the main thread. Nothing here animates `filter`, `width` or
 * `top`: an earlier version wrote `style.filter` every frame, which repainted a
 * full-screen image 60 times a second and was the cause of the scroll jank.
 *
 * Gear ratios follow the real geometry: angular speed is inversely proportional
 * to radius, and meshed gears turn in opposite directions.
 */

const IMG_W = 1408;
const IMG_H = 768;

type Gear = {
  src: string;
  cx: number; cy: number; r: number;
  seconds: number;
  dir: 1 | -1;
};

// radii measured from the source; speed ∝ 1/r so the teeth appear to mesh
const GEARS: Gear[] = [
  { src: '/gears/big-ring.webp',  cx: 586, cy: 349, r: 236, seconds: 150, dir:  1 },
  { src: '/gears/small-top.webp', cx: 919, cy: 270, r: 86,  seconds: 55,  dir: -1 },
  { src: '/gears/small-bot.webp', cx: 904, cy: 442, r: 118, seconds: 75,  dir: -1 },
];

const pct = (v: number, total: number) => `${(v / total) * 100}%`;

export default function GearMachine({ className = '' }: { className?: string }) {
  return (
    <div className={`gear-machine ${className}`}>
      <picture>
        <source srcSet="/machine-sm.webp" media="(max-width: 800px)" />
        <img
          className="gear-base"
          src="/machine.webp"
          alt=""
          width={IMG_W}
          height={IMG_H}
          fetchPriority="high"
        />
      </picture>

      {GEARS.map((g) => (
        <img
          key={g.src}
          className="gear-part"
          src={g.src}
          alt=""
          aria-hidden
          width={g.r * 2}
          height={g.r * 2}
          style={{
            left: pct(g.cx - g.r, IMG_W),
            top: pct(g.cy - g.r, IMG_H),
            width: pct(g.r * 2, IMG_W),
            height: pct(g.r * 2, IMG_H),
            animationDuration: `${g.seconds}s`,
            animationDirection: g.dir === 1 ? 'normal' : 'reverse',
          }}
        />
      ))}
    </div>
  );
}
