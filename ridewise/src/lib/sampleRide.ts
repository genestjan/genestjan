import { useStore } from '../store/store';
import { samplePlan } from './defaults';

/** Open the demo ride (real GenSan to Davao route and places). Reuses it if it exists. */
export async function openSampleRide(): Promise<void> {
  const s = useStore.getState();
  const existing = Object.values(s.plans).find((p) => p.isSample);
  if (existing) s.setActive(existing.id);
  else s.savePlan(await samplePlan());
}
