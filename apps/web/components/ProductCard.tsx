'use client';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import type { Product } from '@/lib/api';
import AddToCartButton from './AddToCartButton';
import WishButton from './WishButton';
import { rupees } from '@/lib/money';

export default function ProductCard({ p }: { p: Product }) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -8, rotate: -0.5 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className="relative overflow-hidden rounded-3xl bg-white shadow-lg shadow-slate-200"
    >
      <div
        className="relative h-40"
        style={{ background: `linear-gradient(135deg, ${p.color}, ${p.color}88)` }}
      >
        {p.image && (
          <Image src={p.image.url} alt={p.image.alt} fill sizes="(min-width:1280px) 25vw, (min-width:640px) 40vw, 100vw"
            className="object-cover" />
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold capitalize">
          {p.category.replace('-', ' ')}
        </span>
        <WishButton p={p} className="absolute right-3 top-3 z-10" />
        <span className="absolute bottom-3 right-3 rounded-full bg-white/80 px-2 py-1 text-xs">★ {p.rating}</span>
      </div>
      <div className="p-4">
        <h3 className="font-display text-lg font-semibold">
          <Link href={`/products/${p.id}`} className="after:absolute after:inset-0 hover:underline">
            {p.name}
          </Link>
        </h3>
        <p className="mt-1 text-sm text-slate-500">{p.description}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xl font-bold">{rupees(p.price)}</span>
          <AddToCartButton
            p={p}
            className="relative z-10 rounded-full px-4 py-1.5 text-sm font-semibold text-white"
          />
        </div>
      </div>
    </motion.article>
  );
}
