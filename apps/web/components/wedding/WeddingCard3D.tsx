'use client';
import { useRef } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { inkOn, shade } from '@/lib/color';
import { longDate } from '@/lib/personalize';

const initial = (s: string) => (s.trim()[0] ?? '·').toUpperCase();

/** A flourish for the corners of the inside page, drawn in the card's own colour. */
function Corner({ colour, className }: { colour: string; className: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={`absolute h-10 w-10 ${className}`} fill="none" stroke={colour} strokeWidth="1.2" strokeLinecap="round">
      <path d="M3 45V14C3 7 8 3 14 3h31" />
      <path d="M10 45V18c0-5 3-8 8-8h27" opacity=".55" />
      <circle cx="14" cy="14" r="2.2" fill={colour} stroke="none" />
    </svg>
  );
}

/**
 * The hero card: it floats, tilts towards the pointer, and turns over to show the inside.
 * Front = the cover with a monogram; back = the invitation with the names, date and venue.
 */
export default function WeddingCard3D({
  accent, one, two, date, venue, flipped, label,
}: { accent: string; one: string; two: string; date: string; venue: string; flipped: boolean; label: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rx = useSpring(useTransform(py, [-0.5, 0.5], [9, -9]), { stiffness: 140, damping: 16 });
  const ry = useSpring(useTransform(px, [-0.5, 0.5], [-11, 11]), { stiffness: 140, damping: 16 });

  const dark = shade(accent, -0.45);
  const mid = shade(accent, -0.2);
  const ink = inkOn(mid);
  const gold = '#d4af37';

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
    <div className="[perspective:1400px]" onPointerMove={move} onPointerLeave={rest}>
      <motion.div
        ref={ref}
        role="img"
        aria-label={label}
        className="relative mx-auto aspect-[5/7] w-[min(78vw,19rem)] sm:w-80"
        style={{ rotateX: reduce ? 0 : rx, rotateY: reduce ? 0 : ry, transformStyle: 'preserve-3d' }}
        animate={reduce ? undefined : { y: [0, -10, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <motion.div
          className="absolute inset-0"
          style={{ transformStyle: 'preserve-3d' }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 70, damping: 15 }}
        >
          {/* Cover */}
          <div
            className="absolute inset-0 overflow-hidden rounded-md shadow-2xl shadow-black/25 [backface-visibility:hidden]"
            style={{ background: `linear-gradient(155deg, ${mid}, ${dark})`, color: ink }}
          >
            <div className="absolute inset-3 rounded-sm" style={{ border: `1.5px solid ${gold}` }} />
            <div className="absolute inset-[18px] rounded-sm" style={{ border: `1px solid ${gold}99` }} />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_15%,rgba(255,255,255,0.28),transparent_55%)]" />
            <div className="relative flex h-full flex-col items-center justify-center text-center">
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.45em]" style={{ color: ink }}>The wedding of</p>
              <p className="mt-5 font-script text-7xl leading-none" style={{ color: ink, textShadow: '0 2px 12px rgba(0,0,0,.3)' }}>
                {initial(n1)}<span className="mx-1 text-4xl align-middle">&amp;</span>{initial(n2)}
              </p>
              <div className="mt-6 h-px w-24" style={{ background: `linear-gradient(90deg, transparent, ${gold}, transparent)` }} />
              <p className="mt-4 font-display text-lg italic">{n1} &amp; {n2}</p>
            </div>
          </div>

          {/* Inside */}
          <div
            className="absolute inset-0 overflow-hidden rounded-md bg-[#fffdf8] shadow-2xl shadow-black/25 [backface-visibility:hidden] [transform:rotateY(180deg)]"
            style={{ background: `linear-gradient(165deg, ${shade(accent, 0.86)}, #fffdf8 60%)` }}
          >
            <div className="absolute inset-3 rounded-sm" style={{ border: `1px solid ${accent}` }} />
            <Corner colour={accent} className="left-4 top-4" />
            <Corner colour={accent} className="right-4 top-4 [transform:scaleX(-1)]" />
            <Corner colour={accent} className="bottom-4 left-4 [transform:scaleY(-1)]" />
            <Corner colour={accent} className="bottom-4 right-4 [transform:scale(-1)]" />
            <div className="relative flex h-full flex-col items-center justify-center px-9 text-center text-slate-700">
              <p className="font-display text-[10px] uppercase tracking-[0.35em]" style={{ color: shade(accent, -0.5) }}>Together with their families</p>
              <p className="mt-4 font-script text-5xl leading-[1.05] text-slate-900" data-testid="studio-one">{n1}</p>
              <p className="font-display text-xl italic" style={{ color: shade(accent, -0.4) }}>&amp;</p>
              <p className="font-script text-5xl leading-[1.05] text-slate-900" data-testid="studio-two">{n2}</p>
              <p className="mt-4 font-display text-[11px] uppercase tracking-[0.25em] text-slate-500">invite you to celebrate their wedding</p>
              <p className="mt-3 font-display text-base font-semibold text-slate-800" data-testid="studio-date">{date ? longDate(date) : 'Saturday, 12 December 2026'}</p>
              <p className="font-display text-sm italic text-slate-600">{venue.trim() || 'Your venue, your city'}</p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
