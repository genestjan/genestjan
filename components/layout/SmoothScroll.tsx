'use client';
import { useLenis } from '@/lib/useLenis';

/** Mounts Lenis for the whole page. Renders nothing. */
export default function SmoothScroll() {
  useLenis();
  return null;
}
