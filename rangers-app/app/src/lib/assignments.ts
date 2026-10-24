import type { Assignment, Submission } from './model';

/** The latest proof for each task (a child may replace a proof; the newest one counts). */
export function latestByTask(subs: Submission[], assignmentId: string): Map<string, Submission> {
  const m = new Map<string, Submission>();
  for (const x of subs.filter((s) => s.assignmentId === assignmentId).sort((a, b) => a.at.localeCompare(b.at))) m.set(x.taskId, x);
  return m;
}
export interface Progress { total: number; sent: number; approved: number; redo: number; cleared: boolean; toReview: number }
/** A task is cleared when a proof has been sent. The coach can then approve it or ask for a redo (which reopens it). */
export function progress(a: Assignment, subs: Submission[]): Progress {
  const by = latestByTask(subs, a.id); let sent = 0, approved = 0, redo = 0;
  for (const t of a.tasks) { const x = by.get(t.id); if (!x) continue; if (x.status === 'redo') redo++; else { sent++; if (x.status === 'approved') approved++; } }
  return { total: a.tasks.length, sent, approved, redo, cleared: a.tasks.length > 0 && sent === a.tasks.length, toReview: sent - approved };
}
/** Assignments still waiting on the child (not cleared), soonest due first. */
export const openAssignments = (list: Assignment[], subs: Submission[]) =>
  list.filter((a) => !progress(a, subs).cleared).sort((a, b) => (a.dueOn ?? '9999').localeCompare(b.dueOn ?? '9999') || b.at.localeCompare(a.at));
/** One entry per assignment group, for the coach's list. */
export function groups(list: Assignment[]) {
  const m = new Map<string, Assignment[]>();
  for (const a of list) m.set(a.groupId, [...(m.get(a.groupId) ?? []), a]);
  return [...m.entries()].map(([groupId, items]) => ({ groupId, items, first: items[0] })).sort((a, b) => b.first.at.localeCompare(a.first.at));
}
