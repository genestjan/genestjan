'use client';
import { useEffect, useRef } from 'react';
import { usePrefersReducedMotion } from '@/lib/useReducedMotion';

/** 400px radial amber at 6%, screen blend, 60ms lag. Desktop only. BRIEF 6.6. */
export default function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced || !window.matchMedia('(hover:hover)').matches) return;
    let raf = 0;
    const target = { x: -999, y: -999 };
    const cur = { x: -999, y: -999 };
    const onMove = (e: PointerEvent) => { target.x = e.clientX; target.y = e.clientY; };
    const loop = () => {
      cur.x += (target.x - cur.x) * 0.18;
      cur.y += (target.y - cur.y) * 0.18;
      if (ref.current) ref.current.style.transform = `translate3d(${cur.x - 200}px, ${cur.y - 200}px, 0)`;
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => { window.removeEventListener('pointermove', onMove); cancelAnimationFrame(raf); };
  }, [reduced]);

  if (reduced) return null;
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-50 hidden h-[400px] w-[400px] rounded-full md:block"
      style={{
        background: 'radial-gradient(circle, rgba(255,176,58,0.06), transparent 70%)',
        mixBlendMode: 'screen',
      }}
    />
  );
}
