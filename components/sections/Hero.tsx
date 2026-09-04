'use client';
import { hero, site } from '@/lib/content';
import { pillars } from '@/lib/pillars';
import StaggerText from '@/components/ui/StaggerText';
import MagneticButton from '@/components/ui/MagneticButton';
import MachineBackdrop from '@/components/layout/MachineBackdrop';
import { ArrowRight } from 'lucide-react';

/**
 * Entrances are CSS animations, not Framer Motion. Framer's `initial`
 * serialises to inline opacity:0 in the static HTML, which would leave the
 * hero copy invisible to crawlers and delay LCP until hydration.
 *
 * The four pillars were floating glass boxes in a WebGL scene. They read as
 * blue rectangles pasted over the film, the particle field around them looked
 * like dust on the lens, and the whole canvas cost three.js on first load to
 * say four words. They are four words now.
 */
export default function Hero() {
  return (
    <section id="top" className="relative flex min-h-[100svh] items-center overflow-hidden pb-20 pt-28 sm:pt-32">
      <MachineBackdrop />

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
          <MagneticButton href={site.booking} external>
            {hero.ctaPrimary} <ArrowRight size={16} aria-hidden />
          </MagneticButton>
          <MagneticButton href="#system" variant="ghost">
            {hero.ctaSecondary}
          </MagneticButton>
        </div>

        <ul className="fade-up-in mt-16 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4" style={{ animationDelay: '0.88s' }}>
          {pillars.map((p) => (
            <li key={p.id}>
              <a href={p.href} className="pillar-cell group block h-full px-4 py-5">
                <span className="mono-label block text-[0.6rem] text-muted transition-colors group-hover:text-current">
                  {p.hud}
                </span>
                <span className="mt-2 block font-display text-[0.95rem] font-medium text-paper">
                  {p.label}
                </span>
              </a>
            </li>
          ))}
        </ul>

        <p className="mono-label fade-up-in mt-10 max-w-3xl leading-relaxed text-muted" style={{ animationDelay: '1s' }}>
          {hero.trust}
        </p>
      </div>
    </section>
  );
}
