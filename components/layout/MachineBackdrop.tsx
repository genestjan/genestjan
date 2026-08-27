'use client';
import { useEffect, useRef } from 'react';
import GearMachine from '@/components/canvas/GearMachine';
import { usePrefersReducedMotion } from '@/lib/useReducedMotion';

/**
 * The living machine as the site background, scroll-synced.
 *
 * It continues from exactly where the intro leaves it, so the hand-off is a
 * continuous shot rather than a cut. As the page advances the plate pulls back
 * and a veil deepens over it, letting it recede behind the content.
 *
 * Only `transform` and `opacity` are written per frame. A previous version set
 * `style.filter = brightness(...)` on every frame, repainting a full-screen
 * image continuously, which is what made scrolling feel laggy.
 */
export default function MachineBackdrop() {
  const plate = useRef<HTMLDivElement>(null);
  const veil = useRef<HTMLDivElement>(null);
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
        plate.current.style.transform =
          `translate3d(0, ${(-cur * 80).toFixed(1)}px, 0) scale(${(1.08 - cur * 0.09).toFixed(4)})`;
      }
      if (veil.current) {
        // opacity is composited; brightness() would repaint the whole plate
        veil.current.style.opacity = (0.34 + cur * 0.42).toFixed(3);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  return (
    <div aria-hidden className="machine-bg">
      <div ref={plate} className="machine-plate">
        <GearMachine />
      </div>
      <span className="machine-pulse machine-pulse-a" />
      <span className="machine-pulse machine-pulse-b" />
      <div className="machine-veil" />
      <div ref={veil} className="machine-dim" />
    </div>
  );
}
