'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import Stars from '@/components/Stars';
import Icon from '@/components/Icon';
import type { Product } from '@/lib/api';
import { shade } from '@/lib/color';
import { rupees } from '@/lib/money';
import { todayIso } from '@/lib/personalize';
import Petals from './Petals';
import WeddingCard3D from './WeddingCard3D';

const GOLD = '#b8892b';
const ROTATE_MS = 6500;
const field = 'mt-1 w-full rounded-xl border border-amber-200/80 bg-white/90 px-4 py-2.5 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-200';

const daysUntil = (iso: string) => Math.ceil((new Date(`${iso}T00:00:00`).getTime() - new Date(`${todayIso()}T00:00:00`).getTime()) / 86_400_000);

/** A small card in a design's colour, used to pick between designs. */
function Thumb({ colour, letter }: { colour: string; letter: string }) {
  return (
    <span aria-hidden className="relative block h-[4.5rem] w-14 overflow-hidden rounded-[5px] shadow-md shadow-black/20"
      style={{ background: `linear-gradient(155deg, ${shade(colour, -0.2)}, ${shade(colour, -0.5)})` }}>
      <span className="absolute inset-[3px] rounded-[3px] border border-[#d4af37]/80" />
      <span className="absolute inset-0 grid place-items-center font-script text-2xl text-white/95">{letter}</span>
    </span>
  );
}

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
  const [venue, setVenue] = useState('');
  const [touched, setTouched] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [turned, setTurned] = useState(false);
  const [paused, setPaused] = useState(false);
  const [auto, setAuto] = useState(true);
  const radios = useRef<(HTMLButtonElement | null)[]>([]);

  // Show the next design every few seconds until the visitor takes over (or hovers / focuses inside).
  const running = auto && !reduce && !paused && designs.length > 1;
  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => setI((x) => (x + 1) % designs.length), ROTATE_MS);
    return () => clearTimeout(t);
  }, [running, i, designs.length]);

  // Keep the chosen design's thumbnail in view in the scrolling row.
  // (Scrolling only that row; scrollIntoView would also nudge the section's clipped edges.)
  useEffect(() => {
    const el = radios.current[i];
    const row = el?.parentElement;
    if (!el || !row) return;
    row.scrollTo({ left: el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' });
  }, [i, reduce]);

  if (designs.length === 0) return null;
  const d = designs[i];
  const choose = (n: number, focus = false) => {
    const k = (n + designs.length) % designs.length;
    setAuto(false); setI(k);
    if (focus) radios.current[k]?.focus();
  };
  const edit = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => { set(e.target.value); setTouched(true); setAuto(false); };
  const flip = () => { setFlipped((f) => !f); setTurned(true); setAuto(false); };
  const days = date ? daysUntil(date) : null;

  const q = new URLSearchParams();
  if (touched) {
    if (one.trim()) q.set('n1', one.trim());
    if (two.trim()) q.set('n2', two.trim());
    if (date) q.set('d', date);
    if (venue.trim()) q.set('v', venue.trim());
  }
  const href = `/products/${d.id}${q.toString() ? `?${q}` : ''}#personalise`;

  return (
    <section aria-labelledby="studio-h" className="mx-auto max-w-7xl px-4"
      onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="relative overflow-hidden rounded-[2rem] border border-amber-200/70 bg-[linear-gradient(135deg,#fffaf0,#fff6ec_55%,#fdf2f4)] px-5 py-12 shadow-xl shadow-amber-900/5 sm:px-12 lg:py-16">
        {/* Warm light behind the card */}
        <div aria-hidden className="pointer-events-none absolute -right-24 top-1/2 h-[34rem] w-[34rem] -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(251,191,36,0.28),transparent_65%)] motion-safe:animate-drift" />
        <div aria-hidden className="pointer-events-none absolute -left-32 bottom-0 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(251,113,133,0.16),transparent_65%)] motion-safe:animate-drift" />
        <Petals />

        <div className="relative grid grid-cols-[minmax(0,1fr)] items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Words and the little customiser */}
          <div>
            <p className="inline-flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.3em]" style={{ color: GOLD }}>
              <span aria-hidden className="h-px w-8" style={{ background: GOLD }} />Wedding cards
            </p>
            <h2 id="studio-h" className="mt-3 font-display text-5xl font-semibold leading-[1.02] tracking-normal text-slate-900 sm:text-6xl">
              Your love story,<br />
              <span className="font-script text-[1.15em] font-normal text-transparent bg-clip-text motion-safe:animate-gleam"
                style={{ backgroundImage: 'linear-gradient(90deg,#b8892b,#f0d588,#b8892b)', backgroundSize: '200% 100%' }}>beautifully</span> printed
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
              Type your names and watch the invitation come to life. Pick a design, see it before you buy, and we print it for you.
            </p>

            <form className="mt-8 max-w-xl rounded-2xl border border-amber-200/70 bg-white/60 p-5 shadow-sm backdrop-blur" aria-label="Try your names on a card" onSubmit={(e) => e.preventDefault()}>
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-900 text-xs text-white">1</span>Who is getting married?
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">First name
                  <input className={field} value={one} onChange={edit(setOne)} maxLength={40} autoComplete="off" />
                </label>
                <label className="block text-sm font-medium text-slate-700">Second name
                  <input className={field} value={two} onChange={edit(setTwo)} maxLength={40} autoComplete="off" />
                </label>
                <label className="block text-sm font-medium text-slate-700">Wedding date <span className="font-normal text-slate-400">(optional)</span>
                  <input className={field} type="date" min={todayIso()} value={date} onChange={edit(setDate)} />
                  {days !== null && days >= 0 && (
                    <span className="mt-1 block text-xs font-normal" style={{ color: GOLD }}>
                      {days === 0 ? 'That is today!' : days === 1 ? 'That is tomorrow.' : `${days} days to go.`}
                    </span>
                  )}
                </label>
                <label className="block text-sm font-medium text-slate-700">Venue <span className="font-normal text-slate-400">(optional)</span>
                  <input className={field} value={venue} onChange={edit(setVenue)} maxLength={120} placeholder="Hall or hotel, city" autoComplete="off" />
                </label>
              </div>
            </form>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href={href} className="group inline-flex items-center gap-2 rounded-full bg-slate-900 px-7 py-3 text-sm font-semibold text-white transition hover:bg-slate-700">
                Personalise this card · {d.variantLabel ? 'from ' : ''}{rupees(d.price)}
                <Icon name="back" size={16} className="rotate-180 transition group-hover:translate-x-1" />
              </Link>
              <Link href="/shop?categories=wedding-cards" className="rounded-full border border-slate-300 bg-white/80 px-6 py-3 text-sm font-semibold transition hover:border-amber-500 hover:text-amber-800">
                See all {designs.length > 7 ? '' : `${designs.length} `}wedding cards
              </Link>
            </div>

            <ul className="mt-8 grid max-w-xl gap-3 text-sm text-slate-600 sm:grid-cols-3">
              {([['sparkle', 'Live preview before you buy'], ['edit', 'Your names, date and venue'], ['box', 'Printed and delivered']] as const).map(([icon, t]) => (
                <li key={t} className="flex items-center gap-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-100/80" style={{ color: GOLD }}><Icon name={icon} size={16} tint="transparent" /></span>{t}
                </li>
              ))}
            </ul>
          </div>

          {/* The card and the design chooser */}
          <div className="flex flex-col items-center">
            <div className="py-4">
              <WeddingCard3D accent={d.color} one={one} two={two} date={date} venue={venue} flipped={flipped} onFlip={flip} swapKey={d.id}
                label={`${d.name}: a wedding card for ${one || 'one'} and ${two || 'two'}`} />
            </div>

            <div className="mt-5 flex h-9 items-center">
              <button type="button" onClick={flip} aria-pressed={flipped}
                className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white/90 px-4 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-amber-500">
                <Icon name="back" size={14} className={flipped ? '' : 'rotate-180'} />{flipped ? 'Back to the cover' : 'Open the card'}
              </button>
              {!turned && <span className="ml-3 hidden text-xs text-slate-500 sm:inline">or tap the card</span>}
            </div>

            <div className="mt-5 w-full max-w-md text-center" aria-live="polite">
              <p className="font-display text-2xl font-semibold text-slate-900">{d.name}</p>
              <p className="mt-0.5 flex items-center justify-center gap-3 text-sm text-slate-600">
                <span className="font-semibold tabular-nums text-slate-900">{d.variantLabel ? 'From ' : ''}{rupees(d.price)}</span>
                {d.reviewCount > 0 && <Stars rating={d.rating} count={d.reviewCount} size={14} />}
              </p>
            </div>

            <div className="mt-6 w-full max-w-md">
              <p className="mb-2 flex items-center justify-center gap-2 text-sm font-semibold text-slate-800">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-900 text-xs text-white">2</span>Pick a design
              </p>
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Previous design" onClick={() => choose(i - 1)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-300 bg-white/90 hover:border-amber-500"><Icon name="back" size={16} /></button>
                <div role="radiogroup" aria-label="Choose a design"
                  className="relative flex min-w-0 flex-1 snap-x gap-3 overflow-x-auto px-2 pb-3 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); choose(i + 1, true); }
                    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); choose(i - 1, true); }
                  }}>
                  {designs.map((x, n) => (
                    <button key={x.id} ref={(el) => { radios.current[n] = el; }} type="button" role="radio" aria-checked={n === i} tabIndex={n === i ? 0 : -1}
                      aria-label={`${x.name}, ${rupees(x.price)}`} onClick={() => choose(n)}
                      className={`shrink-0 snap-center rounded-lg p-1 outline-none transition focus-visible:ring-2 focus-visible:ring-amber-400 ${n === i ? 'scale-105 bg-white shadow-lg ring-2 ring-slate-900' : 'opacity-80 hover:opacity-100 hover:-translate-y-0.5'}`}>
                      <Thumb colour={x.color} letter={x.name.trim()[0]?.toUpperCase() ?? '·'} />
                    </button>
                  ))}
                </div>
                <button type="button" aria-label="Next design" onClick={() => choose(i + 1)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-300 bg-white/90 hover:border-amber-500"><Icon name="back" size={16} className="rotate-180" /></button>
              </div>
              {/* Time until the next design, while the showcase is playing by itself */}
              <div aria-hidden className="mx-auto mt-1 h-0.5 w-40 overflow-hidden rounded-full bg-amber-200/60">
                {running && <motion.div key={i} className="h-full origin-left bg-amber-500" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: ROTATE_MS / 1000, ease: 'linear' }} />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
