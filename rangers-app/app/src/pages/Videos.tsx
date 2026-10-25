import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Back, Card, Empty, H2, Page, Segmented } from '../components/ui';
import { CoachVideo, removeCoachVideo, useDrive, VideoPicker } from '../components/CoachVideo';
import { WhoMayBeFilmed } from '../components/Clip';
import { activeTeam, del, put, uid, useAppState } from '../lib/store';
import { isStaff, useMyChildren, useRole } from '../lib/role';
import { fmtDate } from '../lib/util';
import { accessToken, cloudEnabled, useCloud, videoSpace } from '../lib/cloud';
import { driveSpace, scriptSender } from '../lib/drive';
import type { ClubVideo, VideoAudience, VideoRef, VideoTopic } from '../lib/model';

export const TOPICS: [VideoTopic, string][] = [['how-we-work', 'How we do things'], ['warm-up', 'Warm-up'], ['ball-skills', 'Ball skills'], ['drills', 'Drills'], ['goalkeeping', 'Goalkeeping'], ['fitness', 'Fitness at home'], ['match-day', 'Match day'], ['safety', 'Safety']];
const refOf = (v: ClubVideo): VideoRef => (v.driveId ? { drive: v.driveId } : { youtube: v.youtubeId });
const topicName = (t: VideoTopic) => TOPICS.find(([k]) => k === t)?.[1] ?? 'Video';

/** Which library videos a person sees: coaches see everything (coaches-only ones on their own tab); families see their child's team and the whole club. */
export function useVisibleVideos() {
  const s = useAppState(); const staff = isStaff(useRole()); const kids = useMyChildren();
  const teams = new Set(kids.map((k) => k.teamId));
  return s.videos.filter((v) => staff || (v.audience === 'club' || (v.audience === 'team' && v.teamId && teams.has(v.teamId)))).sort((a, b) => b.at.localeCompare(a.at));
}

