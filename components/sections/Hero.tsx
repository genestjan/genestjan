'use client';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { hero, site } from '@/lib/content';
import type { Pillar } from '@/lib/pillars';
import StaggerText from '@/components/ui/StaggerText';
import MagneticButton from '@/components/ui/MagneticButton';
import CanvasFallback from '@/components/canvas/CanvasFallback';
import CanvasBoundary from '@/components/canvas/CanvasBoundary';
import { usePrefersReducedMotion } from '@/lib/useReducedMotion';
import { useWebGL } from '@/lib/useWebGL';
import { ArrowRight } from 'lucide-react';

// Canvas never blocks first paint and is never the LCP element (BRIEF 6.7).
const HeroScene = dynamic(() => import('@/components/canvas/HeroScene'), {
  ssr: false,
  loading: () => <CanvasFallback />,
});

/**
 * Entrances are CSS animations, not Framer Motion. Framer's `initial`
 * serialises to inline opacity:0 in the static HTML, which would leave the
 * hero copy invisible to crawlers and delay LCP until hydration.
 */
export default function Hero() {
  const reduced = usePrefersReducedMotion();
  const webgl = useWebGL();
  const [focus, setFocus] = useState<Pillar | null>(null);

  const use3D = !reduced && webgl;

  return (
    <section id="top" className="relative flex min-h-[100svh] items-center overflow-hidden pb-20 pt-28 sm:pt-32">
      <div className="absolute inset-0 z-0">
        {use3D ? (
          <CanvasBoundary>
            <HeroScene onFocusChange={setFocus} />
          </CanvasBoundary>
        ) : (
          <CanvasFallback />
        )}
      </div>

      {/* Copy recedes while a node is focused so the fly-in reads clearly */}
      <div
        className="relative z-10 mx-auto w-full max-w-content px-5 transition-all duration-700 sm:px-8"
        style={{
          opacity: focus ? 0.12 : 1,
          transform: focus ? 'translateY(-14px)' : 'none',
          filter: focus ? 'blur(2px)' : 'none',
        }}
      >
        <p className="mono-label fade-up-in mb-7 text-current" style={{ animationDelay: '0.15s' }}>
          {hero.eyebrow}
        </p>

        <h1 className="max-w-[16ch] font-display text-h1 font-bold text-paper">
          <StaggerText lines={hero.h1} delay={0} accentLine={3} />
        </h1>

        <p className="fade-up-in mt-8 max-w-prose text-body text-muted" style={{ animationDelay: '0.55s' }}>
          {hero.sub}
        </p>

        <div className="fade-up-in mt-10 flex flex-wrap gap-4" style={{ animationDelay: '0.72s' }}>
          <MagneticButton href={site.booking} external>
            {hero.ctaPrimary} <ArrowRight size={16} aria-hidden />
          </MagneticButton>
          <MagneticButton href="#system" variant="ghost">
            {hero.ctaSecondary}
          </MagneticButton>
        </div>

        <p className="mono-label fade-up-in mt-14 max-w-3xl leading-relaxed text-muted" style={{ animationDelay: '0.88s' }}>
          {hero.trust}
        </p>
      </div>

      {use3D && (
        <p className="mono-label pointer-events-none absolute bottom-7 left-1/2 z-10 -translate-x-1/2 text-center text-muted opacity-70">
          {focus ? 'Click anywhere to pull back' : 'Click a node to focus'}
        </p>
      )}
    </section>
  );
}
