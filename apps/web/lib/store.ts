'use client';
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from '@/lib/api';
import * as account from '@/lib/account';

// Only what the cart/wishlist pages need to render, so they work without refetching.
export interface Snapshot {
  id: string;
  name: string;
  price: number;
  color: string;
  category: string;
  image: Product['image'];
}

export const snapshot = (p: Product): Snapshot => ({
  id: p.id, name: p.name, price: p.price, color: p.color, category: p.category, image: p.image,
});

export interface CartLine extends Snapshot { qty: number }

interface State {
  cart: CartLine[];
  wishlist: Snapshot[];
  /** true while logged in: every change is also saved to the account */
  online: boolean;
  /** which account the local cart/wishlist mirror; null means it's guest data */
  ownerId: string | null;
  adopt: (s: account.ServerState, ownerId: string) => void;
  goOffline: () => void;
  resync: () => Promise<void>;
  addToCart: (p: Product, qty?: number) => void;
  setQty: (id: string, qty: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  toggleWish: (p: Product) => void;
}

export const MAX_QTY = 99;

export const useStore = create<State>()(
  persist(
    (set, get) => {
      // Save a change to the account; if it fails, fall back to the server's copy.
      const save = (op: () => Promise<unknown>) => {
        if (!get().online) return;
        op().catch(() => get().resync());
      };
      const qtyOf = (id: string) => get().cart.find((l) => l.id === id)?.qty ?? 0;

      return {
        cart: [],
        wishlist: [],
        online: false,
        ownerId: null,
        adopt: (s, ownerId) =>
          set({
            online: true,
            ownerId,
            cart: s.cart.map((l) => ({ ...snapshot(l.product), qty: l.qty })),
            wishlist: s.wishlist.map(snapshot),
          }),
        // On logout, drop the account's items so they don't show up for the next person on this device.
        goOffline: () => set({ online: false, ownerId: null, cart: [], wishlist: [] }),
        resync: async () => {
          const { ownerId } = get();
          if (!ownerId) return;
          try {
            get().adopt(await account.fetchState(), ownerId);
          } catch {
            /* offline or session expired: keep local state */
          }
        },
        addToCart: (p, qty = 1) => {
          set((s) => {
            const line = s.cart.find((l) => l.id === p.id);
            return {
              cart: line
                ? s.cart.map((l) => (l.id === p.id ? { ...l, qty: Math.min(MAX_QTY, l.qty + qty) } : l))
                : [...s.cart, { ...snapshot(p), qty }],
            };
          });
          save(() => account.putQty(p.id, qtyOf(p.id)));
        },
        setQty: (id, qty) => {
          set((s) => ({
            cart: s.cart
              .map((l) => (l.id === id ? { ...l, qty: Math.min(MAX_QTY, qty) } : l))
              .filter((l) => l.qty > 0),
          }));
          save(() => account.putQty(id, qtyOf(id)));
        },
        removeFromCart: (id) => {
          set((s) => ({ cart: s.cart.filter((l) => l.id !== id) }));
          save(() => account.putQty(id, 0));
        },
        clearCart: () => {
          set({ cart: [] });
          save(() => account.deleteCart());
        },
        toggleWish: (p) => {
          const had = get().wishlist.some((w) => w.id === p.id);
          set((s) => ({
            wishlist: had ? s.wishlist.filter((w) => w.id !== p.id) : [...s.wishlist, snapshot(p)],
          }));
          save(() => (had ? account.deleteWish(p.id) : account.putWish(p.id)));
        },
      };
    },
    {
      name: 'decors-store',
      version: 1,
      // `online` is derived from the session at startup; `ownerId` is kept so a reload
      // doesn't mistake the account's own saved items for a guest cart.
      partialize: (s) => ({ cart: s.cart, wishlist: s.wishlist, ownerId: s.ownerId }),
    },
  ),
);

/** True after the first client render, so server HTML and persisted state never mismatch. */
export function useHydrated() {
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(true), []);
  return ok;
}
