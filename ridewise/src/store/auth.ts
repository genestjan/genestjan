import { create } from 'zustand';
import {
  AVATAR_COLORS, adoptLegacyData, changePassword, createAccount, deleteAccount, getUnlock, listAccounts, renameAccount, setLastAccount, setUnlock,
  unlockWithDevice, unlockWithPassword, type AccountRecord, type UnlockMode,
} from './accounts';
import { activateVault, deactivateVault, flushVault, vaultReadFailed } from './storage';
import { useStore } from './store';
import { checkBiometric, createBiometric, friendlyBiometricError } from '../lib/biometric';
import { passwordProblem } from '../lib/vault';

export type AuthStatus = 'loading' | 'welcome' | 'choose' | 'locked' | 'unlocked';

type AuthState = {
  status: AuthStatus;
  accounts: AccountRecord[];
  current: AccountRecord | null; // the rider who is signed in, or who is being unlocked
  unlockMode: UnlockMode;
  dk: CryptoKey | null;
  readFailed: boolean;
  /** Set right after registering so the app can offer "how should I open next time?". */
  justRegistered: boolean;

  init: () => Promise<void>;
  register: (i: { name: string; password: string; color?: string }) => Promise<void>;
  loginWithPassword: (id: string, password: string) => Promise<void>;
  loginWithFingerprint: (id: string) => Promise<void>;
  chooseRider: (id: string) => Promise<void>;
  lock: () => Promise<void>;
  switchRider: () => Promise<void>;
  addRider: () => Promise<void>;
  logOut: () => Promise<void>;
  setOpenMode: (mode: UnlockMode) => Promise<{ ok: boolean; message?: string }>;
  updatePassword: (oldPw: string, newPw: string) => Promise<void>;
  updateProfile: (name: string, color: string) => Promise<void>;
  deleteCurrent: (password: string) => Promise<void>;
  /** For a forgotten password: removes the rider and their saved data. */
  resetForgotten: (id: string) => Promise<void>;
  finishWelcome: () => void;
};

async function enter(account: AccountRecord, dk: CryptoKey, set: (p: Partial<AuthState>) => void, mode: UnlockMode) {
  activateVault(account.id, dk);
  await useStore.persist.rehydrate();
  await setLastAccount(account.id);
  set({ status: 'unlocked', current: account, dk, unlockMode: mode, readFailed: vaultReadFailed() });
}

export const useAuth = create<AuthState>()((set, get) => ({
  status: 'loading',
  accounts: [],
  current: null,
  unlockMode: 'password',
  dk: null,
  readFailed: false,
  justRegistered: false,

  async init() {
    const { accounts, lastId } = await listAccounts();
    if (accounts.length === 0) return set({ status: 'welcome', accounts: [], current: null });
    const last = accounts.find((a) => a.id === lastId);
    if (!last) return set({ status: 'choose', accounts, current: null });
    const unlock = await getUnlock(last.id);
    set({ accounts, current: last, unlockMode: unlock.mode });
    if (unlock.mode === 'open') {
      try {
        const dk = await unlockWithDevice(last.id);
        return await enter(last, dk, set, 'open');
      } catch {
        /* fall through to the lock screen */
      }
    }
    set({ status: 'locked' });
  },

  async register({ name, password, color }) {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Please type your name.');
    const problem = passwordProblem(password);
    if (problem) throw new Error(problem);
    const { account, dk, firstAccount } = await createAccount({ name: trimmed, password, color: color ?? AVATAR_COLORS[get().accounts.length % AVATAR_COLORS.length] });
    // Anything saved before accounts existed moves into the first account.
    if (firstAccount) await adoptLegacyData(account.id, dk);
    const { accounts } = await listAccounts();
    set({ accounts, justRegistered: true });
    await enter(account, dk, set, 'password');
  },

  async loginWithPassword(id, password) {
    const account = get().accounts.find((a) => a.id === id);
    if (!account) throw new Error('We could not find that rider.');
    const dk = await unlockWithPassword(account, password);
    const unlock = await getUnlock(id);
    await enter(account, dk, set, unlock.mode);
  },

  async loginWithFingerprint(id) {
    const account = get().accounts.find((a) => a.id === id);
    const unlock = await getUnlock(id);
    if (!account || unlock.mode !== 'fingerprint' || !unlock.credentialId) throw new Error('Fingerprint is not set up for this rider on this phone.');
    try {
      await checkBiometric(unlock.credentialId);
    } catch (e) {
      throw new Error(friendlyBiometricError(e));
    }
    const dk = await unlockWithDevice(id);
    await enter(account, dk, set, 'fingerprint');
  },

  async chooseRider(id) {
    const account = get().accounts.find((a) => a.id === id);
    if (!account) return;
    const unlock = await getUnlock(id);
    set({ current: account, unlockMode: unlock.mode });
    if (unlock.mode === 'open') {
      try {
        return await enter(account, await unlockWithDevice(id), set, 'open');
      } catch {
        /* fall through to the lock screen */
      }
    }
    set({ status: 'locked' });
  },

  async lock() {
    await flushVault();
    deactivateVault();
    useStore.getState().clearMemory();
    set({ status: 'locked', dk: null, justRegistered: false });
  },

  async switchRider() {
    await get().lock();
    set({ status: 'choose', current: null });
  },

  async addRider() {
    await get().lock();
    set({ status: 'welcome', current: null });
  },

  /** Lock AND make this phone forget the fingerprint/auto-open, so the password is needed. */
  async logOut() {
    const { current, dk } = get();
    if (current && dk) await setUnlock(current.id, dk, 'password');
    await get().lock();
    set({ unlockMode: 'password' });
  },

  async setOpenMode(mode) {
    const { current, dk } = get();
    if (!current || !dk) return { ok: false, message: 'Please unlock first.' };
    let credentialId: string | undefined;
    if (mode === 'fingerprint') {
      try {
        credentialId = await createBiometric(current.id, current.name);
      } catch (e) {
        return { ok: false, message: friendlyBiometricError(e) };
      }
    }
    const ok = await setUnlock(current.id, dk, mode, credentialId);
    if (!ok) return { ok: false, message: 'This browser cannot remember it (maybe a private window). You will use your password.' };
    set({ unlockMode: mode });
    return { ok: true };
  },

  async updatePassword(oldPw, newPw) {
    const { current } = get();
    if (!current) return;
    const problem = passwordProblem(newPw);
    if (problem) throw new Error(problem);
    const next = await changePassword(current, oldPw, newPw);
    set({ current: next, accounts: get().accounts.map((a) => (a.id === next.id ? next : a)) });
  },

  async updateProfile(name, color) {
    const { current } = get();
    if (!current || !name.trim()) return;
    const next = await renameAccount(current.id, name, color);
    if (next) set({ current: next, accounts: get().accounts.map((a) => (a.id === next.id ? next : a)) });
  },

  async deleteCurrent(password) {
    const { current } = get();
    if (!current) return;
    await unlockWithPassword(current, password);
    await flushVault();
    deactivateVault();
    useStore.getState().clearMemory();
    await deleteAccount(current.id);
    const { accounts } = await listAccounts();
    set({ accounts, current: null, dk: null, status: accounts.length ? 'choose' : 'welcome' });
  },

  async resetForgotten(id) {
    await deleteAccount(id);
    const { accounts } = await listAccounts();
    set({ accounts, current: null, status: accounts.length ? 'choose' : 'welcome' });
  },

  finishWelcome() {
    set({ justRegistered: false });
  },
}));
