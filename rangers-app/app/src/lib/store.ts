import { useSyncExternalStore } from 'react';
import Dexie, { type Table } from 'dexie';
import type { FormatId, Player } from './types';
import type { Locks } from './rotation';

export type MatchEvent =
  | { t: number; type: 'start' | 'pause' | 'resume' | 'end' }
  | { t: number; type: 'on' | 'off'; playerId: string }
  | { t: number; type: 'mark'; playerId: string; mark: 'star' | 'shy' | 'help' }
  | { t: number; type: 'injury'; playerId: string; head: boolean };

export interface Match {
  id: string;
  name: string;
  format: FormatId;
  periods: number;
  periodMinutes: number;
  windowMinutes: number;
  availableIds: string[];
  locks: Locks;
  carryOver: 'off' | 'gentle' | 'strong';
  keys: string[];           // max 3
  moveKey: string;
  focusValue: string;
  halftimeGood: string;
  halftimeChange: string;
  celebrate: string;
  log: MatchEvent[];        // append-only
  createdAt: number;
}

export interface AppState {
  players: Player[];
  matches: Match[];
  mode: 'club' | 'sun';
  blocked: string[];        // players blocked after a suspected head injury
}

const empty: AppState = { players: [], matches: [], mode: 'club', blocked: [] };

class DB extends Dexie {
  kv!: Table<{ k: string; v: AppState }, string>;
  constructor() { super('rangers-app'); this.version(1).stores({ kv: 'k' }); }
}
const db = new DB();

let state: AppState = empty;
const subs = new Set<() => void>();
let ready = false;

function emit() { subs.forEach((f) => f()); }
async function persist() {
  try { await db.kv.put({ k: 'state', v: state }); } catch { try { localStorage.setItem('rangers-state', JSON.stringify(state)); } catch { /* private mode */ } }
}

export async function loadState() {
  try { const r = await db.kv.get('state'); if (r) state = { ...empty, ...r.v }; }
  catch { try { const s = localStorage.getItem('rangers-state'); if (s) state = { ...empty, ...JSON.parse(s) }; } catch { /* ignore */ } }
  ready = true; applyMode(); emit();
}
export const isReady = () => ready;

export function update(fn: (s: AppState) => AppState) { state = fn(state); applyMode(); emit(); void persist(); }
export function useAppState(): AppState {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => state);
}
export function getState() { return state; }
function applyMode() { document.documentElement.dataset.mode = state.mode; }

export const uid = () => crypto.randomUUID();

export const DEMO_PLAYERS: Player[] = ['Ana','Ben','Carlo','Dina','Eli','Fe','Gab','Hana','Ian','Jo','Kai','Lia','Mar','Nico']
  .map((n, i) => ({ id: `demo-${i}`, firstName: n, number: i + 1, gkWilling: i < 3 }));

export function exportBackup(): string { return JSON.stringify(state, null, 2); }
export function importBackup(json: string) { update(() => ({ ...empty, ...JSON.parse(json) })); }
