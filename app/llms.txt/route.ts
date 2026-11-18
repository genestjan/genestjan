import { site, hero, services, industries, faq } from '@/lib/content';

// llms.txt: a plain summary for AI assistants and answer engines.
export const dynamic = 'force-static';

export function GET() {
  const lines = [
    `# ${site.name}`,
    '',
    `> ${site.description}`,
    '',
    hero.sub,
    '',
    `- Location: ${site.location} (remote; works UK, AU and US hours)`,
    `- Book a free 15 minute call: ${site.booking}`,
    `- Email: ${site.email}`,
    `- LinkedIn: ${site.linkedin}`,
    '',
    '## Services',
    '',
    ...services.items.map((s) => `- [${s.seoTitle}](${site.domain}/services/${s.slug}/): ${s.seoDescription}`),
    '',
    '## Industries',
    '',
    ...industries.items.map((i) => `- ${i.name}: ${i.note}`),
    '',
    '## Questions',
    '',
    ...faq.items.flatMap((f) => [`### ${f.q}`, '', f.a, '']),
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
