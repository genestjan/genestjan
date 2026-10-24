import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlayCircle, Plus } from 'lucide-react';
import { Back, Card, Empty, H2, Page, Segmented } from '../components/ui';
import { YouTube } from '../components/MediaView';
import { WhoMayBeFilmed } from '../components/Clip';
import { activeTeam, del, put, uid, useAppState } from '../lib/store';
import { isStaff, useMyChildren, useRole } from '../lib/role';
import { youtubeId } from '../lib/mediaRules';
import { fmtDate } from '../lib/util';
import { cloudEnabled, useCloud, videoSpace } from '../lib/cloud';
import type { ClubVideo, VideoAudience, VideoTopic } from '../lib/model';

export const TOPICS: [VideoTopic, string][] = [['how-we-work', 'How we do things'], ['warm-up', 'Warm-up'], ['ball-skills', 'Ball skills'], ['drills', 'Drills'], ['goalkeeping', 'Goalkeeping'], ['fitness', 'Fitness at home'], ['match-day', 'Match day'], ['safety', 'Safety']];
const topicName = (t: VideoTopic) => TOPICS.find(([k]) => k === t)?.[1] ?? 'Video';

/** Which library videos a person sees: coaches see everything (coaches-only ones on their own tab); families see their child's team and the whole club. */
export function useVisibleVideos() {
  const s = useAppState(); const staff = isStaff(useRole()); const kids = useMyChildren();
  const teams = new Set(kids.map((k) => k.teamId));
  return s.videos.filter((v) => staff || (v.audience === 'club' || (v.audience === 'team' && v.teamId && teams.has(v.teamId)))).sort((a, b) => b.at.localeCompare(a.at));
}

/** Coaches see how full the club's space for short in-app videos is. When it is full, new ones are refused; nothing is deleted. */
function VideoSpace() {
  const c = useCloud(); const [sp, setSp] = useState<{ used: number; room: number } | null>(null);
  useEffect(() => { if (cloudEnabled && c.status === 'ready' && navigator.onLine) void videoSpace().then(setSp).catch(() => undefined); }, [c.status]);
  if (!sp) return null; const mb = (n: number) => Math.round(n / 1048576);
  return <p className="muted mb-3 text-sm">Short videos in the app use {mb(sp.used)} MB of the club's {mb(sp.used + sp.room)} MB.{sp.room <= 0 ? ' It is full: new short videos are refused until some are removed.' : ''} YouTube videos use none of it.</p>;
}

/** The club's video library: how-to and "how we do things" videos on YouTube (free, any length), shown inside the app. */
export function VideoLibrary() {
  const s = useAppState(); const role = useRole(); const staff = isStaff(role); const all = useVisibleVideos();
  const [tab, setTab] = useState<'players' | 'coaches'>('players'); const [topic, setTopic] = useState<VideoTopic | ''>(''); const [playing, setPlaying] = useState('');
  const list = all.filter((v) => (staff ? (tab === 'coaches' ? v.audience === 'coaches' : v.audience !== 'coaches') : true) && (!topic || v.topic === topic));
  const used = new Set(all.filter((v) => !staff || (tab === 'coaches') === (v.audience === 'coaches')).map((v) => v.topic));
  const who = (v: ClubVideo) => (v.audience === 'coaches' ? 'Coaches only' : v.audience === 'club' ? 'Whole club' : s.teams.find((t) => t.id === v.teamId)?.name ?? 'One team');
  return (
    <Page title="Video library" back={<Back to="/more" />}>
      {staff && <Segmented value={tab} onChange={(v) => { setTab(v); setTopic(''); }} label="Videos for" options={[['players', 'For players and families'], ['coaches', 'For coaches']]} />}
      {staff && <Link to="/videos/new" className="btn mb-3 w-full" data-tour="video-add"><Plus size={18} aria-hidden="true" />Add a video</Link>}
      {staff && <VideoSpace />}
      {used.size > 1 && <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Topic">
        <button className={`btn min-h-[40px] px-3 text-sm ${topic ? 'ghost' : ''}`} onClick={() => setTopic('')}>All</button>
        {TOPICS.filter(([k]) => used.has(k)).map(([k, l]) => <button key={k} className={`btn min-h-[40px] px-3 text-sm ${topic === k ? '' : 'ghost'}`} onClick={() => setTopic(k)}>{l}</button>)}
      </div>}
      {list.length === 0 && <Empty>{staff ? (tab === 'coaches' ? 'No videos for coaches yet. Add how you run a warm-up, match day or a safety routine, so every coach does it the same way.' : 'No videos yet. Add drills and skills the children can practise at home.') : 'No videos from the coaches yet.'}</Empty>}
      <ul className="grid gap-3">{list.map((v) => (
        <li key={v.id} className="card grid gap-2 p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm"><span className="rounded-full bg-gold px-2.5 py-0.5 font-bold text-ink">{topicName(v.topic)}</span><span className="muted">{who(v)}</span><span className="muted ml-auto">{fmtDate(v.at)}</span></div>
          <p className="text-lg font-bold">{v.title}</p>
          {v.notes && <p className="whitespace-pre-wrap">{v.notes}</p>}
          {playing === v.id ? <YouTube id={v.youtubeId} /> : <button className="btn ghost" onClick={() => setPlaying(v.id)}><PlayCircle size={20} aria-hidden="true" />Play video</button>}
          <div className="flex items-center justify-between gap-2"><span className="muted text-sm">Added by {v.by}</span>
            {staff && (role === 'admin' || v.by === s.me.name) && <button className="btn ghost min-h-[44px] text-sm" onClick={() => { if (confirm(`Remove "${v.title}" from the library? (It stays on YouTube.)`)) del('videos', v.id); }}>Remove</button>}</div>
        </li>))}</ul>
      {staff && <><H2>How to put a video on YouTube (free)</H2>
        <Card className="grid gap-2 text-sm">
          <ol className="list-decimal grid gap-1 pl-5">
            <li>Open the <b>YouTube</b> app with the club's Google account (so the videos belong to the club, not to one coach).</li>
            <li>Tap <b>+</b>, then <b>Create a video</b> or choose one you recorded. Any length is fine.</li>
            <li>Under visibility choose <b>Unlisted</b>: only people with the link can watch, and it never shows in searches.</li>
            <li>Upload. Then tap <b>Share</b>, <b>Copy link</b>, and paste it in <b>Add a video</b> here.</li>
          </ol>
          <p className="muted">YouTube is free and plays at a lower quality on weak signal, so families save data. It uses none of the club's storage. Film children only if their family agreed to photos and videos.</p>
        </Card></>}
    </Page>
  );
}

