import { useSyncExternalStore } from 'react';

// Routes live in the URL hash (#/budgets), which works the same inside the Android and Windows
// apps and in a browser.

export type Route = '/' | '/tx' | '/accounts' | '/budgets' | '/debts' | '/analytics' | '/inbox' | '/settings' | '/more';

const read = (): Route => {
  const h = location.hash.replace(/^#/, '').split('?')[0];
  return (['/', '/tx', '/accounts', '/budgets', '/debts', '/analytics', '/inbox', '/settings', '/more'].includes(h) ? h : '/') as Route;
};

const subscribe = (fn: () => void) => {
  addEventListener('hashchange', fn);
  return () => removeEventListener('hashchange', fn);
};

export const useRoute = () => useSyncExternalStore(subscribe, read);

export function navigate(to: Route) {
  if (read() !== to) location.hash = to;
  document.querySelector('main')?.scrollTo({ top: 0 });
}
