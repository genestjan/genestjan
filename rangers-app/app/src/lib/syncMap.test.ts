import { DEMO_PLAYERS } from './store';
import { describe, expect, it } from 'vitest';
import { applyRows, derivedId, isDemoId, isUuid, rowJson, SETTINGS_ID, toRows, type RowIn } from './syncMap';
import { migrate } from './store';

const T = '10000000-0000-4000-8000-000000000001', P = '21000000-0000-4000-8000-000000000001', E = '30000000-0000-4000-8000-000000000001';
const base = () => { const s = migrate({}); s.players = [{ id: P, teamId: T, firstName: 'Ana', gkWilling: false, photoConsent: false }]; return s; };

describe('sync mapping', () => {
  it('derived ids are valid uuids and stable', () => { expect(isUuid(derivedId(E, 'pub'))).toBe(true); expect(derivedId(E, 'pub')).toBe(derivedId(E, 'pub')); expect(derivedId(E, 'pub')).not.toBe(E); });
  it('family items carry the player and team; events are team-visible', () => {
    const s = base();
    s.availability = [{ id: E, eventId: 'x', playerId: P, status: 'going', by: 'me', at: '2026-01-01' }];
    s.events = [{ id: '30000000-0000-4000-8000-000000000002', teamId: T, type: 'training', title: 'T', startsAt: '', endsAt: '', venue: '', mapUrl: '', hospital: '', bring: '', opponent: '', notes: '', goingByDefault: true }];
    const rows = toRows(s);
    const a = rows.find((r) => r.kind === 'availability')!; expect(a).toMatchObject({ visibility: 'family', player_id: P, team_id: T });
    expect(rows.find((r) => r.kind === 'event')!.visibility).toBe('team');
  });
  it('a published review makes a family copy WITHOUT the coach note; unpublished stays coach-only', () => {
    const s = base();
    s.assessments = [{ id: E, playerId: P, teamId: T, term: 'T1', ratings: {}, strength: '', working: '', familyComment: 'Nice', coachNote: 'SECRET' }];
    expect(toRows(s).filter((r) => r.kind.startsWith('assessment')).map((r) => r.kind)).toEqual(['assessment']);
    s.assessments[0].publishedAt = '2026-02-01';
    const pub = toRows(s).find((r) => r.kind === 'assessment_pub')!;
    expect(pub.visibility).toBe('family'); expect(JSON.stringify(pub.data)).not.toContain('SECRET');
  });
  it('skips non-uuid ids and orphans', () => {
    const s = base(); s.goals = [{ id: 'not-a-uuid', playerId: P, text: 'x', status: 'active', at: '' }];
    expect(toRows(s).some((r) => r.kind === 'goal')).toBe(false);
  });
  it('library videos: coaches-only and club videos sync with no team; team videos carry the team', () => {
    const s = base(); const v = (id: string, audience: 'coaches' | 'team' | 'club', teamId?: string) => ({ id, title: 'V', youtubeId: 'dQw4w9WgXcQ', audience, teamId, topic: 'drills' as const, notes: '', at: '', by: '' });
    s.videos = [v('30000000-0000-4000-8000-0000000000a1', 'coaches'), v('30000000-0000-4000-8000-0000000000a2', 'team', T), v('30000000-0000-4000-8000-0000000000a3', 'club'), v('30000000-0000-4000-8000-0000000000a4', 'team')];
    expect(toRows(s).filter((r) => r.kind === 'video').map((r) => [r.visibility, r.team_id])).toEqual([['staff', null], ['team', T], ['club', null]]);
  });
  it('announcements: club scope is club-visible with no team', () => {
    const s = base(); s.announcements = [{ id: E, scope: 'club', title: 'Hi', body: '', at: '', by: '', seenBy: [] }];
    expect(toRows(s).find((r) => r.kind === 'announcement')).toMatchObject({ visibility: 'club', team_id: null });
  });
  it('applyRows inserts, updates and deletes; parents get the family copy of a review', () => {
    let s = base();
    const row = (o: Partial<RowIn>): RowIn => ({ id: E, kind: 'goal', team_id: T, player_id: P, visibility: 'family', data: { id: E, playerId: P, text: 'Left foot', status: 'active', at: '' }, updated_at: '', deleted_at: null, ...o });
    s = applyRows(s, [row({})]); expect(s.goals).toHaveLength(1);
    s = applyRows(s, [row({ data: { id: E, playerId: P, text: 'Both feet', status: 'done', at: '' } })]); expect(s.goals[0].text).toBe('Both feet');
    s = applyRows(s, [row({ deleted_at: '2026-01-01' })]); expect(s.goals).toHaveLength(0);
    const pubData = { id: E, playerId: P, teamId: T, term: 'T1', ratings: {}, strength: 'x', working: 'y', familyComment: 'Nice', coachNote: '', publishedAt: '2026-02-01' };
    s = applyRows(s, [{ id: derivedId(E, 'pub'), kind: 'assessment_pub', team_id: T, player_id: P, visibility: 'family', data: pubData, updated_at: '', deleted_at: null }]);
    expect(s.assessments[0].coachNote).toBe('');
    // the coach takes it back: the family copy disappears from the parent's phone
    s = applyRows(s, [{ id: derivedId(E, 'pub'), kind: 'assessment_pub', team_id: T, player_id: P, visibility: 'family', data: pubData, updated_at: '', deleted_at: '2026-02-02' }]);
    expect(s.assessments).toHaveLength(0);
  });
  it('a coach\'s own full review is never replaced by the family copy, and family copies are never pushed', () => {
    let s = base();
    s.assessments = [{ id: E, playerId: P, teamId: T, term: 'T1', ratings: {}, strength: '', working: '', familyComment: 'Nice', coachNote: 'SECRET', publishedAt: '2026-02-01' }];
    s = applyRows(s, [{ id: derivedId(E, 'pub'), kind: 'assessment_pub', team_id: T, player_id: P, visibility: 'family', data: { ...s.assessments[0], coachNote: '' }, updated_at: '', deleted_at: null }]);
    expect(s.assessments[0].coachNote).toBe('SECRET');
    const parent = applyRows(base(), [{ id: derivedId(E, 'pub'), kind: 'assessment_pub', team_id: T, player_id: P, visibility: 'family', data: { ...s.assessments[0], coachNote: '' }, updated_at: '', deleted_at: null }]);
    expect(toRows(parent).some((r) => r.kind.startsWith('assessment'))).toBe(false);
  });
  it('the head-coach PIN never leaves the phone', () => {
    const s = base(); s.settings.headCoachPin = '4321';
    expect(JSON.stringify(toRows(s).find((r) => r.kind === 'settings'))).not.toContain('4321');
    const pulled = applyRows(s, [{ id: SETTINGS_ID, kind: 'settings', team_id: null, player_id: null, visibility: 'club', data: { gcashNumber: '0917' }, updated_at: '', deleted_at: null }]);
    expect(pulled.settings.headCoachPin).toBe('4321'); expect(pulled.settings.gcashNumber).toBe('0917');
  });
  it('saved moves and equipment are staff-only', () => {
    const s = base(); s.strategies = [{ id: E, name: 'x', whyKids: '', coachNote: 'secret', doc: {} as never }];
    expect(toRows(s).find((r) => r.kind === 'strategy')!.visibility).toBe('staff');
  });
  it('no echo: rows pulled then re-serialised are identical', () => {
    let s = base(); const data = { id: E, playerId: P, text: 'x', status: 'active', at: '' };
    s = applyRows(s, [{ id: E, kind: 'goal', team_id: T, player_id: P, visibility: 'family', data, updated_at: '', deleted_at: null }]);
    expect(rowJson(toRows(s).find((r) => r.id === E)!)).toBe(rowJson({ id: E, kind: 'goal', team_id: T, player_id: P, visibility: 'family', data }));
  });
});
describe('state migration', () => {
  it('upgrades Phase 1 data: players get a team, blocked becomes a head-injury record', () => {
    const s = migrate({ players: [{ id: 'a', firstName: 'Ana', gkWilling: false }], matches: [{ id: 'm', name: 'x', log: [] }], blocked: ['a'] });
    expect(s.players[0].teamId).toBe(s.teams[0].id); expect(s.matches[0].teamId).toBe(s.teams[0].id); expect(s.blocked).toEqual(['a']);
  });
  it('never sends practice players from the demo team, or anything about them', () => {
    const st = migrate({}); const demo = DEMO_PLAYERS[0];
    st.players = [demo]; st.goals = [{ id: '11111111-1111-4111-8111-111111111111', playerId: demo.id, text: 'x', status: 'active', at: '' }];
    st.assessments = [{ id: '22222222-2222-4222-8222-222222222222', playerId: demo.id, teamId: st.teams[0].id, term: 't', ratings: {}, strength: '', working: '', familyComment: '', coachNote: '' } as never];
    const rows = toRows(st);
    expect(rows.some((r) => r.player_id === demo.id)).toBe(false);
    expect(isDemoId(demo.id)).toBe(true); expect(isDemoId('9a9a9a9a-0000-4000-8000-000000000001')).toBe(false);
  });
});
