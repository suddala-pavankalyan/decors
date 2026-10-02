'use client';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { MAX_QTY, useHydrated, useStore } from '@/lib/store';

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
      <h1 className="font-display text-3xl font-bold">Your cart</h1>

      {cart.length === 0 ? (
        <div className="mt-10 text-center text-slate-500">
          <p>Your cart is empty.</p>
          <Link href="/" className="mt-3 inline-block text-fuchsia-600 hover:underline">Browse products</Link>
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
                    <p className="text-sm capitalize text-slate-500">{l.category.replace('-', ' ')} · ${l.price}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <button type="button" aria-label="Decrease quantity" onClick={() => setQty(l.id, l.qty - 1)}
                        className="h-7 w-7 rounded-full border border-slate-200">−</button>
                      <span className="w-6 text-center text-sm">{l.qty}</span>
                      <button type="button" aria-label="Increase quantity" disabled={l.qty >= MAX_QTY}
                        onClick={() => setQty(l.id, l.qty + 1)}
                        className="h-7 w-7 rounded-full border border-slate-200 disabled:opacity-40">+</button>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">${l.price * l.qty}</p>
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
              <span>Subtotal</span><span className="font-bold">${subtotal}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Shipping and tax are calculated at checkout.</p>
            <button type="button" disabled
              className="mt-4 w-full rounded-full bg-fuchsia-500 py-2.5 font-semibold text-white disabled:opacity-60"
              title="Checkout is coming soon">
              Checkout (coming soon)
            </button>
            <button type="button" onClick={clear} className="mt-3 w-full text-xs text-slate-500 hover:underline">
              Clear cart
            </button>
          </aside>
        </div>
      )}
    </main>
  );
}
