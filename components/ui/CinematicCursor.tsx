'use client';
import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '@/lib/useReducedMotion';

/**
 * Trailing magnetic cursor with states. Reads `document.body.dataset.cursor`,
 * which 3D nodes and links set on hover, so the scene can drive it without
 * prop-drilling through the canvas.
 */
export default function CinematicCursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState('');
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced || !window.matchMedia('(hover:hover)').matches) return;

    const t = { x: innerWidth / 2, y: innerHeight / 2 };
    const d = { ...t };
    const r = { ...t };
    let raf = 0;

    const move = (e: PointerEvent) => {
      t.x = e.clientX; t.y = e.clientY;
      const el = e.target as HTMLElement | null;
      const state =
        document.body.dataset.cursor ??
        (el?.closest('a,button') ? 'view' : '');
      setLabel(state === 'zoom' ? 'ZOOM' : state === 'drag' ? 'DRAG' : state === 'view' ? 'VIEW' : '');
    };

    const loop = () => {
      d.x += (t.x - d.x) * 0.35; d.y += (t.y - d.y) * 0.35;
      r.x += (t.x - r.x) * 0.14; r.y += (t.y - r.y) * 0.14;
      if (dot.current) dot.current.style.transform = `translate3d(${d.x - 3}px,${d.y - 3}px,0)`;
      if (ring.current) ring.current.style.transform = `translate3d(${r.x - 22}px,${r.y - 22}px,0)`;
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener('pointermove', move, { passive: true });
    raf = requestAnimationFrame(loop);
    document.documentElement.classList.add('has-custom-cursor');

    return () => {
      window.removeEventListener('pointermove', move);
      cancelAnimationFrame(raf);
      document.documentElement.classList.remove('has-custom-cursor');
    };
  }, [reduced]);

  if (reduced) return null;

  return (
    <div aria-hidden className="hidden md:block">
      <div ref={dot} className="cur-dot" />
      <div ref={ring} className={`cur-ring ${label ? 'cur-ring-on' : ''}`}>
        {label && <span className="cur-label">{label}</span>}
      </div>
    </div>
  );
}
