'use client';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { useHydrated, useStore } from '@/lib/store';

function Badge({ n }: { n: number }) {
  return (
    <AnimatePresence>
      {n > 0 && (
        <motion.span
          key={n}
          initial={{ scale: 0.4 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-fuchsia-500 px-1 text-xs font-bold text-white"
        >
          {n}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

export default function Header() {
  const hydrated = useHydrated();
  const cartCount = useStore((s) => s.cart.reduce((n, l) => n + l.qty, 0));
  const wishCount = useStore((s) => s.wishlist.length);
  return (
    <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
      <Link href="/" className="font-display text-xl font-bold">Decors</Link>
      <div className="flex items-center gap-6 text-sm font-medium">
        <Link href="/wishlist" className="relative hover:text-fuchsia-600">
          ♥ Wishlist<Badge n={hydrated ? wishCount : 0} />
        </Link>
        <Link href="/cart" className="relative hover:text-fuchsia-600">
          🛒 Cart<Badge n={hydrated ? cartCount : 0} />
        </Link>
      </div>
    </nav>
  );
}
