import { describe, expect, it } from 'vitest';
import { groups, latestByTask, openAssignments, progress } from './assignments';
import { checkMedia, fitImage, proofPath, teamPhotoPath, youtubeId } from './mediaRules';
import { ASSIGNMENT_TEMPLATES, templatesFor } from '../content/assignments';
import { missingDetails } from '../components/Emergency';
import type { Assignment, Submission } from './model';

const a = (id: string, over: Partial<Assignment> = {}): Assignment => ({ id, groupId: 'g1', playerId: 'p1', teamId: 't1', title: 'T', why: '', tasks: [{ id: 't1', text: 'a' }, { id: 't2', text: 'b' }], at: '2026-10-01T00:00:00Z', by: 'C', ...over });
const sub = (assignmentId: string, taskId: string, status: Submission['status'], at = '2026-10-02T00:00:00Z'): Submission => ({ id: assignmentId + taskId + at, assignmentId, taskId, playerId: 'p1', teamId: 't1', mediaPath: 'x', mediaType: 'image', at, status, feedback: '' });

describe('assignment progress', () => {
  it('is cleared only when every task has a proof', () => {
    expect(progress(a('a1'), []).cleared).toBe(false);
    expect(progress(a('a1'), [sub('a1', 't1', 'submitted')])).toMatchObject({ sent: 1, cleared: false });
    expect(progress(a('a1'), [sub('a1', 't1', 'submitted'), sub('a1', 't2', 'submitted')])).toMatchObject({ sent: 2, cleared: true, toReview: 2 });
  });
  it('a redo request reopens the task', () => {
    const p = progress(a('a1'), [sub('a1', 't1', 'submitted'), sub('a1', 't2', 'redo')]);
    expect(p).toMatchObject({ sent: 1, redo: 1, cleared: false });
  });
  it('approved proofs are not waiting for review', () => {
    expect(progress(a('a1'), [sub('a1', 't1', 'approved'), sub('a1', 't2', 'approved')])).toMatchObject({ approved: 2, toReview: 0, cleared: true });
  });
  it('the newest proof for a task wins', () => {
    const m = latestByTask([sub('a1', 't1', 'redo', '2026-10-02T00:00:00Z'), sub('a1', 't1', 'submitted', '2026-10-03T00:00:00Z')], 'a1');
    expect(m.get('t1')?.status).toBe('submitted');
  });
  it('an assignment with no tasks is never cleared', () => { expect(progress(a('a1', { tasks: [] }), []).cleared).toBe(false); });
  it('lists open work first by due date and groups by send', () => {
    const open = openAssignments([a('a1', { dueOn: '2026-11-05' }), a('a2', { dueOn: '2026-11-01' }), a('a3')], []);
    expect(open.map((x) => x.id)).toEqual(['a2', 'a1', 'a3']);
    expect(groups([a('a1'), a('a2'), a('a3', { groupId: 'g2' })]).map((g) => g.items.length).sort()).toEqual([1, 2]);
  });
});

describe('media rules', () => {
  it('accepts photos, refuses videos and other files with a helpful reason', () => {
    expect(checkMedia({ type: 'image/jpeg', size: 5e6 }).ok).toBe(true);
    expect(checkMedia({ type: 'image/png', size: 5e6 }).ok).toBe(true);
    const v = checkMedia({ type: 'video/mp4', size: 1e6 }); expect(v.ok).toBe(false); expect(!v.ok && v.reason).toMatch(/Add a video/);
    expect(checkMedia({ type: 'application/pdf', size: 10 }).ok).toBe(false);
    expect(checkMedia({ type: '', size: 10 }).ok).toBe(false);
  });
  it('shrinks photos to fit but never enlarges', () => {
    expect(fitImage(4000, 3000)).toEqual({ w: 1280, h: 960 });
    expect(fitImage(800, 600)).toEqual({ w: 800, h: 600 });
  });
  it('builds the folder layout the storage rules expect', () => {
    expect(proofPath('P', 'f')).toBe('p/P/f.jpg'); expect(teamPhotoPath('T', 'f')).toBe('t/T/f.jpg');
  });
  it('reads YouTube links in every usual form and nothing else', () => {
    for (const u of ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXcQ?si=abc', 'https://youtube.com/shorts/dQw4w9WgXcQ', 'https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=10', ' https://www.youtube.com/embed/dQw4w9WgXcQ '])
      expect(youtubeId(u)).toBe('dQw4w9WgXcQ');
    for (const u of ['https://vimeo.com/123', 'https://evil.example/watch?v=dQw4w9WgXcQ', 'not a link', 'https://youtube.com/watch?v=short', 'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ'])
      expect(youtubeId(u)).toBe('');
  });
});

describe('content and details', () => {
  it('every ready-made assignment has a title, a reason and 1 to 8 tasks, and age ranges make sense', () => {
    for (const t of ASSIGNMENT_TEMPLATES) { expect(t.title && t.why).toBeTruthy(); expect(t.tasks.length).toBeGreaterThan(0); expect(t.tasks.length).toBeLessThanOrEqual(8); expect(t.minAge).toBeLessThanOrEqual(t.maxAge); }
    expect(new Set(ASSIGNMENT_TEMPLATES.map((t) => t.id)).size).toBe(ASSIGNMENT_TEMPLATES.length);
    expect(templatesFor(7).length).toBeGreaterThan(2);
  });
  it('no ready-made task asks a young child to head the ball or do hard fitness', () => {
    for (const t of ASSIGNMENT_TEMPLATES) expect(t.tasks.join(' ')).not.toMatch(/\bhead(ing|er)?\b|sprint|max effort|until you drop/i);
    for (const t of ASSIGNMENT_TEMPLATES) expect(t.tasks.join(' ')).not.toMatch(/\bclip\b|video/i);
  });
  it('lists what a family still needs to enter', () => {
    const p = { id: 'p', firstName: 'Ana', teamId: 't', number: 1, gkWilling: false, photoConsent: false } as never;
    expect((missingDetails(p) as string[]).length).toBe(4);
    const full = { ...(p as object), emergency: { contacts: [{ name: 'M', phone: '09' }], allergies: 'none', inhaler: false, note: '', birthDate: '2015-01-01', address: 'x' } } as never;
    expect(missingDetails(full)).toEqual([]);
  });
});
