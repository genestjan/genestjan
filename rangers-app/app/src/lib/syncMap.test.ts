import { describe, expect, it } from 'vitest';
import { applyRows, derivedId, isUuid, rowJson, toRows, type RowIn } from './syncMap';
import { migrate } from './store';

const T = '10000000-0000-4000-8000-000000000001', P = '20000000-0000-4000-8000-000000000001', E = '30000000-0000-4000-8000-000000000001';
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
});
