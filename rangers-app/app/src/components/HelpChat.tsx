import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Chip } from './ui';
import { activeTeam, teamPlayers, useAppState, type AppState } from '../lib/store';
import { useMyChildren } from '../lib/role';
import { SUGGESTIONS, entryLabel, reply, type Reply } from '../lib/assistant';
import type { Fact } from '../content/help';
import { startGuide } from '../lib/guide';
import { fmtDate, fmtDateTime } from '../lib/util';
import { PROGRAMMES, type Player, type Team } from '../lib/model';
import { docsMissingFor } from './Docs';
import { docsMissing, infoFor, isSchoolTeam, ladder, STAGE_TEXT } from '../lib/school';
import { openAssignments, progress } from '../lib/assignments';
import { report } from '../lib/attendance';
import { schoolYearStart } from '../lib/school';

const CLUB_CONTACT = 'Coach James, +63 993 291 0764';
/** Live answers about the team, built from what is already on this phone. */
export function teamFacts(s: AppState, role: 'coach' | 'parent', kids: Player[], team: Team) {
  const teamIds = role === 'parent' ? [...new Set(kids.map((k) => k.teamId))] : [team.id];
  const upcoming = s.events.filter((e) => teamIds.includes(e.teamId) && !e.cancelled && Date.parse(e.endsAt) > Date.now()).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const next = upcoming[0]; const players = role === 'parent' ? kids : teamPlayers(s, team.id);
  const info = infoFor(s.teamInfo, role === 'parent' ? kids[0]?.teamId ?? team.id : team.id);
  return (f: Fact): string => {
    switch (f) {
      case 'next': return next ? `Next: ${next.title}, ${fmtDateTime(next.startsAt)}${next.venue ? ` at ${next.venue}` : ''}.${next.bring ? ` Bring: ${next.bring}.` : ''}` : 'Nothing is scheduled yet. New sessions appear in Schedule as soon as the coach adds them.';
      case 'where': return next ? `${next.title} on ${fmtDate(next.startsAt)} is at ${next.venue || 'a place the coach has not added yet'}.${next.mapUrl ? ' Open the event in Schedule for the map link.' : ''}` : 'Nothing is scheduled yet.';
      case 'bring': return next?.bring ? `For ${next.title}: ${next.bring}.` : 'Water bottle, boots or shoes and shin guards. Check the event in Schedule for anything extra.';
      case 'contact': return [role === 'parent' ? 'Message the coach in Inbox: Messages, then your child\'s name.' : 'Message a family in Inbox: Messages, then the child\'s name.', info?.kind === 'school' && info.coordinator ? `School coordinator: ${info.coordinator}${info.coordinatorPhone ? `, ${info.coordinatorPhone}` : ''}.` : '', `Club: ${CLUB_CONTACT}.`].filter(Boolean).join(' ');
      case 'papers': {
        if (role === 'parent') return kids.map((k) => { const id = docsMissingFor(k); const sc = isSchoolTeam(s.teamInfo, k.teamId) ? docsMissing(s.eligibility.find((e) => e.playerId === k.id)) : [];
          return `${k.firstName}: ${id.length ? `please add a photo of the ${id.map((x) => (x === 'studentId' ? 'student ID' : 'PSA birth certificate')).join(' and ')}` : 'ID papers are in'}${sc.length ? `; for school screening the coach still needs ${sc.join(', ')}` : ''}.`; }).join(' ') || 'No child is linked yet.';
        const noId = players.filter((k) => docsMissingFor(k).length); return noId.length ? `${noId.length} still missing ID papers: ${noId.map((k) => k.firstName).join(', ')}. See More, ID papers.` : 'Everyone has both ID papers in.';
      }
      case 'tasks': {
        if (role === 'parent') { const open = openAssignments(s.assignments.filter((a) => kids.some((k) => k.id === a.playerId)), s.submissions); return open.length ? `${open.length} task list${open.length === 1 ? '' : 's'} to do: ${open.map((a) => a.title).join(', ')}. Open Tasks and send a photo for each task.` : 'No tasks waiting. Well done!'; }
        const review = s.assignments.filter((a) => a.teamId === team.id).reduce((n, a) => n + progress(a, s.submissions).toReview, 0); return review ? `${review} task photo(s) waiting for you in Assign.` : 'No task photos waiting. Send a new task from Today, Assign tasks.';
      }
      case 'palaro': {
        const tid = role === 'parent' ? kids.find((k) => isSchoolTeam(s.teamInfo, k.teamId))?.teamId : isSchoolTeam(s.teamInfo, team.id) ? team.id : undefined;
        if (!tid) return 'The Road to Palaro is the DepEd ladder: Intramurals, District Meet, GSCAA (city), SRAA (Region XII), then Palarong Pambansa. It shows for school teams such as SPED Rangers.';
        const st = ladder(s.events, tid); const cur = st.find((x) => x.state === 'next') ?? [...st].reverse().find((x) => x.state !== 'not-yet');
        return cur ? `${cur.name}: ${STAGE_TEXT[cur.state]}${cur.next ? `, ${fmtDate(cur.next.startsAt)}${cur.next.venue ? ` at ${cur.next.venue}` : ''}` : ''}. Open Road to Palaro for the whole ladder.` : 'No school meets added yet this school year. Open Road to Palaro to see the ladder.';
      }
      case 'squad': {
        const ev = upcoming.find((e) => ['match', 'tournament', 'meet'].includes(e.type)); if (!ev) return 'No match, tournament or meet coming up yet.';
        if (!ev.squad?.length) return `The squad for ${ev.title} (${fmtDate(ev.startsAt)}) has not been picked yet.`;
        if (role === 'parent') return kids.map((k) => `${k.firstName} is ${ev.squad!.includes(k.id) ? '' : 'not '}in the squad for ${ev.title} (${fmtDate(ev.startsAt)}).`).join(' ');
        return `${ev.squad.length} picked for ${ev.title} (${fmtDate(ev.startsAt)}).`;
      }
      case 'attendance': {
        const rows = report(players, s.attendance, s.events.filter((e) => teamIds.includes(e.teamId)), schoolYearStart(new Date()).toISOString());
        if (role === 'parent') return rows.map((r) => `${r.player.firstName}: ${r.rate === null ? 'nothing recorded yet this school year' : `${r.rate}% this school year (${r.present} present, ${r.late} late, ${r.absent} absent, ${r.excused} excused)`}.`).join(' ') || 'No child is linked yet.';
        const rec = rows.filter((r) => r.rate !== null); return rec.length ? `Average this school year: ${Math.round(rec.reduce((n, r) => n + (r.rate ?? 0), 0) / rec.length)}%. Take attendance from Today; the report is in Attendance.` : 'No attendance recorded yet. Take it from Today, Take attendance.';
      }
      case 'values': return `${PROGRAMMES[team.programme].name} values: ${PROGRAMMES[team.programme].values.join(', ')}.`;
    }
  };
}

