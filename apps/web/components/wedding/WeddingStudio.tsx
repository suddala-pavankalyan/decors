'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import Stars from '@/components/Stars';
import Icon from '@/components/Icon';
import type { Product } from '@/lib/api';
import { luminance, shade } from '@/lib/color';
import Petals from './Petals';
import WeddingCard3D from './WeddingCard3D';

const ROTATE_MS = 6500;

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
  // Sample details so the open card looks finished; the visitor enters their own on the product page.
  const [date, setDate] = useState('');
  const [flipped, setFlipped] = useState(false);
  const [turned, setTurned] = useState(false);
  const [paused, setPaused] = useState(false);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    // A Saturday about four months from today.
    const t = new Date(); t.setDate(t.getDate() + 120);
    t.setDate(t.getDate() + ((6 - t.getDay() + 7) % 7));
    setDate(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`);
  }, []);
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
  // The whole section takes its colours from the chosen card.
  const deep = shade(d.color, luminance(d.color) > 0.5 ? -0.62 : -0.38);
  const theme = {
    '--a': deep, '--a-mid': shade(d.color, -0.12), '--a-line': shade(d.color, 0.55), '--a-soft': shade(d.color, 0.88), '--a-tint': shade(d.color, 0.94),
  } as React.CSSProperties;
  const choose = (n: number, focus = false) => {
    const k = (n + designs.length) % designs.length;
    setAuto(false); setI(k);
    if (focus) radios.current[k]?.focus();
  };
  const flip = () => { setFlipped((f) => !f); setTurned(true); setAuto(false); };

  const href = `/products/${d.id}#personalise`;

  return (
    <section aria-labelledby="studio-h" className="mx-auto max-w-7xl px-4" style={theme}
      onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="relative overflow-hidden rounded-[2rem] border border-[color:var(--a-line)] bg-[color:var(--a-tint)] transition-colors duration-700 px-5 py-12 shadow-xl shadow-black/5 sm:px-12 lg:py-16">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.85),rgba(255,255,255,0.35)_60%,rgba(255,255,255,0.7))]" />
        {/* Light behind the card, in the card's colour */}
        <div aria-hidden className="pointer-events-none absolute -right-24 top-1/2 h-[34rem] w-[34rem] -translate-y-1/2 rounded-full opacity-40 blur-3xl transition-colors duration-700 motion-safe:animate-drift" style={{ background: d.color }} />
        <div aria-hidden className="pointer-events-none absolute -left-32 bottom-0 h-96 w-96 rounded-full opacity-25 blur-3xl transition-colors duration-700 motion-safe:animate-drift" style={{ background: shade(d.color, 0.35) }} />
        <Petals colours={[shade(d.color, 0.6), shade(d.color, 0.35), shade(d.color, 0.78)]} />

        <div className="relative grid grid-cols-[minmax(0,1fr)] items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Words and the little customiser */}
          <div>
            <p className="inline-flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.3em]" style={{ color: 'var(--a)' }}>
              <span aria-hidden className="h-px w-8" style={{ background: 'var(--a)' }} />Wedding cards
            </p>
            <h2 id="studio-h" className="mt-3 font-display text-5xl font-semibold leading-[1.02] tracking-normal text-slate-900 sm:text-6xl">
              Your love story,<br />
              <span className="font-script text-[1.15em] font-normal text-transparent bg-clip-text motion-safe:animate-gleam"
                style={{ backgroundImage: `linear-gradient(90deg, ${deep}, ${shade(d.color, luminance(d.color) > 0.5 ? -0.3 : 0.05)}, ${deep})`, backgroundSize: '200% 100%' }}>beautifully</span> printed
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
              Choose a design, open the card and imagine your names on it. Add your details on the next page, see a live preview, and we print it for you.
            </p>


            <div className="mt-9 w-full max-w-md">
              <p className="mb-2 text-sm font-semibold text-slate-800">
                Pick a design
              </p>
              <div className="flex w-fit max-w-full items-center gap-2">
                <button type="button" aria-label="Previous design" onClick={() => choose(i - 1)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-300 bg-white/90 hover:border-[color:var(--a)]"><Icon name="back" size={16} /></button>
                <div role="radiogroup" aria-label="Choose a design"
                  className="relative flex min-w-0 snap-x gap-3 overflow-x-auto px-2 pb-3 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); choose(i + 1, true); }
                    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); choose(i - 1, true); }
                  }}>
                  {designs.map((x, n) => (
                    <button key={x.id} ref={(el) => { radios.current[n] = el; }} type="button" role="radio" aria-checked={n === i} tabIndex={n === i ? 0 : -1}
                      aria-label={x.name} onClick={() => choose(n)}
                      className={`shrink-0 snap-center rounded-lg p-1 outline-none transition focus-visible:ring-2 focus-visible:ring-[color:var(--a)] ${n === i ? 'scale-105 bg-white shadow-lg ring-2 ring-slate-900' : 'opacity-80 hover:opacity-100 hover:-translate-y-0.5'}`}>
                      <Thumb colour={x.color} letter={x.name.trim()[0]?.toUpperCase() ?? '·'} />
                    </button>
                  ))}
                </div>
                <button type="button" aria-label="Next design" onClick={() => choose(i + 1)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-300 bg-white/90 hover:border-[color:var(--a)]"><Icon name="back" size={16} className="rotate-180" /></button>
              </div>
              {/* Time until the next design, while the showcase is playing by itself */}
              <div aria-hidden className="mt-1 h-0.5 w-40 overflow-hidden rounded-full bg-[color:var(--a-line)]">
                {running && <motion.div key={i} className="h-full origin-left bg-[color:var(--a)]" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: ROTATE_MS / 1000, ease: 'linear' }} />}
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href={href} className="group inline-flex items-center gap-2 rounded-full bg-slate-900 px-7 py-3 text-sm font-semibold text-white transition hover:bg-slate-700">
                Personalise this card
                <Icon name="back" size={16} className="rotate-180 transition group-hover:translate-x-1" />
              </Link>
              <Link href="/shop?categories=wedding-cards" className="rounded-full border border-slate-300 bg-white/80 px-6 py-3 text-sm font-semibold transition hover:border-[color:var(--a)] hover:text-[color:var(--a)]">
                See all {designs.length > 7 ? '' : `${designs.length} `}wedding cards
              </Link>
            </div>

          </div>

          {/* The card and the design chooser */}
          <div className="flex flex-col items-center">
            <div className="py-4">
              <WeddingCard3D accent={d.color} one="Aarav" two="Meera" date={date} venue="Rose Garden Palace, Jaipur" flipped={flipped} onFlip={flip} swapKey={d.id}
                label={`${d.name}: a sample wedding card`} />
            </div>

            <div className="mt-5 flex h-9 items-center">
              <button type="button" onClick={flip} aria-pressed={flipped}
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--a-line)] bg-white/90 px-4 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-[color:var(--a)]">
                <Icon name="back" size={14} className={flipped ? '' : 'rotate-180'} />{flipped ? 'Back to the cover' : 'Open the card'}
              </button>
              {!turned && <span className="ml-3 hidden text-xs text-slate-500 sm:inline">or tap the card</span>}
            </div>

            <div className="mt-5 w-full max-w-md text-center" aria-live="polite">
              <p className="font-display text-2xl font-semibold text-slate-900">{d.name}</p>
              {d.reviewCount > 0 && <p className="mt-1 flex justify-center text-sm text-slate-600"><Stars rating={d.rating} count={d.reviewCount} size={14} /></p>}
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
