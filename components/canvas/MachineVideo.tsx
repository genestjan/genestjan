'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * The machine, as film. Hero only.
 *
 * Two encodes of the same 8 second master. Desktop crops a horizontal band out
 * of a portrait source and blows it up, so it gets the 1080 wide file; phones
 * show the frame near its native size, where the 720 encode is
 * indistinguishable and saves 2.4MB.
 *
 * The source is chosen in an effect rather than with `<source media>`: browsers
 * only honour the media attribute inside `<picture>`, and Chrome was handing
 * phones the desktop file. Nothing loads until mount, which also means reduced
 * motion and no-JS download no video at all and keep the poster.
 *
 * Autoplay needs muted + playsInline, and can still be refused (data saver,
 * low power mode, some in-app browsers). Codec-less Chromium builds have no
 * H.264 either. Any of those falls back to the poster frame rather than
 * showing a dead black box.
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
    v.src = window.matchMedia('(min-width: 768px)').matches
      ? '/video/machine-hd.mp4'
      : '/video/machine.mp4';
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
        width={1080}
        height={1920}
      />
    );
  }

  return (
    <video
      ref={ref}
      className={`machine-film ${className}`}
      poster="/video/poster.webp"
      loop
      muted
      playsInline
      preload="auto"
      aria-hidden
      width={1080}
      height={1920}
    />
  );
}
