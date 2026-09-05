'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { system } from '@/lib/content';
import { gearPath, boltCircle, trainLayout } from '@/lib/gear';
import { EASE } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/lib/useReducedMotion';
import { setTrain, tooth } from '@/lib/sound';

/**
 * The fourteen stops, as one connected gear box.
 *
 * The stops are a process, so the gears are a real train: every consecutive
 * pair meshes, the row change is a straight drop so that pair meshes too, and
 * the phases come out of the rolling-contact condition rather than being
 * chosen. scripts/check-gears.mjs is the proof that no tooth ever passes
 * through another one.
 *
 * Rotation is driven from a single angle in one animation frame rather than by
 * CSS per gear. Fourteen CSS animations cannot be sped up together without
 * each one jumping, and a meshed train that jumps is a broken train. One angle
 * also means the tooth clicks can be fired exactly when a tooth actually
 * passes the mesh, instead of on a timer that drifts against the picture.
 *
 * Still real buttons, so BRIEF 6.8 still holds: arrow keys move between stops,
 * Enter opens one, Escape closes it.
 */

const TEETH = 14;
const PITCH_DEG = 360 / TEETH;
const BASE_DPS = 8;      // degrees per second at rest
const FAST_DPS = 46;     // while the pointer is on the train
const BOLTS = boltCircle(6, 30);

/** Two lines at most, broken at the last space so the wider half sits on top. */
function hubLines(label: string): string[] {
  if (label.length <= 9) return [label];
  const i = label.lastIndexOf(' ');
  return i < 0 ? [label] : [label.slice(0, i), label.slice(i + 1)];
}

