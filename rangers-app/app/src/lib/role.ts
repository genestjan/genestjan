import { cloudEnabled, useCloud } from './cloud';
import { useAppState } from './store';

export type EffectiveRole = 'admin' | 'coach' | 'parent';
/** Cloud: the signed-in role. Local-only: coach, or parent while previewing a child. */
export function useRole(): EffectiveRole {
  const c = useCloud(); const s = useAppState();
  if (cloudEnabled) return (c.role ?? 'parent') as EffectiveRole;
  return s.previewChildId ? 'parent' : 'coach';
}
export const isStaff = (r: EffectiveRole) => r === 'admin' || r === 'coach';
/** Children the current user may see as a parent. */
export function useMyChildren() {
  const s = useAppState(); const c = useCloud();
  if (!cloudEnabled) return s.previewChildId ? s.players.filter((p) => p.id === s.previewChildId) : [];
  return c.role === 'parent' ? s.players : [];
}
