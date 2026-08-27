'use client';
import { useEffect, useRef } from 'react';

/** Normalised pointer position (-1..1), written to a ref so it never re-renders. */
export function useMousePosition() {
  const pos = useRef({ x: 0, y: 0 });
  useEffect(() => {
    if (!window.matchMedia('(hover:hover)').matches) return;
    const on = (e: PointerEvent) => {
      pos.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pos.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('pointermove', on, { passive: true });
    return () => window.removeEventListener('pointermove', on);
  }, []);
  return pos;
}
