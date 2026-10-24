import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Back, Card, Empty, H2, Page } from '../components/ui';
import { MediaPicker, MediaView, YouTube } from '../components/MediaView';
import { activeTeam, del, put, teamPlayers, uid, useAppState } from '../lib/store';
import { ASSIGNMENT_TEMPLATES, templatesFor } from '../content/assignments';
import { groups, latestByTask, progress } from '../lib/assignments';
import { teamPhotoPath, youtubeId } from '../lib/mediaRules';
import { removeMedia } from '../lib/media';
import { BAND_AGE } from '../lib/sessionBuilder';
import { fmtDate, today } from '../lib/util';
import type { Assignment, Submission } from '../lib/model';

/** Coach: all assignments sent, newest first. */
export function AssignList() {
  const s = useAppState(); const team = activeTeam(s);
  const list = groups(s.assignments.filter((a) => a.teamId === team.id));
  return (
    <Page title="Assign" back={<Back to="/" />}>
      <Link to="/assign/new" className="btn mb-3 w-full" data-tour="assign-new">New assignment</Link>
      {list.length === 0 && <Empty>No assignments yet. Pick a ready-made one or write your own, choose the players, and they get a task list to clear with photos.</Empty>}
      <div className="grid gap-3">
        {list.map((g) => {
          const ps = g.items.map((a) => progress(a, s.submissions));
          const cleared = ps.filter((p) => p.cleared).length; const review = ps.reduce((n, p) => n + p.toReview, 0);
          return (
            <Link key={g.groupId} to={`/assign/${g.groupId}`} className="card block p-4">
              <div className="text-2xl font-semibold">{g.first.title}</div>
              <div className="muted">{g.items.length} player{g.items.length === 1 ? '' : 's'} · {cleared} cleared{g.first.dueOn ? ` · due ${fmtDate(g.first.dueOn)}` : ''}</div>
              {review > 0 && <div className="mt-1 font-semibold text-red">{review} to review</div>}
            </Link>);
        })}
      </div>
    </Page>
  );
}

