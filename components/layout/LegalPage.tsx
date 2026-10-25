import Image from 'next/image';
import type { ReactNode } from 'react';
import Footer from './Footer';
import { site } from '@/lib/content';

/** Plain reading page for the privacy notice and terms: no intro, no effects, just the text. */
export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <>
      <header className="border-b border-line bg-ink">
        <div className="mx-auto flex max-w-content items-center justify-between px-5 py-3 sm:px-8">
          <a href="/" className="flex items-center gap-3">
            <Image src="/logo-512.png" alt="" width={34} height={34} className="h-8 w-8 object-contain" />
            <span className="font-display text-sm font-medium tracking-tight text-paper">{site.name}</span>
          </a>
          <a href="/" className="mono-label text-muted hover:text-current">Back to the site</a>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-3xl px-5 py-14 sm:px-8">
        <h1 className="font-display text-4xl font-bold text-paper sm:text-5xl">{title}</h1>
        <p className="mono-label mt-3 text-muted">Last updated {updated}</p>
        <div className="legal mt-10 grid gap-5 text-body leading-relaxed text-paper">{children}</div>
      </main>
      <Footer base="/" />
    </>
  );
}

export const H = ({ children }: { children: ReactNode }) => <h2 className="mt-6 font-display text-2xl font-bold text-paper">{children}</h2>;
export const L = ({ href, children }: { href: string; children: ReactNode }) => <a href={href} className="underline underline-offset-4 hover:text-signal" target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}>{children}</a>;
