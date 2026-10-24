import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Back, Card, Chip, Empty, H2, Page } from '../components/ui';
import { activeTeam, put, teamPlayers, uid, useAppState } from '../lib/store';
import { derivedId } from '../lib/syncMap';
import { LOW_ATTENDANCE, STATUSES, defaultEvent, report, reportCsv, statusOf, summarise } from '../lib/attendance';
import { schoolYearStart } from '../lib/school';
import { latestReply } from './Schedule';
import { download, fmtDate, fmtDateTime } from '../lib/util';
import type { AttendanceStatus } from '../lib/model';

/** Opens today's event (or the latest one), or offers to start a session now. */
export function AttendanceHome() {
  const s = useAppState(); const nav = useNavigate(); const team = activeTeam(s);
  const e = defaultEvent(s.events, team.id);
  const recent = s.events.filter((x) => x.teamId === team.id && !x.cancelled && Date.parse(x.startsAt) <= Date.now()).sort((a, b) => b.startsAt.localeCompare(a.startsAt)).slice(0, 8);
  const startNow = () => {
    const st = new Date(); const id = uid();
    put('events', { id, teamId: team.id, type: 'training', title: 'Training', startsAt: st.toISOString(), endsAt: new Date(st.getTime() + 90 * 60000).toISOString(), venue: '', mapUrl: '', hospital: '', bring: '', opponent: '', notes: '', goingByDefault: false });
    nav(`/attendance/${id}`);
  };
  return (
    <Page title="Attendance" back={<Back to="/" />}>
      {e && <Link to={`/attendance/${e.id}`} className="btn mb-3 h-14 w-full" data-tour="att-take">Take attendance: {e.title}, {fmtDate(e.startsAt)}</Link>}
      <button className="btn ghost mb-3 w-full" onClick={startNow}>Not in the schedule? Start a training session now</button>
      <Link to="/attendance/report" className="btn ghost mb-3 w-full" data-tour="att-report">See the attendance report</Link>
      {recent.length > 0 && <><H2>Recent sessions</H2><div className="grid gap-2">{recent.map((x) => { const sm = summarise(s.attendance.filter((a) => a.eventId === x.id)); return (
        <Link key={x.id} to={`/attendance/${x.id}`} className="card flex items-center justify-between p-4"><span>{x.title}, {fmtDate(x.startsAt)}</span><span className="muted text-sm">{sm.recorded ? `${sm.present + sm.late} came` : 'Not taken'}</span></Link>); })}</div></>}
    </Page>
  );
}

/** Tap each child: Present, Late, Absent or Excused. Parents' "not going" replies are shown as a hint. */
export function TakeAttendance() {
  const { id } = useParams(); const s = useAppState();
  const e = s.events.find((x) => x.id === id);
  if (!e) return <Page title="Attendance" back={<Back to="/attendance" />}><Empty>This event is not here any more.</Empty></Page>;
  const kids = teamPlayers(s, e.teamId);
  const rec = (pid: string) => s.attendance.find((a) => a.eventId === e.id && a.playerId === pid);
  const mark = (pid: string, status: AttendanceStatus) => put('attendance', { id: derivedId(`${e.id}:${pid}`, 'att'), eventId: e.id, playerId: pid, status, present: status === 'present' || status === 'late' });
  const sm = summarise(kids.map((k) => rec(k.id)).filter((x): x is NonNullable<typeof x> => !!x));
  const allPresent = () => kids.filter((k) => !rec(k.id)).forEach((k) => mark(k.id, latestReply(s, e.id, k.id)?.status === 'no' ? 'excused' : 'present'));
  return (
    <Page title="Attendance" back={<Back to="/attendance" />}>
      <p className="mb-1 text-lg font-semibold">{e.title}</p><p className="muted mb-3">{fmtDateTime(e.startsAt)}{e.venue ? ` · ${e.venue}` : ''}</p>
      <Card className="mb-3 grid grid-cols-4 gap-1 text-center">{STATUSES.map((x) => <div key={x.id}><div className="display text-3xl">{sm[x.id]}</div><div className="muted text-xs">{x.label}</div></div>)}</Card>
      {kids.length === 0 && <Empty>No players in this team yet.</Empty>}
      {kids.some((k) => !rec(k.id)) && <button className="btn ghost mb-3 w-full" onClick={allPresent}>Mark everyone not yet marked as present</button>}
      <div className="grid gap-2">
        {kids.map((k) => { const cur = rec(k.id); const st = cur ? statusOf(cur) : undefined; const said = latestReply(s, e.id, k.id)?.status; return (
          <div key={k.id} className="card grid gap-2 p-3">
            <div className="flex items-center justify-between"><span className="text-lg font-semibold">{k.firstName}{k.number ? ` #${k.number}` : ''}</span>{said && <span className="muted text-xs">Parent said: {said === 'no' ? 'not going' : said}</span>}</div>
            <div className="grid grid-cols-4 gap-1" role="group" aria-label={`${k.firstName} attendance`}>{STATUSES.map((x) => (
              <button key={x.id} className={`btn min-h-[48px] px-1 text-sm ${st === x.id ? '' : 'ghost'}`} aria-pressed={st === x.id} onClick={() => mark(k.id, x.id)}>{x.label}</button>))}</div>
          </div>); })}
      </div>
      <p className="muted mt-3 text-sm">Saved as you tap. Families see their own child's attendance on the Progress page.</p>
    </Page>
  );
}

/** Per child, in name order. Excused sessions do not count against a child. Downloadable for the school. */
export function AttendanceReport() {
  const s = useAppState(); const team = activeTeam(s); const kids = teamPlayers(s);
  const [range, setRange] = useState<'30' | 'year' | 'all'>('year');
  const from = range === 'all' ? '0000' : range === 'year' ? schoolYearStart(new Date()).toISOString() : new Date(Date.now() - 30 * 86400000).toISOString();
  const rows = report(kids, s.attendance, s.events.filter((e) => e.teamId === team.id), from);
  const label = range === 'all' ? 'all time' : range === 'year' ? 'this school year' : 'the last 30 days';
  return (
    <Page title="Attendance report" back={<Back to="/attendance" />}>
      <div className="mb-3 flex flex-wrap gap-2"><Chip on={range === '30'} onClick={() => setRange('30')}>Last 30 days</Chip><Chip on={range === 'year'} onClick={() => setRange('year')}>School year</Chip><Chip on={range === 'all'} onClick={() => setRange('all')}>All</Chip></div>
      {kids.length === 0 && <Empty>No players yet.</Empty>}
      <div className="grid gap-2">{rows.map((r) => (
        <div key={r.player.id} className="card flex items-center justify-between gap-2 p-3">
          <div><div className="font-semibold">{r.player.firstName}</div><div className="muted text-xs">{r.recorded ? `${r.present} present, ${r.late} late, ${r.absent} absent, ${r.excused} excused` : 'Nothing recorded'}</div></div>
          <div className={`text-right ${r.rate !== null && r.rate < LOW_ATTENDANCE ? 'font-semibold text-red' : ''}`}>{r.rate === null ? '-' : `${r.rate}%`}</div>
        </div>))}</div>
      <p className="muted mt-3 text-sm">Below {LOW_ATTENDANCE}% shows in red: a kind word with the family usually helps more than a warning.</p>
      <button className="btn mt-3 w-full" onClick={() => download(`attendance-${team.name.replace(/\W+/g, '-')}.csv`, reportCsv(rows, `${team.name}, attendance, ${label}`), 'text/csv')}>Download for the school (spreadsheet)</button>
    </Page>
  );
}