/** Coach: build an assignment from a ready-made one or from scratch, with an optional photo or YouTube video, and send it to chosen players. */
export function AssignNew() {
  const s = useAppState(); const nav = useNavigate(); const team = activeTeam(s); const kids = teamPlayers(s);
  const [title, setTitle] = useState(''); const [why, setWhy] = useState(''); const [tasks, setTasks] = useState<string[]>(['']);
  const [templateId, setTemplateId] = useState<string | undefined>(); const [due, setDue] = useState('');
  const [photo, setPhoto] = useState(''); const [yt, setYt] = useState(''); const ytId = youtubeId(yt);
  const [chosen, setChosen] = useState<string[]>([]); const [all, setAll] = useState(false);
  const age = BAND_AGE[team.ageBand]; const templates = all ? ASSIGNMENT_TEMPLATES : templatesFor(age);
  const clean = tasks.map((t) => t.trim()).filter(Boolean);
  const ready = title.trim() && clean.length > 0 && chosen.length > 0;
  const applyTemplate = (id: string) => { const t = ASSIGNMENT_TEMPLATES.find((x) => x.id === id)!; setTemplateId(id); setTitle(t.title); setWhy(t.why); setTasks(t.tasks); };
  const send = () => {
    const groupId = uid(); const at = new Date().toISOString();
    for (const playerId of chosen) {
      const a: Assignment = { id: uid(), groupId, playerId, teamId: team.id, title: title.trim(), why: why.trim(), tasks: clean.map((text, i) => ({ id: `t${i + 1}`, text })), photoPath: photo || undefined, youtubeId: ytId || undefined, templateId, dueOn: due || undefined, at, by: s.me.name };
      put('assignments', a);
    }
    nav(`/assign/${groupId}`, { replace: true });
  };
  return (
    <Page title="New assignment" back={<Back to="/assign" />}>
      <H2>1. Start from a ready-made one</H2>
      <div className="grid gap-2" data-tour="assign-templates">
        {templates.map((t) => <button key={t.id} className={`btn ${templateId === t.id ? '' : 'ghost'} justify-start text-left`} aria-pressed={templateId === t.id} onClick={() => applyTemplate(t.id)}>{t.title}</button>)}
        <button className="btn ghost" onClick={() => setAll(!all)}>{all ? `Only show ones for ${team.ageBand}` : 'Show all ready-made assignments'}</button>
      </div>
      <H2>2. Check or write the tasks</H2>
      <Card className="grid gap-3">
        <input className="field" placeholder="Title, e.g. Ball mastery at home" aria-label="Assignment title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="field" rows={2} placeholder="Why this matters (the child reads this)" aria-label="Why this matters" value={why} onChange={(e) => setWhy(e.target.value)} />
        {tasks.map((t, i) => (
          <div key={i} className="flex gap-2">
            <input className="field flex-1" placeholder={`Task ${i + 1}`} aria-label={`Task ${i + 1}`} value={t} onChange={(e) => setTasks(tasks.map((x, k) => (k === i ? e.target.value : x)))} />
            {tasks.length > 1 && <button className="btn ghost px-3" aria-label={`Remove task ${i + 1}`} onClick={() => setTasks(tasks.filter((_, k) => k !== i))}>Remove</button>}
          </div>))}
        {tasks.length < 8 && <button className="btn ghost" onClick={() => setTasks([...tasks, ''])}>Add a task</button>}
        <label className="grid gap-1 text-sm font-semibold">Due date (optional)<input type="date" className="field" min={today()} value={due} onChange={(e) => setDue(e.target.value)} /></label>
      </Card>
      <H2>3. Show them how (optional)</H2>
      <Card className="grid gap-3" tour="assign-show-how">
        <label className="grid gap-1 text-sm font-semibold">YouTube link to a how-to video
          <input className="field" inputMode="url" placeholder="https://youtu.be/..." value={yt} onChange={(e) => setYt(e.target.value)} /></label>
        {yt.trim() && !ytId && <p className="text-sm text-red" role="alert">That is not a YouTube video link. Copy it from YouTube's Share button.</p>}
        {ytId && <YouTube id={ytId} />}
        <p className="muted text-sm">Upload the video to YouTube with the club account and choose <b>Unlisted</b>, so only people with the link can watch. It costs nothing and uses none of the club's storage.</p>
        {photo ? (<><MediaView path={photo} /><button className="btn ghost" onClick={() => { void removeMedia([photo]).catch(() => undefined); setPhoto(''); }}>Remove the photo</button></>)
          : <MediaPicker label="Add a photo (for example a drawing of the drill)" pathFor={() => teamPhotoPath(team.id, uid())} onSaved={setPhoto} />}
      </Card>
      <H2>4. Choose the players</H2>
      <Card className="grid gap-2" tour="assign-players">
        <div className="flex gap-2"><button className="btn ghost flex-1" onClick={() => setChosen(kids.map((k) => k.id))}>Everyone</button><button className="btn ghost flex-1" onClick={() => setChosen([])}>Nobody</button></div>
        {kids.length === 0 && <p className="muted">Add players in Squad first.</p>}
        {kids.map((k) => (
          <label key={k.id} className="flex items-center gap-3 py-1"><input type="checkbox" className="h-6 w-6" checked={chosen.includes(k.id)} onChange={(e) => setChosen(e.target.checked ? [...chosen, k.id] : chosen.filter((x) => x !== k.id))} />{k.firstName}{k.number ? ` · #${k.number}` : ''}</label>))}
      </Card>
      <button className="btn mt-4 h-14 w-full" disabled={!ready} onClick={send}>Send to {chosen.length} player{chosen.length === 1 ? '' : 's'}</button>
      {!ready && <p className="muted mt-2 text-sm">Needs a title, at least one task and at least one player.</p>}
    </Page>
  );
}

/** Coach: how each player is getting on, with their photos to approve or send back. */
export function AssignDetail() {
  const { groupId } = useParams(); const s = useAppState(); const nav = useNavigate();
  const items = s.assignments.filter((a) => a.groupId === groupId);
  if (items.length === 0) return <Page title="Assignment" back={<Back to="/assign" />}><Empty>This assignment is no longer there.</Empty></Page>;
  const a0 = items[0];
  const remove = () => {
    if (!confirm('Delete this assignment for every player, with their photos?')) return;
    const subs = s.submissions.filter((x) => items.some((a) => a.id === x.assignmentId));
    const files = [...new Set([...items.map((a) => a.photoPath ?? ''), ...subs.map((x) => x.mediaPath)].filter(Boolean))];
    void removeMedia(files).catch(() => undefined);   // best effort: the records go either way
    items.forEach((a) => del('assignments', a.id)); subs.forEach((x) => del('submissions', x.id)); nav('/assign', { replace: true });
  };
  return (
    <Page title={a0.title} back={<Back to="/assign" />}>
      {a0.why && <p className="mb-2">{a0.why}</p>}
      {a0.dueOn && <p className="muted mb-2">Due {fmtDate(a0.dueOn)}</p>}
      {a0.youtubeId && <div className="mb-3"><YouTube id={a0.youtubeId} /></div>}
      {a0.photoPath && <div className="mb-3"><MediaView path={a0.photoPath} /></div>}
      {items.map((a) => <PlayerReview key={a.id} a={a} />)}
      <button className="btn ghost mt-4 w-full" onClick={remove}>Delete this assignment</button>
    </Page>
  );
}

function PlayerReview({ a }: { a: Assignment }) {
  const s = useAppState(); const kid = s.players.find((p) => p.id === a.playerId); const by = latestByTask(s.submissions, a.id); const pr = progress(a, s.submissions);
  return (
    <Card className="mb-3 grid gap-3">
      <div className="flex items-center justify-between"><div className="text-2xl font-semibold">{kid?.firstName ?? 'Player'}</div><div className={pr.cleared ? 'font-semibold text-red' : 'muted'}>{pr.cleared ? 'List cleared' : `${pr.sent} of ${pr.total} sent`}</div></div>
      {a.tasks.map((t) => { const x = by.get(t.id); return <TaskReview key={`${t.id}:${x?.at ?? ''}`} text={t.text} sub={x} />; })}
    </Card>
  );
}

function TaskReview({ text, sub }: { text: string; sub?: Submission }) {
  const [fb, setFb] = useState(sub?.feedback ?? '');
  const set = (status: Submission['status']) => sub && put('submissions', { ...sub, status, feedback: fb.trim(), reviewedAt: new Date().toISOString() });
  return (
    <div className="grid gap-2 border-t pt-3" style={{ borderColor: 'var(--line)' }}>
      <div className="font-semibold">{text}</div>
      {!sub && <div className="muted">Not sent yet</div>}
      {sub && (<>
        <MediaView path={sub.mediaPath} version={sub.at} />
        <div className="muted text-sm">{sub.status === 'approved' ? 'Approved' : sub.status === 'redo' ? 'Sent back for another try' : 'Waiting for you'}</div>
        <input className="field" placeholder="A short comment for the player (optional)" aria-label="Comment for the player" value={fb} onChange={(e) => setFb(e.target.value)} />
        <div className="flex gap-2"><button className="btn flex-1" disabled={sub.status === 'approved'} onClick={() => set('approved')}>Approve</button><button className="btn ghost flex-1" disabled={sub.status === 'redo'} onClick={() => set('redo')}>Try again</button></div>
      </>)}
    </div>
  );
}
