'use client';
import dynamic from 'next/dynamic';
import { hero } from '@/lib/content';
import StaggerText from '@/components/ui/StaggerText';
import MagneticButton from '@/components/ui/MagneticButton';
import CanvasFallback from '@/components/canvas/CanvasFallback';
import { usePrefersReducedMotion } from '@/lib/useReducedMotion';
import { useWebGL } from '@/lib/useWebGL';
import CanvasBoundary from '@/components/canvas/CanvasBoundary';
import { ArrowRight } from 'lucide-react';

// Canvas never blocks first paint and is never the LCP element (BRIEF 6.7).
const HeroField = dynamic(() => import('@/components/canvas/HeroField'), {
  ssr: false,
  loading: () => <CanvasFallback />,
});

/**
 * Entrances here are CSS animations, not Framer Motion. Framer's `initial`
 * serialises to inline opacity:0 in the static HTML, which would leave the
 * hero copy invisible to crawlers and delay LCP until hydration.
 * Orchestrated sequence totals roughly 1.4s (BRIEF 6.6).
 */
export default function Hero() {
  const reduced = usePrefersReducedMotion();
  const webgl = useWebGL();

  return (
    <section id="top" className="relative flex min-h-[100svh] items-center overflow-hidden pb-20 pt-28 sm:pt-32">
      <div className="absolute inset-0 z-0">
        {reduced || !webgl ? (
          <CanvasFallback />
        ) : (
          <CanvasBoundary>
            <HeroField />
          </CanvasBoundary>
        )}
      </div>

      <div className="relative z-10 mx-auto w-full max-w-content px-5 sm:px-8">
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
          <MagneticButton href="#contact">
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
    </section>
  );
}
