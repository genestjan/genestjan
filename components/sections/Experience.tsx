'use client';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { experience, site } from '@/lib/content';
import Section from './Section';
import Eyebrow from '@/components/ui/Eyebrow';
import Reveal from '@/components/ui/Reveal';
import MagneticButton from '@/components/ui/MagneticButton';
import { EASE } from '@/lib/motion';

type Row = { period: string; client: string; role: string; url: string };

function Rows({ rows, live = false }: { rows: Row[]; live?: boolean }) {
  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => (
        <li key={r.client + r.period} className="grid gap-1 py-5 lg:grid-cols-[200px_1fr] lg:gap-8">
          <span className="mono-label text-muted">{r.period}</span>
          <div>
            <p className="flex items-center gap-3 font-display text-base font-medium text-paper">
              {live && (
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-signal shadow-[0_0_10px_#FFB03A]" />
              )}
              {r.url ? (
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="hover:text-current">
                  {r.client}
                </a>
              ) : r.client}
            </p>
            <p className="mt-1 text-sm text-muted">{r.role}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function Experience() {
  const [open, setOpen] = useState(false);

  return (
    <Section id="experience" alt>
      <Reveal><Eyebrow>{experience.eyebrow}</Eyebrow></Reveal>
      <Reveal delay={0.05}>
        <h2 className="font-display text-h2 font-bold text-paper">{experience.h2}</h2>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="mt-12 rounded-2xl border border-signal/30 bg-[rgba(255,176,58,0.04)] p-6 sm:p-8">
          <Rows rows={experience.current} live />
        </div>
      </Reveal>

      <Reveal delay={0.15}>
        <div className="mt-10">
          <Rows rows={experience.featured} />
        </div>
      </Reveal>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="full"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="overflow-hidden"
          >
            <Rows rows={experience.full} />
            <p className="mono-label mt-10 text-current">Before freelancing</p>
            <Rows rows={experience.before} />
            <p className="mt-8 max-w-prose text-body text-muted">{experience.note}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mono-label mt-8 rounded-full border border-line px-5 py-2.5 text-muted transition-colors duration-300 hover:border-current hover:text-current"
      >
        {open ? 'Hide full history' : 'Show full history'}
      </button>

      <div className="mt-12">
        <MagneticButton href={site.booking} external>Book a call</MagneticButton>
      </div>
    </Section>
  );
}
