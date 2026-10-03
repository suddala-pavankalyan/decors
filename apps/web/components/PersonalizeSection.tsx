'use client';
import { useState } from 'react';
import Link from 'next/link';
import PersonalizeEditor from '@/components/PersonalizeEditor';
import type { Product } from '@/lib/api';
import type { Personalization } from '@/lib/personalize';
import { maxFor, useStore } from '@/lib/store';

/** "Make it yours" on a product page: type the details, watch the card change, add it to the cart. */
export default function PersonalizeSection({ p }: { p: Product }) {
  const add = useStore((s) => s.addToCart);
  const setQtyOf = useStore((s) => s.setQty);
  const setDetails = useStore((s) => s.setPersonalization);
  const line = useStore((s) => s.cart.find((l) => l.id === p.id));
  const [qty, setQty] = useState('1');
  const [done, setDone] = useState(false);
  const max = maxFor(p);

  if (p.stock === 0) return <p className="mt-6 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">This card is sold out.</p>;

  function submit(d: Personalization) {
    const n = Math.min(max, Math.max(1, Math.round(Number(qty) || 1)));
    // Adding again replaces the details and sets the number of cards, rather than piling up copies.
    if (line) {
      setQtyOf(p.id, n);
      setDetails(p.id, d);
    } else {
      add(p, n, d);
    }
    setDone(true);
  }

  return (
    <section id="personalise" aria-labelledby="personalise-h" className="mt-12 rounded-3xl bg-white/80 p-6 shadow-xl">
      <h2 id="personalise-h" className="text-2xl font-bold">Make it yours</h2>
      <p className="mt-1 text-sm text-slate-600">Add your names, date and venue. The card on the right updates as you type.</p>
      <div className="mt-5">
        <label className="mb-5 block max-w-[12rem] text-sm font-medium">How many cards?
          <input type="number" min={1} max={max} value={qty} onChange={(e) => { setQty(e.target.value); setDone(false); }}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-200" />
        </label>
        <PersonalizeEditor
          key={line?.personalization ? 'saved' : 'new'}
          initial={line?.personalization ?? null} accent={p.color} productName={p.name}
          submitLabel={line ? 'Update cart' : 'Add to cart'} onSubmit={submit}
        />
        {done && (
          <p role="status" className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Added to your cart. <Link href="/cart" className="font-semibold underline">View cart</Link>
          </p>
        )}
      </div>
    </section>
  );
}
