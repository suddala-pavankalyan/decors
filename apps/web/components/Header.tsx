'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { useHydrated, useStore } from '@/lib/store';
import Icon from '@/components/Icon';

function Badge({ n }: { n: number }) {
  return (
    <AnimatePresence>
      {n > 0 && (
        <motion.span
          key={n}
          initial={{ scale: 0.4 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          className="absolute -right-2.5 -top-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-fuchsia-500 px-1 text-[10px] font-bold leading-none text-white"
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
  const { user, ready, init, logout } = useAuth();
  useEffect(() => { init(); }, [init]);
  return (
    <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
      <Link href="/" className="font-display text-xl font-bold">Decors</Link>
      <div className="flex items-center gap-6 text-sm font-medium">
        <Link href="/wishlist" className="inline-flex items-center gap-1.5 hover:text-fuchsia-600">
          <span className="relative"><Icon name="heart" size={20} /><Badge n={hydrated ? wishCount : 0} /></span>
          Wishlist
        </Link>
        <Link href="/cart" className="inline-flex items-center gap-1.5 hover:text-fuchsia-600">
          <span className="relative"><Icon name="bag" size={20} /><Badge n={hydrated ? cartCount : 0} /></span>
          Cart
        </Link>
        {ready && (user ? (
          <span className="flex items-center gap-3">
            <Link href="/orders" className="inline-flex items-center gap-1.5 hover:text-fuchsia-600">
              <Icon name="box" size={20} />Orders
            </Link>
            <span className="inline-flex items-center gap-1.5 text-slate-600">
              <Icon name="user" size={20} />{user.name.split(' ')[0]}
            </span>
            <button type="button" onClick={logout} className="hover:text-fuchsia-600">Log out</button>
          </span>
        ) : (
          <Link href="/login" className="rounded-full bg-fuchsia-500 px-4 py-1.5 text-white hover:bg-fuchsia-600">Log in</Link>
        ))}
      </div>
    </nav>
  );
}
