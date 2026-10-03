'use client';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { maxFor, useHydrated, useStore } from '@/lib/store';
import { stockLabel } from '@/lib/stock';
import { rupees } from '@/lib/money';
import Icon from '@/components/Icon';

export default function CartPage() {
  const hydrated = useHydrated();
  const cart = useStore((s) => s.cart);
  const setQty = useStore((s) => s.setQty);
  const remove = useStore((s) => s.removeFromCart);
  const clear = useStore((s) => s.clearCart);

  if (!hydrated) return <main className="p-10 text-center">Loading…</main>;

  const subtotal = cart.reduce((n, l) => n + l.price * l.qty, 0);

  return (
    <main className="mx-auto max-w-4xl px-4 pb-16">
      <h1 className="text-3xl font-bold">Your cart</h1>

      {cart.length === 0 ? (
        <div className="mt-10 text-center text-slate-500">
          <p>Your cart is empty.</p>
          <Link href="/shop" className="mt-3 inline-block text-fuchsia-600 hover:underline">Browse products</Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 md:grid-cols-[1fr_280px]">
          <ul className="space-y-3">
            <AnimatePresence initial={false}>
              {cart.map((l) => (
                <motion.li
                  key={l.id} layout
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -40 }}
                  className="flex items-center gap-4 rounded-2xl bg-white p-3 shadow"
                >
                  <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl" style={{ background: l.color }}>
                    {l.image && <Image src={l.image.url} alt={l.image.alt} fill sizes="96px" className="object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/products/${l.id}`} className="block truncate font-semibold hover:underline">{l.name}</Link>
                    <p className="text-sm capitalize text-slate-500">{l.category.replace('-', ' ')} · {rupees(l.price)}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <button type="button" aria-label="Decrease quantity" onClick={() => setQty(l.id, l.qty - 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200"><Icon name="minus" size={14} /></button>
                      <span className="w-6 text-center text-sm">{l.qty}</span>
                      <button type="button" aria-label="Increase quantity" disabled={l.qty >= maxFor(l)}
                        onClick={() => setQty(l.id, l.qty + 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 disabled:opacity-40"><Icon name="plus" size={14} /></button>
                    </div>
                    {l.stock !== undefined && (l.qty > l.stock || stockLabel(l.stock)) && (
                      <p role={l.qty > l.stock ? 'alert' : undefined} className={`mt-1 text-xs font-medium ${l.qty > l.stock ? 'text-rose-600' : 'text-amber-700'}`}>
                        {l.stock === 0 ? 'Sold out: remove it to check out.' : l.qty > l.stock ? `Only ${l.stock} left: lower the quantity to check out.` : stockLabel(l.stock)}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-bold tabular-nums">{rupees(l.price * l.qty)}</p>
                    <button type="button" onClick={() => remove(l.id)} className="mt-2 text-xs text-rose-500 hover:underline">
                      Remove
                    </button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>

          <aside className="h-fit rounded-2xl bg-white p-5 shadow md:sticky md:top-4">
            <h2 className="font-semibold">Order summary</h2>
            <div className="mt-3 flex justify-between text-sm">
              <span>Subtotal</span><span className="font-bold tabular-nums">{rupees(subtotal)}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Shipping and tax are calculated at checkout.</p>
            <Link href="/checkout"
              className="mt-4 block w-full rounded-full bg-gradient-to-r from-rose-500 to-fuchsia-500 py-2.5 text-center font-semibold text-white">
              Checkout
            </Link>
            <button type="button" onClick={clear} className="mt-3 w-full text-xs text-slate-500 hover:underline">
              Clear cart
            </button>
          </aside>
        </div>
      )}
    </main>
  );
}
