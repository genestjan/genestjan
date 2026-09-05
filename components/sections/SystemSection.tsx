import { system } from '@/lib/content';
import Section from './Section';
import Eyebrow from '@/components/ui/Eyebrow';
import Reveal from '@/components/ui/Reveal';
import GearTrain from '@/components/canvas/GearTrain';

export default function SystemSection() {
  return (
    <Section id="system" alt>
      <Reveal><Eyebrow>{system.eyebrow}</Eyebrow></Reveal>
      <Reveal delay={0.05}>
        <h2 className="max-w-[20ch] font-display text-h2 font-bold text-paper">{system.h2}</h2>
      </Reveal>

      <div className="mt-8 max-w-prose space-y-5">
        {system.body.map((p, i) => (
          <Reveal key={i} delay={0.05 + i * 0.05}>
            <p className="text-body text-muted">{p}</p>
          </Reveal>
        ))}
      </div>

      <div className="mt-14">
        <GearTrain />
      </div>

      <Reveal>
        <p className="mt-14 max-w-prose text-body text-paper">{system.closing}</p>
      </Reveal>
    </Section>
  );
}
