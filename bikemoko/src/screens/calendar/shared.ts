import { useEffect, useState } from 'react';
import type { JobStatus, Staff, WorkOrder } from '@/domain/types';
import { BAYS } from '@/domain/types';

export const VISIBLE_STATUSES: JobStatus[] = ['scheduled', 'checked_in', 'in_repair', 'waiting_parts', 'quality_check', 'ready'];

/** Block colours per status, tokens only. */
export const STATUS_BLOCK: Record<string, string> = {
  scheduled: 'bg-raised border-faint',
  checked_in: 'bg-info/20 border-info',
  in_repair: 'bg-brand/20 border-brand',
  waiting_parts: 'bg-warn/20 border-warn',
  quality_check: 'bg-violet-500/20 border-violet-500',
  ready: 'bg-ok/20 border-ok',
};
export const STATUS_DOT: Record<string, string> = {
  scheduled: 'bg-faint',
  checked_in: 'bg-info',
  in_repair: 'bg-brand',
  waiting_parts: 'bg-warn',
  quality_check: 'bg-violet-500',
  ready: 'bg-ok',
};

export type LaneMode = 'mechanic' | 'bay';

export interface Lane {
  key: string;
  label: string;
  staff?: Staff;
  /** mechanic id (or null for unassigned) in mechanic mode, bay name in bay mode */
  value: string | null;
  capacityMins?: number;
}

export const laneOf = (j: WorkOrder, mode: LaneMode) => (mode === 'mechanic' ? j.mechanicId ?? 'none' : j.bay);

export function buildLanes(mode: LaneMode, mechanics: Staff[], jobs: WorkOrder[]): Lane[] {
  if (mode === 'bay') return BAYS.map((b) => ({ key: b, label: b, value: b }));
  const lanes: Lane[] = mechanics.map((m) => ({ key: m.id, label: m.name, staff: m, value: m.id, capacityMins: m.dailyCapacityMins }));
  if (jobs.some((j) => !j.mechanicId)) lanes.push({ key: 'none', label: 'Unassigned', value: null });
  return lanes;
}

export function useNow(everyMs = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

export function useIsPhone() {
  const q = '(max-width: 767px)';
  const [m, setM] = useState(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q).matches : false));
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return m;
}
