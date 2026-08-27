// Shared variants and easings, BRIEF.md 6.6
import type { Variants } from 'framer-motion';

export const EASE = [0.22, 1, 0.36, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

export const stagger = (staggerChildren = 0.08): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren } },
});

export const viewportOnce = { once: true, margin: '-100px' } as const;
