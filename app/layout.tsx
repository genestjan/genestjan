import type { Metadata } from 'next';
import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { site, faq } from '@/lib/content';
import CursorGlow from '@/components/ui/CursorGlow';
import ScrollProgress from '@/components/layout/ScrollProgress';
import SmoothScroll from '@/components/layout/SmoothScroll';
import CinematicCursor from '@/components/ui/CinematicCursor';
import ApertureIntro from '@/components/ui/ApertureIntro';
import MachineBackdrop from '@/components/layout/MachineBackdrop';

const display = Space_Grotesk({
  subsets: ['latin'], weight: ['500', '700'],
  variable: '--font-display', display: 'swap', preload: true,
});
const body = Inter({
  subsets: ['latin'], weight: ['400', '500', '600'],
  variable: '--font-body', display: 'swap',
});
const mono = JetBrains_Mono({
  subsets: ['latin'], weight: ['400', '500'],
  variable: '--font-mono', display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(site.domain),
  title: site.title,
  description: site.description,
  keywords: site.keywords,
  authors: [{ name: site.name }],
  alternates: { canonical: site.domain },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    url: site.domain,
    siteName: site.name,
    title: site.title,
    description: site.description,
    images: [{ url: '/logo-512.png', width: 512, height: 512, alt: site.name }],
    locale: 'en_GB',
  },
  twitter: {
    card: 'summary_large_image',
    title: site.title,
    description: site.description,
    images: ['/logo-512.png'],
  },
  icons: { icon: '/logo-512.png', apple: '/logo-512.png' },
};

export const viewport = { themeColor: '#06080D' };

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Person',
      '@id': `${site.domain}/#person`,
      name: site.name,
      alternateName: 'Jan Ramirez',
      url: site.domain,
      image: `${site.domain}/jan.png`,
      email: site.email,
      jobTitle: 'Digital Marketing Operator',
      description: site.description,
      knowsLanguage: ['English', 'Filipino', 'Cebuano'],
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'General Santos City',
        addressCountry: 'PH',
      },
      sameAs: [site.linkedin, site.facebook],
      knowsAbout: site.keywords,
    },
    {
      '@type': 'ProfessionalService',
      '@id': `${site.domain}/#service`,
      name: `${site.name}, Digital Marketing`,
      url: site.domain,
      image: `${site.domain}/logo-512.png`,
      email: site.email,
      founder: { '@id': `${site.domain}/#person` },
      priceRange: '$$',
      areaServed: 'Worldwide',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'General Santos City',
        addressCountry: 'PH',
      },
      description: site.description,
    },
    {
      // The page renders these questions visibly; the schema mirrors them so
      // they are eligible for FAQ rich results.
      '@type': 'FAQPage',
      '@id': `${site.domain}/#faq`,
      mainEntity: faq.items.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    {
      '@type': 'WebSite',
      '@id': `${site.domain}/#website`,
      url: site.domain,
      name: site.name,
      publisher: { '@id': `${site.domain}/#person` },
      inLanguage: 'en-GB',
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <head>
        {/* Scroll reveals are JS-driven per BRIEF 6.6, which serialises to
            inline opacity:0. Without this the page below the hero is blank
            when scripts fail or are blocked. */}
        <noscript>
          <style>{`[style*="opacity:0"]{opacity:1!important;transform:none!important}`}</style>
        </noscript>
      </head>
      <body className="grain vignette">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <a href="#main" className="skip-link">Skip to content</a>
        <MachineBackdrop />
        <ApertureIntro />
        <SmoothScroll />
        <ScrollProgress />
        <CursorGlow />
        <CinematicCursor />
        {children}
      </body>
    </html>
  );
}
