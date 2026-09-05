'use client';
import { useEffect, useState } from 'react';

/**
 * The entrance: the logo builds on solid black, holds there, and only then
 * lifts to reveal the machine film already running underneath.
 *
 * This renders on the server, opaque, from the very first byte. It used to
 * mount only after hydration, which meant the hero painted first and the
 * visitor saw the site for a beat, then the logo, then the site again. The
 * whole animation is CSS, so it runs before any JavaScript has executed; the
 * script only handles the skip, the scroll lock, and taking the node out
 * afterwards. A noscript rule removes it outright when scripts are off, so an
 * opaque overlay can never be what someone is left looking at.
 *
 * It is not dismissed by a stray click any more, only by Skip or Escape. The
 * hold is the point, and a pointer landing early used to cut it short in a way
 * that looked exactly like a bug.
 *
 * This deliberately holds no video of its own. The film lives in
 * MachineBackdrop and plays from first paint; this overlay just covers it and
 * gets out of the way, so the hand-off is the same footage rather than two
 * clips that have to be matched.
 */
const FULL_MS = 4800;
const REDUCED_MS = 3500;

export default function ApertureIntro() {
  // Server and first client render agree, so there is no hydration mismatch
  // and no frame in which the overlay is missing.
  const [show, setShow] = useState(true);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setShow(false);
      document.body.style.overflow = prev;
    };

    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') finish(); };
    const t = setTimeout(finish, reduced ? REDUCED_MS : FULL_MS);
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  if (!show) return null;

  return (
    <div aria-hidden className="intro" data-testid="aperture-intro">
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

      <button className="intro-skip" onClick={() => setShow(false)}>Skip</button>
    </div>
  );
}
