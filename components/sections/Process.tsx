'use client';
import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { process } from '@/lib/content';
import Section from './Section';
import Eyebrow from '@/components/ui/Eyebrow';
import Reveal from '@/components/ui/Reveal';

export default function Process() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.8', 'end 0.4'] });
  // SVG pathLength draws 0 to 1 on scroll (BRIEF 6.6)
  const draw = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <Section id="process" alt>
      <Reveal><Eyebrow>{process.eyebrow}</Eyebrow></Reveal>
      <Reveal delay={0.05}>
        <h2 className="font-display text-h2 font-bold text-paper">{process.h2}</h2>
      </Reveal>

      <div ref={ref} className="relative mt-16">
        <svg
          aria-hidden
          className="pointer-events-none absolute left-[19px] top-0 hidden h-full w-1 lg:block"
          preserveAspectRatio="none" viewBox="0 0 2 100"
        >
          <motion.line
            x1="1" y1="0" x2="1" y2="100"
            stroke="#FFB03A" strokeWidth="2"
            style={{ pathLength: draw }}
          />
        </svg>

        <ol className="space-y-10">
          {process.steps.map((s, i) => (
            <li key={s.n}>
              <Reveal delay={i * 0.06}>
                <div className="grid gap-5 lg:grid-cols-[40px_1fr] lg:gap-8">
                  <span className="mono-label flex h-10 w-10 items-center justify-center rounded-full border border-line bg-ink-2 text-signal">
                    {s.n}
                  </span>
                  <div>
                    <h3 className="font-display text-h3 font-medium text-paper">{s.title}</h3>
                    <p className="mt-3 max-w-prose text-body text-muted">{s.body}</p>
                  </div>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}
