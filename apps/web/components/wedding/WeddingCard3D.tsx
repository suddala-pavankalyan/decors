'use client';
import { useRef } from 'react';
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { inkOn, shade } from '@/lib/color';
import { longDate } from '@/lib/personalize';

const initial = (s: string) => (s.trim()[0] ?? '·').toUpperCase();
const GOLD = '#d4af37';
// Fine paper grain, as an inline SVG so there is nothing extra to download.
const GRAIN = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .45  0 0 0 0 .38  0 0 0 0 .3  0 0 0 .11 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`;

/** Script names shrink as they get longer so they always fit on the card. */
const nameSize = (s: string, base: number) => `${Math.max(1.7, base - Math.max(0, s.trim().length - 7) * 0.2)}rem`;

/** A flourish for the corners of the inside page, drawn in the card's own colour. */
function Corner({ colour, className }: { colour: string; className: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={`absolute h-11 w-11 ${className}`} fill="none" stroke={colour} strokeWidth="1.2" strokeLinecap="round">
      <path d="M3 45V14C3 7 8 3 14 3h31" />
      <path d="M10 45V18c0-5 3-8 8-8h27" opacity=".55" />
      <path d="M3 24c5-1 8-4 9-9" opacity=".7" />
      <circle cx="14" cy="14" r="2.4" fill={colour} stroke="none" />
    </svg>
  );
}

/** A thin divider with a small diamond, used between the names and the details. */
function Divider({ colour }: { colour: string }) {
  return (
    <div aria-hidden className="my-3 flex w-28 items-center gap-2">
      <span className="h-px flex-1" style={{ background: `linear-gradient(90deg, transparent, ${colour})` }} />
      <span className="h-1.5 w-1.5 rotate-45" style={{ background: colour }} />
      <span className="h-px flex-1" style={{ background: `linear-gradient(270deg, transparent, ${colour})` }} />
    </div>
  );
}

/**
 * The hero card: it floats, tilts towards the pointer with a light glint, and turns over (click, tap,
 * Enter or Space) to show the inside. Front = the cover with a monogram; back = the invitation.
 */
export default function WeddingCard3D({
  accent, one, two, date, venue, flipped, onFlip, label, swapKey,
}: { accent: string; one: string; two: string; date: string; venue: string; flipped: boolean; onFlip: () => void; label: string; swapKey: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rx = useSpring(useTransform(py, [-0.5, 0.5], [9, -9]), { stiffness: 140, damping: 16 });
  const ry = useSpring(useTransform(px, [-0.5, 0.5], [-11, 11]), { stiffness: 140, damping: 16 });
  const gx = useTransform(px, [-0.5, 0.5], [15, 85]);
  const gy = useTransform(py, [-0.5, 0.5], [10, 90]);
  const glare = useMotionTemplate`radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,0.42), transparent 48%)`;

  const dark = shade(accent, -0.5);
  const mid = shade(accent, -0.22);
  const ink = inkOn(mid);

  function move(e: React.PointerEvent) {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  }
  const rest = () => { px.set(0); py.set(0); };

  const n1 = one.trim() || 'First';
  const n2 = two.trim() || 'Second';

  return (
    <div className="relative [perspective:1400px]" onPointerMove={move} onPointerLeave={rest}>
      {/* Soft shadow on the "table" */}
      <div aria-hidden className="absolute -bottom-6 left-1/2 h-8 w-4/5 -translate-x-1/2 rounded-[50%] bg-black/25 blur-xl" />
      <motion.div
        key={swapKey}
        initial={reduce ? false : { opacity: 0, rotateY: -28, scale: 0.94 }}
        animate={{ opacity: 1, rotateY: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        <motion.div
          ref={ref}
          role="button"
          tabIndex={0}
          aria-label={`${label}. ${flipped ? 'Showing the inside' : 'Showing the cover'}. Press to turn it over.`}
          onClick={onFlip}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFlip(); } }}
          className="relative mx-auto aspect-[5/7] w-[min(74vw,19rem)] cursor-pointer rounded-md outline-none focus-visible:ring-4 focus-visible:ring-amber-300 sm:w-80"
          style={{ rotateX: reduce ? 0 : rx, rotateY: reduce ? 0 : ry, transformStyle: 'preserve-3d' }}
          animate={reduce ? undefined : { y: [0, -10, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <motion.div className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}
            animate={{ rotateY: flipped ? 180 : 0 }} transition={{ type: 'spring', stiffness: 70, damping: 15 }}>
            {/* Cover */}
            <div className="absolute inset-0 overflow-hidden rounded-md shadow-2xl shadow-black/30 [backface-visibility:hidden]"
              style={{ background: `linear-gradient(155deg, ${mid}, ${dark})`, color: ink }}>
              <div className="absolute inset-0 opacity-80" style={{ backgroundImage: GRAIN }} />
              <div className="absolute inset-3 rounded-sm" style={{ border: `1.5px solid ${GOLD}` }} />
              <div className="absolute inset-[18px] rounded-sm" style={{ border: `1px solid ${GOLD}99` }} />
              {/* Foil sheen sweeping across */}
              <div aria-hidden className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent motion-safe:animate-sheen" />
              <motion.div aria-hidden className="absolute inset-0 mix-blend-soft-light" style={{ background: reduce ? undefined : glare }} />
              <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
                <p className="font-display text-[11px] font-semibold uppercase tracking-[0.45em]" style={{ color: ink }}>The wedding of</p>
                <p className="mt-5 font-script text-7xl leading-none" style={{ color: ink, textShadow: '0 2px 12px rgba(0,0,0,.3)' }}>
                  {initial(n1)}<span className="mx-1 align-middle text-4xl">&amp;</span>{initial(n2)}
                </p>
                <Divider colour={GOLD} />
                <p className="font-display text-lg italic" style={{ color: ink }}>{n1} &amp; {n2}</p>
                {date && <p className="mt-2 font-display text-[11px] uppercase tracking-[0.3em] opacity-90">{new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
              </div>
            </div>

            {/* Inside */}
            <div className="absolute inset-0 overflow-hidden rounded-md shadow-2xl shadow-black/30 [backface-visibility:hidden] [transform:rotateY(180deg)]"
              style={{ background: `linear-gradient(165deg, ${shade(accent, 0.86)}, #fffdf8 60%)` }}>
              <div className="absolute inset-0" style={{ backgroundImage: GRAIN }} />
              <motion.div aria-hidden className="absolute inset-0 mix-blend-soft-light" style={{ background: reduce ? undefined : glare }} />
              <div className="absolute inset-3 rounded-sm" style={{ border: `1px solid ${accent}` }} />
              <Corner colour={accent} className="left-4 top-4" />
              <Corner colour={accent} className="right-4 top-4 [transform:scaleX(-1)]" />
              <Corner colour={accent} className="bottom-4 left-4 [transform:scaleY(-1)]" />
              <Corner colour={accent} className="bottom-4 right-4 [transform:scale(-1)]" />
              <div className="relative flex h-full flex-col items-center justify-center px-9 text-center text-slate-700">
                <p className="font-display text-[10px] font-semibold uppercase tracking-[0.35em]" style={{ color: shade(accent, -0.5) }}>Together with their families</p>
                <p className="mt-4 font-script leading-[1.05] text-slate-900" style={{ fontSize: nameSize(n1, 3.1) }} data-testid="studio-one">{n1}</p>
                <p className="font-display text-xl italic" style={{ color: shade(accent, -0.4) }}>&amp;</p>
                <p className="font-script leading-[1.05] text-slate-900" style={{ fontSize: nameSize(n2, 3.1) }} data-testid="studio-two">{n2}</p>
                <Divider colour={shade(accent, -0.2)} />
                <p className="font-display text-[11px] uppercase tracking-[0.25em] text-slate-500">invite you to celebrate their wedding</p>
                <p className="mt-3 font-display text-base font-semibold text-slate-800" data-testid="studio-date">{date ? longDate(date) : 'Saturday, 12 December 2026'}</p>
                <p className="font-display text-sm italic text-slate-600" data-testid="studio-venue">{venue.trim() || 'Your venue, your city'}</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}
