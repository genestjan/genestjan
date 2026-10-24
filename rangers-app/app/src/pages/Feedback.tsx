import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, Frown, Meh, MessageSquareHeart, Smile, type LucideIcon } from 'lucide-react';
import { Back, Card, H2, IconChip, Page, Segmented, Tone } from '../components/ui';
import { cloudEnabled, feedbackReaders, listFeedback, listMembers, sendFeedback, setFeedbackReader, setFeedbackStatus, useCloud, type Feedback, type Member } from '../lib/cloud';
import { checkFeedback, FEEDBACK_KINDS, feedbackCsv, kindLabel, RATINGS, ratingLabel, type FeedbackKind } from '../lib/feedback';
import { useFeedbackAsk } from '../lib/onboarding';
import { download, fmtDate, fmtDateTime } from '../lib/util';

export const RATING_ICON: Record<number, LucideIcon> = { 1: Frown, 2: Meh, 3: Smile };
const DRAFT = 'rangers-feedback-draft';
const readDraft = () => { try { return localStorage.getItem(DRAFT) ?? ''; } catch { return ''; } };
const keepDraft = (v: string) => { try { if (v) localStorage.setItem(DRAFT, v); else localStorage.removeItem(DRAFT); } catch { /* private mode */ } };
const ROLE: Record<string, string> = { admin: 'club admin', coach: 'coach', parent: 'parent', pending: 'coach (waiting)' };
const SEEN: Record<Feedback['status'], string> = { new: 'Sent', seen: 'Read by the club', done: 'Done, thank you' };

/** Everyone: tell the club what works, what is hard, and what the app should do next. */
export function SendFeedback() {
  const cloud = useCloud(); const [q] = useSearchParams();
  const [rating, setRating] = useState<number | null>(Number(q.get('rating')) || null);
  const [kind, setKind] = useState<FeedbackKind>('idea');
  const [msg, setMsg] = useState(readDraft);
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle'); const [err, setErr] = useState('');
  const [mine, setMine] = useState<Feedback[]>([]);
  const ready = cloud.status === 'ready';
  useEffect(() => { if (ready) listFeedback().then((all) => setMine(all.filter((f) => f.user_id === cloud.userId))).catch(() => {}); }, [ready, state, cloud.userId]);
  const write = (v: string) => { setMsg(v); keepDraft(v); setErr(''); };
  const send = async () => {
    const bad = checkFeedback(msg); if (bad) { setErr(bad); return; }
    setState('sending'); setErr('');
    try { await sendFeedback(kind, msg.trim(), rating, q.get('from') ?? ''); write(''); setRating(null); setState('sent'); }
    catch (e) { setState('idle'); setErr(navigator.onLine ? (e as Error).message : 'No signal. Your message is kept on this phone. Tap Send again when you have signal.'); }
  };
  return (
    <Page title="Send feedback" back={<Back to="/more" />}>
      <Card className="mb-3 grid gap-2">
        <div className="flex items-center gap-3"><IconChip icon={MessageSquareHeart} /><h2 className="text-xl font-bold">Help us make the app better</h2></div>
        <p>Tell us what works, what is hard to use, and what you wish the app could do. Every message is read by the club, and your ideas decide what we improve next.</p>
      </Card>
      {!cloudEnabled ? <Card><p>Feedback is sent when you use the club's app at rangersfc.net/app and are signed in.</p></Card>
        : !ready ? <Card><p>Sign in first, then you can send feedback.</p></Card>
        : state === 'sent' ? (
          <Card className="grid gap-3 text-center" >
            <div className="mx-auto"><IconChip icon={Smile} /></div>
            <h2 className="text-2xl font-bold">Salamat! Thank you.</h2>
            <p>Your feedback reached the club. You will see below when it has been read.</p>
            <button className="btn" onClick={() => setState('idle')}>Send more feedback</button>
            <Link className="btn ghost" to="/">Back to Home</Link>
          </Card>
        ) : (
          <Card className="grid gap-4">
            <div><p className="mb-2 font-semibold">How is the app for you? <span className="muted text-sm font-normal">(you can skip this)</span></p>
              <div className="grid grid-cols-3 gap-2" role="group" aria-label="How is the app for you">{RATINGS.map(([v, l]) => { const I = RATING_ICON[v]; return <button key={v} className="tool min-h-[72px] text-sm" aria-pressed={rating === v} onClick={() => setRating(rating === v ? null : v)}><I size={28} aria-hidden="true" />{l}</button>; })}</div></div>
            <div><p className="mb-2 font-semibold">What is it about?</p>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="What is it about">{FEEDBACK_KINDS.map(([k, l]) => <button key={k} className="tool min-h-[52px] text-sm" aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>)}</div></div>
            <label className="grid gap-1 font-semibold">Your feedback
              <textarea className="field py-3 font-normal" rows={5} value={msg} onChange={(e) => write(e.target.value)} placeholder="Write in English, Tagalog or Bisaya." /></label>
            <p className="muted text-sm">Please do not write a child's health details here. The club admins and the app team see your name with your feedback.</p>
            {err && <Tone tone="warn">{err}</Tone>}
            <button className="btn h-14" disabled={state === 'sending'} onClick={send}>{state === 'sending' ? 'Sending...' : 'Send feedback'}</button>
          </Card>
        )}
      {mine.length > 0 && <><H2>Your feedback</H2>
        <ul className="grid gap-2">{mine.map((f) => <li key={f.id} className="card grid gap-1 p-3">
          <div className="flex flex-wrap justify-between gap-2 text-sm"><span className="muted">{fmtDate(f.created_at)} · {kindLabel(f.kind)}</span><b className={f.status === 'new' ? 'muted' : 'text-gold'}>{SEEN[f.status]}</b></div>
          <p className="whitespace-pre-wrap">{f.message}</p></li>)}</ul></>}
      {cloud.reader && <Link to="/feedback/inbox" className="btn ghost mt-4 w-full">Open the feedback inbox</Link>}
    </Page>
  );
}

