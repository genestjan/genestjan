import type { AgeBand, ClubEvent, Eligibility, MeetLevel, Player, Team, TeamInfo } from './model';

/** The DepEd "Road to Palaro", lowest to highest. Wording from the club's own notes on how the ladder works in General Santos City. */
export const LEVELS: { id: MeetLevel; name: string; short: string; what: string }[] = [
  { id: 'intramurals', name: 'Intramurals', short: 'School', what: 'Games inside the school. This forms the school\'s official varsity roster.' },
  { id: 'district', name: 'District Meet', short: 'District', what: 'Schools compete within their DepEd district (East, West, North, South, Central). Elementary schools often send their champion school; secondary teams play for the district title to qualify for the city meet.' },
  { id: 'gscaa', name: 'GSCAA Meet (Division)', short: 'City', what: 'General Santos City Athletic Association. District champions meet the private schools. The winning team usually forms the core of the GenSan delegation, and standout players from other teams can be added.' },
  { id: 'sraa', name: 'SRAA Meet (Regional)', short: 'Region XII', what: 'SOCCSKSARGEN Regional Athletic Association. GenSan plays the other divisions of Region XII: South Cotabato, Cotabato Province, Sultan Kudarat, Sarangani, Koronadal, Tacurong and Kidapawan.' },
  { id: 'palaro', name: 'Palarong Pambansa', short: 'National', what: 'Champions and selected athletes from Region XII represent SOCCSKSARGEN at the national games.' },
];
export const levelName = (l?: MeetLevel) => LEVELS.find((x) => x.id === l)?.name ?? 'School meet';

/** DepEd screening before GSCAA and SRAA. The app records only whether each is ready, never the document. */
export const SCREENING_DOCS = [
  { id: 'psa', label: 'PSA birth certificate' }, { id: 'sf10', label: 'Form 137 / SF10' }, { id: 'dental', label: 'Dental record' },
  { id: 'consent', label: 'Parental consent' }, { id: 'medical', label: 'Medical clearance' },
] as const;
export const DEFAULT_CATEGORIES = ['Elementary Boys', 'Secondary Boys', 'Secondary Girls (Futsal)'];
export const DISTRICTS = ['East', 'West', 'North', 'South', 'Central'];
/** Venues the club has used for school football in GenSan (suggestions only; any venue can be typed). */
export const VENUES = ['GSCNHS (City High)', 'GSCNSSAT', 'Irineo Santiago NHS', 'Lagao NHS', 'Yam 1, Purok 27, Barangay Mabuhay'];

export const newTeamInfo = (teamId: string, id: string): TeamInfo => ({ id, teamId, kind: 'club', mixedAges: false, schoolName: '', district: '', coordinator: '', coordinatorPhone: '', categories: [...DEFAULT_CATEGORIES], cutoffs: {} });
export const infoFor = (all: TeamInfo[], teamId: string) => all.find((x) => x.teamId === teamId);
export const isSchoolTeam = (all: TeamInfo[], teamId: string) => infoFor(all, teamId)?.kind === 'school';

/** Birthday from the coach's record or, if missing, from what the family entered. */
export const birthOf = (p: Player) => p.birthDate || p.emergency?.birthDate || '';
export function ageOn(birth: string, on: Date): number | undefined {
  const b = new Date(birth + 'T00:00:00'); if (isNaN(+b)) return undefined;
  let a = on.getFullYear() - b.getFullYear(); const m = on.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && on.getDate() < b.getDate())) a--;
  return a;
}
export function bandForAge(age: number): AgeBand { return age <= 6 ? 'U6' : age <= 19 ? (`U${age}` as AgeBand) : age < 30 ? '20+' : age < 40 ? '30+' : '40+'; }
/** On a mixed-age team (school setting, or a team with several age groups) each child is reviewed against their own age group; otherwise the team's. */
export function bandOf(p: Player, team: Team, info: TeamInfo | undefined, now = new Date()): AgeBand {
  if (!info?.mixedAges && !(team.ageBands && team.ageBands.length > 1)) return team.ageBand;
  const a = birthOf(p) ? ageOn(birthOf(p), now) : undefined;
  return a === undefined ? team.ageBand : bandForAge(a);
}

export const docsMissing = (e?: Eligibility) => SCREENING_DOCS.filter((d) => !e?.docs?.[d.id]).map((d) => d.label);
export type AgeFit = 'ok' | 'too-old' | 'no-birthday' | 'no-cutoff' | 'no-category';
/** Age check against the "born on or after" date the coach copied from the current DepEd memo. */
export function ageFit(p: Player, e: Eligibility | undefined, info: TeamInfo | undefined): AgeFit {
  if (!e?.category) return 'no-category';
  const cut = info?.cutoffs?.[e.category]; if (!cut) return 'no-cutoff';
  const b = birthOf(p); if (!b) return 'no-birthday';
  return b >= cut ? 'ok' : 'too-old';
}
export const AGE_FIT_TEXT: Record<AgeFit, string> = {
  ok: 'Age OK', 'too-old': 'Born before the cutoff', 'no-birthday': 'Birthday missing', 'no-cutoff': 'No age cutoff set', 'no-category': 'No category yet',
};

/** DepEd school years start in June. */
export function schoolYearStart(now: Date): Date { const y = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1; return new Date(y, 5, 1); }

export type StageState = 'qualified' | 'champion' | 'placed' | 'out' | 'next' | 'played' | 'not-yet';
export interface Stage { level: MeetLevel; name: string; what: string; state: StageState; events: ClubEvent[]; next?: ClubEvent; last?: ClubEvent }
/** Where the team stands on the ladder this school year, from its school-meet events and the results entered. */
export function ladder(events: ClubEvent[], teamId: string, now = new Date()): Stage[] {
  const from = schoolYearStart(now).toISOString();
  const mine = events.filter((e) => e.teamId === teamId && e.type === 'meet' && !e.cancelled && e.startsAt >= from).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return LEVELS.map((l) => {
    const ev = mine.filter((e) => e.meetLevel === l.id);
    const past = ev.filter((e) => Date.parse(e.endsAt) <= now.getTime()); const future = ev.filter((e) => Date.parse(e.endsAt) > now.getTime());
    const outcomes = ev.map((e) => e.outcome ?? '');
    const state: StageState = outcomes.includes('champion') ? 'champion' : outcomes.includes('qualified') ? 'qualified' : outcomes.includes('eliminated') ? 'out'
      : outcomes.includes('placed') ? 'placed' : future.length ? 'next' : past.length ? 'played' : 'not-yet';
    return { level: l.id, name: l.name, what: l.what, state, events: ev, next: future[0], last: past[past.length - 1] };
  });
}
export const STAGE_TEXT: Record<StageState, string> = {
  champion: 'Champions', qualified: 'Qualified', placed: 'Placed', out: 'Out at this stage', next: 'Coming up', played: 'Played (add the result)', 'not-yet': 'Not yet',
};
