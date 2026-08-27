'use client';
import { motion } from 'framer-motion';
import { fadeUp, viewportOnce } from '@/lib/motion';
import type { ReactNode } from 'react';

export default function Reveal({
  children, delay = 0, className = '',
}: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={viewportOnce}
      variants={fadeUp}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}
