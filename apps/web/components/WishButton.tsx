'use client';
import { motion } from 'framer-motion';
import type { Product } from '@/lib/api';
import { useHydrated, useStore } from '@/lib/store';

export default function WishButton({ p, className = '' }: { p: Product; className?: string }) {
  const hydrated = useHydrated();
  const wished = useStore((s) => s.wishlist.some((w) => w.id === p.id));
  const toggle = useStore((s) => s.toggleWish);
  const on = hydrated && wished;
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.8 }}
      animate={on ? { scale: [1, 1.35, 1] } : { scale: 1 }}
      onClick={() => toggle(p)}
      aria-pressed={on}
      aria-label={on ? 'Remove from wishlist' : 'Add to wishlist'}
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-lg shadow ${className}`}
    >
      <span className={on ? 'text-rose-500' : 'text-slate-400'}>{on ? '♥' : '♡'}</span>
    </motion.button>
  );
}
