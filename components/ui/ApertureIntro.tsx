'use client';
import { useEffect, useState } from 'react';

/**
 * Cinematic entrance: an aperture irises open onto the machine plate, which
 * pushes back into place as the wordmark resolves and a light sweeps the metal.
 *
 * Renders nothing until mounted on the client. Server-rendering the overlay
 * would ship an opaque full-screen panel in the static HTML, hiding the entire
 * site for anyone whose JavaScript fails or is blocked.
 *
 * Plays once per browser session, skippable with any key or click, and skipped
 * outright under prefers-reduced-motion.
 */
const BLADES = 6;
const KEY = 'gjr-intro-seen';
const RUN_MS = 3200;

export default function ApertureIntro() {
  const [phase, setPhase] = useState<'idle' | 'playing'>('idle');

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let seen = false;
    try { seen = sessionStorage.getItem(KEY) === '1'; } catch { /* private mode */ }
    if (reduced || seen) return;

    setPhase('playing');
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setPhase('idle');
      document.body.style.overflow = prevOverflow;
      try { sessionStorage.setItem(KEY, '1'); } catch { /* ignore */ }
    };

    const t = setTimeout(finish, RUN_MS);
    window.addEventListener('keydown', finish);
    window.addEventListener('pointerdown', finish);

    return () => {
      clearTimeout(t);
      // Never leave the page scroll-locked if this unmounts mid-play.
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', finish);
      window.removeEventListener('pointerdown', finish);
    };
  }, []);

  if (phase !== 'playing') return null;

  return (
    <div aria-hidden className="intro-root" data-testid="aperture-intro">
      {/* The machine, seen through the opening iris */}
      <div className="intro-plate">
        <picture>
          <source srcSet="/machine-sm.webp" media="(max-width: 800px)" />
          <img src="/machine.webp" alt="" width={1408} height={768} />
        </picture>
        <span className="intro-sweep" />
      </div>

      {/* Aperture blades retracting outward */}
      <svg className="intro-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="apGlow">
            <stop offset="0%" stopColor="#FFB03A" stopOpacity="0.5" />
            <stop offset="55%" stopColor="#4FD1E0" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#06080D" stopOpacity="0" />
          </radialGradient>

          {/* White shows the ink cover, the growing black circle punches the
              hole. Scaling centre-anchored blades cannot do this: a bigger
              triangle still covers the middle, so the iris never opens. */}
          <mask id="irisMask">
            <rect x="-50" y="-50" width="200" height="200" fill="white" />
            <circle className="intro-iris" cx="50" cy="50" r="1" fill="black" />
          </mask>
        </defs>

        <rect x="-50" y="-50" width="200" height="200" fill="#06080D" mask="url(#irisMask)" />

        {/* Blades are stroke-only mechanics now, they no longer occlude */}
        <g className="intro-blades">
          {Array.from({ length: BLADES }).map((_, i) => (
            <path
              key={i}
              className="intro-blade"
              d="M50 50 L50 -60 L145 -6 Z"
              fill="none"
              stroke="#4FD1E0"
              strokeWidth="0.12"
              // --r is read by the keyframes; an inline `transform` here would
              // be overridden by the animation instead.
              style={{
                transformOrigin: '50px 50px',
                ['--r' as string]: `${(360 / BLADES) * i}deg`,
                animationDelay: `${0.25 + i * 0.015}s`,
              }}
            />
          ))}
        </g>

        <circle className="intro-glow" cx="50" cy="50" r="44" fill="url(#apGlow)" />
        <circle className="intro-ring" cx="50" cy="50" r="13" fill="none" stroke="#FFB03A" strokeWidth="0.35" />
        <circle className="intro-ring2" cx="50" cy="50" r="21" fill="none" stroke="#4FD1E0" strokeWidth="0.18" />
      </svg>

      <div className="intro-caption">
        <span className="intro-tag">THE SYSTEM BEHIND THE MARKETING</span>
      </div>

      <button className="intro-skip" onClick={() => setPhase('idle')}>Skip</button>
    </div>
  );
}
