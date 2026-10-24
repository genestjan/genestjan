import { describe, expect, it } from 'vitest';
import { groups, latestByTask, openAssignments, progress } from './assignments';
import { checkMedia, fitImage, proofPath, teamVideoPath, videosToRemove, MAX_VIDEO_BYTES, MAX_COACH_VIDEO_BYTES } from './mediaRules';
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
  it('accepts photos and short videos', () => {
    expect(checkMedia({ type: 'image/jpeg', size: 5e6 })).toMatchObject({ ok: true, kind: 'image' });
    expect(checkMedia({ type: 'video/mp4', size: 10e6 })).toMatchObject({ ok: true, kind: 'video', ext: 'mp4' });
    expect(checkMedia({ type: 'video/quicktime', size: 10e6 })).toMatchObject({ ok: true, ext: 'mov' });
  });
  it('refuses big videos and other files with a helpful reason', () => {
    const big = checkMedia({ type: 'video/mp4', size: MAX_VIDEO_BYTES + 1 }); expect(big.ok).toBe(false); expect(!big.ok && big.reason).toMatch(/limit is 20 MB/);
    expect(checkMedia({ type: 'video/mp4', size: MAX_VIDEO_BYTES + 1 }, MAX_COACH_VIDEO_BYTES).ok).toBe(true);
    expect(checkMedia({ type: 'video/mp4', size: MAX_COACH_VIDEO_BYTES + 1 }, MAX_COACH_VIDEO_BYTES).ok).toBe(false);
    const odd = checkMedia({ type: 'video/3gpp', size: 10 }); expect(!odd.ok && odd.reason).toMatch(/normal camera app/);
    expect(checkMedia({ type: 'application/pdf', size: 10 }).ok).toBe(false);
    expect(checkMedia({ type: '', size: 10 }).ok).toBe(false);
  });
  it('shrinks photos to fit but never enlarges', () => {
    expect(fitImage(4000, 3000)).toEqual({ w: 1280, h: 960 });
    expect(fitImage(800, 600)).toEqual({ w: 800, h: 600 });
  });
  it('removes only approved server videos, 30 days after approval', () => {
    const now = Date.parse('2026-12-01T00:00:00Z'); const old = '2026-10-01T00:00:00Z', recent = '2026-11-20T00:00:00Z';
    const s = (o: object) => ({ status: 'approved', mediaType: 'video', mediaPath: 'p/x/y.mp4', at: old, ...o });
    expect(videosToRemove([s({})], now)).toHaveLength(1);
    expect(videosToRemove([s({ reviewedAt: recent })], now)).toHaveLength(0);
    expect(videosToRemove([s({ status: 'submitted' }), s({ mediaType: 'image' }), s({ mediaPath: '' }), s({ mediaPath: 'local:abc' })], now)).toHaveLength(0);
  });
  it('builds the folder layout the storage rules expect', () => {
    expect(proofPath('P', 'f', 'jpg')).toBe('p/P/f.jpg'); expect(teamVideoPath('T', 'f', 'mp4')).toBe('t/T/f.mp4');
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
  });
  it('lists what a family still needs to enter', () => {
    const p = { id: 'p', firstName: 'Ana', teamId: 't', number: 1, gkWilling: false, photoConsent: false } as never;
    expect((missingDetails(p) as string[]).length).toBe(4);
    const full = { ...(p as object), emergency: { contacts: [{ name: 'M', phone: '09' }], allergies: 'none', inhaler: false, note: '', birthDate: '2015-01-01', address: 'x' } } as never;
    expect(missingDetails(full)).toEqual([]);
  });
});
