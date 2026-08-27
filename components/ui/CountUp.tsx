'use client';
import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '@/lib/useReducedMotion';

/**
 * Counts up on enter (BRIEF 6.6).
 *
 * Seeded with the final value rather than 0 so the static HTML carries the
 * real number. Starting at 0 meant crawlers, and anyone whose observer never
 * fired, saw "0+ years remote". The count only rewinds to 0 once we know we
 * are on the client and about to animate.
 */
export default function CountUp({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(to);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) { setN(to); return; }
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const dur = 1200;
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min((t - t0) / dur, 1);
        setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      setN(0);
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });

    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to, reduced]);

  return <span ref={ref}>{n}{suffix}</span>;
}
