import { mergePlans } from './sync';
import { testPlan } from '../test/fixtures';

describe('sync merge', () => {
  it('keeps the newest copy of each plan and uploads only local wins', () => {
    const a = { ...testPlan(), id: 'a', updatedAt: '2026-10-23T10:00:00Z' };
    const aRemoteNewer = { ...a, name: 'remote', updatedAt: '2026-10-23T11:00:00Z' };
    const b = { ...testPlan(), id: 'b', updatedAt: '2026-10-23T09:00:00Z' };
    const c = { ...testPlan(), id: 'c', updatedAt: '2026-10-23T09:00:00Z' };
    const { merged, toUpload } = mergePlans([a, b], [aRemoteNewer, c]);
    expect(merged.find((p) => p.id === 'a')!.name).toBe('remote');
    expect(merged.map((p) => p.id).sort()).toEqual(['a', 'b', 'c']);
    expect(toUpload.map((p) => p.id)).toEqual(['b']);
  });
});
