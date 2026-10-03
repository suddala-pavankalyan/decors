'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import type { Product } from '@/lib/api';
import { maxFor, useStore } from '@/lib/store';
import Icon from './Icon';

export default function AddToCartButton({
  p, label = 'Add', className = '',
}: { p: Product; label?: string; className?: string }) {
  const add = useStore((s) => s.addToCart);
  const [added, setAdded] = useState(false);
  const inCart = useStore((s) => s.cart.find((l) => l.id === p.id)?.qty ?? 0);
  const soldOut = p.stock === 0;
  // Cards with the customer's own names are added from the product page, where they type the details.
  // Products with options (sizes, volumes) are bought from the product page too, where the option is chosen.
  if ((p.personalizable || p.variantLabel) && !soldOut) {
    return <Link href={`/products/${p.id}`} className={className} style={{ background: p.color }}>{p.personalizable ? 'Personalise' : `Choose ${p.variantLabel!.toLowerCase()}`}</Link>;
  }
  const atMax = !soldOut && inCart >= maxFor(p);
  if (soldOut || atMax) {
    return (
      <button type="button" disabled className={`${className} cursor-not-allowed !bg-slate-200 !text-slate-500`}>
        {soldOut ? 'Sold out' : 'All in cart'}
      </button>
    );
  }
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.92 }}
      whileHover={{ scale: 1.05 }}
      onClick={() => {
        add(p);
        setAdded(true);
        setTimeout(() => setAdded(false), 1200);
      }}
      className={className}
      style={{ background: p.color }}
    >
      {added ? (
        <span className="inline-flex items-center gap-1"><Icon name="check" size={16} />Added</span>
      ) : (
        label
      )}
    </motion.button>
  );
}
