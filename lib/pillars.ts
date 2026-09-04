/**
 * The four focus areas shown as a strip under the hero copy.
 *
 * The build spec listed "Print Services" and "Security & Camera Systems".
 * Those are not services Jan offers and appear nowhere in BRIEF.md, so these
 * map to his real pillars instead. Change these if that was intended.
 */
export type Pillar = {
  id: string;
  label: string;
  hud: string;
  href: string;
};

export const pillars: Pillar[] = [
  { id: 'ads', label: 'Meta Ads', hud: 'PAID ACQUISITION', href: '#services' },
  { id: 'funnels', label: 'Funnels', hud: 'CONVERSION PATH', href: '#system' },
  { id: 'automation', label: 'Automation', hud: 'CRM + WORKFLOW', href: '#services' },
  { id: 'media', label: 'Video & Podcast', hud: 'MEDIA PRODUCTION', href: '#work' },
];
