import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { site, services, process, faq, cta } from '@/lib/content';
import Section from '@/components/sections/Section';
import Eyebrow from '@/components/ui/Eyebrow';
import GlassCard from '@/components/ui/GlassCard';
import ToolChip from '@/components/ui/ToolChip';
import MagneticButton from '@/components/ui/MagneticButton';
import SubHeader from '@/components/layout/SubHeader';

export const dynamicParams = false;

export function generateStaticParams() {
  return services.items.map((s) => ({ slug: s.slug }));
}

function find(slug: string) {
  return services.items.find((s) => s.slug === slug);
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const s = find(params.slug);
  if (!s) return {};
  const url = `${site.domain}/services/${s.slug}/`;
  const title = `${s.seoTitle} | ${site.name}`;
  return {
    title,
    description: s.seoDescription,
    alternates: { canonical: url },
    openGraph: { type: 'website', url, siteName: site.name, title, description: s.seoDescription, images: ['/og.png'], locale: 'en_GB' },
    twitter: { card: 'summary_large_image', title, description: s.seoDescription, images: ['/og.png'] },
  };
}

export default function ServicePage({ params }: { params: { slug: string } }) {
  const s = find(params.slug);
  if (!s) notFound();
  const url = `${site.domain}/services/${s.slug}/`;
  const others = services.items.filter((o) => o.slug !== s.slug);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Service',
        '@id': `${url}#service`,
        name: s.title,
        serviceType: s.seoTitle,
        description: s.seoDescription,
        url,
        provider: { '@id': `${site.domain}/#person` },
        areaServed: ['GB', 'AU', 'US', 'PH'],
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: `${s.title}: what is included`,
          itemListElement: s.tags.map((t) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: t } })),
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: site.domain },
          { '@type': 'ListItem', position: 2, name: 'Services', item: `${site.domain}/#services` },
          { '@type': 'ListItem', position: 3, name: s.title, item: url },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SubHeader />
      <main id="main">
        <Section id="service" className="!pt-10">
          <nav aria-label="Breadcrumb" className="mono-label mb-10 text-muted">
            <a href="/" className="hover:text-paper">Home</a> / <a href="/#services" className="hover:text-paper">Services</a> / <span className="text-paper">{s.title}</span>
          </nav>
          <Eyebrow>{`SERVICE ${s.n} / ${site.location.toUpperCase()}`}</Eyebrow>
          <h1 className="font-display text-h2 font-bold text-paper">{s.seoTitle}</h1>
          <p className="mt-6 max-w-prose text-body text-muted">{s.body}</p>
          <p className="mt-4 max-w-prose text-body text-muted">{s.seoDescription}</p>
          <div className="mt-8"><MagneticButton href={site.booking} external>{cta.button}</MagneticButton></div>

          <h2 className="mt-20 font-display text-h3 font-bold text-paper">What is included</h2>
          <ul className="mt-6 flex flex-wrap gap-2">
            {s.tags.map((t) => <li key={t}><ToolChip>{t}</ToolChip></li>)}
          </ul>

          <h2 className="mt-20 font-display text-h3 font-bold text-paper">How we work together</h2>
          <ol className="mt-6 grid gap-5 md:grid-cols-2">
            {process.steps.map((p) => (
              <li key={p.n}>
                <GlassCard className="h-full">
                  <p className="mono-label text-signal">{p.n}</p>
                  <h3 className="mt-3 font-display text-h3 font-medium text-paper">{p.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted">{p.body}</p>
                </GlassCard>
              </li>
            ))}
          </ol>

          <h2 className="mt-20 font-display text-h3 font-bold text-paper">Questions</h2>
          <dl className="mt-6 max-w-prose space-y-6">
            {faq.items.map((f) => (
              <div key={f.q}>
                <dt className="font-display font-medium text-paper">{f.q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted">{f.a}</dd>
              </div>
            ))}
          </dl>

          <h2 className="mt-20 font-display text-h3 font-bold text-paper">It plugs into</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((o) => (
              <li key={o.slug}>
                <a href={`/services/${o.slug}/`} className="block rounded-xl border border-white/10 px-4 py-3 text-sm text-muted hover:text-paper">{o.title}</a>
              </li>
            ))}
          </ul>

          <div className="mt-20 max-w-prose">
            <h2 className="font-display text-h3 font-bold text-paper">{cta.h2}</h2>
            <p className="mt-4 text-body text-muted">{cta.body}</p>
            <div className="mt-8"><MagneticButton href={site.booking} external>{cta.button}</MagneticButton></div>
          </div>
        </Section>
      </main>
    </>
  );
}
