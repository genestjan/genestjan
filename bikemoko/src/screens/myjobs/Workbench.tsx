import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, CheckCircle2, Circle, Pause, Play, Plus, X } from 'lucide-react';
import { db } from '@/data/db';
import { addJobPart, setJobStatus, toggleTimer, updateJob } from '@/data/actions';
import { useLiveQuery, useProducts } from '@/data/hooks';
import { JOB_STATUS, jobTotals, workedMins } from '@/domain/jobs';
import { minsLabel } from '@/domain/util';
import { Badge, Button, Card, Money, SearchBox, cx, run, toast } from '@/ui/kit';
import { fitWithin, pathToReady } from './helpers';
import { useTick } from './useTick';

async function downscale(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('Could not read that photo'));
      i.src = url;
    });
    const { w, h } = fitWithin(img.naturalWidth, img.naturalHeight, 1280);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d')!.drawImage(img, 0, 0, w, h);
    return c.toDataURL('image/jpeg', 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function Workbench({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const now = useTick(15_000);
  const job = useLiveQuery(() => db.workOrders.get(jobId), [jobId]);
  const customer = useLiveQuery(async () => (job ? db.customers.get(job.customerId) : undefined), [job?.customerId]);
  const bike = useLiveQuery(async () => (job?.bikeId ? db.bikes.get(job.bikeId) : undefined), [job?.bikeId]);
  const products = useProducts();
  const fileRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [partNote, setPartNote] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!job) return null;
  const totals = jobTotals(job.lines);
  const worked = workedMins(job, now);
  const running = !!job.timerSince;
  const closed = job.status === 'ready' || job.status === 'completed' || job.status === 'cancelled';
  const matches = q.trim()
    ? products.filter((p) => p.active && [p.name, p.sku, p.barcode].some((v) => v.toLowerCase().includes(q.trim().toLowerCase()))).slice(0, 8)
    : [];

  const onPhoto = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      const urls = await Promise.all(Array.from(files).map(downscale));
      await run(() => updateJob(job.id, { photos: [...job.photos, ...urls] }), 'Photo added');
    } catch (e) {
      toast.error(e);
    }
  };

  const toggleItem = (i: number) =>
    run(() => updateJob(job.id, { checklist: job.checklist.map((c, k) => (k === i ? { ...c, done: !c.done } : c)) }));

  const addPart = async (productId: string) => {
    const ok = await run(() => addJobPart(job.id, productId, 1).then(() => true), 'Part added');
    if (ok) {
      setPartNote(true);
      setQ('');
      setAdding(false);
    }
  };

  const markReady = async () => {
    setBusy(true);
    for (const to of pathToReady(job.status)) {
      const r = await run(() => setJobStatus(job.id, to).then(() => true));
      if (!r) break;
    }
    setBusy(false);
  };

  const doneCount = job.checklist.filter((c) => c.done).length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg" role="dialog" aria-label={`Job ${job.jobNo}`}>
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-bg px-4 py-3">
        <button onClick={onClose} aria-label="Close workbench" className="grid h-11 w-11 place-items-center rounded-xl bg-raised">
          <X size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="num truncate font-semibold">{job.jobNo} · {customer?.name ?? ''}</div>
          <div className="truncate text-xs text-muted">{bike ? `${bike.brand} ${bike.model}` : 'No bike'}</div>
        </div>
        <Badge tone={job.status === 'ready' ? 'ok' : 'brand'}>{JOB_STATUS[job.status].label}</Badge>
      </div>

      <div className="mx-auto max-w-xl space-y-4 p-4 pb-32">
        {job.complaint && (
          <Card>
            <div className="text-xs font-semibold uppercase text-muted">Complaint</div>
            <p className="mt-1">{job.complaint}</p>
          </Card>
        )}

        <Card className="space-y-3 text-center">
          <div className="num font-display text-5xl font-bold">{minsLabel(worked)}</div>
          <div className="text-sm text-muted">worked of {minsLabel(totals.durationMins)} estimated</div>
          <Button size="xl" className="w-full" variant={running ? 'secondary' : 'primary'} disabled={closed} onClick={() => run(() => toggleTimer(job.id))}>
            {running ? <><Pause size={22} /> Pause</> : <><Play size={22} /> Start</>}
          </Button>
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Checklist</div>
            <div className="num text-sm text-muted">{doneCount} of {job.checklist.length}</div>
          </div>
          {job.checklist.length === 0 && <div className="text-sm text-muted">No checklist on this job.</div>}
          {job.checklist.map((c, i) => (
            <button
              key={i}
              onClick={() => toggleItem(i)}
              aria-pressed={c.done}
              className={cx('flex min-h-[56px] w-full items-center gap-3 rounded-xl border px-3 text-left', c.done ? 'border-ok/40 bg-ok/10' : 'border-line bg-raised')}
            >
              {c.done ? <CheckCircle2 className="shrink-0 text-ok" size={26} /> : <Circle className="shrink-0 text-faint" size={26} />}
              <span className={cx('text-base', c.done && 'text-muted line-through')}>{c.label}</span>
            </button>
          ))}
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Intake photos</div>
            <Button size="md" variant="secondary" onClick={() => fileRef.current?.click()}>
              <Camera size={18} /> Take photo
            </Button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => { onPhoto(e.target.files); e.target.value = ''; }} />
          {job.photos.length === 0 ? (
            <div className="text-sm text-muted">No photos yet. Take a few before you start.</div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {job.photos.map((p, i) => (
                <img key={i} src={p} alt={`Intake ${i + 1}`} className="aspect-square w-full rounded-xl object-cover" />
              ))}
            </div>
          )}
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Parts</div>
            <Money value={totals.parts} strong />
          </div>
          {job.lines.filter((l) => l.kind === 'part').map((l) => (
            <div key={l.id} className="flex justify-between text-sm">
              <span>{l.qty} x {l.name}</span>
              <Money value={l.qty * l.unitPrice} />
            </div>
          ))}
          {adding ? (
            <div className="space-y-2">
              <SearchBox
                autoFocus
                value={q}
                placeholder="Search name, SKU or scan barcode"
                onChange={(e) => setQ(e.target.value)}
                onClear={() => setQ('')}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  const exact = products.find((p) => p.barcode && p.barcode === q.trim());
                  if (exact) addPart(exact.id);
                }}
              />
              {matches.map((p) => (
                <button key={p.id} onClick={() => addPart(p.id)} className="flex min-h-[52px] w-full items-center justify-between rounded-xl border border-line bg-raised px-3 text-left text-sm">
                  <span className="min-w-0 truncate">{p.name}</span>
                  <Money value={p.price} />
                </button>
              ))}
              {q.trim() && matches.length === 0 && <div className="text-sm text-muted">No parts match.</div>}
            </div>
          ) : (
            <Button variant="secondary" className="w-full" size="lg" disabled={closed} onClick={() => setAdding(true)}>
              <Plus size={18} /> Scan or add part
            </Button>
          )}
          {partNote && (
            <div className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm">
              The new total is <Money value={totals.total} strong />. The customer will need to re-approve the higher total before you carry on.
            </div>
          )}
        </Card>

        {job.status === 'ready' && (
          <Card className="space-y-3 border-ok/40">
            <div className="font-semibold text-ok">Marked ready</div>
            <p className="text-sm text-muted">Now let the customer know their bike can be collected.</p>
            <Link to={`/jobs/${job.id}`} className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-brand font-semibold text-brand-ink">
              Notify the customer
            </Link>
          </Card>
        )}
      </div>

      {job.status !== 'ready' && !closed && (
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-bg p-4">
          <div className="mx-auto max-w-xl">
            <Button size="xl" className="w-full" disabled={busy} onClick={markReady}>
              Mark ready and notify
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
