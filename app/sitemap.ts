import type { MetadataRoute } from 'next';
import { site, services } from '@/lib/content';
import { HOMEPAGE_VISIBLE } from '@/lib/visibility';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  if (!HOMEPAGE_VISIBLE) return [];
  return [
    { url: `${site.domain}/`, changeFrequency: 'monthly', priority: 1 },
    ...services.items.map((s) => ({
      url: `${site.domain}/services/${s.slug}/`,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    { url: `${site.domain}/ridewise/`, changeFrequency: 'monthly', priority: 0.5 },
  ];
}
