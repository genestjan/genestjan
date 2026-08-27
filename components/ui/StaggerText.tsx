/**
 * Word-by-word entrance for the H1, BRIEF 6.6.
 *
 * Deliberately a server component using CSS animation rather than Framer
 * Motion: a JS-driven initial opacity of 0 renders the H1 invisible in the
 * static HTML until hydration, which makes the LCP element unpaintable and
 * breaks BRIEF 6.7. CSS keyframes paint from the first frame of CSS.
 */
export default function StaggerText({
  lines, className = '', delay = 0, accentLine,
}: { lines: string[]; className?: string; delay?: number; accentLine?: number }) {
  let i = 0;
  return (
    <span className={className}>
      {lines.map((line, li) => (
        <span key={li} className="block">
          {line.split(' ').map((word, wi) => {
            const idx = i++;
            return (
              <span
                key={`${li}-${wi}`}
                className={`rise-in inline-block ${li === accentLine ? 'text-signal' : ''}`}
                style={{ animationDelay: `${delay + idx * 0.045}s` }}
              >
                {word}
                {' '}
              </span>
            );
          })}
        </span>
      ))}
    </span>
  );
}
