import Image from 'next/image';
import { footer, site } from '@/lib/content';

export default function Footer() {
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
                    href={n === 'Home' ? '#top' : `#${n.toLowerCase()}`}
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
      </div>
    </footer>
  );
}
