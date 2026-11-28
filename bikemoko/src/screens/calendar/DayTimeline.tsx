import { useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookedMins } from '@/domain/jobs';
import { minsLabel } from '@/domain/util';
import type { Customer, CustomerBike, WorkOrder } from '@/domain/types';
import { rescheduleJob } from '@/data/actions';
import { cx, run } from '@/ui/kit';
import { blockRect, hhmm, isoAt, minsOfDay, minsToPx, movedStart, resizedDuration, rowAfterDrag, slotFromClick, SNAP_MINS } from './timeline';
import { STATUS_BLOCK, laneOf, type Lane, type LaneMode } from './shared';

const PX_PER_HOUR = 96;
const ROW_H = 80;
const LABEL_W = 168;

interface Drag {
  id: string;
  mode: 'move' | 'resize';
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  row: number;
}

export function CapacityBar({ used, cap }: { used: number; cap: number }) {
  const pct = Math.min(100, Math.round((used / Math.max(1, cap)) * 100));
  return (
    <div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-raised">
        <div className={cx('h-full rounded-full', used > cap ? 'bg-bad' : pct > 80 ? 'bg-warn' : 'bg-ok')} style={{ width: `${pct}%` }} />
      </div>
      <div className="num mt-1 text-[11px] text-muted">
        {minsLabel(Math.round(used))} of {minsLabel(cap)}
      </div>
    </div>
  );
}