/** Coaches see how full the club's space for short in-app videos is. When it is full, new ones are refused; nothing is deleted. */
function VideoSpace() {
  const c = useCloud(); const driveUrl = useDrive(); const [sp, setSp] = useState<{ used: number; room: number } | null>(null); const [gd, setGd] = useState<number | null>(null);
  useEffect(() => { if (cloudEnabled && c.status === 'ready' && navigator.onLine) void videoSpace().then(setSp).catch(() => undefined); }, [c.status]);
  useEffect(() => { if (driveUrl && navigator.onLine) void accessToken().then((t) => driveSpace(scriptSender(driveUrl), t)).then((x) => setGd(x?.free ?? null)).catch(() => undefined); }, [driveUrl]);
  if (!sp && gd === null) return null; const mb = (n: number) => Math.round(n / 1048576);
  return <p className="muted mb-3 text-sm">{gd !== null && <>The club's Google Drive has {(gd / 1073741824).toFixed(1)} GB free for uploaded videos. </>}{sp && <>Short videos in the app use {mb(sp.used)} MB of {mb(sp.used + sp.room)} MB.{sp.room <= 0 ? ' It is full: new short videos are refused until some are removed.' : ''}</>}</p>;
}

/** The club's video library: how-to and "how we do things" videos on YouTube (free, any length), shown inside the app. */
export function VideoLibrary() {
  const s = useAppState(); const role = useRole(); const staff = isStaff(role); const all = useVisibleVideos();
  const [tab, setTab] = useState<'players' | 'coaches'>('players'); const [topic, setTopic] = useState<VideoTopic | ''>(''); const [err, setErr] = useState(''); const driveUrl = useDrive();
  const list = all.filter((v) => (staff ? (tab === 'coaches' ? v.audience === 'coaches' : v.audience !== 'coaches') : true) && (!topic || v.topic === topic));
  const used = new Set(all.filter((v) => !staff || (tab === 'coaches') === (v.audience === 'coaches')).map((v) => v.topic));
  const removeIt = async (v: ClubVideo) => {
    if (!confirm(v.driveId ? `Remove "${v.title}"? The video goes to the club Google Drive's bin (kept there 30 days).` : `Remove "${v.title}" from the library? (It stays on YouTube.)`)) return;
    setErr(''); try { if (v.driveId) await removeCoachVideo({ drive: v.driveId }, driveUrl); del('videos', v.id); } catch (e) { setErr((e as Error).message); }
  };
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
      {err && <p role="alert" className="mb-3 text-red">{err}</p>}
      <ul className="grid gap-3">{list.map((v) => (
        <li key={v.id} className="card grid gap-2 p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm"><span className="rounded-full bg-gold px-2.5 py-0.5 font-bold text-ink">{topicName(v.topic)}</span><span className="muted">{who(v)}</span><span className="muted ml-auto">{fmtDate(v.at)}</span></div>
          <p className="text-lg font-bold">{v.title}</p>
          {v.notes && <p className="whitespace-pre-wrap">{v.notes}</p>}
          <CoachVideo v={refOf(v)} />
          <div className="flex items-center justify-between gap-2"><span className="muted text-sm">Added by {v.by}</span>
            {staff && (role === 'admin' || v.by === s.me.name) && <button className="btn ghost min-h-[44px] text-sm" onClick={() => void removeIt(v)}>Remove</button>}</div>
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

/** Coach: add a video to the library (uploaded here to the club's Google Drive, or a YouTube link), for coaches only, one team, or the whole club. */
export function VideoNew() {
  const s = useAppState(); const nav = useNavigate(); const team = activeTeam(s); const driveUrl = useDrive();
  const [vid, setVid] = useState<VideoRef | undefined>(); const [busy, setBusy] = useState(false); const [title, setTitle] = useState(''); const [topic, setTopic] = useState<VideoTopic>('drills');
  const [audience, setAudience] = useState<VideoAudience>('team'); const [notes, setNotes] = useState('');
  // a video uploaded but never saved is removed on leaving, so it does not fill the club's Drive
  const keep = useRef<{ v?: VideoRef; saved: boolean; url: string }>({ saved: false, url: '' }); keep.current = { ...keep.current, v: vid, url: driveUrl };
  useEffect(() => () => { const k = keep.current; if (!k.saved && k.v?.drive) void removeCoachVideo(k.v, k.url).catch(() => undefined); }, []);
  const save = () => {
    if (!vid) return; keep.current.saved = true;
    put('videos', { id: uid(), title: title.trim(), youtubeId: vid.youtube ?? '', driveId: vid.drive, audience, teamId: audience === 'team' ? team.id : undefined, topic, notes: notes.trim(), at: new Date().toISOString(), by: s.me.name });
    nav('/videos', { replace: true });
  };
  return (
    <Page title="Add a video" back={<Back to="/videos" />}>
      <Card className="grid gap-3">
        <VideoPicker value={vid} onChange={setVid} onBusy={setBusy} />
        <label className="grid gap-1 text-sm font-semibold">Title<input className="field" placeholder="For example: Our warm-up before every training" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="grid gap-1 text-sm font-semibold">Topic<select className="field" value={topic} onChange={(e) => setTopic(e.target.value as VideoTopic)}>{TOPICS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <div className="grid gap-1"><span className="text-sm font-semibold">Who can watch it in the app</span>
          <div className="grid gap-2" role="group" aria-label="Who can watch">{([['coaches', 'Coaches only'], ['team', `Players and families of ${team.name}`], ['club', 'Everyone in the club']] as [VideoAudience, string][]).map(([k, l]) =>
            <button key={k} className={`btn min-h-[48px] justify-start ${audience === k ? '' : 'ghost'}`} aria-pressed={audience === k} onClick={() => setAudience(k)}>{l}</button>)}</div></div>
        <label className="grid gap-1 text-sm font-semibold">Notes (optional)<textarea className="field py-3" rows={3} placeholder="What to watch for, how many times to practise..." value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        <WhoMayBeFilmed teamId={team.id} />
        <button className="btn h-14" disabled={!vid || busy || !title.trim()} onClick={save}>Save to the library</button>
        <p className="muted text-sm">Anyone who has a video's link can watch it, like an unlisted YouTube video. The app shows the link only to the people you choose above.</p>
      </Card>
    </Page>
  );
}
