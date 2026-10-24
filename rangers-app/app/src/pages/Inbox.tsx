import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Back, Card, Chip, Empty, H2, Page } from '../components/ui';
import { activeTeam, put, uid, useAppState } from '../lib/store';
import { fmtDateTime, share } from '../lib/util';
import { isStaff, useMyChildren, useRole } from '../lib/role';
import { isSeen, markSeen, seenCount, threads } from '../lib/inbox';

export default function Inbox() {
  const s = useAppState(); const role = useRole(); const staff = isStaff(role); const kids = useMyChildren(); const team = activeTeam(s);
  const [tab, setTab] = useState<'news' | 'msgs'>('news');
  const [title, setTitle] = useState(''); const [body, setBody] = useState(''); const [scope, setScope] = useState<'team' | 'club'>('team'); const [note, setNote] = useState('');
  const who = staff ? 'coach' : 'parent';
  const anns = s.announcements.filter((a) => (staff ? a.scope === 'club' || a.teamId === team.id : a.scope === 'club' || kids.some((k) => k.teamId === a.teamId))).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.at.localeCompare(a.at));
  useEffect(() => { if (!staff && kids[0]) anns.forEach((a) => { if (tab === 'news') markSeen(s, a.id, kids[0].id, who); }); /* eslint-disable-next-line */ }, [tab, anns.length, kids.length]);
  const post = () => { put('announcements', { id: uid(), scope, teamId: scope === 'team' ? team.id : undefined, title, body, at: new Date().toISOString(), by: s.me.name, seenBy: [] }); setTitle(''); setBody(''); setNote('Posted. Parents will see it in the app.'); };
  const th = staff ? threads(s, team.id) : kids.map((k) => ({ playerId: k.id, msgs: s.messages.filter((m) => m.playerId === k.id).sort((a, b) => a.at.localeCompare(b.at)) }));
  return (
    <Page title="Inbox">
      <div className="mb-3 flex gap-2"><Chip on={tab === 'news'} onClick={() => setTab('news')}>Announcements</Chip><Chip on={tab === 'msgs'} onClick={() => setTab('msgs')}>Messages</Chip></div>
      {tab === 'news' && (<>
        {staff && (
          <Card className="mb-4 grid gap-2">
            <h2 className="text-2xl">New announcement</h2>
            <input className="field" placeholder="Title (e.g. No training Saturday)" aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea className="field py-3" rows={3} placeholder="Message" aria-label="Message" value={body} onChange={(e) => setBody(e.target.value)} />
            <div className="flex gap-2"><Chip on={scope === 'team'} onClick={() => setScope('team')}>{team.name}</Chip><Chip on={scope === 'club'} onClick={() => setScope('club')}>Whole club</Chip></div>
            <button className="btn h-14" disabled={!title.trim()} onClick={post}>Post</button>{note && <p role="status">{note}</p>}
          </Card>)}
        {anns.length === 0 && <Empty>No announcements yet.</Empty>}
        <ul className="grid gap-3">{anns.map((a) => { const c = seenCount(s, a); return (
          <li key={a.id} className="card p-4"><div className="flex items-baseline justify-between gap-2"><span className="text-xl font-semibold">{a.pinned && 'Pinned: '}{a.title}</span><span className="muted text-sm">{fmtDateTime(a.at)}</span></div>
            <p className="mt-1 whitespace-pre-wrap">{a.body}</p><div className="muted mt-1 text-sm">{a.by}{a.scope === 'club' ? ' · whole club' : ''}{staff && ` · seen by ${c.seen} of ${c.total} families`}</div>
            {staff && <div className="mt-2 flex gap-2"><button className="btn ghost min-h-[44px] text-sm" onClick={() => share(`${a.title}\n${a.body}`)}>Share to group chat</button><button className="btn ghost min-h-[44px] text-sm" onClick={() => put('announcements', { ...a, pinned: !a.pinned })}>{a.pinned ? 'Unpin' : 'Pin'}</button></div>}
          </li>); })}</ul></>)}
      {tab === 'msgs' && (<>
        <p className="muted mb-3 text-sm">{staff ? 'Messages go to a child\'s parents. There is no group chat and coaches never message children directly.' : 'Private messages with your child\'s coach.'}</p>
        {staff ? <ThreadList /> : th.length === 0 ? <Empty>No children linked to this account yet.</Empty> : <ul className="grid gap-2">{th.map((t) => { const k = s.players.find((p) => p.id === t.playerId); const last = t.msgs[t.msgs.length - 1]; return <li key={t.playerId}><Link to={`/inbox/${t.playerId}`} className="card block p-3"><b>Message the coach about {k?.firstName}</b><div className="muted truncate text-sm">{last ? last.body : 'No messages yet'}</div></Link></li>; })}</ul>}
      </>)}
    </Page>
  );
}

