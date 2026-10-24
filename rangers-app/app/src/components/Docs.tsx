import { Link } from 'react-router-dom';
import { MediaPicker, MediaView } from './MediaView';
import { put } from '../lib/store';
import { removeMedia } from '../lib/media';
import { DOC_IMAGE, DOC_LABEL, docPath, type DocKind } from '../lib/mediaRules';
import type { Emergency, Player } from '../lib/model';

export const DOC_KINDS: DocKind[] = ['studentId', 'birthCert'];
const blank = (): Emergency => ({ contacts: [{ name: '', phone: '' }], allergies: '', inhaler: false, note: '' });
export const docsMissingFor = (p: Player) => DOC_KINDS.filter((k) => !p.emergency?.docs?.[k]);

/** Red reminder on the family's home screen until both photos are in. */
export function DocsReminder({ p }: { p: Player }) {
  const m = docsMissingFor(p); if (m.length === 0) return null;
  return (
    <Link to={`/docs/${p.id}`} data-tour="docs-reminder" className="card block border-2 p-4" style={{ borderColor: 'var(--red, #C31E24)' }}>
      <div className="text-xl font-semibold text-red">Required: {p.firstName}'s ID papers</div>
      <div>Please add a photo of {m.map((k) => DOC_LABEL[k]).join(' and ')}. Tournament organisers ask the coach to show them. Tap to add.</div>
    </Link>
  );
}

/** Take or choose a photo of each paper. Replacing a photo overwrites the old file. */
export function DocsEditor({ p }: { p: Player }) {
  const em = p.emergency ?? blank();
  const saved = (k: DocKind, path: string) => put('players', { ...p, emergency: { ...em, docs: { ...em.docs, [k]: { path, at: new Date().toISOString() } } } });
  return (
    <div className="grid gap-3">
      {DOC_KINDS.map((k) => { const d = em.docs?.[k]; return (
        <div key={k} className="card grid gap-2 p-4" data-tour={`doc-${k}`}>
          <div className="flex items-center justify-between gap-2"><div className="text-lg font-semibold">{DOC_LABEL[k]}</div><span className={`text-sm ${d ? 'font-semibold' : 'text-red'}`}>{d ? 'Added' : 'Needed'}</span></div>
          {k === 'studentId' && <p className="muted text-sm">The school ID card, front side, with the photo and name readable.</p>}
          {k === 'birthCert' && <p className="muted text-sm">Lay the whole certificate flat in good light, and make sure every word is readable.</p>}
          {d && <MediaView path={d.path} version={d.at} />}
          <MediaPicker label={d ? 'Replace this photo' : 'Take or choose a photo'} ghost={!!d} quality={DOC_IMAGE} pathFor={() => docPath(p.id, k)} onSaved={(path) => saved(k, path)} />
        </div>); })}
      <p className="muted text-sm">Only {p.firstName}'s coaches and family can see these. They are deleted when {p.firstName} leaves the club.</p>
    </div>
  );
}

/** When a child leaves the club, the ID photos go too. Best effort: the record is cleared either way. */
export async function removeDocs(p: Player): Promise<Player> {
  const paths = DOC_KINDS.map((k) => p.emergency?.docs?.[k]?.path).filter((x): x is string => !!x);
  await removeMedia(paths).catch(() => undefined);
  return p.emergency ? { ...p, emergency: { ...p.emergency, docs: {} } } : p;
}
