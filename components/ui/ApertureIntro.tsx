'use client';
import { useEffect, useState } from 'react';

/**
 * Three-act cinematic entrance.
 *
 *   Act 1  (0.0 - 2.0s)  The logo builds: the gold ring sweeps in and settles,
 *                        the speech mark drops into it, the name resolves.
 *   Act 2  (2.0 - 4.2s)  The logo pushes toward camera and dissolves as the
 *                        machine powers up behind it, light sweeping the metal.
 *   Act 3  (4.2 - 5.0s)  The overlay lifts. The same plate continues underneath
 *                        as the site background, so the cut is seamless.
 *
 * Renders nothing until mounted on the client: server-rendering the overlay
 * would ship an opaque full-screen panel that hides the whole site if scripts
 * fail. Plays once per session, skippable, and skipped under reduced-motion.
 */
const KEY = 'gjr-intro-seen';
const RUN_MS = 5000;

export default function ApertureIntro() {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let seen = false;
    try { seen = sessionStorage.getItem(KEY) === '1'; } catch { /* private mode */ }
    if (reduced || seen) return;

    setPlaying(true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setPlaying(false);
      document.body.style.overflow = prevOverflow;
      try { sessionStorage.setItem(KEY, '1'); } catch { /* ignore */ }
    };

    const t = setTimeout(finish, RUN_MS);
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

  if (!playing) return null;

  return (
    <div aria-hidden className="intro" data-testid="aperture-intro">
      {/* ACT 2: the machine powering up behind the mark */}
      <div className="intro-machine">
        <picture>
          <source srcSet="/machine-sm.webp" media="(max-width: 800px)" />
          <img src="/machine.webp" alt="" width={1408} height={768} />
        </picture>
        <span className="intro-sheen" />
      </div>

      {/* ACT 1: the logo assembling */}
      <div className="intro-logo">
        <img className="intro-ring" src="/mark-ring.webp" alt="" width={900} height={900} />
        <img className="intro-bubble" src="/mark-bubble.webp" alt="" width={520} height={520} />
        <div className="intro-words">
          <span className="intro-name">Genest Jan Ramirez</span>
          <span className="intro-tag">Connect, Engage, Succeed</span>
        </div>
      </div>

      <button className="intro-skip" onClick={() => setPlaying(false)}>Skip</button>
    </div>
  );
}
