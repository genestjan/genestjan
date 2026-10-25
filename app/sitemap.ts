import type { MetadataRoute } from 'next';
import { site } from '@/lib/content';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: site.domain, changeFrequency: 'monthly', priority: 1 },
    { url: `${site.domain}/privacy/`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${site.domain}/terms/`, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
