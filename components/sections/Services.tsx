import { services } from '@/lib/content';
import Section from './Section';
import Eyebrow from '@/components/ui/Eyebrow';
import Reveal from '@/components/ui/Reveal';
import GlassCard from '@/components/ui/GlassCard';
import ToolChip from '@/components/ui/ToolChip';

export default function Services() {
  return (
    <Section id="services">
      <Reveal><Eyebrow>{services.eyebrow}</Eyebrow></Reveal>
      <Reveal delay={0.05}>
        <h2 className="font-display text-h2 font-bold text-paper">{services.h2}</h2>
      </Reveal>
      <Reveal delay={0.1}>
        <p className="mt-6 max-w-prose text-body text-muted">{services.intro}</p>
      </Reveal>

      <ul className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {services.items.map((s, i) => (
          <li key={s.n}>
            <Reveal delay={(i % 3) * 0.07}>
              <GlassCard className="h-full">
                <p className="mono-label text-signal">{s.n}</p>
                <h3 className="mt-3 font-display text-h3 font-medium text-paper">{s.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">{s.body}</p>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {s.tags.map((t) => <li key={t}><ToolChip>{t}</ToolChip></li>)}
                </ul>
              </GlassCard>
            </Reveal>
          </li>
        ))}
      </ul>
    </Section>
  );
}
