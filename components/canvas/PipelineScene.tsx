'use client';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { system } from '@/lib/content';
import { EASE } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/lib/useReducedMotion';

/**
 * The 14-stop customer journey.
 *
 * Built from SVG + DOM rather than 3D objects: BRIEF 6.8 requires every node to
 * be a real focusable button with full keyboard support, which canvas objects
 * cannot be. Same visual language as the hero field, accessible by construction.
 * On mobile this collapses to a vertical scroll-through list (BRIEF 6.9).
 */
export default function PipelineScene() {
  const [active, setActive] = useState<number | null>(null);
  const reduced = usePrefersReducedMotion();
  const nodes = system.nodes;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  // Arrow keys move between stops, matching how a real toolbar behaves.
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const next = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? i + 1
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? i - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const t = (next + nodes.length) % nodes.length;
    refs.current[t]?.focus();
  };

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setActive(null); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, []);

  return (
    <div className="relative">
      {/* Connector rail with a travelling amber pulse */}
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
        <svg className="h-full w-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="rail" x1="0" x2="1">
              <stop offset="0%" stopColor="#1E3A5F" stopOpacity="0" />
              <stop offset="12%" stopColor="#1E3A5F" />
              <stop offset="88%" stopColor="#1E3A5F" />
              <stop offset="100%" stopColor="#1E3A5F" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1].map((row) => (
            <g key={row}>
              <line
                x1="4%" y1={`${row * 50 + 25}%`} x2="96%" y2={`${row * 50 + 25}%`}
                stroke="url(#rail)" strokeWidth="1"
              />
              {!reduced && (
                <circle r="3" fill="#FFB03A" opacity="0.9">
                  <animate
                    attributeName="cx" from="4%" to="96%"
                    dur="6s" begin={`${row * 3}s`} repeatCount="indefinite"
                  />
                  <animate
                    attributeName="cy" values={`${row * 50 + 25}%;${row * 50 + 25}%`}
                    dur="6s" begin={`${row * 3}s`} repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity" values="0;1;1;0"
                    dur="6s" begin={`${row * 3}s`} repeatCount="indefinite"
                  />
                </circle>
              )}
            </g>
          ))}
        </svg>
      </div>

      <ul
        className="relative grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7 lg:gap-4"
        role="list"
      >
        {nodes.map((n, i) => {
          const isActive = active === i;
          return (
            <li key={n.id}>
              <button
                ref={(el) => { refs.current[i] = el; }}
                onClick={() => setActive(isActive ? null : i)}
                onKeyDown={(e) => onKey(e, i)}
                aria-expanded={isActive}
                aria-controls="pipeline-detail"
                className={[
                  'group relative w-full rounded-xl border px-3 py-4 text-left transition-all duration-300',
                  isActive
                    ? 'border-signal bg-[rgba(255,176,58,0.08)]'
                    : 'border-line bg-[rgba(20,27,39,0.5)] hover:border-current',
                ].join(' ')}
              >
                <span className="mono-label block text-[0.62rem] text-muted group-hover:text-current">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span
                  className={`mt-1 block font-mono text-[0.8rem] leading-tight ${
                    isActive ? 'text-signal' : 'text-paper'
                  }`}
                >
                  {n.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <AnimatePresence mode="wait">
        {active !== null && (
          <motion.div
            id="pipeline-detail"
            key={active}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: reduced ? 0.15 : 0.4, ease: EASE }}
            className="glass mt-6 p-6 sm:p-8"
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
