'use client';
import { create } from 'zustand';
import { API } from '@/lib/api';
import * as account from '@/lib/account';
import { useStore } from '@/lib/store';

export interface User { id: string; email: string; name: string; role: 'USER' | 'ADMIN'; createdAt: string; emailVerified: boolean }

interface AuthState {
  user: User | null;
  /** false until the first /auth/me check finishes */
  ready: boolean;
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  /** Email links. Each throws an Error with a message that is safe to show. */
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  /** Returns true if a new email was sent, false if the address was already verified. */
  resendVerification: () => Promise<boolean>;
}

async function call(
  path: string,
  body?: unknown,
  method: 'GET' | 'POST' | 'PATCH' = body === undefined && path === 'me' ? 'GET' : 'POST',
): Promise<Response> {
  return fetch(`${API}/auth/${path}`, {
    method,
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
        store.cart.map((l) => ({ productId: l.id, qty: l.qty, personalization: l.personalization ?? null })),
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

async function errorMessage(res: Response): Promise<string> {
  let msg = 'Something went wrong';
  let raw = '';
  try {
    const j = await res.json();
    raw = Array.isArray(j.message) ? j.message.join('. ') : j.message ?? '';
    if (raw) msg = raw;
  } catch {}
  // The generic rate limiter has an unfriendly message; our own "please wait" messages are already clear.
  if (res.status === 429 && (!raw || /throttler/i.test(raw))) msg = 'Too many attempts. Please wait a minute and try again.';
  return msg;
}

async function readUser(res: Response): Promise<User> {
  if (res.ok) return res.json();
  throw new Error(await errorMessage(res));
}

async function send<T = unknown>(path: string, body: unknown = {}): Promise<T> {
  const res = await call(path, body);
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json();
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
  updateName: async (name) => set({ user: await readUser(await call('me', { name }, 'PATCH')) }),
  // The server signs out every other device and re-issues this one's cookie.
  changePassword: async (currentPassword, newPassword) =>
    set({ user: await readUser(await call('change-password', { currentPassword, newPassword })) }),
  forgotPassword: async (email) => { await send('forgot-password', { email }); },
  resetPassword: async (token, newPassword) => { await send('reset-password', { token, newPassword }); },
  verifyEmail: async (token) => {
    await send('verify-email', { token });
    // If they are signed in, the "please confirm your email" banner should disappear.
    set((s) => (s.user ? { user: { ...s.user, emailVerified: true } } : s));
  },
  resendVerification: async () => !(await send<{ alreadyVerified: boolean }>('resend-verification')).alreadyVerified,
}));
