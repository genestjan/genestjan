import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Back, Card, Chip, Empty, H2, Page } from '../components/ui';
import { MediaPicker, MediaView } from '../components/MediaView';
import { CoachVideo, removeCoachVideo, useDrive, VideoPicker } from '../components/CoachVideo';
import { BoardView } from '../components/BoardView';
import { del, put, uid, useAppState } from '../lib/store';
import { useRole } from '../lib/role';
import { removeMedia } from '../lib/media';
import { drillClipPath, drillPhotoPath } from '../lib/mediaRules';
import { checkDrill, emptyDrill, MAX_DRILL_PHOTOS, THEMES } from '../lib/drills';
import { DRILLS, type Drill } from '../content/drills';
import type { CustomDrill, VideoRef } from '../lib/model';

export const isCustom = (d: Drill): d is CustomDrill => 'by' in d;
const EQUIP = ['ball', 'cones', 'bibs', 'goals'] as const;

/** Built-in and coaches' drills. Coaches' drills come first: what the club's own coaches use. */
export function Drills() {
  const s = useAppState(); const [theme, setTheme] = useState('all'); const [age, setAge] = useState(10); const [mine, setMine] = useState<'club' | 'built-in'>(s.drills.length ? 'club' : 'built-in');
  const fit = (d: Drill) => (theme === 'all' || d.theme === theme) && age >= d.minAge && age <= d.maxAge + 2 && !(d.heading && age < 12);
  const list: Drill[] = mine === 'club' ? [...s.drills].sort((a, b) => b.at.localeCompare(a.at)).filter(fit) : DRILLS.filter(fit);
  return (
    <Page title="Drills" back={<Back to="/train" />}>
      <Link to="/drills/new" className="btn mb-3 w-full"><Plus size={18} aria-hidden="true" />Create a drill</Link>
      <div className="mb-3 grid grid-cols-2 gap-2" role="group" aria-label="Which drills">
        <Chip on={mine === 'club'} onClick={() => setMine('club')}>Our coaches' drills ({s.drills.length})</Chip>
        <Chip on={mine === 'built-in'} onClick={() => setMine('built-in')}>Built-in drills</Chip>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2"><select className="field" aria-label="Theme" value={theme} onChange={(e) => setTheme(e.target.value)}><option value="all">All themes</option>{THEMES.concat('heading').map((t) => <option key={t}>{t}</option>)}</select><label className="flex items-center gap-2">Age<input type="number" className="field" min={6} max={16} value={age} onChange={(e) => setAge(+e.target.value)} /></label></div>
      {age < 12 && <p className="muted mb-2 text-sm">Heading drills are hidden below age 12.</p>}
      <ul className="grid gap-2">{list.map((d) => <li key={d.id}><Link to={`/drills/${d.id}`} className="card block p-3"><div className="text-xl font-semibold">{d.name}</div>
        <div className="muted text-sm">{d.theme} · ages {d.minAge}-{d.maxAge} · {d.minutes} min · {d.equipment.join(', ')}{isCustom(d) ? ` · by ${d.by}` : ''}{isCustom(d) && (d.video || d.photos.length) ? ' · has video or photos' : ''}</div></Link></li>)}</ul>
      {list.length === 0 && <Empty>{mine === 'club' ? (s.drills.length ? 'No coaches\' drills match.' : 'No drills from our coaches yet. Tap Create a drill to add the first one: the drills you run every week, so every coach can run them the same way.') : 'No drills match.'}</Empty>}
    </Page>
  );
}

/** What a coach reads on the touchline: the same for built-in and coaches' drills. */
export function DrillCard({ d }: { d: Drill }) {
  const s = useAppState(); const board = isCustom(d) && d.boardId ? s.strategies.find((x) => x.id === d.boardId) : undefined;
  return (
    <Card className="grid gap-2">
      <p className="muted text-sm">{d.theme} · ages {d.minAge}-{d.maxAge} · {d.area} · {d.minutes} min · {d.players[0]}-{d.players[1]} children · {d.equipment.join(', ') || 'no equipment'}</p>
      {isCustom(d) && d.video && <CoachVideo v={d.video} />}
      {board && <div className="grid gap-1"><p className="text-sm font-semibold">Board: {board.name}</p><BoardView doc={board.doc} /></div>}
      {d.setup && <p className="whitespace-pre-wrap"><b>Set up:</b> {d.setup}</p>}
      <p className="whitespace-pre-wrap"><b>How:</b> {d.how}</p>
      {d.points.some(Boolean) && <><p><b>Coaching points:</b></p><ul className="list-disc pl-5">{d.points.filter(Boolean).map((p) => <li key={p}>{p}</li>)}</ul></>}
      {d.easier && <p><b>Easier:</b> {d.easier}</p>}
      {d.harder && <p><b>Harder:</b> {d.harder}</p>}
      {isCustom(d) && d.photos.length > 0 && <div className="grid grid-cols-2 gap-2">{d.photos.map((p) => <MediaView key={p} path={p} />)}</div>}
      {isCustom(d) && <p className="muted text-sm">Made by {d.by}{d.updatedBy && d.updatedBy !== d.by ? `, changed by ${d.updatedBy}` : ''}</p>}
    </Card>
  );
}

