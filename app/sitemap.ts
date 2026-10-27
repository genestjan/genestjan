import type { MetadataRoute } from 'next';
import { site } from '@/lib/content';
import { HOMEPAGE_VISIBLE } from '@/lib/visibility';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  if (!HOMEPAGE_VISIBLE) return [];
  return [{ url: site.domain, changeFrequency: 'monthly', priority: 1 }];
}
