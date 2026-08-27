import { gap } from '@/lib/content';
import Section from './Section';
import Eyebrow from '@/components/ui/Eyebrow';
import Reveal from '@/components/ui/Reveal';
import GlassCard from '@/components/ui/GlassCard';

export default function Gap() {
  return (
    <Section id="gap">
      <Reveal><Eyebrow>{gap.eyebrow}</Eyebrow></Reveal>
      <Reveal delay={0.05}>
        <h2 className="max-w-[18ch] font-display text-h2 font-bold text-paper">{gap.h2}</h2>
      </Reveal>

      <div className="mt-10 max-w-prose space-y-5">
        {gap.body.map((p, i) => (
          <Reveal key={i} delay={0.05 + i * 0.04}>
            <p className={`text-body ${i === gap.body.length - 1 ? 'font-medium text-signal' : 'text-muted'}`}>
              {p}
            </p>
          </Reveal>
        ))}
      </div>

      <ul className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {gap.cards.map((c, i) => (
          <li key={i}>
            <Reveal delay={(i % 3) * 0.08}>
              <GlassCard className="h-full">
                <p className="font-display text-h3 font-medium leading-snug text-paper">
                  &ldquo;{c.quote}&rdquo;
                </p>
                <p className="mt-4 text-sm leading-relaxed text-muted">{c.diagnosis}</p>
              </GlassCard>
            </Reveal>
          </li>
        ))}
      </ul>
    </Section>
  );
}
