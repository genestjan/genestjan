'use client';
import { useEffect, useRef, useState } from 'react';
import { process } from '@/lib/content';
import Section from './Section';
import Eyebrow from '@/components/ui/Eyebrow';
import Reveal from '@/components/ui/Reveal';
import BridgeBuild from '@/components/canvas/BridgeBuild';

/**
 * Four steps with the bridge going up beside them.
 *
 * The step crossing the middle of the viewport drives the build, so reading
 * the section is what constructs the span. Tracking is an IntersectionObserver
 * with the root squeezed to a band across the middle, which is a lot steadier
 * than mapping scroll offsets and costs nothing per frame.
 *
 * The bridge is pinned at both sizes. Left unpinned on phones it sat above the
 * list and scrolled away before the second stage ever fired, so the whole
 * build was desktop-only.
 */
export default function Process() {
  const [step, setStep] = useState(-1);
  const items = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const i = items.current.indexOf(e.target as HTMLLIElement);
          if (i >= 0) setStep(i);
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    items.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <Section id="process">
      <Reveal><Eyebrow>{process.eyebrow}</Eyebrow></Reveal>
      <Reveal delay={0.05}>
        <h2 className="font-display text-h2 font-bold text-paper">{process.h2}</h2>
      </Reveal>

      <div className="mt-14 grid gap-12 lg:grid-cols-[1fr_minmax(0,470px)] lg:gap-16">
        <div className="bridge-pane lg:col-start-2 lg:row-start-1 lg:self-start">
          <BridgeBuild step={step} />
          <p className="mono-label mt-4 text-center text-muted">
            <span className="text-signal">
              {step < 0 ? '00' : process.steps[step].n}
            </span>
            {' / '}
            {step < 0 ? 'The gap' : process.steps[step].title}
          </p>
        </div>

        <ol className="lg:col-start-1 lg:row-start-1 space-y-12">
          {process.steps.map((s, i) => (
            <li
              key={s.n}
              ref={(el) => { items.current[i] = el; }}
              data-active={step === i}
              className="step-row"
            >
              <div className="grid gap-5 lg:grid-cols-[44px_1fr] lg:gap-7">
                <span className="step-num mono-label flex h-11 w-11 items-center justify-center rounded-full border">
                  {s.n}
                </span>
                <div>
                  <h3 className="font-display text-h3 font-medium text-paper">{s.title}</h3>
                  <p className="mt-3 max-w-prose text-body text-muted">{s.body}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}