export function DrillDetail() {
  const { id } = useParams(); const s = useAppState(); const role = useRole(); const nav = useNavigate(); const driveUrl = useDrive();
  const d: Drill | undefined = DRILLS.find((x) => x.id === id) ?? s.drills.find((x) => x.id === id); const [err, setErr] = useState('');
  if (!d) return <Page title="Drill" back={<Back to="/drills" />}><Empty>Not found. It may have been removed.</Empty></Page>;
  const canChange = isCustom(d) && (role === 'admin' || d.by === s.me.name);
  const remove = async () => {
    if (!isCustom(d) || !confirm(`Remove "${d.name}" for every coach? Its photos and video are removed too.`)) return;
    setErr(''); try { await removeCoachVideo(d.video, driveUrl); await removeMedia(d.photos).catch(() => undefined); del('drills', d.id); nav('/drills', { replace: true }); } catch (e) { setErr((e as Error).message); }
  };
  return (
    <Page title={d.name} back={<Back to="/drills" />}>
      <DrillCard d={d} />
      {canChange && <div className="mt-3 grid grid-cols-2 gap-2">
        <Link to={`/drills/${d.id}/edit`} className="btn ghost">Edit</Link>
        <button className="btn ghost" onClick={() => void remove()}>Remove</button>
      </div>}
      {err && <p role="alert" className="mt-2 text-red">{err}</p>}
      <Link to={`/drills/new?from=${d.id}`} className="btn ghost mt-3 w-full">Make my own version of this drill</Link>
      {isCustom(d) && !canChange && <p className="muted mt-2 text-sm">Only {d.by} or a club admin can change or remove this drill. Your own version copies the words, not the photos or video.</p>}
    </Page>
  );
}

