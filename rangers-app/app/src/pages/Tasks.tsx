import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Back, Card, Empty, H2, Page } from '../components/ui';
import { MediaPicker, MediaView } from '../components/MediaView';
import { put, useAppState } from '../lib/store';
import { derivedId } from '../lib/syncMap';
import { latestByTask, openAssignments, progress } from '../lib/assignments';
import { proofPath } from '../lib/mediaRules';
import { useMyChildren } from '../lib/role';
import { fmtDate } from '../lib/util';
import type { Assignment, Submission } from '../lib/model';

/** Parent or player: the task lists the coach sent, for each child. */
export function Tasks() {
  const s = useAppState(); const kids = useMyChildren();
  if (kids.length === 0) return <Page title="Tasks"><Empty>No child is linked to this account yet.</Empty></Page>;
  return (
    <Page title="Tasks">
      {kids.map((k) => {
        const mine = s.assignments.filter((a) => a.playerId === k.id);
        const open = openAssignments(mine, s.submissions); const done = mine.filter((a) => !open.includes(a)).sort((a, b) => b.at.localeCompare(a.at));
        return (
          <section key={k.id}>
            {kids.length > 1 && <H2>{k.firstName}</H2>}
            {mine.length === 0 && <Empty>No tasks from the coach yet for {k.firstName}. When one arrives it shows here.</Empty>}
            {open.length > 0 && <div className="grid gap-3">{open.map((a) => <TaskCard key={a.id} a={a} />)}</div>}
            {done.length > 0 && <><H2>Cleared</H2><div className="grid gap-3">{done.map((a) => <TaskCard key={a.id} a={a} />)}</div></>}
          </section>);
      })}
    </Page>
  );
}

function TaskCard({ a }: { a: Assignment }) {
  const s = useAppState(); const pr = progress(a, s.submissions);
  return (
    <Link to={`/tasks/${a.id}`} className="card block p-4">
      <div className="text-2xl font-semibold">{a.title}</div>
      <div className="muted">{pr.sent} of {pr.total} sent{a.dueOn ? ` · due ${fmtDate(a.dueOn)}` : ''}</div>
      {pr.redo > 0 && <div className="mt-1 font-semibold text-red">{pr.redo} to try again</div>}
      {pr.cleared && <div className="mt-1 font-semibold text-red">{pr.approved === pr.total ? 'All approved' : 'List cleared'}</div>}
    </Link>
  );
}

/** One assignment: watch the coach's video, then send a photo or video for each task to clear the list. */
export function TaskDetail() {
  const { id } = useParams(); const s = useAppState(); const kids = useMyChildren();
  const a = s.assignments.find((x) => x.id === id && kids.some((k) => k.id === x.playerId));
  if (!a) return <Page title="Task" back={<Back to="/tasks" />}><Empty>This task is no longer there.</Empty></Page>;
  const kid = s.players.find((p) => p.id === a.playerId); const by = latestByTask(s.submissions, a.id); const pr = progress(a, s.submissions);
  return (
    <Page title={a.title} back={<Back to="/tasks" />}>
      {pr.cleared ? <Card className="mb-3 text-lg font-semibold">Well done{kid ? `, ${kid.firstName}` : ''}! You sent something for every task.</Card> : <p className="muted mb-2">{pr.sent} of {pr.total} done. Send a photo or a short video for each task to clear the list.</p>}
      {a.why && <p className="mb-3 text-lg">{a.why}</p>}
      {a.dueOn && <p className="muted mb-3">Due {fmtDate(a.dueOn)}</p>}
      {a.videoPath && <><H2>Watch first</H2><MediaView path={a.videoPath} kind={a.videoKind ?? 'video'} /></>}
      <H2>Your tasks</H2>
      <div className="grid gap-3">{a.tasks.map((t, i) => <TaskRow key={t.id} a={a} n={i + 1} taskId={t.id} text={t.text} sub={by.get(t.id)} />)}</div>
    </Page>
  );
}

function TaskRow({ a, n, taskId, text, sub }: { a: Assignment; n: number; taskId: string; text: string; sub?: Submission }) {
  const [open, setOpen] = useState(false);
  const send = (mediaPath: string, mediaType: 'image' | 'video') => {
    put('submissions', { id: derivedId(a.id, taskId), assignmentId: a.id, taskId, playerId: a.playerId, teamId: a.teamId, mediaPath, mediaType, at: new Date().toISOString(), status: 'submitted', feedback: '' });
    setOpen(false);
  };
  const state = !sub ? 'To do' : sub.status === 'approved' ? 'Approved' : sub.status === 'redo' ? 'Try again' : 'Sent';
  return (
    <Card className="grid gap-2">
      <div className="flex items-start justify-between gap-3"><div className="text-lg font-semibold">{n}. {text}</div><span className={`shrink-0 rounded-full border px-3 py-1 text-sm ${sub && sub.status !== 'redo' ? 'font-semibold text-red' : ''}`} style={{ borderColor: 'var(--line)' }}>{state}</span></div>
      {sub?.feedback && <p className="rounded-xl p-2" style={{ background: 'var(--line)' }}>Coach: {sub.feedback}</p>}
      {sub && <MediaView path={sub.mediaPath} kind={sub.mediaType} />}
      {sub?.status === 'approved' ? null : (!sub || open || sub.status === 'redo')
        ? <MediaPicker label={sub ? 'Send a new photo or video' : 'Add a photo or video'} pathFor={(p) => proofPath(a.playerId, crypto.randomUUID(), p.ext)} onSaved={send} />
        : <button className="btn ghost" onClick={() => setOpen(true)}>Replace it</button>}
    </Card>
  );
}