/** Club admins and the people they choose: read feedback, mark it done, download it, choose who reads it. */
export function FeedbackInbox() {
  const cloud = useCloud(); const admin = cloud.role === 'admin';
  const [all, setAll] = useState<Feedback[]>([]); const [show, setShow] = useState<'new' | 'all'>('new'); const [msg, setMsg] = useState('');
  const [readers, setReaders] = useState<string[]>([]); const [members, setMembers] = useState<Member[]>([]);
  const ready = cloud.status === 'ready' && cloud.reader;
  const load = async () => { setAll(await listFeedback()); if (admin) { setReaders(await feedbackReaders()); setMembers(await listMembers()); } };
  useEffect(() => { if (ready) load().catch((e: Error) => setMsg(e.message)); }, [ready, admin]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ready) return <Page title="Feedback inbox" back={<Back to="/more" />}><Card><p>Only club admins, and the people they choose, read the feedback.</p><Link className="btn mt-3 w-full" to="/feedback">Send feedback instead</Link></Card></Page>;
  const fresh = all.filter((f) => f.status === 'new'); const list = show === 'new' ? fresh : all;
  const name = (u: string) => members.find((m) => m.user_id === u)?.name ?? 'Someone';
  const mark = async (f: Feedback, status: Feedback['status']) => { setAll(all.map((x) => (x.id === f.id ? { ...x, status } : x))); try { await setFeedbackStatus(f.id, status); } catch (e) { setMsg((e as Error).message); } };
  const reader = async (u: string, keep: boolean, done: string) => { setMsg('Saving...'); try { await setFeedbackReader(u, keep); setReaders(await feedbackReaders()); setMsg(done); } catch (e) { setMsg(`Not saved: ${(e as Error).message}`); } };
  return (
    <Page title="Feedback inbox" back={<Back to="/more" />}>
      <Segmented value={show} onChange={setShow} label="Show" options={[['new', `New (${fresh.length})`], ['all', `All (${all.length})`]]} />
      {list.length === 0 && <Card><p>{show === 'new' ? 'No new feedback. You are all caught up.' : 'No feedback yet. Remind families and coaches that the app has a Send feedback button in More and in Help.'}</p></Card>}
      <ul className="grid gap-2">{list.map((f) => { const I = f.rating ? RATING_ICON[f.rating] : null; return (
        <li key={f.id} className="card grid gap-2 p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-gold px-2.5 py-0.5 font-bold text-ink">{kindLabel(f.kind)}</span>
            {I && <span className="inline-flex items-center gap-1"><I size={18} aria-hidden="true" />{ratingLabel(f.rating)}</span>}
            <span className="muted ml-auto">{fmtDateTime(f.created_at)}</span>
          </div>
          <p className="whitespace-pre-wrap text-lg">{f.message}</p>
          <p className="muted text-sm">{f.name || 'Someone'} · {ROLE[f.role] ?? f.role}{f.page ? ` · from ${f.page}` : ''}</p>
          <div className="flex flex-wrap gap-2">
            {f.status === 'new' && <button className="btn ghost min-h-[44px]" onClick={() => mark(f, 'seen')}>Mark as read</button>}
            {f.status !== 'done' ? <button className="btn min-h-[44px]" onClick={() => mark(f, 'done')}>Done</button> : <span className="muted text-sm">Done</span>}
          </div>
        </li>); })}</ul>
      {all.length > 0 && <button className="btn ghost mt-3 w-full" onClick={() => download(`rangers-feedback-${new Date().toISOString().slice(0, 10)}.csv`, feedbackCsv(all))}><Download size={18} aria-hidden="true" />Download all as a spreadsheet</button>}
      {admin && <><H2>Who gets feedback</H2>
        <Card className="grid gap-2">
          <p className="text-sm">Club admins always get feedback and an alert when it arrives. Add anyone else who should, for example the person who started the app, so they keep hearing from families after handing the club over.</p>
          {readers.map((u) => <div key={u} className="flex items-center gap-2"><span className="flex-1 truncate"><b>{name(u)}</b>{u === cloud.userId ? ' (you)' : ''}</span><button className="btn ghost min-h-[44px]" onClick={() => reader(u, false, `${name(u)} no longer gets feedback.`)}>Remove</button></div>)}
          {!readers.includes(cloud.userId) && <button className="btn ghost" onClick={() => reader(cloud.userId, true, 'You will keep getting feedback, even if you stop being an admin.')}>Keep sending me feedback, even if I stop being an admin</button>}
          <label className="grid gap-1 text-sm font-semibold">Add someone
            <select className="field" value="" onChange={(e) => { const u = e.target.value; if (u) void reader(u, true, `${name(u)} now gets feedback.`); }}>
              <option value="">Choose a person</option>
              {members.filter((m) => m.role !== 'admin' && m.status === 'active' && !readers.includes(m.user_id)).map((m) => <option key={m.user_id} value={m.user_id}>{m.name} ({ROLE[m.role] ?? m.role})</option>)}
            </select></label>
          {msg && <p role="status" className="font-semibold">{msg}</p>}
        </Card></>}
      {!admin && msg && <p role="status" className="mt-3 font-semibold">{msg}</p>}
    </Page>
  );
}

/** Home screen: once a month (never in the first days), a friendly "how is the app?" with one-tap faces. */
export function FeedbackNudge() {
  const cloud = useCloud(); const ask = useFeedbackAsk();
  if (!cloudEnabled || cloud.status !== 'ready' || !ask.show) return null;
  return (
    <Card className="mt-3 grid gap-3" >
      <div className="flex items-center gap-3"><IconChip icon={MessageSquareHeart} /><div><p className="font-bold">How is the app for you?</p><p className="muted text-sm">One tap tells us. Your feedback helps every family and coach.</p></div></div>
      <div className="grid grid-cols-3 gap-2">{RATINGS.map(([v, l]) => { const I = RATING_ICON[v]; return <Link key={v} to={`/feedback?rating=${v}&from=Home`} className="tool min-h-[64px] text-sm" onClick={ask.later}><I size={26} aria-hidden="true" />{l}</Link>; })}</div>
      <div className="flex justify-end gap-2"><button className="btn ghost min-h-[44px] px-4 text-sm" onClick={ask.later}>Later</button><button className="btn ghost min-h-[44px] px-4 text-sm" onClick={ask.never}>Don't ask again</button></div>
    </Card>
  );
}