/** Create or change a coach's drill: the usual drill parts, plus photos, a video and a saved board. */
export function DrillEditor() {
  const { id } = useParams(); const s = useAppState(); const nav = useNavigate(); const driveUrl = useDrive(); const [q] = useSearchParams();
  const from = q.get('from'); const existing = id ? s.drills.find((x) => x.id === id) : undefined;
  const [d, setD] = useState<CustomDrill>(() => existing ?? emptyDrill(uid(), s.me.name, [...DRILLS, ...s.drills].find((x) => x.id === from)));
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const set = (p: Partial<CustomDrill>) => setD((x) => ({ ...x, ...p }));
  // photos and a video added here but never saved are removed on leaving (they would use storage for nothing)
  const keep = useRef<{ saved: boolean; photos: string[]; video?: VideoRef; url: string }>({ saved: false, photos: [], url: '' }); keep.current.url = driveUrl;
  useEffect(() => () => { const k = keep.current; if (!k.saved) { void removeMedia(k.photos).catch(() => undefined); void removeCoachVideo(k.video, k.url).catch(() => undefined); } }, []);
  if (id && !existing) return <Page title="Drill" back={<Back to="/drills" />}><Empty>Not found.</Empty></Page>;
  const save = () => {
    const problem = checkDrill(d); if (problem) { setErr(problem); return; }
    keep.current.saved = true;
    put('drills', { ...d, name: d.name.trim(), at: existing ? d.at : new Date().toISOString(), updatedBy: existing ? s.me.name : undefined });
    nav(`/drills/${d.id}`, { replace: true });
  };
  const setVideo = (v: VideoRef | undefined) => {
    set({ video: v }); keep.current.video = v;
    if (!v && existing?.video) put('drills', { ...existing, video: undefined });   // its file is gone: the saved drill must not point at it
  };
  return (
    <Page title={existing ? 'Change the drill' : 'Create a drill'} back={<Back to={existing ? `/drills/${d.id}` : '/drills'} />}>
      <Card className="grid gap-3">
        <label className="grid gap-1 text-sm font-semibold">Name of the drill<input className="field" value={d.name} placeholder="For example: Rondo 4 v 1" onChange={(e) => set({ name: e.target.value })} /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-sm font-semibold">Theme<select className="field" value={d.theme} onChange={(e) => set({ theme: e.target.value })}>{THEMES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="grid gap-1 text-sm font-semibold">Minutes<input type="number" className="field" min={2} max={60} value={d.minutes} onChange={(e) => set({ minutes: +e.target.value })} /></label>
          <label className="grid gap-1 text-sm font-semibold">From age<input type="number" className="field" min={5} max={18} value={d.minAge} onChange={(e) => set({ minAge: +e.target.value })} /></label>
          <label className="grid gap-1 text-sm font-semibold">To age<input type="number" className="field" min={5} max={18} value={d.maxAge} onChange={(e) => set({ maxAge: +e.target.value })} /></label>
          <label className="grid gap-1 text-sm font-semibold">Fewest children<input type="number" className="field" min={1} max={40} value={d.players[0]} onChange={(e) => set({ players: [+e.target.value, d.players[1]] })} /></label>
          <label className="grid gap-1 text-sm font-semibold">Most children<input type="number" className="field" min={1} max={60} value={d.players[1]} onChange={(e) => set({ players: [d.players[0], +e.target.value] })} /></label>
        </div>
        <label className="grid gap-1 text-sm font-semibold">Space<input className="field" value={d.area} placeholder="For example: 20 x 20 m" onChange={(e) => set({ area: e.target.value })} /></label>
        <div><div className="mb-1 text-sm font-semibold">Equipment</div><div className="flex flex-wrap gap-2">{EQUIP.map((k) => <Chip key={k} on={d.equipment.includes(k)} onClick={() => set({ equipment: d.equipment.includes(k) ? d.equipment.filter((x) => x !== k) : [...d.equipment, k] })}>{k}</Chip>)}</div></div>
        <label className="flex items-center gap-3"><input type="checkbox" className="h-6 w-6" checked={!!d.heading} onChange={(e) => set({ heading: e.target.checked, minAge: e.target.checked ? Math.max(12, d.minAge) : d.minAge })} />This drill has heading the ball (only for age 12 and up)</label>
        <label className="grid gap-1 text-sm font-semibold">Set up<textarea className="field py-3" rows={2} value={d.setup} placeholder="Where the cones go, how many groups, who has a ball" onChange={(e) => set({ setup: e.target.value })} /></label>
        <label className="grid gap-1 text-sm font-semibold">How it works (instructions)<textarea className="field py-3" rows={5} value={d.how} placeholder="Step by step, what the children do" onChange={(e) => set({ how: e.target.value })} /></label>
        <div className="grid gap-2"><span className="text-sm font-semibold">Coaching points (what to look for)</span>
          {d.points.map((p, i) => <input key={i} className="field" aria-label={`Coaching point ${i + 1}`} value={p} onChange={(e) => set({ points: d.points.map((x, k) => (k === i ? e.target.value : x)) as CustomDrill['points'] })} />)}</div>
        <label className="grid gap-1 text-sm font-semibold">Make it easier<input className="field" value={d.easier} onChange={(e) => set({ easier: e.target.value })} /></label>
        <label className="grid gap-1 text-sm font-semibold">Make it harder<input className="field" value={d.harder} onChange={(e) => set({ harder: e.target.value })} /></label>
      </Card>
      <H2>Video</H2>
      <Card className="grid gap-2"><p className="muted text-sm">Show the drill being run, so other coaches can copy it. Film only children whose family agreed to videos.</p>
        <VideoPicker value={d.video} onChange={setVideo} onBusy={setBusy} clipPathFor={(p) => drillClipPath(d.id, uid(), p.ext)} /></Card>
      <H2>Photos</H2>
      <Card className="grid gap-2">
        {d.photos.length > 0 && <div className="grid grid-cols-2 gap-2">{d.photos.map((p) => <div key={p} className="grid gap-1"><MediaView path={p} /><button className="btn ghost min-h-[44px] text-sm" onClick={() => { if (!confirm('Remove this photo?')) return; void removeMedia([p]).catch(() => undefined); set({ photos: d.photos.filter((x) => x !== p) }); keep.current.photos = keep.current.photos.filter((x) => x !== p); if (existing?.photos.includes(p)) put('drills', { ...existing, photos: existing.photos.filter((x) => x !== p) }); }}>Remove</button></div>)}</div>}
        {d.photos.length < MAX_DRILL_PHOTOS ? <MediaPicker label="Add a photo (the set-up, or a drawing)" pathFor={() => drillPhotoPath(d.id, uid())} onSaved={(p) => { setD((x) => ({ ...x, photos: [...x.photos, p] })); keep.current.photos.push(p); }} ghost />
          : <p className="muted text-sm">Up to {MAX_DRILL_PHOTOS} photos.</p>}
      </Card>
      <H2>Tactics board (optional)</H2>
      <Card className="grid gap-2">
        {s.strategies.length ? <label className="grid gap-1 text-sm font-semibold">Show a saved board<select className="field" value={d.boardId ?? ''} onChange={(e) => set({ boardId: e.target.value || undefined })}><option value="">No board</option>{s.strategies.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          : <p className="muted text-sm">Draw it on the Tactics board and save it to the library first; then you can show it here.</p>}
      </Card>
      {err && <p role="alert" className="mt-3 text-red">{err}</p>}
      <button className="btn mt-4 h-14 w-full" disabled={busy} onClick={save}>{existing ? 'Save the changes' : 'Save the drill for all coaches'}</button>
    </Page>
  );
}
