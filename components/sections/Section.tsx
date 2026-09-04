import type { ReactNode } from 'react';

/** Shared section shell: consistent rhythm, max width and landmark.
 *
 * Sections used to be translucent blocks so the site-wide film showed through.
 * The film is hero-only now, so they sit on the page ground instead, and the
 * alternating band fades in at its edges rather than starting on a hard line.
 */
export default function Section({
  id, children, className = '', alt = false,
}: { id: string; children: ReactNode; className?: string; alt?: boolean }) {
  return (
    <section
      id={id}
      className={`relative py-24 sm:py-32 ${alt ? 'section-alt' : ''} ${className}`}
    >
      <div className="mx-auto max-w-content px-5 sm:px-8">{children}</div>
    </section>
  );
}
