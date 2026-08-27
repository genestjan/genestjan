'use client';
import { useEffect, useState } from 'react';

export type Tier = 'mobile' | 'tablet' | 'desktop';

/** Node count scales by device, BRIEF 6.7. Detected once on mount, never per frame. */
export function useDeviceTier(): Tier {
  const [tier, setTier] = useState<Tier>('desktop');
  useEffect(() => {
    const w = window.innerWidth;
    setTier(w < 640 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop');
  }, []);
  return tier;
}

export const NODE_COUNT: Record<Tier, number> = {
  mobile: 600,
  tablet: 1200,
  desktop: 3000,
};
