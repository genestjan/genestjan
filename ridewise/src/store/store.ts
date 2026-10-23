import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  ChecklistItem,
  ChecklistItemState,
  ChecklistKind,
  ChecklistRecord,
  FatigueAnswer,
  RidePlan,
  RideSession,
  RiderProfile,
} from '../types';
import { deviceStorage } from './storage';
import { newId } from '../lib/schedule';
import { adviceFor } from '../lib/fatigue';

export type HistoryEntry = {
  id: string;
  planId: string;
  planName: string;
  startedAt: string;
  endedAt: string;
  elapsedMin: number;
  movingMin: number;
  distanceKm: number | null;
  stopsCompleted: number;
  notes?: string;
};

type State = {
  plans: Record<string, RidePlan>;
  activePlanId: string | null;
  sessions: Record<string, RideSession>; // by planId
  checklists: Record<string, ChecklistRecord>; // key: kind|planId|stopId
  customItems: Record<ChecklistKind, ChecklistItem[]>;
  rider: RiderProfile;
  history: HistoryEntry[];
  prefs: { hydrateEveryMin: number; snackEveryMin: number; suppliesEveryMin: number; notifications: boolean; keepElapsedDuringStops: boolean };
  hydrated: boolean;

  savePlan: (p: RidePlan) => void;
  updatePlan: (id: string, fn: (p: RidePlan) => RidePlan) => void;
  deletePlan: (id: string) => void;
  setActive: (id: string | null) => void;

  startSession: (planId: string, baseline?: FatigueAnswer) => void;
  updateSession: (planId: string, fn: (s: RideSession) => RideSession) => void;
  checkIn: (planId: string, answer: FatigueAnswer) => void;
  endSession: (planId: string, summary: Omit<HistoryEntry, 'id' | 'planId' | 'planName' | 'startedAt' | 'endedAt'>) => void;

  setChecklistState: (key: string, kind: ChecklistKind, itemId: string, state: ChecklistItemState, planId?: string, stopId?: string) => void;
  resetChecklist: (key: string) => void;
  addCustomItem: (kind: ChecklistKind, label: string) => void;
  removeCustomItem: (kind: ChecklistKind, id: string) => void;

  setRider: (r: RiderProfile) => void;
  setPrefs: (p: Partial<State['prefs']>) => void;
  wipeAll: () => void;
};

export const checklistKey = (kind: ChecklistKind, planId?: string, stopId?: string) => [kind, planId ?? '-', stopId ?? '-'].join('|');

const initial = {
  plans: {},
  activePlanId: null,
  sessions: {},
  checklists: {},
  customItems: { 'pre-ride': [], 'pit-stop': [], 'post-ride': [] },
  rider: { style: 'relaxed' as const },
  history: [],
  prefs: { hydrateEveryMin: 20, snackEveryMin: 45, suppliesEveryMin: 90, notifications: false, keepElapsedDuringStops: true },
};

export const useStore = create<State>()(
  persist(
    (set) => ({
      ...initial,
      hydrated: false,
      savePlan: (p) => set((s) => ({ plans: { ...s.plans, [p.id]: { ...p, updatedAt: new Date().toISOString() } }, activePlanId: p.id })),
      updatePlan: (id, fn) =>
        set((s) => (s.plans[id] ? { plans: { ...s.plans, [id]: { ...fn(s.plans[id]), updatedAt: new Date().toISOString() } } } : s)),
      deletePlan: (id) =>
        set((s) => {
          const plans = { ...s.plans };
          delete plans[id];
          const sessions = { ...s.sessions };
          delete sessions[id];
          return { plans, sessions, activePlanId: s.activePlanId === id ? null : s.activePlanId };
        }),
      setActive: (id) => set({ activePlanId: id }),

      startSession: (planId, baseline) =>
        set((s) => {
          const now = new Date().toISOString();
          const session: RideSession = {
            id: newId('ride'),
            planId,
            state: 'riding',
            startedAt: now,
            pauses: [],
            checkins: baseline ? [{ at: now, answer: baseline }] : [],
            baseline,
            supplies: { water: 'full', food: 'full', electrolytes: 'unknown', updatedAt: now },
            reminders: {},
            lastRideResumeAt: now,
            progressKm: 0,
            progressSource: 'manual',
            gpsEnabled: false,
          };
          const plan = s.plans[planId];
          return {
            sessions: { ...s.sessions, [planId]: session },
            plans: plan ? { ...s.plans, [planId]: { ...plan, status: 'riding' } } : s.plans,
          };
        }),
      updateSession: (planId, fn) =>
        set((s) => (s.sessions[planId] ? { sessions: { ...s.sessions, [planId]: fn(s.sessions[planId]) } } : s)),
      checkIn: (planId, answer) =>
        set((s) => {
          const cur = s.sessions[planId];
          if (!cur) return s;
          const now = new Date().toISOString();
          let next: RideSession = { ...cur, checkins: [...cur.checkins, { at: now, answer }] };
          const a = adviceFor(answer);
          if (a.pauseRide && cur.state === 'riding') {
            next = {
              ...next,
              state: answer === 'unsafe' ? 'safety-pause' : 'paused',
              pauses: [...cur.pauses, { start: now, reason: answer === 'unsafe' ? 'safety' : 'manual' }],
            };
          } else if (answer === 'unsafe') {
            next = { ...next, state: 'safety-pause' };
          }
          return { sessions: { ...s.sessions, [planId]: next } };
        }),
      endSession: (planId, summary) =>
        set((s) => {
          const cur = s.sessions[planId];
          const plan = s.plans[planId];
          if (!cur) return s;
          const endedAt = new Date().toISOString();
          const entry: HistoryEntry = { id: cur.id, planId, planName: plan?.name ?? 'Ride', startedAt: cur.startedAt, endedAt, ...summary };
          const sessions = { ...s.sessions };
          delete sessions[planId];
          return {
            sessions,
            history: [entry, ...s.history].slice(0, 100),
            plans: plan ? { ...s.plans, [planId]: { ...plan, status: 'completed' } } : s.plans,
          };
        }),

      setChecklistState: (key, kind, itemId, state, planId, stopId) =>
        set((s) => {
          const cur = s.checklists[key] ?? { id: key, kind, planId, stopId, states: {}, updatedAt: '' };
          return { checklists: { ...s.checklists, [key]: { ...cur, states: { ...cur.states, [itemId]: state }, updatedAt: new Date().toISOString() } } };
        }),
      resetChecklist: (key) =>
        set((s) => {
          const c = { ...s.checklists };
          delete c[key];
          return { checklists: c };
        }),
      addCustomItem: (kind, label) =>
        set((s) => ({ customItems: { ...s.customItems, [kind]: [...s.customItems[kind], { id: newId('item'), label, custom: true }] } })),
      removeCustomItem: (kind, id) =>
        set((s) => ({ customItems: { ...s.customItems, [kind]: s.customItems[kind].filter((i) => i.id !== id) } })),

      setRider: (r) => set({ rider: r }),
      setPrefs: (p) => set((s) => ({ prefs: { ...s.prefs, ...p } })),
      wipeAll: () => set({ ...initial }),
    }),
    {
      name: 'ridewise:v1',
      version: 1,
      storage: createJSONStorage(() => deviceStorage),
      partialize: ({ hydrated: _h, ...rest }) => rest as unknown as State,
      onRehydrateStorage: () => () => useStore.setState({ hydrated: true }),
    },
  ),
);

export function useActivePlan(): RidePlan | null {
  return useStore((s) => (s.activePlanId ? s.plans[s.activePlanId] ?? null : null));
}
