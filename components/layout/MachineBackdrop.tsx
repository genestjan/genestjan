'use client';
import { useEffect, useRef } from 'react';
import { usePrefersReducedMotion } from '@/lib/useReducedMotion';

/**
 * The machine plate as the site background, scroll-synced.
 *
 * It starts exactly where the intro leaves it (scale 1.08, brightness 0.6) so
 * the hand-off is a continuous shot rather than a cut. As the page scrolls it
 * pulls back and dims, letting the plate recede behind the content instead of
 * competing with body copy.
 */
export default function MachineBackdrop() {
  const plate = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    let cur = 0;

    const loop = () => {
      const max = Math.max(document.documentElement.scrollHeight - innerHeight, 1);
      const target = Math.min(scrollY / max, 1);
      cur += (target - cur) * 0.07;

      if (plate.current) {
        // pull back and drift up as the page advances
        const scale = 1.08 - cur * 0.1;
        const y = -cur * 90;
        plate.current.style.transform = `translate3d(0, ${y}px, 0) scale(${scale})`;
      }
      if (img.current) {
        // recede: the plate is loudest at the top of the page and quiet by the end
        const b = 0.34 - cur * 0.2;
        img.current.style.filter = `brightness(${b.toFixed(3)}) saturate(0.85) contrast(1.05)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  return (
    <div aria-hidden className="machine-bg">
      <div ref={plate} className="machine-plate">
        <picture>
          <source srcSet="/machine-sm.webp" media="(max-width: 800px)" />
          <img ref={img} src="/machine.webp" alt="" width={1408} height={768} />
        </picture>
      </div>
      {/* Gold current tracing the circuitry */}
      <span className="machine-pulse machine-pulse-a" />
      <span className="machine-pulse machine-pulse-b" />
      {/* Readability veil: without this the plate eats body-copy contrast */}
      <div className="machine-veil" />
    </div>
  );
}
