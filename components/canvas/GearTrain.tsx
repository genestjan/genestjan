'use client';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { system } from '@/lib/content';
import { gearPath, boltCircle } from '@/lib/gear';
import { EASE } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/lib/useReducedMotion';

/**
 * The fourteen stops, as a gear train.
 *
 * The hero footage is a gold gear machine and the whole argument of the page
 * is that the stops are one connected mechanism rather than fourteen separate
 * jobs, so the route is drawn as meshed gears on a common shaft: every one
 * turning, neighbours counter-rotating, each carrying a still hub the way the
 * big gear in the film carries the logo.
 *
 * Still SVG + DOM, not 3D. BRIEF 6.8 wants every stop to be a real focusable
 * button with keyboard support, which is what this is; the gear is decoration
 * layered inside it. On mobile it falls back to two columns rather than a
 * seven-across train (BRIEF 6.9).
 */

// Tooth counts are picked so neighbours differ, which is what makes a row read
// as a gear train rather than a row of identical stamps.
const TEETH = [14, 11, 16, 12, 15, 10, 13, 16, 12, 14, 11, 15, 13, 12];
const BOLTS = boltCircle(6, 25);

export default function GearTrain() {
  const [active, setActive] = useState<number | null>(null);
  const reduced = usePrefersReducedMotion();
  const nodes = system.nodes;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const train = useRef<HTMLOListElement>(null);
  const [live, setLive] = useState(false);

  // Gears only turn while the train is on screen. Fourteen continuously
  // animating groups is cheap but not free, and none of it is worth paying for
  // three sections away.
  useEffect(() => {
    const el = train.current;
    if (!el || reduced) return;
    const io = new IntersectionObserver(
      ([e]) => setLive(e.isIntersecting),
      { rootMargin: '150px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  // Arrow keys move between stops, matching how a real toolbar behaves.
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const next = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? i + 1
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? i - 1 : null;
    if (next === null) return;
    e.preventDefault();
    refs.current[(next + nodes.length) % nodes.length]?.focus();
  };

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setActive(null); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, []);

  return (
    <div className="relative">
      {/* One set of gradients for all fourteen gears. Defining them per gear
          would mean fourteen duplicate ids, which is invalid and only works by
          accident. */}
      <svg aria-hidden width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="gearIdle" x1="0" y1="0" x2="0.75" y2="1">
            <stop offset="0%" stopColor="#B79A5E" />
            <stop offset="22%" stopColor="#8A7240" />
            <stop offset="46%" stopColor="#4B3F26" />
            <stop offset="62%" stopColor="#7A6539" />
            <stop offset="84%" stopColor="#3E3420" />
            <stop offset="100%" stopColor="#635230" />
          </linearGradient>
          <linearGradient id="gearLive" x1="0" y1="0" x2="0.75" y2="1">
            <stop offset="0%" stopColor="#FFE7B8" />
            <stop offset="26%" stopColor="#F0B84A" />
            <stop offset="52%" stopColor="#8A5F1C" />
            <stop offset="76%" stopColor="#E8B25C" />
            <stop offset="100%" stopColor="#6B4712" />
          </linearGradient>
          <radialGradient id="gearHub" cx="0.38" cy="0.32" r="0.8">
            <stop offset="0%" stopColor="#20293A" />
            <stop offset="70%" stopColor="#0E141E" />
            <stop offset="100%" stopColor="#070A10" />
          </radialGradient>
        </defs>
      </svg>

      <ol
        ref={train}
        className={`gear-train grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 ${live ? 'is-live' : ''}`}
      >
        {nodes.map((n, i) => {
          const isActive = active === i;
          return (
            <li key={n.id} className="gear-cell">
              <button
                ref={(el) => { refs.current[i] = el; }}
                onClick={() => setActive(isActive ? null : i)}
                onKeyDown={(e) => onKey(e, i)}
                aria-expanded={isActive}
                aria-controls="pipeline-detail"
                className={`gear-btn ${isActive ? 'is-on' : ''}`}
              >
                <span className="gear-face">
                  <span aria-hidden className="gear-rail" />
                  <svg aria-hidden viewBox="-50 -50 100 100" className="gear-svg">
                    <g
                      className="gear-rotor"
                      style={{
                        animationDuration: `${TEETH[i] * 1.7}s`,
                        animationDirection: i % 2 ? 'reverse' : 'normal',
                      }}
                    >
                      <path d={gearPath(TEETH[i])} className="gear-teeth" />
                      <circle r="30" className="gear-web" />
                      <path d="M-30 -19 A35 35 0 0 1 -7 -34" className="gear-spec" />
                      {BOLTS.map((b, k) => (
                        <circle key={k} cx={b.cx} cy={b.cy} r="2.4" className="gear-bolt" />
                      ))}
                    </g>
                    <circle r="21" className="gear-hub" />
                    <circle r="21" className="gear-hub-ring" />
                    <text x="0" y="0" className="gear-num">{String(i + 1).padStart(2, '0')}</text>
                  </svg>
                </span>
                <span className="gear-label">{n.label}</span>
              </button>
            </li>
          );
        })}
      </ol>

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
