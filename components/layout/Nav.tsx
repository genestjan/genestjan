'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';
import { nav, site } from '@/lib/content';
import MagneticButton from '@/components/ui/MagneticButton';

export default function Nav() {
  const [stuck, setStuck] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const on = () => setStuck(window.scrollY > 60);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-[65] transition-all duration-500 ${
        stuck ? 'border-b border-line bg-[rgba(6,8,13,0.82)] backdrop-blur-xl' : ''
      }`}
    >
      <div className="mx-auto flex max-w-content items-center justify-between px-5 py-3 sm:px-8">
        <a href="#top" className="flex items-center gap-3">
          <Image src="/logo-512.png" alt="" width={34} height={34} className="h-8 w-8 object-contain" />
          <span className="font-display text-sm font-medium tracking-tight text-paper">
            Genest Jan <span className="text-signal">Ramirez</span>
          </span>
        </a>

        <nav aria-label="Primary" className="hidden items-center gap-7 lg:flex">
          {nav.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="mono-label text-muted transition-colors duration-300 hover:text-current"
            >
              {n.label}
            </a>
          ))}
          <MagneticButton href={site.booking} external variant="ghost" className="!px-5 !py-2.5">
            Book a call
          </MagneticButton>
        </nav>

        <div className="flex items-center gap-2 lg:hidden">
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="rounded-md p-2 text-paper"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <nav
          aria-label="Mobile"
          className="border-t border-line bg-[rgba(6,8,13,0.97)] px-5 py-6 backdrop-blur-xl lg:hidden"
        >
          <ul className="flex flex-col gap-4">
            {nav.map((n) => (
              <li key={n.href}>
                <a
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="mono-label text-muted hover:text-current"
                >
                  {n.label}
                </a>
              </li>
            ))}
            <li className="pt-2">
              <MagneticButton href={site.booking} external onClick={() => setOpen(false)}>
                Book a call
              </MagneticButton>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
