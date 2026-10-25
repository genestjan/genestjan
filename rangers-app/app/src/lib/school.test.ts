import { describe, expect, it } from 'vitest';
import { ageFit, ageOn, bandForAge, bandOf, docsMissing, ladder, newTeamInfo, schoolYearStart } from './school';
import { defaultEvent, report, reportCsv, statusOf, summarise } from './attendance';
import type { Attendance, ClubEvent, Eligibility, Player, Team } from './model';

const team: Team = { id: 't', name: 'SPED Rangers', programme: 'rangers', ageBand: 'U14', defaultFormat: '11v11' };
const kid = (o: Partial<Player> = {}): Player => ({ id: 'p', teamId: 't', firstName: 'Ana', gkWilling: false, photoConsent: false, ...o });
const ev = (o: Partial<ClubEvent>): ClubEvent => ({ id: 'e', teamId: 't', type: 'meet', title: '', startsAt: '2026-09-10T01:00:00Z', endsAt: '2026-09-10T08:00:00Z', venue: '', mapUrl: '', hospital: '', bring: '', opponent: '', notes: '', goingByDefault: false, ...o });

describe('school team', () => {
  it('works out age on a date and the matching age group', () => {
    expect(ageOn('2014-10-25', new Date('2026-10-24'))).toBe(11);
    expect(ageOn('2014-10-24', new Date('2026-10-24T12:00:00'))).toBe(12);
    expect([8, 10, 12, 14, 17].map(bandForAge)).toEqual(['U8', 'U10', 'U12', 'U14', 'U17']);
  });
  it('mixed-age teams review each child against their own age group', () => {
    const info = { ...newTeamInfo('t', 'i'), mixedAges: true }; const now = new Date('2026-10-24');
    expect(bandOf(kid({ birthDate: '2017-01-01' }), team, info, now)).toBe('U9');   // reviewed with the U10 skills (nearest plan)
    expect(bandOf(kid({ emergency: { contacts: [], allergies: '', inhaler: false, note: '', birthDate: '2011-03-01' } }), team, info, now)).toBe('U15');
    expect(bandOf(kid(), team, info, now)).toBe('U14');                       // no birthday: the team's group
    expect(bandOf(kid({ birthDate: '2017-01-01' }), team, undefined, now)).toBe('U14');   // not mixed
    expect(bandOf(kid({ birthDate: '2017-01-01' }), { ...team, ageBands: ['U9', 'U14'] }, undefined, now)).toBe('U9');   // a team with several age groups
  });
  it('lists missing screening papers and checks age against the cutoff', () => {
    const e: Eligibility = { id: 'x', playerId: 'p', category: 'Secondary Boys', docs: { psa: true, consent: true }, selectedFor: [], note: '' };
    expect(docsMissing(e)).toEqual(['Form 137 / SF10', 'Dental record', 'Medical clearance']);
    expect(docsMissing(undefined)).toHaveLength(5);
    const info = { ...newTeamInfo('t', 'i'), cutoffs: { 'Secondary Boys': '2009-01-01' } };
    expect(ageFit(kid({ birthDate: '2010-05-05' }), e, info)).toBe('ok');
    expect(ageFit(kid({ birthDate: '2008-12-31' }), e, info)).toBe('too-old');
    expect(ageFit(kid(), e, info)).toBe('no-birthday');
    expect(ageFit(kid({ birthDate: '2010-05-05' }), { ...e, category: 'Elementary Boys' }, info)).toBe('no-cutoff');
    expect(ageFit(kid(), undefined, info)).toBe('no-category');
  });
  it('the school year starts in June', () => {
    expect(schoolYearStart(new Date('2026-10-24')).getFullYear()).toBe(2026);
    expect(schoolYearStart(new Date('2027-03-01')).getFullYear()).toBe(2026);
  });
  it('shows where the team is on the Road to Palaro', () => {
    const now = new Date('2026-10-24T00:00:00Z');
    const st = ladder([
      ev({ id: '1', meetLevel: 'intramurals', outcome: 'champion' }),
      ev({ id: '2', meetLevel: 'district', outcome: 'qualified', startsAt: '2026-10-01T01:00:00Z', endsAt: '2026-10-01T08:00:00Z' }),
      ev({ id: '3', meetLevel: 'gscaa', startsAt: '2026-11-20T01:00:00Z', endsAt: '2026-11-21T08:00:00Z' }),
      ev({ id: '4', meetLevel: 'sraa', startsAt: '2025-01-10T01:00:00Z', endsAt: '2025-01-10T08:00:00Z', outcome: 'eliminated' }),   // last school year: ignored
      ev({ id: '5', meetLevel: 'district', teamId: 'other', outcome: 'eliminated' }),
    ], 't', now);
    expect(st.map((x) => x.state)).toEqual(['champion', 'qualified', 'next', 'not-yet', 'not-yet']);
    expect(st[2].next?.id).toBe('3');
    expect(ladder([ev({ meetLevel: 'district' })], 't', now)[1].state).toBe('played');
    expect(ladder([ev({ meetLevel: 'district', outcome: 'eliminated' })], 't', now)[1].state).toBe('out');
  });
});

describe('attendance', () => {
  const a = (playerId: string, eventId: string, o: Partial<Attendance>): Attendance => ({ id: playerId + eventId, eventId, playerId, present: false, ...o });
  it('reads old present/absent records and new statuses', () => {
    expect(statusOf(a('p', 'e', { present: true }))).toBe('present');
    expect(statusOf(a('p', 'e', { present: false }))).toBe('absent');
    expect(statusOf(a('p', 'e', { present: true, status: 'late' }))).toBe('late');
  });
  it('excused sessions do not count against a child', () => {
    const s = summarise([a('p', '1', { status: 'present', present: true }), a('p', '2', { status: 'late', present: true }), a('p', '3', { status: 'absent' }), a('p', '4', { status: 'excused' })]);
    expect(s).toMatchObject({ recorded: 4, present: 1, late: 1, absent: 1, excused: 1, rate: 67 });
    expect(summarise([]).rate).toBeNull();
    expect(summarise([a('p', '1', { status: 'excused' })]).rate).toBeNull();
  });
  it('reports children in name order, never ranked, and only from the chosen date', () => {
    const players = [kid({ id: 'b', firstName: 'Ben' }), kid({ id: 'a', firstName: 'Ana', lastName: 'Cruz', number: 7 })];
    const events = [ev({ id: 'old', startsAt: '2026-01-01T00:00:00Z' }), ev({ id: 'new', startsAt: '2026-10-01T00:00:00Z' })];
    const rows = report(players, [a('b', 'new', { status: 'present', present: true }), a('a', 'old', { status: 'absent' })], events, '2026-06-01');
    expect(rows.map((r) => r.player.firstName)).toEqual(['Ana', 'Ben']);
    expect(rows[0].recorded).toBe(0); expect(rows[1].rate).toBe(100);
    const csv = reportCsv(rows, 'SPED Rangers'); expect(csv.split('\n')[2]).toBe('"Ana Cruz","7","0","0","0","0",""');
  });
  it('picks today\'s event, else the latest one that has started', () => {
    const now = new Date('2026-10-24T09:00:00');
    const es = [ev({ id: 'past', startsAt: new Date('2026-10-20T09:00:00').toISOString() }), ev({ id: 'later', startsAt: new Date('2026-10-30T09:00:00').toISOString() })];
    expect(defaultEvent(es, 't', now)?.id).toBe('past');
    expect(defaultEvent([...es, ev({ id: 'today', startsAt: new Date('2026-10-24T16:00:00').toISOString() })], 't', now)?.id).toBe('today');
  });
});
