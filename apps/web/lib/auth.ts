'use client';
import { create } from 'zustand';
import { API } from '@/lib/api';
import * as account from '@/lib/account';
import { useStore } from '@/lib/store';

export interface User { id: string; email: string; name: string }

interface AuthState {
  user: User | null;
  /** false until the first /auth/me check finishes */
  ready: boolean;
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

async function call(path: string, body?: unknown): Promise<Response> {
  return fetch(`${API}/auth/${path}`, {
    method: body === undefined && path === 'me' ? 'GET' : 'POST',
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Make the local cart/wishlist match the account.
 * - Guest data (no owner): merge it into the account once.
 * - Already this account's copy (page reload): just refresh from the server, never re-merge.
 * - Another account's leftovers: discard and load this account's data.
 */
async function syncAccount(userId: string) {
  const store = useStore.getState();
  try {
    if (store.ownerId === null) {
      const merged = await account.mergeGuest(
        store.cart.map((l) => ({ productId: l.id, qty: l.qty })),
        store.wishlist.map((w) => w.id),
      );
      store.adopt(merged, userId);
    } else {
      store.adopt(await account.fetchState(), userId);
    }
  } catch {
    /* keep local items; try again on the next load */
  }
}

async function readUser(res: Response): Promise<User> {
  if (res.ok) return res.json();
  let msg = 'Something went wrong';
  try {
    const j = await res.json();
    msg = Array.isArray(j.message) ? j.message.join('. ') : j.message ?? msg;
  } catch {}
  if (res.status === 429) msg = 'Too many attempts. Please wait a minute and try again.';
  throw new Error(msg);
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  ready: false,
  init: async () => {
    try {
      const res = await call('me');
      const user: User | null = res.ok ? await res.json() : null;
      set({ user, ready: true });
      if (user) await syncAccount(user.id);
    } catch {
      set({ user: null, ready: true });
    }
  },
  login: async (email, password) => {
    const user = await readUser(await call('login', { email, password }));
    set({ user });
    await syncAccount(user.id);
  },
  register: async (name, email, password) => {
    const user = await readUser(await call('register', { name, email, password }));
    set({ user });
    await syncAccount(user.id);
  },
  logout: async () => {
    await call('logout').catch(() => {});
    useStore.getState().goOffline();
    set({ user: null });
  },
}));