export default function GearTrain() {
  const [active, setActive] = useState<number | null>(null);
  const [cols, setCols] = useState(7);
  const [live, setLive] = useState(false);
  const reduced = usePrefersReducedMotion();
  const nodes = system.nodes;

  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const rotors = useRef<(SVGGElement | null)[]>([]);
  const stage = useRef<HTMLDivElement>(null);
  const flow = useRef<HTMLSpanElement>(null);
  const fast = useRef(false);

  const train = useMemo(() => trainLayout(nodes.length, cols, TEETH), [nodes.length, cols]);

  useEffect(() => {
    const pick = () => setCols(innerWidth >= 1024 ? 7 : innerWidth >= 640 ? 4 : 3);
    pick();
    addEventListener('resize', pick);
    return () => removeEventListener('resize', pick);
  }, []);

  // The box only turns while it is on screen, and only makes a noise then too.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setLive(e.isIntersecting), { rootMargin: '120px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    setTrain(live && !reduced);
    return () => setTrain(false);
  }, [live, reduced]);

  // One angle, one frame loop, fourteen transforms.
  useEffect(() => {
    const phases = train.gears.map((g) => g.phase);
    const dirs = train.gears.map((g) => g.dir);

    const paint = (angle: number) => {
      for (let i = 0; i < rotors.current.length; i++) {
        const r = rotors.current[i];
        if (r) r.style.transform = `rotate(${phases[i] + dirs[i] * angle}deg)`;
      }
    };

    if (reduced) { paint(0); return; }
    if (!live) return;

    let raf = 0;
    let angle = 0;
    let speed = BASE_DPS;
    let last = performance.now();
    let nextTooth = PITCH_DEG;
    let drive = 0;

    const gears = train.gears;
    const { width: W, height: H } = train;

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      speed += ((fast.current ? FAST_DPS : BASE_DPS) - speed) * 0.05;
      angle += speed * dt;
      paint(angle);

      // Drive marker walking the route, one stop per second. Row two runs
      // right to left so the train stays meshed, which makes the reading order
      // ambiguous from the numbers alone; this shows it.
      drive = (drive + dt * (fast.current ? 2.6 : 0.9)) % gears.length;
      if (flow.current) {
        const i = Math.floor(drive);
        const f = drive - i;
        const a = gears[i];
        const b = gears[(i + 1) % gears.length];
        // The wrap from stop fourteen back to stop one is a jump, not a walk.
        const wrapping = i === gears.length - 1;
        const x = wrapping ? a.x : a.x + (b.x - a.x) * f;
        // Ride below the hub text rather than straight through it.
        const y = (wrapping ? a.y : a.y + (b.y - a.y) * f) + 18;
        flow.current.style.left = `${(x / W) * 100}%`;
        flow.current.style.top = `${(y / H) * 100}%`;
        flow.current.style.opacity = wrapping ? `${(1 - f).toFixed(2)}` : '1';
      }

      // A click each time a tooth actually passes through the mesh.
      if (angle >= nextTooth) {
        nextTooth += PITCH_DEG * Math.max(1, Math.ceil((angle - nextTooth) / PITCH_DEG));
        tooth();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [live, reduced, train]);

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const next = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? i + 1
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? i - 1 : null;
    if (next === null) return;
    e.preventDefault();
    refs.current[(next + nodes.length) % nodes.length]?.focus();
  };

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setActive(null); };
    addEventListener('keydown', onEsc);
    return () => removeEventListener('keydown', onEsc);
  }, []);

  const enter = useCallback(() => { fast.current = true; }, []);
  const leave = useCallback(() => { fast.current = false; }, []);

  const { width, height } = train;
  const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(4)}%`;

  return (
    <div className="relative">
      <svg aria-hidden width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="gearIdle" x1="0" y1="0" x2="0.7" y2="1">
            <stop offset="0%" stopColor="#C9AC6C" />
            <stop offset="20%" stopColor="#8F7743" />
            <stop offset="44%" stopColor="#4C4027" />
            <stop offset="60%" stopColor="#7E6939" />
            <stop offset="82%" stopColor="#3B3220" />
            <stop offset="100%" stopColor="#68562F" />
          </linearGradient>
          <linearGradient id="gearLive" x1="0" y1="0" x2="0.7" y2="1">
            <stop offset="0%" stopColor="#FFEFC9" />
            <stop offset="20%" stopColor="#F6C25A" />
            <stop offset="46%" stopColor="#8A5F1C" />
            <stop offset="62%" stopColor="#F0C168" />
            <stop offset="84%" stopColor="#6B4712" />
            <stop offset="100%" stopColor="#C99235" />
          </linearGradient>
          <radialGradient id="gearHub" cx="0.36" cy="0.3" r="0.85">
            <stop offset="0%" stopColor="#232D40" />
            <stop offset="68%" stopColor="#0D131D" />
            <stop offset="100%" stopColor="#06090F" />
          </radialGradient>
          <linearGradient id="hubRim" x1="0" y1="0" x2="0.6" y2="1">
            <stop offset="0%" stopColor="rgba(255,240,214,0.42)" />
            <stop offset="45%" stopColor="rgba(255,240,214,0.05)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.5)" />
          </linearGradient>
        </defs>
      </svg>

      <div
        ref={stage}
        className={`gear-stage ${live ? 'is-live' : ''}`}
        style={{ aspectRatio: `${width} / ${height}` }}
        onPointerEnter={enter}
        onPointerLeave={leave}
      >
        <span aria-hidden className="gear-plate" />
        <span aria-hidden ref={flow} className="gear-flow" />
        <ol className="contents">
          {nodes.map((n, i) => {
            const g = train.gears[i];
            const isActive = active === i;
            return (
              <li
                key={n.id}
                className="gear-slot"
                style={{
                  left: pct(g.x - 50, width),
                  top: pct(g.y - 50, height),
                  width: pct(100, width),
                  height: pct(100, height),
                  // Alternating stack so meshing teeth read as interleaved.
                  zIndex: i % 2 ? 3 : 2,
                }}
              >
                <button
                  ref={(el) => { refs.current[i] = el; }}
                  onClick={() => setActive(isActive ? null : i)}
                  onKeyDown={(e) => onKey(e, i)}
                  aria-expanded={isActive}
                  aria-controls="pipeline-detail"
                  className={`gear-btn ${isActive ? 'is-on' : ''}`}
                >
                  <svg aria-hidden viewBox="-50 -50 100 100" className="gear-svg">
                    {/* the body below, giving the disc thickness */}
                    <circle cx="2.6" cy="3.8" r="45" className="gear-drop" />
                    <g
                      ref={(el) => { rotors.current[i] = el; }}
                      className="gear-rotor"
                      style={{ transform: `rotate(${g.phase}deg)` }}
                    >
                      <path d={gearPath(TEETH)} className="gear-teeth" />
                      <path d={gearPath(TEETH, 44.5, 36)} className="gear-bevel" />
                      <circle r="31" className="gear-web" />
                      {BOLTS.map((b, k) => (
                        <circle key={k} cx={b.cx} cy={b.cy} r="2.3" className="gear-bolt" />
                      ))}
                      <path d="M-30 -19 A35 35 0 0 1 -7 -34" className="gear-spec" />
                    </g>
                    <circle r="25.5" className="gear-hub" />
                    <circle r="25.5" className="gear-hub-rim" />
                    <text className="gear-num" x="0" y="-11">{String(i + 1).padStart(2, '0')}</text>
                    {hubLines(n.label).map((ln, k, all) => (
                      <text key={ln} className="gear-word" x="0" y={all.length === 1 ? 5 : 2 + k * 9}>
                        {ln}
                      </text>
                    ))}
                  </svg>
                  <span className="sr-only">{n.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <AnimatePresence mode="wait">
        {active !== null && (
          <motion.div
            id="pipeline-detail"
            key={active}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: reduced ? 0.15 : 0.4, ease: EASE }}
            className="glass mt-8 p-6 sm:p-8"
          >
            <p className="mono-label mb-3 text-signal">
              Stop {String(active + 1).padStart(2, '0')} / {nodes[active].label}
            </p>
            <p className="max-w-prose text-body text-paper">{nodes[active].detail}</p>
            <button
              onClick={() => setActive(null)}
              className="mono-label mt-5 text-muted underline-offset-4 hover:text-current hover:underline"
            >
              Close
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
