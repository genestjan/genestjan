import { testimonials } from '@/lib/content';
import Section from './Section';
import Eyebrow from '@/components/ui/Eyebrow';
import Reveal from '@/components/ui/Reveal';
import GlassCard from '@/components/ui/GlassCard';

export default function Testimonials() {
  return (
    <Section id="testimonials" alt>
      <Reveal><Eyebrow>{testimonials.eyebrow}</Eyebrow></Reveal>
      <Reveal delay={0.05}>
        <h2 className="font-display text-h2 font-bold text-paper">{testimonials.h2}</h2>
      </Reveal>

      <ul className="mt-14 grid gap-5 lg:grid-cols-2">
        {testimonials.items.map((t, i) => (
          <li key={t.name}>
            <Reveal delay={i * 0.08}>
              <GlassCard className="h-full">
                <figure>
                  <blockquote className="text-body leading-relaxed text-paper">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                  <figcaption className="mt-6 border-t border-line pt-5">
                    <span className="block font-display text-base font-medium text-signal">{t.name}</span>
                    {t.org && <span className="mono-label mt-1 block text-muted">{t.org}</span>}
                  </figcaption>
                </figure>
              </GlassCard>
            </Reveal>
          </li>
        ))}
      </ul>
    </Section>
  );
}
