'use client';
import { useEffect, useState } from 'react';

/**
 * The entrance: the logo builds on solid black, holds there, and only then
 * lifts to reveal the machine film already running underneath.
 *
 * The shade stays fully opaque for the whole build and hold, so the mark and
 * the name are the only thing on screen for the first three and a half
 * seconds. Nothing of the hero bleeds through early.
 *
 * This deliberately holds no video of its own. The film lives in
 * MachineBackdrop and plays from first paint; this overlay just covers it and
 * gets out of the way, so the hand-off is the same footage rather than two
 * clips that have to be matched.
 *
 * Plays on every page load, is skippable, and under prefers-reduced-motion
 * shows the logo held still rather than being removed entirely.
 *
 * Renders nothing until mounted: server-rendering an opaque overlay would hide
 * the whole site for anyone whose scripts fail.
 */
const FULL_MS = 4800;
const REDUCED_MS = 3500;

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
      {/* Blackout over the running film, lifting as the logo departs */}
      <div className="intro-shade" />

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
