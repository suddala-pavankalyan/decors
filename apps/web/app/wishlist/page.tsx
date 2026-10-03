'use client';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { useHydrated, useStore } from '@/lib/store';
import { rupees } from '@/lib/money';
import Icon from '@/components/Icon';

export default function WishlistPage() {
  const hydrated = useHydrated();
  const wishlist = useStore((s) => s.wishlist);
  const cart = useStore((s) => s.cart);
  const addToCart = useStore((s) => s.addToCart);
  const toggle = useStore((s) => s.toggleWish);

  if (!hydrated) return <main className="p-10 text-center">Loading…</main>;

  return (
    <main className="mx-auto max-w-7xl px-4 pb-16">
      <h1 className="text-3xl font-bold">Your wishlist</h1>

      {wishlist.length === 0 ? (
        <div className="mt-10 text-center text-slate-500">
          <p>Nothing saved yet — tap the heart on any product.</p>
          <Link href="/shop" className="mt-3 inline-block text-fuchsia-600 hover:underline">Browse products</Link>
        </div>
      ) : (
        <motion.div layout className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <AnimatePresence>
            {wishlist.map((w) => (
              <motion.article
                key={w.id} layout
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                className="overflow-hidden rounded-3xl bg-white shadow-lg shadow-slate-200"
              >
                <div className="relative h-40" style={{ background: w.color }}>
                  {w.image && <Image src={w.image.url} alt={w.image.alt} fill sizes="25vw" className="object-cover" />}
                </div>
                <div className="p-4">
                  <Link href={`/products/${w.id}`} className="font-semibold hover:underline">{w.name}</Link>
                  <p className="mt-1 font-bold tabular-nums">{rupees(w.price)}</p>
                  <div className="mt-3 flex items-center justify-between">
                    {w.personalizable ? (
                      <Link href={`/products/${w.id}`} className="rounded-full px-4 py-1.5 text-sm font-semibold text-white" style={{ background: w.color }}>Personalise</Link>
                    ) : (
                    <button type="button" disabled={w.stock === 0}
                      onClick={() => addToCart({ ...w, stock: w.stock ?? 20, personalizable: w.personalizable ?? false, colorName: '', tags: [], rating: 0, description: '' })}
                      className="rounded-full px-4 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:!bg-slate-300" style={{ background: w.color }}>
                      {w.stock === 0 ? 'Sold out' : cart.some((l) => l.id === w.id) ? 'Add another' : 'Add to cart'}
                    </button>
                    )}
                    <button type="button" onClick={() => toggle({ ...w, stock: w.stock ?? 20, personalizable: w.personalizable ?? false, colorName: '', tags: [], rating: 0, description: '' })}
                      className="text-xs text-rose-500 hover:underline">Remove</button>
                  </div>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </main>
  );
}
