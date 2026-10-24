import { describe, expect, it } from 'vitest';
import { checkFeedback, feedbackCsv, kindLabel, ratingLabel, shouldAsk } from './feedback';

const DAY = 864e5;
describe('feedback', () => {
  it('needs a few words and not a whole essay', () => {
    expect(checkFeedback('  ')).toMatch(/few words/);
    expect(checkFeedback('Great app!')).toBeNull();
    expect(checkFeedback('x'.repeat(2001))).toMatch(/2000/);
  });
  it('asks on the home screen after 3 days, then once a month, never after "Don\'t ask again"', () => {
    const start = Date.parse('2026-10-01');
    expect(shouldAsk(start, 0, start + 2 * DAY, false)).toBe(false);
    expect(shouldAsk(start, 0, start + 4 * DAY, false)).toBe(true);
    expect(shouldAsk(start, start + 4 * DAY, start + 20 * DAY, false)).toBe(false);
    expect(shouldAsk(start, start + 4 * DAY, start + 35 * DAY, false)).toBe(true);
    expect(shouldAsk(start, 0, start + 40 * DAY, true)).toBe(false);
    expect(shouldAsk(0, 0, start, false)).toBe(false);
  });
  it('makes a spreadsheet that keeps commas, quotes and new lines inside one cell', () => {
    const csv = feedbackCsv([{ created_at: '2026-10-24T08:30:00Z', name: 'Maria', role: 'parent', kind: 'idea', rating: 3, page: 'schedule', status: 'new', message: 'Add "maps", please,\nthanks' }]);
    expect(csv.split('\n')[0]).toBe('Date,Name,Role,About,Rating,Where in the app,Status,Feedback');
    expect(csv).toContain('2026-10-24 08:30,Maria,parent,An idea,Great,schedule,new,"Add ""maps"", please,\nthanks"');
    expect(kindLabel('nope')).toBe('Feedback'); expect(ratingLabel(null)).toBe('');
  });
});
