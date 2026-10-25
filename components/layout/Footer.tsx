import Image from 'next/image';
import { footer, site } from '@/lib/content';

/** base: '/' on pages other than home, so the section links lead back to the home page. */
export default function Footer({ base = '' }: { base?: string }) {
  return (
    <footer className="border-t border-line bg-ink py-12">
      <div className="mx-auto max-w-content px-5 sm:px-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <Image src="/logo-512.png" alt="" width={44} height={44} className="h-10 w-10 object-contain" />
            <div>
              <p className="font-display text-sm text-paper">{site.name}</p>
              <p className="mono-label mt-1 text-muted">{site.location}</p>
            </div>
          </div>

          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {footer.nav.map((n) => (
                <li key={n}>
                  <a
                    href={n === 'Home' ? `${base}#top` : `${base}#${n.toLowerCase()}`}
                    className="mono-label text-muted hover:text-current"
                  >
                    {n}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <ul className="flex gap-5">
            <li><a href={site.linkedin} target="_blank" rel="noopener noreferrer" className="mono-label text-muted hover:text-current">LinkedIn</a></li>
          </ul>
        </div>

        <p className="mono-label mt-10 text-muted">{footer.tagline}</p>
        <p className="mt-3 text-xs text-muted">{footer.copyright}</p>
        <p className="mt-2 text-xs text-muted">
          <a href="/privacy/" className="underline-offset-4 hover:text-current hover:underline">Privacy</a>
          <span aria-hidden="true"> · </span>
          <a href="/terms/" className="underline-offset-4 hover:text-current hover:underline">Terms</a>
        </p>
      </div>
    </footer>
  );
}
