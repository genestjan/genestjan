import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { db } from '@/data/db';
import { useCustomers, useLiveQuery, useSettings, useStaff, byId } from '@/data/hooks';
import { BAYS } from '@/domain/types';
import { JOB_STATUS } from '@/domain/jobs';
import { Button, Empty, IconButton, PageHeader, Segmented, cx } from '@/ui/kit';
import { Agenda } from './Agenda';
import { BookingDrawer, type Slot } from './BookingDrawer';
import { DayTimeline } from './DayTimeline';
import { WeekGrid } from './WeekGrid';
import { STATUS_DOT, VISIBLE_STATUSES, buildLanes, useIsPhone, useNow, type Lane, type LaneMode } from './shared';
import { addDays, jobOnDay, sameDay, startOfDay, startOfWeek } from './timeline';

export default function Screen() {
  const now = useNow();
  const phone = useIsPhone();
  const settings = useSettings();
  const staff = useStaff();
  const customers = useCustomers();
  const allJobs = useLiveQuery(() => db.workOrders.toArray(), [], []);
  const bikes = useLiveQuery(() => db.bikes.toArray(), [], []);
  const [mode, setMode] = useState<LaneMode>('mechanic');
  const [view, setView] = useState<'day' | 'week'>('day');
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [slot, setSlot] = useState<Slot | null>(null);
  const [drawerKey, setDrawerKey] = useState(0);

  const openHour = settings?.openHour ?? 8;
  const closeHour = Math.max(openHour + 1, settings?.closeHour ?? 18);
  const mechanics = useMemo(() => staff.filter((s) => s.role === 'mechanic' && s.active), [staff]);
  const jobs = useMemo(() => allJobs.filter((j) => VISIBLE_STATUSES.includes(j.status)), [allJobs]);
  const dayJobs = useMemo(() => jobs.filter((j) => jobOnDay(j, day)), [jobs, day]);
  const lanes = useMemo(() => buildLanes(mode, mechanics, view === 'day' ? dayJobs : jobs), [mode, mechanics, dayJobs, jobs, view]);
  const customerMap = useMemo(() => byId(customers), [customers]);
  const bikeMap = useMemo(() => byId(bikes), [bikes]);

  const step = view === 'week' ? 7 : 1;
  const label =
    view === 'day'
      ? day.toLocaleDateString('en-PH', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })
      : `${startOfWeek(day).toLocaleDateString('en-PH', { day: 'numeric', month: 'short' })} to ${addDays(startOfWeek(day), 6).toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const openSlot = (lane: Lane | undefined, mins: number) => {
    setSlot({
      mechanicId: mode === 'mechanic' ? lane?.value ?? null : mechanics[0]?.id ?? null,
      bay: mode === 'bay' ? (lane?.value as string) : BAYS[0],
      mins,
    });
    setDrawerKey((k) => k + 1);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Repair Calendar"
        sub="Drag jobs to move or reassign them."
        actions={
          <Button onClick={() => openSlot(lanes[0], Math.max(openHour * 60, Math.ceil((now.getHours() * 60 + now.getMinutes()) / 30) * 30))}>
            <Plus size={18} /> Quick booking
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <Segmented value={mode} onChange={setMode} options={[{ value: 'mechanic', label: 'By mechanic' }, { value: 'bay', label: 'By bay' }]} />
        <Segmented value={view} onChange={setView} options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }]} />
        <div className="ml-auto flex items-center gap-1">
          <IconButton label="Previous" onClick={() => setDay(addDays(day, -step))}><ChevronLeft size={18} /></IconButton>
          <Button variant="secondary" size="md" disabled={view === 'day' && sameDay(day, now)} onClick={() => setDay(startOfDay(new Date()))}>Today</Button>
          <IconButton label="Next" onClick={() => setDay(addDays(day, step))}><ChevronRight size={18} /></IconButton>
        </div>
      </div>
      <div className="font-display text-lg font-semibold">{label}</div>

      {lanes.length === 0 ? (
        <Empty title="No mechanics yet" sub="Add a staff member with the mechanic role to plan their day." />
      ) : view === 'week' ? (
        <WeekGrid day={day} now={now} lanes={lanes} mode={mode} jobs={jobs} allJobs={allJobs} onPickDay={(d) => { setDay(startOfDay(d)); setView('day'); }} />
      ) : phone ? (
        <Agenda day={day} lanes={lanes} mode={mode} jobs={dayJobs} allJobs={allJobs} customers={customerMap} bikes={bikeMap} onSlot={(l) => openSlot(l, openHour * 60)} />
      ) : (
        <DayTimeline day={day} now={now} lanes={lanes} mode={mode} jobs={dayJobs} allJobs={allJobs} customers={customerMap} bikes={bikeMap} openHour={openHour} closeHour={closeHour} onSlot={openSlot} />
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted" aria-label="Legend">
        {VISIBLE_STATUSES.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={cx('h-2.5 w-2.5 rounded-sm', STATUS_DOT[s])} />
            {JOB_STATUS[s].label}
          </span>
        ))}
      </div>

      {slot && (
        <BookingDrawer key={drawerKey} open day={day} slot={slot} mechanics={mechanics} customers={customers} onClose={() => setSlot(null)} />
      )}
    </div>
  );
}
