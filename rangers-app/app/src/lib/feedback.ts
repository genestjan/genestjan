/** Feedback about the app: what people can send, when to ask them, and a file for whoever improves the app. */
export type FeedbackKind = 'idea' | 'problem' | 'praise' | 'other';
export const FEEDBACK_KINDS: [FeedbackKind, string][] = [['idea', 'An idea'], ['problem', 'Something is wrong'], ['praise', 'Something I like'], ['other', 'Something else']];
export const RATINGS: [1 | 2 | 3, string][] = [[1, 'Not good'], [2, 'Okay'], [3, 'Great']];
export const kindLabel = (k: string) => FEEDBACK_KINDS.find(([v]) => v === k)?.[1] ?? 'Feedback';
export const ratingLabel = (r: number | null) => RATINGS.find(([v]) => v === r)?.[1] ?? '';

/** null when the words can be sent, else what to fix. */
export function checkFeedback(msg: string): string | null {
  const t = msg.trim();
  if (t.length < 3) return 'Please write a few words.';
  if (t.length > 2000) return `Please keep it under 2000 letters (now ${t.length}).`;
  return null;
}

const DAY = 864e5;
/** Ask on the home screen? Not in the first 3 days of using the app, then at most once every 30 days, never after "Don't ask again". */
export function shouldAsk(firstSeen: number, lastAsked: number, now: number, never: boolean): boolean {
  if (never || !firstSeen) return false;
  if (now - firstSeen < 3 * DAY) return false;
  return !lastAsked || now - lastAsked >= 30 * DAY;
}

const cell = (v: string | number | null) => { const t = String(v ?? ''); return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
/** A spreadsheet of feedback (newest first) to send to whoever improves the app. */
export function feedbackCsv(rows: { created_at: string; name: string; role: string; kind: string; rating: number | null; page: string; status: string; message: string }[]): string {
  const head = ['Date', 'Name', 'Role', 'About', 'Rating', 'Where in the app', 'Status', 'Feedback'];
  return [head, ...rows.map((r) => [r.created_at.slice(0, 16).replace('T', ' '), r.name, r.role, kindLabel(r.kind), ratingLabel(r.rating), r.page, r.status, r.message])].map((l) => l.map(cell).join(',')).join('\n');
}
