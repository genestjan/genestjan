import type { ReactNode } from 'react';

/** Shared section shell: consistent rhythm, max width and landmark. */
export default function Section({
  id, children, className = '', alt = false,
}: { id: string; children: ReactNode; className?: string; alt?: boolean }) {
  return (
    <section
      id={id}
      className={`relative py-24 sm:py-32 ${alt ? 'bg-ink-2' : 'bg-ink'} ${className}`}
    >
      <div className="mx-auto max-w-content px-5 sm:px-8">{children}</div>
    </section>
  );
}
