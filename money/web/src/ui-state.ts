import { create } from 'zustand';
import type { BillRow } from './lib/compute';
import type { Account, Bill, Txn } from './lib/model';

// Which form is open. Any screen can open one (the + button, a captured item, a bill).

interface UIState {
  txn: Partial<Txn> | null;
  account: Partial<Account> | null;
  bill: Partial<Bill> | null;
  pay: BillRow | null;
  budgets: string | null;
  importer: 'statement' | 'bills' | null;
}

export const useUI = create<UIState>(() => ({ txn: null, account: null, bill: null, pay: null, budgets: null, importer: null }));

export const openTxn = (draft: Partial<Txn> = {}) => useUI.setState({ txn: draft });
export const openAccount = (draft: Partial<Account> = {}) => useUI.setState({ account: draft });
export const openBill = (draft: Partial<Bill> = {}) => useUI.setState({ bill: draft });
export const openPay = (row: BillRow) => useUI.setState({ pay: row });
export const openBudgets = (month: string) => useUI.setState({ budgets: month });
export const openImporter = (kind: 'statement' | 'bills') => useUI.setState({ importer: kind });

/** Android back button: close an open form first. */
export function closeTopSheet(): boolean {
  const s = useUI.getState();
  for (const k of ['pay', 'txn', 'account', 'bill', 'budgets', 'importer'] as const) {
    if (s[k]) { useUI.setState({ [k]: null }); return true; }
  }
  return false;
}
