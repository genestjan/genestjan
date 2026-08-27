'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * The machine, as film.
 *
 * One element for the whole site: the intro simply covers it and then lifts,
 * so the entrance and the background are literally the same playing footage
 * rather than two things that have to be matched.
 *
 * Autoplay needs muted + playsInline, and can still be refused (data saver,
 * low power mode, some in-app browsers). If play() rejects we fall back to the
 * poster frame rather than showing a dead black box.
 */
export default function MachineVideo({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setFailed(true);
      return;
    }
    // Some browsers only honour `muted` as a property, not the SSR attribute,
    // and will refuse autoplay without it.
    v.muted = true;
    v.play().catch(() => setFailed(true));

    // Stop decoding while the tab is hidden; it is pure battery cost.
    const onVis = () => {
      if (document.hidden) v.pause();
      else v.play().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  if (failed) {
    return (
      <img
        className={`machine-film ${className}`}
        src="/video/poster.webp"
        alt=""
        aria-hidden
        width={720}
        height={1280}
      />
    );
  }

  return (
    <video
      ref={ref}
      className={`machine-film ${className}`}
      poster="/video/poster.webp"
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      aria-hidden
      width={720}
      height={1280}
    >
      <source src="/video/machine.webm" type="video/webm" />
      <source src="/video/machine.mp4" type="video/mp4" />
    </video>
  );
}
