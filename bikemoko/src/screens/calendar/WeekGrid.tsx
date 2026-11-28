import { bookedMins } from '@/domain/jobs';
import type { WorkOrder } from '@/domain/types';
import { cx } from '@/ui/kit';
import { addDays, jobOnDay, minsOnDay, sameDay, startOfWeek } from './timeline';
import { laneOf, type Lane, type LaneMode } from './shared';

export function WeekGrid({
  day, now, lanes, mode, jobs, allJobs, onPickDay,
}: {
  day: Date;
  now: Date;
  lanes: Lane[];
  mode: LaneMode;
  jobs: WorkOrder[];
  allJobs: WorkOrder[];
  onPickDay: (d: Date) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(day), i));
  const cols = `160px repeat(7, minmax(92px, 1fr))`;
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <div className="min-w-[860px]">
        <div className="grid border-b border-line" style={{ gridTemplateColumns: cols }}>
          <div />
          {days.map((d) => (
            <button key={d.toISOString()} onClick={() => onPickDay(d)} className={cx('h-12 px-2 text-center text-xs font-semibold hover:bg-raised', sameDay(d, now) ? 'text-brand' : 'text-muted')}>
              {d.toLocaleDateString('en-PH', { weekday: 'short' })} <span className="num text-sm text-ink">{d.getDate()}</span>
            </button>
          ))}
        </div>
        {lanes.map((lane) => (
          <div key={lane.key} className="grid border-b border-line last:border-b-0" style={{ gridTemplateColumns: cols }}>
            <div className="flex items-center gap-2 px-3 py-3">
              {lane.staff && (
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: lane.staff.color }}>
                  {lane.staff.name.slice(0, 1)}
                </span>
              )}
              <span className="truncate text-sm font-semibold">{lane.label}</span>
            </div>
            {days.map((d) => {
              const js = jobs.filter((j) => laneOf(j, mode) === lane.key && jobOnDay(j, d));
              const mins = js.reduce((s, j) => s + minsOnDay(j, d), 0);
              const over = lane.staff && lane.capacityMins ? bookedMins(allJobs, lane.staff.id, d) > lane.capacityMins : false;
              return (
                <button key={d.toISOString()} onClick={() => onPickDay(d)} className={cx('min-h-[64px] border-l border-line px-2 py-2 text-left hover:bg-raised', sameDay(d, now) && 'bg-brand-soft/40')}>
                  {js.length ? (
                    <>
                      <div className="num text-lg font-bold leading-none">{js.length}</div>
                      <div className="text-[11px] text-muted">{js.length === 1 ? 'job' : 'jobs'}</div>
                      <div className={cx('num text-xs', over ? 'font-semibold text-bad' : 'text-muted')}>{(mins / 60).toFixed(1)} h</div>
                    </>
                  ) : (
                    <div className="text-xs text-faint">Free</div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