export function DayTimeline({
  day, now, lanes, mode, jobs, allJobs, customers, bikes, openHour, closeHour, onSlot,
}: {
  day: Date;
  now: Date;
  lanes: Lane[];
  mode: LaneMode;
  jobs: WorkOrder[];
  allJobs: WorkOrder[];
  customers: Map<string, Customer>;
  bikes: Map<string, CustomerBike>;
  openHour: number;
  closeHour: number;
  onSlot: (lane: Lane, mins: number) => void;
}) {
  const nav = useNavigate();
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const hours = closeHour - openHour;
  const width = hours * PX_PER_HOUR;
  const laneIndex = new Map(lanes.map((l, i) => [l.key, i]));

  const nowMins = minsOfDay(now.toISOString(), day);
  const showNow = nowMins >= openHour * 60 && nowMins <= closeHour * 60;

  const start = (e: RPointerEvent<HTMLElement>, j: WorkOrder, m: 'move' | 'resize') => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const row = laneIndex.get(laneOf(j, mode)) ?? 0;
    const d = { id: j.id, mode: m, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, row };
    dragRef.current = d;
    setDrag(d);
  };
  const move = (e: RPointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const n = { ...d, dx: e.clientX - d.x0, dy: e.clientY - d.y0 };
    dragRef.current = n;
    setDrag(n);
  };
  const end = async (e: RPointerEvent<HTMLElement>, j: WorkOrder) => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    const moved = Math.abs(d.dx) > 4 || Math.abs(d.dy) > 4;
    if (!moved) {
      setDrag(null);
      nav(`/jobs/${j.id}`);
      return;
    }
    const s0 = minsOfDay(j.scheduledStart, day);
    const dur = minsOfDay(j.scheduledEnd, day) - s0;
    let s = s0;
    let nd = dur;
    let lane = lanes[d.row];
    if (d.mode === 'move') {
      s = movedStart(s0, dur, d.dx, PX_PER_HOUR, openHour, closeHour);
      lane = lanes[rowAfterDrag(d.row, d.dy, ROW_H, lanes.length)] ?? lane;
    } else nd = resizedDuration(s0, dur, d.dx, PX_PER_HOUR, closeHour);
    const changed = s !== s0 || nd !== dur || (lane && lane.key !== laneOf(j, mode));
    if (changed && lane) {
      await run(() =>
        rescheduleJob(j.id, {
          mechanicId: mode === 'mechanic' ? lane.value : j.mechanicId,
          bay: mode === 'bay' ? (lane.value as string) : j.bay,
          start: isoAt(day, s),
          end: isoAt(day, s + nd),
        }),
      );
    }
    setDrag(null); // on a clash nothing changed in the database, so the block snaps back
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <div style={{ width: LABEL_W + width }} className="relative">
        <div className="flex border-b border-line">
          <div style={{ width: LABEL_W }} className="sticky left-0 z-20 shrink-0 bg-surface" />
          <div className="relative h-8 shrink-0" style={{ width }}>
            {Array.from({ length: hours }, (_, i) => (
              <div key={i} className="num absolute top-0 flex h-full items-center border-l border-line pl-2 text-xs text-muted" style={{ left: i * PX_PER_HOUR }}>
                {hhmm((openHour + i) * 60)}
              </div>
            ))}
          </div>
        </div>
        {lanes.map((lane) => {
          const laneJobs = jobs.filter((j) => laneOf(j, mode) === lane.key);
          return (
            <div key={lane.key} className="flex border-b border-line last:border-b-0" style={{ height: ROW_H }}>
              <div style={{ width: LABEL_W }} className="sticky left-0 z-20 flex shrink-0 flex-col justify-center gap-1.5 border-r border-line bg-surface px-3">
                <div className="flex items-center gap-2">
                  {lane.staff && (
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: lane.staff.color }}>
                      {lane.staff.name.slice(0, 1)}
                    </span>
                  )}
                  <span className="truncate text-sm font-semibold">{lane.label}</span>
                </div>
                {lane.staff && lane.capacityMins ? (
                  <CapacityBar used={bookedMins(allJobs, lane.staff.id, day)} cap={lane.capacityMins} />
                ) : null}
              </div>
              <div
                className="relative shrink-0 cursor-cell"
                style={{ width }}
                onClick={(e) => {
                  const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
                  onSlot(lane, slotFromClick(x, PX_PER_HOUR, openHour, closeHour));
                }}
              >
                {Array.from({ length: hours * 2 }, (_, i) => (
                  <div key={i} className={cx('pointer-events-none absolute top-0 h-full border-l', i % 2 === 0 ? 'border-line' : 'border-line/40 border-dashed')} style={{ left: (i * PX_PER_HOUR) / 2 }} />
                ))}
                {showNow && <div className="pointer-events-none absolute top-0 z-10 h-full w-0.5 bg-bad" style={{ left: minsToPx(nowMins, openHour, PX_PER_HOUR) }} />}
                {laneJobs.map((j) => {
                  const s0 = minsOfDay(j.scheduledStart, day);
                  const e0 = minsOfDay(j.scheduledEnd, day);
                  const dur = e0 - s0;
                  let s = s0;
                  let d = dur;
                  let dy = 0;
                  const active = drag?.id === j.id ? drag : null;
                  if (active) {
                    if (active.mode === 'move') {
                      s = movedStart(s0, dur, active.dx, PX_PER_HOUR, openHour, closeHour);
                      dy = (rowAfterDrag(active.row, active.dy, ROW_H, lanes.length) - active.row) * ROW_H;
                    } else d = resizedDuration(s0, dur, active.dx, PX_PER_HOUR, closeHour);
                  }
                  const r = blockRect(s, s + d, openHour, PX_PER_HOUR);
                  const cust = customers.get(j.customerId);
                  const bike = j.bikeId ? bikes.get(j.bikeId) : undefined;
                  return (
                    <div
                      key={j.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Job ${j.jobNo}, ${cust?.name ?? ''}, ${hhmm(s)} for ${d} minutes`}
                      onKeyDown={(e) => e.key === 'Enter' && nav(`/jobs/${j.id}`)}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => start(e, j, 'move')}
                      onPointerMove={move}
                      onPointerUp={(e) => end(e, j)}
                      onPointerCancel={() => {
                        dragRef.current = null;
                        setDrag(null);
                      }}
                      className={cx(
                        'absolute top-1.5 touch-none select-none overflow-hidden rounded-lg border-l-4 px-2 py-1 text-ink shadow-card',
                        STATUS_BLOCK[j.status],
                        active ? 'z-30 cursor-grabbing opacity-90 shadow-pop' : 'z-10 cursor-grab',
                      )}
                      style={{ left: r.left, width: Math.max(r.width, 24), height: ROW_H - 12, transform: dy ? `translateY(${dy}px)` : undefined }}
                    >
                      <div className="num truncate text-xs font-bold">{j.jobNo}</div>
                      <div className="truncate text-xs">{cust?.name ?? 'Customer'}</div>
                      <div className="truncate text-[11px] text-muted">{bike ? `${bike.brand} ${bike.model}` : 'No bike'}</div>
                      <div
                        aria-label="Resize"
                        onPointerDown={(e) => start(e, j, 'resize')}
                        onPointerMove={move}
                        onPointerUp={(e) => end(e, j)}
                        className="absolute right-0 top-0 h-full w-2.5 cursor-ew-resize bg-ink/10 hover:bg-ink/25"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="px-3 py-2 text-xs text-muted">Drag a block to move it. Drag its right edge to change the length. Moves snap to {SNAP_MINS} minutes.</div>
    </div>
  );
}
