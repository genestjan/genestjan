import { faq } from '@/lib/content';
import Section from './Section';
import Eyebrow from '@/components/ui/Eyebrow';
import Reveal from '@/components/ui/Reveal';

export default function Faq() {
  return (
    <Section id="faq">
      <Reveal><Eyebrow>{faq.eyebrow}</Eyebrow></Reveal>
      <Reveal delay={0.05}>
        <h2 className="font-display text-h2 font-bold text-paper">{faq.h2}</h2>
      </Reveal>

      <div className="mt-12 max-w-3xl">
        {faq.items.map((f, i) => (
          <Reveal key={f.q} delay={(i % 4) * 0.04}>
            <details className="group border-b border-line py-6">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 font-display text-h3 font-medium text-paper transition-colors duration-300 hover:text-current">
                {f.q}
                <span
                  aria-hidden
                  className="mt-1 shrink-0 text-2xl font-light leading-none text-signal transition-transform duration-400 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-5 max-w-prose text-body text-muted">{f.a}</p>
            </details>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
