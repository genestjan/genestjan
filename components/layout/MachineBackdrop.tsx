'use client';
import { useEffect, useRef } from 'react';
import { usePrefersReducedMotion } from '@/lib/useReducedMotion';

/**
 * The machine plate as a living site background.
 *
 * Fixed behind everything, drifting slowly and parallaxing against scroll, with
 * gold energy pulses tracing over the circuitry. Heavily dimmed so body copy
 * keeps its contrast ratio; the plate is atmosphere, not decoration competing
 * with the text.
 */
export default function MachineBackdrop() {
  const plate = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    let cur = 0;
    const loop = () => {
      // Parallax: the plate moves at a fraction of scroll so it sits "behind".
      const target = window.scrollY * 0.055;
      cur += (target - cur) * 0.08;
      if (plate.current) {
        plate.current.style.transform = `translate3d(0, ${-cur}px, 0) scale(1.08)`;
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
          <img src="/machine.webp" alt="" width={1408} height={768} loading="eager" />
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
