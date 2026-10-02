'use client';
import { create } from 'zustand';
import { API } from '@/lib/api';

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
      set({ user: res.ok ? await res.json() : null, ready: true });
    } catch {
      set({ user: null, ready: true });
    }
  },
  login: async (email, password) => set({ user: await readUser(await call('login', { email, password })) }),
  register: async (name, email, password) =>
    set({ user: await readUser(await call('register', { name, email, password })) }),
  logout: async () => {
    await call('logout').catch(() => {});
    set({ user: null });
  },
}));
