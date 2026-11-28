import { useEffect, useState } from 'react';

/** Current time in ms, refreshed on an interval so timers on screen keep moving. */
export function useTick(everyMs = 15_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}
