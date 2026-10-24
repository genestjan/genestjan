import { describe, expect, it } from 'vitest';
import { match, reply } from './assistant';
import { squadAnnouncement, squadChanges, squadMessage } from './squadPick';
import { GUIDES } from '../content/guides';
import { HELP } from '../content/help';
import type { ClubEvent, Player } from './model';

const top = (q: string, role: 'coach' | 'parent' = 'coach') => match(q, role)[0]?.entry.id;
describe('Help chat', () => {
  it('understands common questions, including Filipino and Cebuano words', () => {
    expect(top('When is the next training?', 'parent')).toBe('next');
    expect(top('Kailan ang ensayo?', 'parent')).toBe('next');
    expect(top('asa ang training?', 'parent')).toBe('where');
    expect(top('What should we bring?', 'parent')).toBe('bring');
    expect(top('What papers are still needed for the PSA?', 'parent')).toBe('papers');
    expect(top('How do I take attendance?')).toBe('take-attendance');
    expect(top('how do i pick the squad for the game')).toBe('pick-squad');
    expect(top('How do I recognize a child?')).toBe('recognise');
    expect(top('How do I set up a school team with mixed ages?')).toBe('school-team');
    expect(top('how to send task photo', 'parent')).toBe('send-photo');
    expect(top('install the app on iphone', 'parent')).toBe('home-screen');
  });
  it('keeps coach-only answers away from families', () => {
    expect(match('how do I add players', 'parent').some((m) => m.entry.id === 'add-players')).toBe(false);
  });
  it('fills in live facts and offers a guide', () => {
    const r = reply('what papers are missing', 'parent', (f) => `FACT:${f}`);
    expect(r.text).toBe('FACT:papers'); expect(r.guide).toBe('id-papers');
    expect(reply('blorp zzz', 'parent', () => '').text).toMatch(/do not know/);
  });
  it('every guide named by a help answer exists', () => {
    const ids = new Set(GUIDES.map((g) => g.id));
    for (const h of HELP) if (h.guide) expect(ids.has(h.guide)).toBe(true);
    for (const g of GUIDES) expect(g.steps.length).toBeGreaterThan(0);
  });
});

describe('squad picking', () => {
  const e = { id: 'e', teamId: 't', type: 'meet', title: 'District Meet', startsAt: '2026-11-10T00:00:00Z', endsAt: '2026-11-10T08:00:00Z', venue: 'GSCNSSAT', mapUrl: '', hospital: '', bring: 'Water', opponent: '', notes: '', goingByDefault: false } as ClubEvent;
  const p = (id: string, firstName: string, number?: number) => ({ id, teamId: 't', firstName, number, gkWilling: false, photoConsent: false }) as Player;
  it('works out who was added or taken off since families were told', () => {
    expect(squadChanges(['a', 'b'], ['b', 'c'])).toEqual({ added: ['c'], removed: ['a'] });
    expect(squadChanges(undefined, ['a'])).toEqual({ added: ['a'], removed: [] });
  });
  it('announces first names and shirt numbers only, in shirt order', () => {
    const a = squadAnnouncement(e, [p('2', 'Ben', 9), p('1', 'Ana', 7), p('3', 'Cy')], false);
    expect(a.title).toBe('Squad: District Meet');
    expect(a.body).toContain('Picked (3): Ana (#7), Ben (#9), Cy.');
    expect(a.body).toContain('GSCNSSAT'); expect(a.body).toContain('Bring: Water.');
    expect(squadAnnouncement(e, [p('1', 'Ana')], true).title).toBe('Squad update: District Meet');
    expect(squadMessage(e, p('1', 'Ana'))).toMatch(/^Ana has been picked for District Meet on .*GSCNSSAT\. Please bring: Water\. Reply here if Ana cannot come\.$/);
  });
});
