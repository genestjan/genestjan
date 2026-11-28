import { useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import { db } from '@/data/db';
import { useLiveQuery, useStaff, byId } from '@/data/hooks';
import { useSession } from '@/app/session';
import { JOB_STATUS, jobTotals, workedMins } from '@/domain/jobs';
import { minsLabel } from '@/domain/util';
import type { JobStatus } from '@/domain/types';
import { Badge, Card, Empty, Field, PageHeader, Select } from '@/ui/kit';
import { Workbench } from './Workbench';
import { useTick } from './useTick';

const ACTIVE: JobStatus[] = ['scheduled', 'checked_in', 'in_repair', 'waiting_parts', 'quality_check', 'ready'];
const sameDay = (iso: string, d: Date) => new Date(iso).toDateString() === d.toDateString();
const hm = (iso: string) => new Date(iso).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

export default function Screen() {
  const { staff } = useSession();
  const allStaff = useStaff();
  const now = useTick(15_000);
  const mechanics = allStaff.filter((s) => s.role === 'mechanic' && s.active);
  const isOwner = !staff || staff.role === 'owner';
  const [picked, setPicked] = useState('');
  const mechanicId = isOwner ? picked || mechanics[0]?.id || '' : staff!.id;
  const [openId, setOpenId] = useState<string | null>(null);

  const jobs = useLiveQuery(() => db.workOrders.toArray(), [], []);
  const customers = useLiveQuery(() => db.customers.toArray(), [], []);
  const bikes = useLiveQuery(() => db.bikes.toArray(), [], []);
  const cMap = useMemo(() => byId(customers), [customers]);
  const bMap = useMemo(() => byId(bikes), [bikes]);

  const today = new Date(now);
  const queue = jobs
    .filter((j) => j.mechanicId === mechanicId && ACTIVE.includes(j.status) && (sameDay(j.scheduledStart, today) || !['scheduled', 'ready'].includes(j.status)))
    .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));

  return (
    <div className="space-y-4">
      <PageHeader title="My Jobs" sub={today.toLocaleDateString('en-PH', { weekday: 'long', day: 'numeric', month: 'long' })} />
      {isOwner && (
        <Field label="Mechanic">
          <Select value={mechanicId} onChange={(e) => setPicked(e.target.value)}>
            {mechanics.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </Select>
        </Field>
      )}
      {!mechanicId ? (
        <Empty title="No mechanic selected" sub="Pick a mechanic to see their jobs." />
      ) : queue.length === 0 ? (
        <Empty title="Nothing in the queue" sub="Jobs booked for today will show up here." />
      ) : (
        <div className="space-y-3">
          {queue.map((j) => {
            const bike = j.bikeId ? bMap.get(j.bikeId) : undefined;
            return (
              <button key={j.id} onClick={() => setOpenId(j.id)} className="block w-full text-left">
                <Card className="space-y-2 active:bg-raised">
                  <div className="flex items-center justify-between gap-2">
                    <span className="num text-sm text-muted">{hm(j.scheduledStart)} · {j.jobNo}</span>
                    <Badge tone={j.status === 'ready' ? 'ok' : j.status === 'waiting_parts' ? 'warn' : 'brand'}>{JOB_STATUS[j.status].label}</Badge>
                  </div>
                  <div className="font-display text-xl font-semibold">{bike ? `${bike.brand} ${bike.model}` : 'Bike'}</div>
                  <div className="text-sm text-muted">{cMap.get(j.customerId)?.name}</div>
                  {j.complaint && <div className="line-clamp-2 text-sm">{j.complaint}</div>}
                  <div className="num flex items-center gap-1.5 text-sm text-muted">
                    <Clock size={14} /> {minsLabel(workedMins(j, now))} of {minsLabel(jobTotals(j.lines).durationMins)}
                    {j.timerSince && <Badge tone="ok" dot className="ml-2">Running</Badge>}
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      )}
      {openId && <Workbench jobId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
