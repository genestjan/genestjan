import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, Check, Pause, Play, Plus, Receipt, X } from 'lucide-react';
import { db } from '@/data/db';
import { addJobPart, setJobStatus, toggleTimer, updateJob } from '@/data/actions';
import { byId, useLiveQuery, useProducts, useStaff, useStockMap } from '@/data/hooks';
import { JOB_STATUS, NEXT_STATUS, jobTotals, workedMins } from '@/domain/jobs';
import { available } from '@/domain/stock';
import { minsLabel } from '@/domain/util';
import type { JobStatus, NotifyTrigger } from '@/domain/types';
import { Badge, Button, Card, Empty, Field, Modal, Money, PageHeader, SearchBox, Section, Stat, Stepper, Textarea, cx, run, toast } from '@/ui/kit';
import { FLOW, JOB_TONE, bikeLabel, flowIndex, isOverdue, matchProduct, promptTrigger } from './helpers';
import { Confirm, MechAvatar, useNow } from './parts';
import { NotifyModal, NotifyPanel } from './NotifyPanel';
import { downscaleToDataUrl } from './photo';

export default function JobDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const job = useLiveQuery(async () => (await db.workOrders.get(id)) ?? null, [id]);
  const customer = useLiveQuery(async () => (job ? await db.customers.get(job.customerId) : undefined), [job?.customerId]);
  const bike = useLiveQuery(async () => (job?.bikeId ? await db.bikes.get(job.bikeId) : undefined), [job?.bikeId]);
  const staff = useStaff();
  const now = useNow(10_000);
  const [notify, setNotify] = useState<NotifyTrigger | null>(null);
  const [cancel, setCancel] = useState(false);
  const [addPart, setAddPart] = useState(false);
  const [photoDel, setPhotoDel] = useState<number | null>(null);
  const [busyPhoto, setBusyPhoto] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [notes, setNotes] = useState('');
  const [complaint, setComplaint] = useState('');
  const jobId = job?.id;
  useEffect(() => {
    if (!job) return;
    setNotes(job.intakeNotes);
    setComplaint(job.complaint);
    // Only reset when a different job opens; edits save on blur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  if (job === undefined) return <PageHeader title="Job" sub="Loading" />;
  if (job === null) return <Empty title="Job not found" action={<Link to="/repairs" className="text-brand">Back to repairs</Link>} />;

  const mech = byId(staff).get(job.mechanicId ?? '');
  const totals = jobTotals(job.lines);
  const worked = workedMins(job, now);
  const planned = totals.durationMins || Math.round((new Date(job.scheduledEnd).getTime() - new Date(job.scheduledStart).getTime()) / 60_000);
  const pct = Math.min(100, Math.round((worked / Math.max(1, planned)) * 100));
  const over = worked > planned;
  const closed = job.status === 'completed' || job.status === 'cancelled';
  const idx = flowIndex(job.status);
  const late = isOverdue(job, now);
  const balance = Math.max(0, totals.total - job.deposit);

  const move = async (to: JobStatus) => {
    const r = await run(() => setJobStatus(job.id, to), `Now ${JOB_STATUS[to].label.toLowerCase()}`);
    const t = promptTrigger(to);
    if (r !== undefined && t) setNotify(t);
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusyPhoto(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files)) urls.push(await downscaleToDataUrl(f));
      await updateJob(job.id, { photos: [...job.photos, ...urls] });
      toast.ok(urls.length > 1 ? 'Photos added' : 'Photo added');
    } catch (e) {
      toast.error(e);
    } finally {
      setBusyPhoto(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const nexts = NEXT_STATUS[job.status].filter((s) => s !== 'completed'); // completing goes through billing

  return (
    <div>
      <PageHeader
        title={job.jobNo}
        sub={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{customer?.name ?? 'Customer'}</span>
            <span>{bikeLabel(bike)}</span>
            <span className="flex items-center gap-1.5">
              <MechAvatar staff={mech} size={20} />
              {mech?.name ?? 'No mechanic'}
            </span>
            <span>{job.bay}</span>
            <span className="num">{new Date(job.scheduledStart).toLocaleString('en-PH', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
          </span>
        }
        actions={
          <>
            <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => nav('/repairs')}>
              Back
            </Button>
            {late && <Badge tone="bad">Overdue</Badge>}
            <Badge tone={JOB_TONE[job.status]} dot>
              {JOB_STATUS[job.status].label}
            </Badge>
          </>
        }
      />

      <Card className="mb-4">
        <ol className="mb-4 flex gap-1 overflow-x-auto pb-1">
          {FLOW.map((s, i) => {
            const done = job.status !== 'cancelled' && i < idx;
            const cur = job.status !== 'cancelled' && i === idx;
            return (
              <li key={s} className={cx('flex min-w-[88px] flex-1 flex-col items-center gap-1 text-center text-xs', cur ? 'font-bold text-brand' : done ? 'text-ok' : 'text-faint')}>
                <span className={cx('grid h-7 w-7 place-items-center rounded-full border text-[11px]', cur ? 'border-brand bg-brand-soft' : done ? 'border-ok/50 bg-ok/10' : 'border-line')}>{done ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
                {JOB_STATUS[s].label}
                {cur && job.status === 'waiting_parts' && <Badge tone="warn">Waiting for parts</Badge>}
              </li>
            );
          })}
        </ol>
        {job.status === 'cancelled' && <p className="mb-3 text-sm text-bad">This job was cancelled.</p>}
        <div className="flex flex-wrap gap-2">
          {nexts.map((s) => (
            <Button key={s} size="lg" variant={s === 'cancelled' ? 'danger' : nexts[0] === s ? 'primary' : 'secondary'} onClick={() => (s === 'cancelled' ? setCancel(true) : move(s))}>
              {s === 'cancelled' ? 'Cancel job' : `Move to ${JOB_STATUS[s].label.toLowerCase()}`}
            </Button>
          ))}
          {job.status === 'ready' && (
            <Link to="/pos">
              <Button size="lg" variant="primary" icon={<Receipt className="h-4 w-4" />}>
                Go to billing
              </Button>
            </Link>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid content-start gap-4">
          <Section title="Timer">
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className={cx('num font-display text-3xl font-bold', over && 'text-bad')}>{minsLabel(worked)}</div>
                  <div className="text-sm text-muted">worked of {minsLabel(planned)} estimated</div>
                </div>
                <Button
                  size="lg"
                  variant={job.timerSince ? 'secondary' : 'primary'}
                  disabled={closed || job.status === 'ready'}
                  icon={job.timerSince ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  onClick={() => run(() => toggleTimer(job.id))}
                >
                  {job.timerSince ? 'Pause timer' : 'Start timer'}
                </Button>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
                <div className={cx('h-full rounded-full', over ? 'bg-bad' : 'bg-brand')} style={{ width: `${pct}%` }} />
              </div>
              {job.timerSince && (
                <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-ok">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-ok" />
                  Timer running
                </div>
              )}
            </Card>
          </Section>

          <Section title="Checklist">
            <Card>
              {job.checklist.length ? (
                <ul className="grid gap-1">
                  {job.checklist.map((c, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        disabled={closed}
                        onClick={() => run(() => updateJob(job.id, { checklist: job.checklist.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) }))}
                        className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-2 text-left text-sm hover:bg-raised"
                      >
                        <span className={cx('grid h-6 w-6 shrink-0 place-items-center rounded-md border', c.done ? 'border-ok bg-ok text-white' : 'border-line')}>{c.done && <Check className="h-4 w-4" />}</span>
                        <span className={cx(c.done && 'text-faint line-through')}>{c.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No checklist for this job.</p>
              )}
            </Card>
          </Section>

          <Section title="Notes">
            <Card className="grid gap-3">
              <Field label="Complaint">
                <Textarea value={complaint} disabled={closed} onChange={(e) => setComplaint(e.target.value)} onBlur={() => complaint !== job.complaint && run(() => updateJob(job.id, { complaint }))} />
              </Field>
              <Field label="Intake notes">
                <Textarea value={notes} disabled={closed} placeholder="Scratches, missing parts, what the customer left" onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== job.intakeNotes && run(() => updateJob(job.id, { intakeNotes: notes }))} />
              </Field>
            </Card>
          </Section>

          <Section
            title="Intake photos"
            action={
              <Button size="sm" loading={busyPhoto} disabled={closed} icon={<Camera className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>
                Add photo
              </Button>
            }
          >
            <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} />
            {job.photos.length ? (
              <div className="grid grid-cols-3 gap-2">
                {job.photos.map((p, i) => (
                  <div key={i} className="relative overflow-hidden rounded-xl border border-line">
                    <img src={p} alt={`Intake ${i + 1}`} className="aspect-square w-full object-cover" />
                    {!closed && (
                      <button type="button" aria-label="Remove photo" className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white" onClick={() => setPhotoDel(i)}>
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <Empty icon={<Camera className="h-5 w-5" />} title="No photos yet" sub="Take a few shots of the bike as it came in." />
            )}
          </Section>
        </div>

        <div className="grid content-start gap-4">
          <Section title="Lines" action={<Button size="sm" disabled={closed} icon={<Plus className="h-4 w-4" />} onClick={() => setAddPart(true)}>Add part</Button>}>
            <Card pad={false}>
              {job.lines.length ? (
                <ul>
                  {job.lines.map((l) => (
                    <li key={l.id} className="flex items-start justify-between gap-3 border-b border-line/70 px-4 py-3 last:border-0">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{l.name}</div>
                        <div className="num text-xs text-muted">
                          {l.qty} x <Money value={l.unitPrice} /> {l.kind === 'labor' ? '(labour)' : ''}
                        </div>
                        {l.short && <Badge tone="warn" className="mt-1">Waiting for part</Badge>}
                      </div>
                      <Money value={l.qty * l.unitPrice} strong />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-4 text-sm text-muted">No lines yet. Add a part to get started.</div>
              )}
            </Card>
          </Section>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Parts" value={<Money value={totals.parts} />} />
            <Stat label="Labour" value={<Money value={totals.labor} />} />
            <Stat label="Total" value={<Money value={totals.total} />} tone="brand" />
            <Stat label="Deposit" value={<Money value={job.deposit} />} />
            <Stat label="Balance due" value={<Money value={balance} />} tone={balance ? 'warn' : 'ok'} />
          </div>

          <Section title="Messages">
            <Card>
              <NotifyPanel workOrderId={job.id} customerId={job.customerId} />
            </Card>
          </Section>
        </div>
      </div>

      <Confirm open={cancel} title="Cancel this job?" confirmLabel="Cancel job" onClose={() => setCancel(false)} onConfirm={() => move('cancelled')}>
        Reserved parts go back on the shelf. This cannot be undone.
      </Confirm>
      <Confirm open={photoDel !== null} title="Remove this photo?" confirmLabel="Remove" onClose={() => setPhotoDel(null)} onConfirm={() => photoDel !== null && run(() => updateJob(job.id, { photos: job.photos.filter((_, i) => i !== photoDel) }))}>
        The photo will be deleted from this job.
      </Confirm>
      <AddPart open={addPart} onClose={() => setAddPart(false)} jobId={job.id} />
      {notify && <NotifyModal open onClose={() => setNotify(null)} workOrderId={job.id} customerId={job.customerId} trigger={notify} />}
    </div>
  );
}

function AddPart({ open, onClose, jobId }: { open: boolean; onClose: () => void; jobId: string }) {
  const products = useProducts();
  const stock = useStockMap();
  const [q, setQ] = useState('');
  const [qty, setQty] = useState(1);
  const list = products.filter((p) => matchProduct(p, q)).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 30);
  return (
    <Modal open={open} onClose={onClose} title="Add part">
      <div className="grid gap-3">
        <SearchBox value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ('')} placeholder="Search parts" autoFocus />
        <div className="flex items-center gap-3 text-sm text-muted">
          Quantity <Stepper value={qty} min={1} onChange={setQty} />
        </div>
        <div className="grid max-h-[340px] gap-2 overflow-y-auto">
          {list.map((p) => {
            const av = available(stock.get(p.id, 'STORE'));
            return (
              <button
                key={p.id}
                type="button"
                onClick={async () => {
                  const r = await run(() => addJobPart(jobId, p.id, qty), `${p.name} added`);
                  if (r !== undefined) onClose();
                }}
                className="flex min-h-[52px] items-center justify-between gap-3 rounded-xl border border-line bg-raised px-3.5 py-2 text-left hover:border-brand/50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{p.name}</span>
                  <span className={cx('num text-xs', av > 0 ? 'text-ok' : 'text-warn')}>{av > 0 ? `${av} in store` : 'Out of stock in store'}</span>
                </span>
                <Money value={p.price} strong />
              </button>
            );
          })}
          {!list.length && <Empty title="No parts found" />}
        </div>
      </div>
    </Modal>
  );
}