interface Msg { from: 'you' | 'helper'; text: string; r?: Reply }
/** The Help chat. Answers come from the app's own help and the team's information on this phone; nothing is sent anywhere. */
export function HelpChat({ role }: { role: 'coach' | 'parent' }) {
  const s = useAppState(); const kids = useMyChildren(); const team = activeTeam(s);
  const [q, setQ] = useState(''); const [msgs, setMsgs] = useState<Msg[]>([]);
  const ask = (text: string) => { if (!text.trim()) return; const r = reply(text, role, teamFacts(s, role, kids, team)); setMsgs([...msgs, { from: 'you', text }, { from: 'helper', text: r.text, r }]); setQ(''); };
  return (
    <Card className="grid gap-3">
      <div className="rounded-2xl p-3" style={{ background: 'var(--bg)' }}>Hi! I am the Rangers Helper. Ask how to do something in the app, or about your team: the next training, what to bring, papers, tasks, the squad. I answer from what is in the app, so I work without signal and nothing you type leaves this phone.</div>
      {msgs.map((m, i) => m.from === 'you'
        ? <div key={i} className="ml-8 rounded-2xl bg-red p-3 text-white">{m.text}</div>
        : <div key={i} className="mr-4 grid gap-2 rounded-2xl p-3" style={{ background: 'var(--bg)' }} role="status"><p>{m.text}</p>
            <div className="flex flex-wrap gap-2">
              {m.r?.guide && <button className="btn min-h-[40px] px-3 text-sm" onClick={() => startGuide(m.r!.guide!)}>Show me how</button>}
              {m.r?.link && <Link className="btn ghost min-h-[40px] px-3 text-sm" to={m.r.link.to}>{m.r.link.label}</Link>}
              {m.r?.also.map((e) => <button key={e.id} className="btn ghost min-h-[40px] px-3 text-sm" onClick={() => ask((e.keys.find((k) => k.includes(' ')) ?? e.keys[0]).replace(/^!/, ''))}>{entryLabel(e)}?</button>)}
            </div></div>)}
      <div className="flex flex-wrap gap-2">{SUGGESTIONS[role].map((x) => <Chip key={x} onClick={() => ask(x)}>{x}</Chip>)}</div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
        <input className="field flex-1" aria-label="Ask a question" placeholder="Type a question" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn px-4" type="submit" disabled={!q.trim()}>Ask</button>
      </form>
    </Card>
  );
}
