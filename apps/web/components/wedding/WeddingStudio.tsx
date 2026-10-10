'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useReducedMotion } from 'framer-motion';
import Stars from '@/components/Stars';
import Icon from '@/components/Icon';
import type { Product } from '@/lib/api';
import { rupees } from '@/lib/money';
import { todayIso } from '@/lib/personalize';
import Petals from './Petals';
import WeddingCard3D from './WeddingCard3D';

const gold = '#b8892b';
const field = 'mt-1 w-full rounded-xl border border-amber-200/80 bg-white/90 px-4 py-2.5 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200';

/**
 * The home page's wedding-card showcase: type two names and watch the card change, turn it over,
 * try the designs, then carry the names to the product page to order.
 */
export default function WeddingStudio({ designs }: { designs: Product[] }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [one, setOne] = useState('Aarav');
  const [two, setTwo] = useState('Meera');
  const [date, setDate] = useState('');
  const [touched, setTouched] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [paused, setPaused] = useState(false);
  const interacted = useRef(false);

  // Show the next design every few seconds until the visitor takes over.
  useEffect(() => {
    if (reduce || paused || designs.length < 2 || interacted.current) return;
    const t = setInterval(() => setI((x) => (x + 1) % designs.length), 6500);
    return () => clearInterval(t);
  }, [reduce, paused, designs.length]);

  if (designs.length === 0) return null;
  const d = designs[i];
  const choose = (n: number) => { interacted.current = true; setI((n + designs.length) % designs.length); };
  const edit = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => { set(e.target.value); setTouched(true); interacted.current = true; };

  const q = new URLSearchParams();
  if (touched) {
    if (one.trim()) q.set('n1', one.trim());
    if (two.trim()) q.set('n2', two.trim());
    if (date) q.set('d', date);
  }
  const href = `/products/${d.id}${q.toString() ? `?${q}` : ''}#personalise`;

  return (
    <section aria-labelledby="studio-h" className="mx-auto max-w-7xl px-4"
      onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="relative overflow-hidden rounded-[2rem] border border-amber-200/70 bg-[linear-gradient(135deg,#fffaf0,#fff6ec_55%,#fdf2f4)] px-5 py-12 shadow-xl shadow-amber-900/5 sm:px-12 lg:py-16">
        <Petals />
        <div className="relative grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Words and the little customiser */}
          <div>
            <p className="inline-flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.3em]" style={{ color: gold }}>
              <span aria-hidden className="h-px w-8" style={{ background: gold }} />Wedding cards
            </p>
            <h2 id="studio-h" className="mt-3 font-display text-5xl font-semibold leading-[1.02] tracking-normal text-slate-900 sm:text-6xl">
              Your love story,<br /><span className="font-script text-[1.15em] font-normal" style={{ color: gold }}>beautifully</span> printed
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
              Type your names and watch the invitation come to life. Pick a design, see it before you buy, and we print it for you.
            </p>

            <form className="mt-7 grid max-w-xl gap-4 sm:grid-cols-2" aria-label="Try your names on a card" onSubmit={(e) => e.preventDefault()}>
              <label className="block text-sm font-medium text-slate-700">First name
                <input className={field} value={one} onChange={edit(setOne)} maxLength={40} autoComplete="off" />
              </label>
              <label className="block text-sm font-medium text-slate-700">Second name
                <input className={field} value={two} onChange={edit(setTwo)} maxLength={40} autoComplete="off" />
              </label>
              <label className="block text-sm font-medium text-slate-700 sm:col-span-2">Wedding date <span className="font-normal text-slate-400">(optional)</span>
                <input className={field} type="date" min={todayIso()} value={date} onChange={edit(setDate)} />
              </label>
            </form>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href={href} className="rounded-full bg-slate-900 px-7 py-3 text-sm font-semibold text-white transition hover:bg-slate-700">
                Personalise this card
              </Link>
              <Link href="/shop?categories=wedding-cards" className="rounded-full border border-slate-300 bg-white/80 px-6 py-3 text-sm font-semibold transition hover:border-amber-500 hover:text-amber-800">
                See all wedding cards
              </Link>
            </div>

            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
              {['Live preview before you buy', 'Your names, date and venue', 'Printed and delivered'].map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: gold }} />{t}
                </li>
              ))}
            </ul>
          </div>

          {/* The card and the design chooser */}
          <div className="flex flex-col items-center">
            <div className="py-4">
              <WeddingCard3D accent={d.color} one={one} two={two} date={date} venue="" flipped={flipped}
                label={`${d.name}: a wedding card for ${one || 'one'} and ${two || 'two'}`} />
            </div>
            <button type="button" onClick={() => setFlipped((f) => !f)} aria-pressed={flipped}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white/90 px-4 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-amber-500">
              <Icon name="back" size={14} className={flipped ? '' : 'rotate-180'} />{flipped ? 'Back to the cover' : 'See inside'}
            </button>

            <div className="mt-6 w-full max-w-md text-center" aria-live="polite">
              <p className="font-display text-2xl font-semibold text-slate-900">{d.name}</p>
              <p className="mt-0.5 flex items-center justify-center gap-3 text-sm text-slate-600">
                <span className="font-semibold tabular-nums text-slate-900">{d.variantLabel ? 'From ' : ''}{rupees(d.price)}</span>
                {d.reviewCount > 0 && <Stars rating={d.rating} count={d.reviewCount} size={14} />}
              </p>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button type="button" aria-label="Previous design" onClick={() => choose(i - 1)}
                className="grid h-9 w-9 place-items-center rounded-full border border-slate-300 bg-white/90 hover:border-amber-500"><Icon name="back" size={16} /></button>
              <div role="radiogroup" aria-label="Choose a design" className="flex max-w-[15rem] flex-wrap justify-center gap-2 sm:max-w-sm">
                {designs.map((x, n) => (
                  <button key={x.id} type="button" role="radio" aria-checked={n === i} aria-label={x.name} title={x.name} onClick={() => choose(n)}
                    className={`h-9 w-9 rounded-full border-2 transition ${n === i ? 'scale-110 border-slate-900 ring-2 ring-white' : 'border-white hover:scale-105'}`}
                    style={{ background: x.color, boxShadow: '0 1px 4px rgba(0,0,0,.25)' }} />
                ))}
              </div>
              <button type="button" aria-label="Next design" onClick={() => choose(i + 1)}
                className="grid h-9 w-9 place-items-center rounded-full border border-slate-300 bg-white/90 hover:border-amber-500"><Icon name="back" size={16} className="rotate-180" /></button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
