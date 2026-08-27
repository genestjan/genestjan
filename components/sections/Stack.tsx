import { stack } from '@/lib/content';
import Section from './Section';
import Eyebrow from '@/components/ui/Eyebrow';
import Reveal from '@/components/ui/Reveal';
import ToolChip from '@/components/ui/ToolChip';

export default function Stack() {
  return (
    <Section id="stack">
      <Reveal><Eyebrow>{stack.eyebrow}</Eyebrow></Reveal>
      <Reveal delay={0.05}>
        <h2 className="max-w-[22ch] font-display text-h2 font-bold text-paper">{stack.h2}</h2>
      </Reveal>
      <Reveal delay={0.1}>
        <p className="mt-6 max-w-prose text-body text-muted">{stack.body}</p>
      </Reveal>

      <dl className="mt-14 space-y-10">
        {stack.groups.map((g, i) => (
          <Reveal key={g.name} delay={i * 0.04}>
            <div className="grid gap-4 border-t border-line pt-6 lg:grid-cols-[220px_1fr]">
              <dt className="mono-label text-current">{g.name}</dt>
              <dd>
                <ul className="flex flex-wrap gap-2">
                  {g.tools.map((t) => <li key={t}><ToolChip>{t}</ToolChip></li>)}
                </ul>
              </dd>
            </div>
          </Reveal>
        ))}
      </dl>
    </Section>
  );
}
