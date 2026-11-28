import { useNavigate } from 'react-router-dom';
import { bookedMins } from '@/domain/jobs';
import type { Customer, CustomerBike, WorkOrder } from '@/domain/types';
import { JOB_STATUS } from '@/domain/jobs';
import { Badge, Card, cx } from '@/ui/kit';
import { CapacityBar } from './DayTimeline';
import { STATUS_BLOCK, laneOf, type Lane, type LaneMode } from './shared';
import { hhmm, minsOfDay } from './timeline';

/** Phone version of the day view: a vertical agenda grouped by mechanic or bay. */
export function Agenda({
  day, lanes, mode, jobs, allJobs, customers, bikes, onSlot,
}: {
  day: Date;
  lanes: Lane[];
  mode: LaneMode;
  jobs: WorkOrder[];
  allJobs: WorkOrder[];
  customers: Map<string, Customer>;
  bikes: Map<string, CustomerBike>;
  onSlot: (lane: Lane) => void;
}) {
  const nav = useNavigate();
  return (
    <div className="space-y-4">
      {lanes.map((lane) => {
        const list = jobs.filter((j) => laneOf(j, mode) === lane.key).sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));
        return (
          <Card key={lane.key} className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {lane.staff && (
                  <span className="grid h-7 w-7 place-items-center rounded-full text-xs font-bold text-white" style={{ background: lane.staff.color }}>
                    {lane.staff.name.slice(0, 1)}
                  </span>
                )}
                <span className="font-semibold">{lane.label}</span>
              </div>
              <button onClick={() => onSlot(lane)} className="h-11 rounded-xl px-3 text-sm font-semibold text-brand hover:bg-raised">
                Book
              </button>
            </div>
            {lane.staff && lane.capacityMins ? <CapacityBar used={bookedMins(allJobs, lane.staff.id, day)} cap={lane.capacityMins} /> : null}
            {list.length === 0 && <div className="text-sm text-muted">Nothing booked.</div>}
            {list.map((j) => {
              const cust = customers.get(j.customerId);
              const bike = j.bikeId ? bikes.get(j.bikeId) : undefined;
              return (
                <button key={j.id} onClick={() => nav(`/jobs/${j.id}`)} className={cx('flex min-h-[64px] w-full items-center gap-3 rounded-xl border-l-4 px-3 py-2 text-left', STATUS_BLOCK[j.status])}>
                  <div className="num w-12 shrink-0 text-sm font-bold">{hhmm(minsOfDay(j.scheduledStart, day))}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{cust?.name ?? 'Customer'}</div>
                    <div className="truncate text-xs text-muted">
                      {j.jobNo} {bike ? `· ${bike.brand} ${bike.model}` : ''}
                    </div>
                  </div>
                  <Badge>{JOB_STATUS[j.status].label}</Badge>
                </button>
              );
            })}
          </Card>
        );
      })}
    </div>
  );
}
