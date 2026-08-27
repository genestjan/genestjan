import { industries } from '@/lib/content';
import Section from './Section';
import Eyebrow from '@/components/ui/Eyebrow';
import Reveal from '@/components/ui/Reveal';

export default function Industries() {
  return (
    <Section id="industries" alt>
      <Reveal><Eyebrow>{industries.eyebrow}</Eyebrow></Reveal>
      <Reveal delay={0.05}>
        <h2 className="font-display text-h2 font-bold text-paper">{industries.h2}</h2>
      </Reveal>
      <Reveal delay={0.1}>
        <p className="mt-6 max-w-prose text-body text-muted">{industries.body}</p>
      </Reveal>

      <ul className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {industries.items.map((it, i) => (
          <li key={it.name} className="bg-ink-2 p-6 transition-colors duration-500 hover:bg-ink-3">
            <Reveal delay={(i % 3) * 0.05}>
              <p className="mono-label text-signal">{String(i + 1).padStart(2, '0')}</p>
              <h3 className="mt-3 font-display text-base font-medium text-paper">{it.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{it.note}</p>
            </Reveal>
          </li>
        ))}
      </ul>
    </Section>
  );
}