/** Coach: add a YouTube video to the library, for coaches only, one team, or the whole club. */
export function VideoNew() {
  const s = useAppState(); const nav = useNavigate(); const team = activeTeam(s);
  const [link, setLink] = useState(''); const id = youtubeId(link); const [title, setTitle] = useState(''); const [topic, setTopic] = useState<VideoTopic>('drills');
  const [audience, setAudience] = useState<VideoAudience>('team'); const [notes, setNotes] = useState('');
  const save = () => { put('videos', { id: uid(), title: title.trim(), youtubeId: id, audience, teamId: audience === 'team' ? team.id : undefined, topic, notes: notes.trim(), at: new Date().toISOString(), by: s.me.name }); nav('/videos', { replace: true }); };
  return (
    <Page title="Add a video" back={<Back to="/videos" />}>
      <Card className="grid gap-3">
        <label className="grid gap-1 text-sm font-semibold">YouTube link<input className="field" inputMode="url" placeholder="https://youtu.be/..." value={link} onChange={(e) => setLink(e.target.value)} /></label>
        {link.trim() && !id && <p className="text-sm text-red" role="alert">That is not a YouTube video link. In YouTube tap Share, then Copy link.</p>}
        {id && <YouTube id={id} />}
        <label className="grid gap-1 text-sm font-semibold">Title<input className="field" placeholder="For example: Our warm-up before every training" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="grid gap-1 text-sm font-semibold">Topic<select className="field" value={topic} onChange={(e) => setTopic(e.target.value as VideoTopic)}>{TOPICS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <div className="grid gap-1"><span className="text-sm font-semibold">Who can watch it in the app</span>
          <div className="grid gap-2" role="group" aria-label="Who can watch">{([['coaches', 'Coaches only'], ['team', `Players and families of ${team.name}`], ['club', 'Everyone in the club']] as [VideoAudience, string][]).map(([k, l]) =>
            <button key={k} className={`btn min-h-[48px] justify-start ${audience === k ? '' : 'ghost'}`} aria-pressed={audience === k} onClick={() => setAudience(k)}>{l}</button>)}</div></div>
        <label className="grid gap-1 text-sm font-semibold">Notes (optional)<textarea className="field py-3" rows={3} placeholder="What to watch for, how many times to practise..." value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        <WhoMayBeFilmed teamId={team.id} />
        <button className="btn h-14" disabled={!id || !title.trim()} onClick={save}>Save to the library</button>
        <p className="muted text-sm">Unlisted YouTube videos can be watched by anyone who has the link. Coaches only means the link is shown only to coaches in the app.</p>
      </Card>
    </Page>
  );
}
