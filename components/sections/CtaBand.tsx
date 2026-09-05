import { cta, site } from '@/lib/content';
import Eyebrow from '@/components/ui/Eyebrow';
import Reveal from '@/components/ui/Reveal';
import MagneticButton from '@/components/ui/MagneticButton';
import { ArrowRight, Check } from 'lucide-react';

/**
 * The middle ask.
 *
 * Booking previously appeared only in the nav, the hero and the contact
 * section at the very bottom, so a reader who was convinced by the case
 * studies had roughly two thousand words to get through before they were
 * offered anything. This is the same offer, put where the conviction is.
 */
export default function CtaBand() {
  return (
    <section id="book" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-content px-5 sm:px-8">
        <Reveal>
          <div className="cta-band relative overflow-hidden rounded-3xl px-6 py-12 sm:px-12 sm:py-16">
            {/* Gear arc bleeding in from the right, the same motif as the hero */}
            <span aria-hidden className="cta-cog" />

            <div className="relative grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-16">
              <div>
                <Eyebrow>{cta.eyebrow}</Eyebrow>
                <h2 className="max-w-[16ch] font-display text-h2 font-bold text-paper">
                  {cta.h2}
                </h2>
                <p className="mt-6 max-w-prose text-body text-muted">{cta.body}</p>
              </div>

              <div>
                <ul className="space-y-3">
                  {cta.points.map((pt) => (
                    <li key={pt} className="flex items-start gap-3 text-body text-paper">
                      <Check size={17} className="mt-1 shrink-0 text-signal" aria-hidden />
                      {pt}
                    </li>
                  ))}
                </ul>

                <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3">
                  <MagneticButton href={site.booking} external>
                    {cta.button} <ArrowRight size={16} aria-hidden />
                  </MagneticButton>
                  <a
                    href="#contact"
                    className="mono-label text-muted underline-offset-4 transition-colors hover:text-current hover:underline"
                  >
                    {cta.note}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