function ThreadList() {
  const s = useAppState(); const team = activeTeam(s); const th = threads(s, team.id);
  const [q, setQ] = useState('');
  const start = s.players.filter((p) => p.teamId === team.id && p.firstName.toLowerCase().includes(q.toLowerCase()));
  return (<>
    {th.length === 0 && <Empty>No conversations yet. Start one below.</Empty>}
    <ul className="mb-4 grid gap-2">{th.map((t) => { const k = s.players.find((p) => p.id === t.playerId); const last = t.msgs[t.msgs.length - 1]; const unread = t.msgs.filter((m) => m.from === 'parent' && !isSeen(s, m.id, 'coach')).length; return (
      <li key={t.playerId}><Link to={`/inbox/${t.playerId}`} className="card flex items-center justify-between gap-2 p-3"><div className="min-w-0"><b>{k?.firstName}'s family</b><div className="muted truncate text-sm">{last.from === 'coach' ? 'You: ' : ''}{last.body}</div></div>{unread > 0 && <span className="rounded-full bg-red px-2 text-white">{unread}</span>}</Link></li>); })}</ul>
    <H2>Message a family</H2>
    <input className="field mb-2" placeholder="Search a child" aria-label="Search a child" value={q} onChange={(e) => setQ(e.target.value)} />
    <div className="flex flex-wrap gap-2">{start.map((p) => <Link key={p.id} to={`/inbox/${p.id}`} className="btn ghost px-4">{p.firstName}</Link>)}</div>
  </>);
}

export function Thread() {
  const { playerId } = useParams(); const s = useAppState(); const role = useRole(); const staff = isStaff(role);
  const [text, setText] = useState(''); const end = useRef<HTMLDivElement>(null);
  const kid = s.players.find((p) => p.id === playerId);
  const msgs = s.messages.filter((m) => m.playerId === playerId).sort((a, b) => a.at.localeCompare(b.at));
  const who = staff ? 'coach' : 'parent';
  useEffect(() => { if (kid) msgs.forEach((m) => { if (m.from !== who) markSeen(s, m.id, kid.id, who); }); end.current?.scrollIntoView(); /* eslint-disable-next-line */ }, [msgs.length]);
  if (!kid) return <Page title="Messages" back={<Back to="/inbox" />}><Empty>This conversation is not available.</Empty></Page>;
  const send = () => { if (!text.trim()) return; put('messages', { id: uid(), threadId: kid.id, playerId: kid.id, teamId: kid.teamId, from: staff ? 'coach' : 'parent', byName: s.me.name, body: text.trim(), at: new Date().toISOString(), readBy: [] }); setText(''); };
  return (
    <Page title={staff ? `${kid.firstName}'s family` : 'Coach'} back={<Back to="/inbox" />}>
      <div className="mb-3 grid gap-2" aria-live="polite">
        {msgs.length === 0 && <Empty>{staff ? 'Say hello, or share how the child is getting on.' : 'Ask your coach anything about training, matches or how your child is doing.'}</Empty>}
        {msgs.map((m) => { const mine = m.from === who; return (
          <div key={m.id} className={`max-w-[85%] rounded-2xl p-3 ${mine ? 'ml-auto bg-red text-white' : 'card'}`}><div className="text-xs opacity-80">{m.byName} · {fmtDateTime(m.at)}</div><div className="whitespace-pre-wrap">{m.body}</div></div>); })}
        <div ref={end} />
      </div>
      <div className="h-20" aria-hidden />
      <div className="fixed inset-x-0 z-30 flex gap-2 p-3" style={{ background: 'var(--bg)', bottom: 'calc(56px + env(safe-area-inset-bottom))' }}>
        <textarea className="field flex-1 py-3" rows={1} aria-label="Message" placeholder="Write a message" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn" disabled={!text.trim()} onClick={send}>Send</button>
      </div>
    </Page>
  );
}
