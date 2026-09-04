'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { work } from '@/lib/content';
import Section from './Section';
import Eyebrow from '@/components/ui/Eyebrow';
import Reveal from '@/components/ui/Reveal';
import GlassCard from '@/components/ui/GlassCard';
import ToolChip from '@/components/ui/ToolChip';
import { EASE } from '@/lib/motion';

export default function Work() {
  const [filter, setFilter] = useState('All');
  const shown = filter === 'All' ? work.cases : work.cases.filter((c) => c.cats.includes(filter));

  return (
    <Section id="work" alt>
      <Reveal><Eyebrow>{work.eyebrow}</Eyebrow></Reveal>
      <Reveal delay={0.05}>
        <h2 className="font-display text-h2 font-bold text-paper">{work.h2}</h2>
      </Reveal>
      <Reveal delay={0.1}>
        <p className="mt-6 max-w-prose text-body text-muted">{work.intro}</p>
      </Reveal>

      <Reveal delay={0.15}>
        <div role="tablist" aria-label="Filter work by type" className="mt-10 flex flex-wrap gap-2">
          {work.filters.map((f) => {
            const on = filter === f;
            return (
              <button
                key={f}
                role="tab"
                aria-selected={on}
                onClick={() => setFilter(f)}
                className={`mono-label rounded-full border px-4 py-2 transition-colors duration-300 ${
                  on ? 'border-current text-current' : 'border-line text-muted hover:text-paper'
                }`}
              >
                {f}
              </button>
            );
          })}
        </div>
      </Reveal>

      <motion.ul layout className="mt-12 grid gap-5 lg:grid-cols-2">
        <AnimatePresence mode="popLayout">
          {shown.map((c) => (
            <motion.li
              key={c.id}
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              <GlassCard className="h-full">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="mono-label rounded-full border border-line px-3 py-1 text-current">
                    {c.cats[0]}
                  </span>
                  {c.period && <span className="mono-label text-muted">{c.period}</span>}
                </div>

                <h3 className="mt-5 font-display text-h3 font-medium text-paper">{c.title}</h3>
                {c.sector && <p className="mt-2 text-sm text-signal">{c.sector}</p>}

                {c.problem && (
                  <p className="mt-5 text-sm leading-relaxed text-muted">
                    <span className="mono-label mr-2 text-current">The problem</span>
                    {c.problem}
                  </p>
                )}
                <p className="mt-4 text-sm leading-relaxed text-muted">
                  <span className="mono-label mr-2 text-current">What I built</span>
                  {c.built}
                </p>

                <ul className="mt-6 flex flex-wrap gap-2">
                  {c.stack.map((s) => <li key={s}><ToolChip>{s}</ToolChip></li>)}
                </ul>
              </GlassCard>
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>
    </Section>
  );
}
