import { useCallback, useEffect, useRef, useState } from 'react';

export type Async<T> = { data: T | null; error: string | null; loading: boolean; reload: () => void };

/** Runs a loader when the screen opens and whenever `deps` change. */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[], enabled = true): Async<T> {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({
    data: null,
    error: null,
    loading: enabled,
  });
  const [n, setN] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const run = ++latest.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    load()
      .then((data) => {
        if (run === latest.current) setState({ data, error: null, loading: false });
      })
      .catch((e: unknown) => {
        if (run === latest.current) {
          setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : 'Something went wrong.' }));
        }
      });
    // The loader is rebuilt every render; `deps` says when to run it again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n, enabled]);

  const reload = useCallback(() => setN((v) => v + 1), []);
  return { ...state, reload };
}
