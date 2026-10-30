import { config } from '../config';

type ClarityFn = ((...args: unknown[]) => void) & { q?: unknown[][] };

/**
 * Loads Microsoft Clarity (heatmaps and session recordings) when a project ID
 * is set in config. Same stub as Clarity's own snippet: calls made before the
 * tag arrives are queued. Clarity hides what riders type into fields by default.
 */
export function startClarity(id = config.clarityId) {
  if (!id || typeof window === 'undefined') return;
  const w = window as unknown as { clarity?: ClarityFn };
  if (w.clarity) return;
  const clarity: ClarityFn = (...args) => { (clarity.q = clarity.q || []).push(args); };
  w.clarity = clarity;
  const tag = document.createElement('script');
  tag.async = true;
  tag.src = `https://www.clarity.ms/tag/${id}`;
  document.head.appendChild(tag);
}
