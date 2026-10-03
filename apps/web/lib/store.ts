'use client';
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product, Variant } from '@/lib/api';
import * as account from '@/lib/account';
import type { Personalization } from '@/lib/personalize';

// Only what the cart/wishlist pages need to render, so they work without refetching.
export interface Snapshot {
  id: string;
  name: string;
  price: number;
  color: string;
  category: string;
  image: Product['image'];
  /** Units available when this was saved (older saved carts do not have it). */
  stock?: number;
  /** Wedding cards: the customer's own names, date and venue go on these. */
  personalizable?: boolean;
  /** The kind of option the product comes in ("Size"), if it has any. */
  variantKind?: string | null;
}

export const snapshot = (p: Product): Snapshot => ({
  id: p.id, name: p.name, price: p.price, color: p.color, category: p.category, image: p.image, stock: p.stock, personalizable: p.personalizable, variantKind: p.variantLabel,
});

export interface CartLine extends Snapshot {
  qty: number;
  personalization?: Personalization | null;
  /** The option chosen for products that have them ("A4", "4 L"); price and stock above are then the option's. */
  variantId?: string;
  variantLabel?: string | null;
}

/** One cart line is a product in one option, so the same product can sit in the cart twice. */
export const lineKey = (l: { id: string; variantId?: string }) => `${l.id}|${l.variantId ?? ''}`;

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
  addToCart: (p: Product, qty?: number, personalization?: Personalization | null, variant?: Variant | null) => void;
  setPersonalization: (key: string, d: Personalization) => void;
  setQty: (key: string, qty: number) => void;
  removeFromCart: (key: string) => void;
  clearCart: () => void;
  toggleWish: (p: Product) => void;
}

export const MAX_QTY = 99;
/** Most of an item a cart may hold: 99, or what is in stock if that is less. */
export const maxFor = (p: { stock?: number }) => Math.min(MAX_QTY, p.stock ?? MAX_QTY);

export const useStore = create<State>()(
  persist(
    (set, get) => {
      // Save a change to the account; if it fails, fall back to the server's copy.
      const save = (op: () => Promise<unknown>) => {
        if (!get().online) return;
        op().catch(() => get().resync());
      };
      const lineOf = (key: string) => get().cart.find((l) => lineKey(l) === key);
      const qtyOf = (key: string) => lineOf(key)?.qty ?? 0;

      return {
        cart: [],
        wishlist: [],
        online: false,
        ownerId: null,
        adopt: (s, ownerId) =>
          set({
            online: true,
            ownerId,
            cart: s.cart.map((l) => ({
              ...snapshot(l.product), qty: l.qty, personalization: l.personalization ?? null,
              ...(l.variant ? { variantId: l.variant.id, variantLabel: l.variant.label, price: l.variant.price, stock: l.variant.stock } : {}),
            })),
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
        addToCart: (p, qty = 1, personalization = null, variant = null) => {
          const key = lineKey({ id: p.id, variantId: variant?.id });
          const cap = maxFor(variant ?? p);
          set((s) => {
            const line = s.cart.find((l) => lineKey(l) === key);
            return {
              cart: line
                ? s.cart.map((l) => (lineKey(l) === key ? { ...l, qty: Math.min(cap, l.qty + qty), personalization: personalization ?? l.personalization } : l))
                : [...s.cart, {
                    ...snapshot(p), qty: Math.min(cap, qty), personalization,
                    ...(variant ? { variantId: variant.id, variantLabel: variant.label, price: variant.price, stock: variant.stock } : {}),
                  }],
            };
          });
          save(() => account.putQty(p.id, qtyOf(key), personalization, variant?.id));
        },
        setPersonalization: (key, d) => {
          set((s) => ({ cart: s.cart.map((l) => (lineKey(l) === key ? { ...l, personalization: d } : l)) }));
          const l = lineOf(key);
          if (l) save(() => account.putQty(l.id, l.qty, d, l.variantId));
        },
        setQty: (key, qty) => {
          const before = lineOf(key);
          set((s) => ({
            cart: s.cart
              .map((l) => (lineKey(l) === key ? { ...l, qty: Math.min(maxFor(l), qty) } : l))
              .filter((l) => l.qty > 0),
          }));
          if (before) save(() => account.putQty(before.id, Math.max(0, Math.min(maxFor(before), qty)), undefined, before.variantId));
        },
        removeFromCart: (key) => {
          const before = lineOf(key);
          set((s) => ({ cart: s.cart.filter((l) => lineKey(l) !== key) }));
          if (before) save(() => account.putQty(before.id, 0, undefined, before.variantId));
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
