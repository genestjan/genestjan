'use client';
import { useRef, type ReactNode } from 'react';
import { usePrefersReducedMotion } from '@/lib/useReducedMotion';

/** Glass panel with pointer tilt, max 8deg, BRIEF 6.6. Tilt off for touch and reduced motion. */
export default function GlassCard({
  children, className = '', tilt = true,
}: { children: ReactNode; className?: string; tilt?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const active = tilt && !reduced;

  const onMove = (e: React.PointerEvent) => {
    if (!active || !ref.current || e.pointerType !== 'mouse') return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    ref.current.style.transform =
      `perspective(1000px) rotateY(${px * 8}deg) rotateX(${-py * 8}deg) scale(1.02)`;
  };
  const reset = () => {
    if (ref.current) ref.current.style.transform = '';
  };

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      className={`glass p-6 sm:p-8 ${className}`}
    >
      {children}
    </div>
  );
}
