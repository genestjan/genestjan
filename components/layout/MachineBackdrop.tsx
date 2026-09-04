'use client';
import { useEffect, useRef } from 'react';
import MachineVideo from '@/components/canvas/MachineVideo';
import { usePrefersReducedMotion } from '@/lib/useReducedMotion';

/**
 * The machine film behind the hero.
 *
 * It used to be fixed behind the whole document. Running footage under every
 * section made the body feel like a screensaver and forced every panel to be
 * translucent to let it through, which is what made the lower page look washed
 * out. It now lives inside the hero and hands off to a solid page.
 *
 * The intro sits on top of this and lifts away, so the entrance and the hero
 * are the same continuously playing footage.
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
      // Progress across the first viewport only: the film is a hero element,
      // so it finishes its move by the time the hero leaves the screen.
      const target = Math.min(scrollY / Math.max(innerHeight, 1), 1);
      cur += (target - cur) * 0.08;
      if (plate.current) {
        plate.current.style.transform =
          `translate3d(0, ${(-cur * 90).toFixed(1)}px, 0) scale(${(1.06 - cur * 0.04).toFixed(4)})`;
      }
      if (veil.current) {
        // opacity composites; brightness() would repaint the whole frame
        veil.current.style.opacity = (0.22 + cur * 0.68).toFixed(3);
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
      <div className="machine-veil" />
      <div ref={veil} className="machine-dim" />
    </div>
  );
}
