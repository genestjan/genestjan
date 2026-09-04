'use client';
import { useRef, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { usePrefersReducedMotion } from '@/lib/useReducedMotion';

/** Magnetic pull within 80px, max 12px offset, spring 150/15. BRIEF 6.6. */
export default function MagneticButton({
  children, href, variant = 'solid', className = '', onClick, type, external = false,
}: {
  children: ReactNode; href?: string; variant?: 'solid' | 'ghost';
  className?: string; onClick?: () => void; type?: 'button' | 'submit';
  /** Booking links go off-site, so they open in a new tab with rel guards. */
  external?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();

  const onMove = (e: React.PointerEvent) => {
    if (reduced || !ref.current || e.pointerType !== 'mouse') return;
    const r = ref.current.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    if (Math.hypot(dx, dy) > 80 + Math.max(r.width, r.height) / 2) return;
    ref.current.style.transform =
      `translate(${Math.max(-12, Math.min(12, dx * 0.3))}px, ${Math.max(-12, Math.min(12, dy * 0.3))}px)`;
  };
  const reset = () => { if (ref.current) ref.current.style.transform = ''; };

  const base =
    'inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold tracking-wide transition-colors duration-300 will-change-transform';
  const styles =
    variant === 'solid'
      ? 'bg-signal text-ink hover:bg-[#FFC066] shadow-[0_8px_30px_rgba(255,176,58,0.25)]'
      : 'border border-line text-paper hover:border-current hover:text-current';

  const inner = (
    <motion.span
      className="contents"
      transition={{ type: 'spring', stiffness: 150, damping: 15 }}
    >
      {children}
    </motion.span>
  );

  if (href) {
    return (
      <a
        ref={ref as React.RefObject<HTMLAnchorElement>}
        href={href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        onPointerMove={onMove}
        onPointerLeave={reset}
        className={`${base} ${styles} ${className}`}
        style={{ transition: 'transform 300ms cubic-bezier(0.22,1,0.36,1), background-color 300ms' }}
      >
        {inner}
      </a>
    );
  }
  return (
    <button
      ref={ref as React.RefObject<HTMLButtonElement>}
      type={type ?? 'button'}
      onClick={onClick}
      onPointerMove={onMove}
      onPointerLeave={reset}
      className={`${base} ${styles} ${className}`}
      style={{ transition: 'transform 300ms cubic-bezier(0.22,1,0.36,1), background-color 300ms' }}
    >
      {inner}
    </button>
  );
}
