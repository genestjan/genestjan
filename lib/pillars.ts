/**
 * The four focus areas shown as floating nodes in the hero scene.
 *
 * The build spec listed "Print Services" and "Security & Camera Systems".
 * Those are not services Jan offers and appear nowhere in BRIEF.md, so the
 * nodes map to his real pillars instead. Change these if that was intended.
 */
export type Pillar = {
  id: string;
  label: string;
  hud: string;
  blurb: string;
  href: string;
  /** Position in the 3D scene, [x, y, z] */
  pos: [number, number, number];
};

export const pillars: Pillar[] = [
  {
    id: 'ads',
    label: 'Meta Ads',
    hud: 'PAID ACQUISITION',
    blurb: 'Campaigns built for booked calls, not vanity metrics.',
    href: '#services',
    pos: [-3.6, 1.5, 0.4],
  },
  {
    id: 'funnels',
    label: 'Funnels',
    hud: 'CONVERSION PATH',
    blurb: 'Lead magnet to tripwire to booking, mapped end to end.',
    href: '#system',
    pos: [3.5, 1.9, -0.6],
  },
  {
    id: 'automation',
    label: 'Automation',
    hud: 'CRM + WORKFLOW',
    blurb: 'GoHighLevel, Kajabi and Zapier doing the follow-up for you.',
    href: '#services',
    pos: [-3.1, -1.9, -0.9],
  },
  {
    id: 'media',
    label: 'Video & Podcast',
    hud: 'MEDIA PRODUCTION',
    blurb: 'One recording turned into a month of content.',
    href: '#work',
    pos: [3.2, -1.6, 0.7],
  },
];
