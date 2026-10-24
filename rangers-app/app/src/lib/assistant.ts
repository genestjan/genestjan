import { HELP, type Fact, type HelpEntry } from '../content/help';

export interface Reply { text: string; guide?: string; link?: { to: string; label: string }; also: HelpEntry[] }
const norm = (t: string) => ` ${t.toLowerCase().normalize('NFKD').replace(/[^a-z0-9\- ]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
const stem = (w: string) => w.replace(/(ing|es|s)$/, '');

/** Scores each help entry against the question: a whole phrase counts more than a single word. */
const SMALL = new Set(['the', 'a', 'an', 'to', 'for', 'of', 'my', 'i', 'do', 'how', 'is', 'in', 'on', 'at', 'ang', 'ng', 'sa']);
const HOW = /\b(how|paano|unsaon|pano)\b/;
export function match(question: string, role: 'coach' | 'parent'): { entry: HelpEntry; score: number }[] {
  const q = norm(question); const words = new Set(q.trim().split(' ').map(stem)); const howTo = HOW.test(q);
  const found = HELP.filter((e) => !e.for || e.for === role).map((entry) => {
    let score = 0; const seen = new Set<string>();   // "task" and "tasks" are one word, counted once
    for (const raw of entry.keys) {
      const strong = raw.startsWith('!'); const kn = norm(strong ? raw.slice(1) : raw);
      if (kn.trim().includes(' ')) {
        const parts = kn.trim().split(' ').filter((w) => !SMALL.has(w));
        if (q.includes(kn)) score += 3; else if (parts.length && parts.every((w) => words.has(stem(w)))) score += 2;
      }
      else if (words.has(stem(kn.trim())) && !seen.has(stem(kn.trim()))) { seen.add(stem(kn.trim())); score += strong ? 2 : kn.trim().length <= 2 ? 0.5 : 1; }
    }
    if (score > 0 && howTo && entry.answer) score += 1;   // "how do I..." wants steps, not a fact
    return { entry, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  // "paano?" or "how?" with nothing else we know: offer the guides rather than "I do not know"
  const tour = HELP.find((e) => e.id === 'tour');
  return found.length || !howTo || !tour ? found : [{ entry: tour, score: 0.5 }];
}

/** Answers from the help list; live team facts come from facts(). Never sends anything anywhere. */
export function reply(question: string, role: 'coach' | 'parent', facts: (f: Fact) => string): Reply {
  const m = match(question, role);
  if (!m.length) return { text: 'Sorry, I do not know that one yet. Try a question below, open a "Show me how" guide, or ask your coach in Inbox.', also: [] };
  const best = m[0].entry;
  const text = best.fact ? facts(best.fact) : best.answer ?? '';
  return { text, guide: best.guide, link: best.link, also: m.slice(1, 3).map((x) => x.entry) };
}
export const SUGGESTIONS: Record<'coach' | 'parent', string[]> = {
  coach: ['When is the next training?', 'How do I take attendance?', 'How do I pick the squad?', 'Who is missing ID papers?', 'How do I set up a school team?'],
  parent: ['When is the next training?', 'What should we bring?', 'What papers are still needed?', 'How do I send a task photo?', 'How do I message the coach?'],
};
/** A short label for a help entry, used on "you might also mean" buttons. */
export const entryLabel = (e: HelpEntry) => ({ next: 'Next session', where: 'Where is it?', bring: 'What to bring', contact: 'Who to contact', papers: 'ID and screening papers', tasks: 'Tasks', palaro: 'Road to Palaro', squad: 'Squad', attendance: 'Attendance', values: 'Club values' } as Record<string, string>)[e.fact ?? ''] ?? ((k) => k[0].toUpperCase() + k.slice(1))(e.keys[0].replace(/^!/, ''));
