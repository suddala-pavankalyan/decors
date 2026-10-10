'use client';
import { useReducedMotion } from 'framer-motion';

/** A few petals drifting down behind the section. Pure CSS animation; hidden for reduced-motion visitors. */
const PETALS = Array.from({ length: 14 }, (_, i) => ({
  left: `${(i * 37 + 8) % 100}%`, size: 10 + ((i * 7) % 12), delay: -((i * 1.7) % 14), dur: 12 + ((i * 3) % 9), hue: i % 3,
}));
const COLOURS = ['#fbcfe8', '#fde68a', '#fecdd3'];

export default function Petals() {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {PETALS.map((p, i) => (
        <span key={i} className="absolute -top-6 block rounded-[60%_0_60%_0] opacity-70 motion-safe:animate-petal"
          style={{ left: p.left, width: p.size, height: p.size * 1.2, background: COLOURS[p.hue], animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }} />
      ))}
    </div>
  );
}
