'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { system } from '@/lib/content';
import { gearPath, trainLayout, TEETH, CHAIN_R, CHAIN_PITCH } from '@/lib/gear';
import { EASE } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/lib/useReducedMotion';
import { setTrain, tooth } from '@/lib/sound';

/**
 * The fourteen stops, as a chain-driven gear box in brass.
 *
 * A roller chain wraps the whole block and runs between the rows, driving
 * every gear. The gears do not touch each other, which is how a bank like this
 * is actually built and which lets the numbers read left to right instead of
 * snaking back along the second row.
 *
 * One chain link per gear tooth, and each gear's starting angle is derived
 * from how far along its driving run it sits, so a roller sits in a tooth gap
 * everywhere the chain meets a gear and stays there. scripts/check-gears.mjs
 * is the proof: zero slip over a full revolution, rollers dead centre in the
 * valleys.
 *
 * Rotation and chain travel come off one angle in one animation frame, so the
 * two can never disagree, and the tooth clicks fire when a tooth actually
 * passes a roller rather than on a timer.
 *
 * Still real buttons: arrow keys move between stops, Enter opens one, Escape
 * closes it.
 */

const PITCH_DEG = 360 / TEETH;
const BASE_DPS = 26;
const FAST_DPS = 66;

function faceLines(label: string): string[] {
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
  const links = useRef<(SVGPathElement | null)[]>([]);
  const stage = useRef<HTMLDivElement>(null);
  const fast = useRef(false);

  const train = useMemo(() => trainLayout(nodes.length, cols), [nodes.length, cols]);

  useEffect(() => {
    const pick = () => setCols(innerWidth >= 1024 ? 7 : innerWidth >= 640 ? 4 : 2);
    pick();
    addEventListener('resize', pick);
    return () => removeEventListener('resize', pick);
  }, []);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setLive(e.isIntersecting), { rootMargin: '140px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    setTrain(live && !reduced);
    return () => setTrain(false);
  }, [live, reduced]);

  useEffect(() => {
    const phases = train.gears.map((g) => g.phase);
    const dirs = train.gears.map((g) => g.dir);
    // Degrees of gear turn to arc length along the chain. Same constant the
    // phase derivation uses, so the two cannot fall out of step.
    const K = (Math.PI * CHAIN_R) / 180;

    const paint = (angle: number) => {
      for (let i = 0; i < rotors.current.length; i++) {
        const r = rotors.current[i];
        if (r) r.style.transform = `rotate(${phases[i] + dirs[i] * angle}deg)`;
      }
      const travel = angle * K;
      for (const l of links.current) {
        if (l) l.style.strokeDashoffset = `${-travel}`;
      }
    };

    if (reduced) { paint(0); return; }
    if (!live) return;

    let raf = 0;
    let angle = 0;
    let speed = BASE_DPS;
    let last = performance.now();
    let nextTooth = PITCH_DEG;

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      speed += ((fast.current ? FAST_DPS : BASE_DPS) - speed) * 0.05;
      angle += speed * dt;
      paint(angle);
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
  // Link plates with a dark joint, and a bright pin head sitting in each joint.
  const gap = `3.4 ${(CHAIN_PITCH - 3.4).toFixed(3)}`;
  const pin = `0.6 ${(CHAIN_PITCH - 0.6).toFixed(3)}`;
  const chainPaths = [train.loop, ...train.runs];

  return (
    <div className="relative">
      <svg aria-hidden width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="brassTeeth" x1="0.05" y1="0" x2="0.85" y2="1">
            <stop offset="0%" stopColor="#F2DDB2" />
            <stop offset="16%" stopColor="#C9A46B" />
            <stop offset="40%" stopColor="#6B5330" />
            <stop offset="56%" stopColor="#B7945F" />
            <stop offset="78%" stopColor="#40301A" />
            <stop offset="100%" stopColor="#8A6E41" />
          </linearGradient>
          <linearGradient id="brassBody" x1="0.1" y1="0" x2="0.8" y2="1">
            <stop offset="0%" stopColor="#EFDAAB" />
            <stop offset="28%" stopColor="#AE8D59" />
            <stop offset="66%" stopColor="#48371D" />
            <stop offset="100%" stopColor="#6E5730" />
          </linearGradient>
          <linearGradient id="brassGroove" x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0%" stopColor="#2C2011" />
            <stop offset="55%" stopColor="#594527" />
            <stop offset="100%" stopColor="#7E6540" />
          </linearGradient>
          {/* Kept light across the whole area the engraving sits in. The
              first pass fell to rgb(133,108,68) under the labels, which is
              3.27:1 against the cut lettering; no amount of darkening the
              letters fixes that, since pure black on that brass is still only
              4.23:1. The face itself had to come up. */}
          <radialGradient id="brassFace" cx="0.34" cy="0.28" r="0.92">
            <stop offset="0%" stopColor="#F6E7C4" />
            <stop offset="60%" stopColor="#D9BF8D" />
            <stop offset="100%" stopColor="#93794A" />
          </radialGradient>
          <linearGradient id="brassChain" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D8BE8E" />
            <stop offset="38%" stopColor="#A2814F" />
            <stop offset="100%" stopColor="#5A462A" />
          </linearGradient>
          <radialGradient id="brassPin" cx="0.35" cy="0.3" r="0.8">
            <stop offset="0%" stopColor="#F3E3BE" />
            <stop offset="60%" stopColor="#BE9E68" />
            <stop offset="100%" stopColor="#7A6038" />
          </radialGradient>
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

        <ol className="contents">
          {nodes.map((n, i) => {
            const g = train.gears[i];
            const isActive = active === i;
            const lines = faceLines(n.label);
            return (
              <li
                key={n.id}
                className="gear-slot"
                style={{
                  left: pct(g.x - 50, width),
                  top: pct(g.y - 50, height),
                  width: pct(100, width),
                  height: pct(100, height),
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
                    <circle cx="2.2" cy="3.4" r="46" className="gear-cast" />
                    <g
                      ref={(el) => { rotors.current[i] = el; }}
                      className="gear-rotor"
                      style={{ transform: `rotate(${g.phase}deg)` }}
                    >
                      <path d={gearPath()} className="gear-teeth" />
                      <path d={gearPath(TEETH, 45.2, 38.6)} className="gear-teeth-lip" />
                    </g>
                    {/* Concentric machined steps. Circles, so holding them
                        still costs nothing and keeps the light where it is. */}
                    <circle r="37.6" className="gear-shoulder" />
                    <circle r="32.8" className="gear-groove" />
                    <circle r="29.2" className="gear-boss" />
                    <circle r="29.2" className="gear-boss-lip" />
                    <circle r="24.4" className="gear-face" />
                    <circle r="25.4" className="gear-face-ring" />

                    {/* Engraving: a lit lower edge under dark cut letters. */}
                    <text className="gear-num-lip" x="0" y={lines.length > 1 ? -8.6 : -5.6}>
                      {String(i + 1).padStart(2, '0')}
                    </text>
                    <text className="gear-num" x="0" y={lines.length > 1 ? -9.2 : -6.2}>
                      {String(i + 1).padStart(2, '0')}
                    </text>
                    {lines.map((ln, k) => (
                      <g key={ln}>
                        <text className="gear-word-lip" x="0" y={(lines.length > 1 ? 4.4 : 8.4) + k * 10}>{ln}</text>
                        <text className="gear-word" x="0" y={(lines.length > 1 ? 3.8 : 7.8) + k * 10}>{ln}</text>
                      </g>
                    ))}
                  </svg>
                  <span className="sr-only">{n.label}</span>
                </button>
              </li>
            );
          })}
        </ol>

        {/* The chain sits over the tooth tips, the way it does on a real box. */}
        <svg
          aria-hidden
          className="gear-chain"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
        >
          {chainPaths.map((d, k) => (
            <g key={k}>
              <path d={d} className="chain-cast" />
              <path d={d} className="chain-edge" />
              <path d={d} className="chain-plate" />
              <path d={d} className="chain-plate-2" />
              <path
                ref={(el) => { links.current[k * 2] = el; }}
                d={d} className="chain-joint" strokeDasharray={gap}
              />
              <path
                ref={(el) => { links.current[k * 2 + 1] = el; }}
                d={d} className="chain-pin" strokeDasharray={pin}
              />
            </g>
          ))}
        </svg>
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
