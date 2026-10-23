export class ServiceError extends Error {
  constructor(
    message: string,
    public kind: 'offline' | 'timeout' | 'rate-limited' | 'unavailable' | 'bad-response' | 'not-found',
    public status?: number,
  ) {
    super(message);
  }
}

export type RetryOptions = {
  retries?: number;
  timeoutMs?: number;
  baseDelayMs?: number;
  /** Injected for tests. */
  sleep?: (ms: number) => Promise<void>;
  fetchImpl?: typeof fetch;
};

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** fetch with a timeout and exponential backoff on 429/5xx and network errors. */
export async function fetchWithRetry(url: string, init: RequestInit = {}, opts: RetryOptions = {}): Promise<Response> {
  const { retries = 2, timeoutMs = 30000, baseDelayMs = 1500, sleep = defaultSleep, fetchImpl = fetch } = opts;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ServiceError('You appear to be offline. This needs an internet connection.', 'offline');
  }
  let last: ServiceError | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, { ...init, signal: ctl.signal });
      clearTimeout(timer);
      if (res.ok) return res;
      if (res.status === 404) throw new ServiceError('Not found.', 'not-found', 404);
      if (res.status === 429) last = new ServiceError('The service is rate limiting requests. Try again in a minute.', 'rate-limited', 429);
      else if (res.status >= 500) last = new ServiceError(`The service is busy or unavailable (HTTP ${res.status}).`, 'unavailable', res.status);
      else throw new ServiceError(`Request rejected (HTTP ${res.status}).`, 'bad-response', res.status);
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof ServiceError && (e.kind === 'not-found' || e.kind === 'bad-response')) throw e;
      if (!(e instanceof ServiceError)) {
        last =
          (e as Error)?.name === 'AbortError'
            ? new ServiceError('The service took too long to answer.', 'timeout')
            : new ServiceError('Could not reach the service. Check your connection.', 'unavailable');
      }
    }
    if (attempt < retries) await sleep(baseDelayMs * 2 ** attempt);
  }
  throw last ?? new ServiceError('Request failed.', 'unavailable');
}
