'use client';
import { useEffect, useState } from 'react';

/**
 * Three-act cinematic entrance.
 *
 *   Act 1  The logo builds: the gold ring sweeps in, the speech mark drops
 *          into it, the name resolves.
 *   Act 2  The logo pushes toward camera and dissolves as the machine powers
 *          up behind it, light sweeping the metal.
 *   Act 3  The overlay lifts. The same plate continues underneath as the site
 *          background, so the hand-off is a continuous shot.
 *
 * Plays on every full page load. It was previously gated behind a
 * sessionStorage flag, which meant it fired once and then never again for the
 * rest of the browser session, so anyone reloading the page never saw it.
 *
 * Under prefers-reduced-motion it still shows the logo, held still and faded
 * rather than animated: skipping the brand moment entirely is a worse answer
 * than removing the movement from it.
 *
 * Renders nothing until mounted on the client, because server-rendering the
 * overlay would ship an opaque panel that hides the site if scripts fail.
 */
const FULL_MS = 5000;
const REDUCED_MS = 1800;

export default function ApertureIntro() {
  const [state, setState] = useState<'off' | 'full' | 'reduced'>('off');

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setState(reduced ? 'reduced' : 'full');

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setState('off');
      document.body.style.overflow = prevOverflow;
    };

    const t = setTimeout(finish, reduced ? REDUCED_MS : FULL_MS);
    window.addEventListener('keydown', finish);
    window.addEventListener('pointerdown', finish);
    return () => {
      clearTimeout(t);
      // never leave the page scroll-locked if this unmounts mid-play
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', finish);
      window.removeEventListener('pointerdown', finish);
    };
  }, []);

  if (state === 'off') return null;

  return (
    <div
      aria-hidden
      className={`intro ${state === 'reduced' ? 'intro-still' : ''}`}
      data-testid="aperture-intro"
    >
      {/* ACT 2: the machine powering up behind the mark */}
      <div className="intro-machine">
        <picture>
          <source srcSet="/machine-sm.webp" media="(max-width: 800px)" />
          <img src="/machine.webp" alt="" width={1408} height={768} fetchPriority="high" />
        </picture>
        <span className="intro-sheen" />
      </div>

      {/* ACT 1: the logo assembling */}
      <div className="intro-logo">
        <img className="intro-ring" src="/mark-ring.webp" alt="" width={900} height={900} fetchPriority="high" />
        <img className="intro-bubble" src="/mark-bubble.webp" alt="" width={520} height={520} fetchPriority="high" />
        <div className="intro-words">
          <span className="intro-name">Genest Jan Ramirez</span>
          <span className="intro-tag">Connect, Engage, Succeed</span>
        </div>
      </div>

      <button className="intro-skip" onClick={() => setState('off')}>Skip</button>
    </div>
  );
}
