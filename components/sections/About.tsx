import Image from 'next/image';
import { about } from '@/lib/content';
import Section from './Section';
import Eyebrow from '@/components/ui/Eyebrow';
import Reveal from '@/components/ui/Reveal';
import CountUp from '@/components/ui/CountUp';

export default function About() {
  return (
    <Section id="about">
      <div className="grid gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
        <Reveal>
          <div className="relative">
            <div className="relative overflow-hidden rounded-2xl border border-line">
              <Image
                src="/jan.png" alt="Genest Jan Ramirez"
                width={1468} height={1161} priority={false}
                className="w-full object-cover"
                style={{ filter: 'contrast(1.08) saturate(0.92)' }}
              />
              <div
                aria-hidden className="absolute inset-0"
                style={{ background: 'linear-gradient(160deg, rgba(79,209,224,0.12), transparent 55%)' }}
              />
            </div>
            <div className="absolute -bottom-6 -right-4 flex h-24 w-24 items-center justify-center rounded-full border border-line bg-ink p-5 sm:-right-6">
              <Image src="/logo-512.png" alt="" width={64} height={64} className="w-full object-contain" />
            </div>
          </div>
        </Reveal>

        <div>
          <Reveal><Eyebrow>{about.eyebrow}</Eyebrow></Reveal>
          <Reveal delay={0.05}>
            <h2 className="max-w-[20ch] font-display text-h2 font-bold text-paper">{about.h2}</h2>
          </Reveal>

          <div className="mt-8 max-w-prose space-y-5">
            {about.body.map((p, i) => (
              <Reveal key={i} delay={0.04 * i}>
                <p className="text-body text-muted">{p}</p>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <dl className="mt-12 grid grid-cols-2 gap-6 border-t border-line pt-8 lg:grid-cols-4">
              {about.stats.map((s) => (
                <div key={s.label}>
                  <dt className="sr-only">{s.label}</dt>
                  <dd>
                    <span className="block font-display text-3xl font-bold text-signal">
                      <CountUp to={s.value} suffix={s.suffix} />
                    </span>
                    <span className="mono-label mt-1 block text-muted">{s.label}</span>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mono-label mt-6 text-muted">{about.languages}</p>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
