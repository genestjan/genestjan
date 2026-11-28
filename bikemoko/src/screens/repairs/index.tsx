import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Clock, FilePlus2, Footprints, Wrench } from 'lucide-react';
import { db } from '@/data/db';
import { createJob, setJobStatus } from '@/data/actions';
import { byId, useLiveQuery, useStaff } from '@/data/hooks';
import { JOB_STATUS, NEXT_STATUS, jobTotals } from '@/domain/jobs';
import type { Estimate, EstimateStatus, JobStatus, NotifyTrigger, WorkOrder } from '@/domain/types';
import { Badge, Button, Card, Empty, Field, Input, Modal, Money, PageHeader, Segmented, Table, Textarea, cx, run, type Tone } from '@/ui/kit';
import { minsLabel } from '@/domain/util';
import { BOARD_COLUMNS, JOB_TONE, addMinsISO, bikeLabel, fromLocalInput, isOverdue, nextHalfHour, promptTrigger, toLocalInput } from './helpers';
import { Confirm, CustomerBikePicker, MechAvatar, ScheduleFields, useNow, type ScheduleValue } from './parts';
import { NotifyModal } from './NotifyPanel';

const EST_TONE: Record<EstimateStatus, Tone> = { draft: 'neutral', sent: 'info', approved: 'ok', declined: 'bad', converted: 'brand' };
const EST_LABEL: Record<EstimateStatus, string> = { draft: 'Draft', sent: 'Sent', approved: 'Approved', declined: 'Declined', converted: 'Booked as job' };

export default function Repairs() {
  const nav = useNavigate();
  const [tab, setTab] = useState<'jobs' | 'estimates'>('jobs');
  const [walkIn, setWalkIn] = useState(false);

  return (
    <div>
      <PageHeader
        title="Repairs"
        sub="Estimates, job orders and customer updates"
        icon={<Wrench className="h-5 w-5" />}
        actions={
          <>
            <Button icon={<Footprints className="h-4 w-4" />} onClick={() => setWalkIn(true)}>
              Walk-in job
            </Button>
            <Button variant="primary" icon={<FilePlus2 className="h-4 w-4" />} onClick={() => nav('/repairs/estimate/new')}>
              New estimate
            </Button>
          </>
        }
      />
      <Segmented
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'jobs', label: 'Jobs board' },
          { value: 'estimates', label: 'Estimates' },
        ]}
      />
      {tab === 'jobs' ? <Board /> : <Estimates />}
      <WalkIn open={walkIn} onClose={() => setWalkIn(false)} />
    </div>
  );
}

// ---------- Jobs board ----------

function Board() {
  const nav = useNavigate();
  const now = useNow();
  const jobs = useLiveQuery(() => db.workOrders.toArray(), [], [] as WorkOrder[]);
  const customers = useLiveQuery(() => db.customers.toArray(), [], []);
  const bikes = useLiveQuery(() => db.bikes.toArray(), [], []);
  const staff = useStaff();
  const cMap = useMemo(() => byId(customers), [customers]);
  const bMap = useMemo(() => byId(bikes), [bikes]);
  const sMap = useMemo(() => byId(staff), [staff]);
  const [notify, setNotify] = useState<{ job: WorkOrder; trigger: NotifyTrigger } | null>(null);
  const [cancel, setCancel] = useState<WorkOrder | null>(null);

  const move = async (j: WorkOrder, to: JobStatus) => {
    const ok = await run(() => setJobStatus(j.id, to), `${j.jobNo} is now ${JOB_STATUS[to].label.toLowerCase()}`);
    const t = promptTrigger(to);
    if (ok !== undefined && t) setNotify({ job: j, trigger: t });
  };

  const open = jobs.filter((j) => BOARD_COLUMNS.includes(j.status));
  if (!open.length) {
    return <Empty icon={<Wrench className="h-5 w-5" />} title="No jobs on the board" sub="Start with an estimate or a walk-in job." />;
  }

  return (
    <>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 md:mx-0 md:px-0">
        {BOARD_COLUMNS.map((col) => {
          const list = open.filter((j) => j.status === col).sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));
          return (
            <section key={col} className="w-[280px] shrink-0 snap-start md:w-[300px]">
              <div className="mb-2 flex items-center justify-between px-1">
                <Badge tone={JOB_TONE[col]} dot>
                  {JOB_STATUS[col].label}
                </Badge>
                <span className="num text-xs text-faint">{list.length}</span>
              </div>
              <div className="grid gap-2.5">
                {list.map((j) => {
                  const late = isOverdue(j, now);
                  const mech = j.mechanicId ? sMap.get(j.mechanicId) : null;
                  return (
                    <Card key={j.id} pad={false} className={cx('p-3.5', late && 'border-bad/50 bg-bad/5')}>
                      <button type="button" className="block w-full text-left" onClick={() => nav(`/jobs/${j.id}`)}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="num text-sm font-bold">{j.jobNo}</span>
                          <span className="flex items-center gap-2">
                            {j.timerSince && (
                              <span className="flex items-center gap-1 text-xs font-semibold text-ok" title="Timer running">
                                <span className="h-2 w-2 animate-pulse rounded-full bg-ok" />
                                Timing
                              </span>
                            )}
                            <MechAvatar staff={mech} />
                          </span>
                        </div>
                        <div className="mt-1 text-sm font-medium">{cMap.get(j.customerId)?.name ?? 'Customer'}</div>
                        <div className="text-xs text-muted">{bikeLabel(j.bikeId ? bMap.get(j.bikeId) : null)}</div>
                        <div className="mt-2 flex items-center justify-between text-xs text-muted">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            <span className="num">{new Date(j.scheduledStart).toLocaleString('en-PH', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
                          </span>
                          <span>{j.bay}</span>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between">
                          {late ? <Badge tone="bad">Overdue</Badge> : <span />}
                          <Money value={jobTotals(j.lines).total} strong />
                        </div>
                      </button>
                      {NEXT_STATUS[j.status].filter((s) => s !== 'completed').length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-line pt-2.5">
                          {NEXT_STATUS[j.status]
                            .filter((s) => s !== 'completed')
                            .map((s) => (
                              <Button
                                key={s}
                                size="sm"
                                variant={s === 'cancelled' ? 'danger' : 'secondary'}
                                className="min-h-[44px] md:min-h-0"
                                icon={s === 'cancelled' ? undefined : <ArrowRight className="h-3.5 w-3.5" />}
                                onClick={() => (s === 'cancelled' ? setCancel(j) : move(j, s))}
                              >
                                {s === 'cancelled' ? 'Cancel' : JOB_STATUS[s].label}
                              </Button>
                            ))}
                        </div>
                      )}
                    </Card>
                  );
                })}
                {!list.length && <div className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-faint">Nothing here</div>}
              </div>
            </section>
          );
        })}
      </div>
      <Confirm open={!!cancel} title="Cancel this job?" confirmLabel="Cancel job" onClose={() => setCancel(null)} onConfirm={() => cancel && move(cancel, 'cancelled')}>
        {cancel?.jobNo} will be cancelled and its reserved parts go back on the shelf.
      </Confirm>
      {notify && <NotifyModal open onClose={() => setNotify(null)} workOrderId={notify.job.id} customerId={notify.job.customerId} trigger={notify.trigger} />}
    </>
  );
}

