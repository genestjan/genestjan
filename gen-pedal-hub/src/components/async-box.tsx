import type { ReactNode } from 'react';

import type { Async } from '@/lib/use-async';

import { Button, Card, P } from './ui';

/** Shows "Loading", an error with a retry button, an empty message, or the content. */
export function AsyncBox<T>({ state, empty, children }: { state: Async<T[]>; empty: string; children: (rows: T[]) => ReactNode }) {
  if (state.error) {
    return (
      <Card>
        <P muted>{state.error}</P>
        <Button label="Try again" kind="plain" onPress={state.reload} />
      </Card>
    );
  }
  if (!state.data) return <P muted>Loading…</P>;
  if (state.data.length === 0) {
    return (
      <Card>
        <P muted>{empty}</P>
      </Card>
    );
  }
  return <>{children(state.data)}</>;
}
