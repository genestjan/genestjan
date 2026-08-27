'use client';
import { useEffect, useRef } from 'react';
import MachineVideo from '@/components/canvas/MachineVideo';
import { usePrefersReducedMotion } from '@/lib/useReducedMotion';

/**
 * The machine film as the site background, scroll-synced.
 *
 * The intro sits on top of this and lifts away, so the entrance and the
 * background are the same continuously playing footage.
 *
 * Only `transform` and `opacity` are written per frame. An earlier version set
 * `style.filter = brightness(...)` every frame, repainting a full-screen layer
 * continuously, which is what made scrolling feel laggy.
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
          `translate3d(0, ${(-cur * 70).toFixed(1)}px, 0) scale(${(1.06 - cur * 0.06).toFixed(4)})`;
      }
      if (veil.current) {
        // opacity composites; brightness() would repaint the whole frame
        veil.current.style.opacity = (0.2 + cur * 0.5).toFixed(3);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  return (
    <div aria-hidden className="machine-bg">
      <div ref={plate} className="machine-plate">
        <MachineVideo />
      </div>
      <span className="machine-pulse machine-pulse-a" />
      <span className="machine-pulse machine-pulse-b" />
      <div className="machine-veil" />
      <div ref={veil} className="machine-dim" />
    </div>
  );
}