// ---------- Estimates ----------

function Estimates() {
  const nav = useNavigate();
  const ests = useLiveQuery(() => db.estimates.toArray(), [], [] as Estimate[]);
  const customers = useLiveQuery(() => db.customers.toArray(), [], []);
  const bikes = useLiveQuery(() => db.bikes.toArray(), [], []);
  const cMap = byId(customers);
  const bMap = byId(bikes);
  const rows = [...ests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <Table
      rows={rows}
      rowKey={(e) => e.id}
      onRow={(e) => nav(`/repairs/estimate/${e.id}`)}
      empty={<Empty icon={<FilePlus2 className="h-5 w-5" />} title="No estimates yet" sub="Quote a repair before the bike goes on the stand." action={<Button variant="primary" onClick={() => nav('/repairs/estimate/new')}>New estimate</Button>} />}
      cols={[
        { key: 'no', label: 'Estimate', cell: (e) => <span className="num font-semibold">{e.estNo}</span> },
        { key: 'c', label: 'Customer', cell: (e) => cMap.get(e.customerId)?.name ?? '-' },
        { key: 'b', label: 'Bike', cell: (e) => bikeLabel(e.bikeId ? bMap.get(e.bikeId) : null) },
        { key: 't', label: 'Total', align: 'right', cell: (e) => <Money value={jobTotals(e.lines).total} strong /> },
        { key: 'd', label: 'Duration', align: 'right', cell: (e) => minsLabel(jobTotals(e.lines).durationMins) },
        { key: 's', label: 'Status', cell: (e) => <Badge tone={EST_TONE[e.status]}>{EST_LABEL[e.status]}</Badge> },
      ]}
    />
  );
}

// ---------- Walk-in ----------

function WalkIn({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate();
  const mechanics = useStaff().filter((s) => s.role === 'mechanic' && s.active);
  const [who, setWho] = useState<{ customerId: string; bikeId: string | null }>({ customerId: '', bikeId: null });
  const [sched, setSched] = useState<ScheduleValue>(() => ({ mechanicId: '', bay: 'Bay 1', start: toLocalInput(nextHalfHour()) }));
  const [mins, setMins] = useState('60');
  const [complaint, setComplaint] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!who.customerId) throw new Error('Choose a customer');
    const mechanicId = sched.mechanicId || mechanics[0]?.id || null;
    const start = fromLocalInput(sched.start);
    const wo = await createJob({
      estimateId: null,
      customerId: who.customerId,
      bikeId: who.bikeId,
      mechanicId,
      bay: sched.bay,
      scheduledStart: start,
      scheduledEnd: addMinsISO(start, Math.max(15, Number(mins) || 60)),
      status: 'checked_in',
      lines: [],
      checklist: [],
      complaint,
      intakeNotes: '',
      photos: [],
      deposit: 0,
    });
    onClose();
    nav(`/jobs/${wo.id}`);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Walk-in job"
      footer={
        <Button
          variant="primary"
          block
          onClick={async () => {
            try {
              await submit();
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          }}
        >
          Create job
        </Button>
      }
    >
      <div className="grid gap-4">
        <CustomerBikePicker customerId={who.customerId} bikeId={who.bikeId} onChange={(customerId, bikeId) => setWho({ customerId, bikeId })} />
        <Field label="What is wrong?">
          <Textarea value={complaint} onChange={(e) => setComplaint(e.target.value)} />
        </Field>
        <ScheduleFields value={sched} onChange={setSched} />
        <Field label="Planned minutes">
          <Input inputMode="numeric" value={mins} onChange={(e) => setMins(e.target.value.replace(/\D/g, ''))} />
        </Field>
        {error && <p className="rounded-xl border border-bad/40 bg-bad/10 p-3 text-sm text-bad">{error}</p>}
      </div>
    </Modal>
  );
}
