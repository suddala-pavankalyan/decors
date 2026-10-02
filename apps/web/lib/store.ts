'use client';
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from '@/lib/api';

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
  addToCart: (p: Product, qty?: number) => void;
  setQty: (id: string, qty: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  toggleWish: (p: Product) => void;
}

export const MAX_QTY = 99;

export const useStore = create<State>()(
  persist(
    (set) => ({
      cart: [],
      wishlist: [],
      addToCart: (p, qty = 1) =>
        set((s) => {
          const line = s.cart.find((l) => l.id === p.id);
          return {
            cart: line
              ? s.cart.map((l) => (l.id === p.id ? { ...l, qty: Math.min(MAX_QTY, l.qty + qty) } : l))
              : [...s.cart, { ...snapshot(p), qty }],
          };
        }),
      setQty: (id, qty) =>
        set((s) => ({
          cart: s.cart
            .map((l) => (l.id === id ? { ...l, qty: Math.min(MAX_QTY, qty) } : l))
            .filter((l) => l.qty > 0),
        })),
      removeFromCart: (id) => set((s) => ({ cart: s.cart.filter((l) => l.id !== id) })),
      clearCart: () => set({ cart: [] }),
      toggleWish: (p) =>
        set((s) => ({
          wishlist: s.wishlist.some((w) => w.id === p.id)
            ? s.wishlist.filter((w) => w.id !== p.id)
            : [...s.wishlist, snapshot(p)],
        })),
    }),
    { name: 'decors-store', version: 1 },
  ),
);

/** True after the first client render, so server HTML and persisted state never mismatch. */
export function useHydrated() {
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(true), []);
  return ok;
}
