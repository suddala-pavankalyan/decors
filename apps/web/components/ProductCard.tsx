'use client';
import { motion } from 'framer-motion';
import type { Product } from '@/lib/api';

export default function ProductCard({ p }: { p: Product }) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -8, rotate: -0.5 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className="overflow-hidden rounded-3xl bg-white shadow-lg shadow-slate-200"
    >
      <div
        className="relative h-40"
        style={{ background: `linear-gradient(135deg, ${p.color}, ${p.color}88)` }}
      >
        <span className="absolute left-3 top-3 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold capitalize">
          {p.category.replace('-', ' ')}
        </span>
        <span className="absolute bottom-3 right-3 rounded-full bg-white/80 px-2 py-1 text-xs">★ {p.rating}</span>
      </div>
      <div className="p-4">
        <h3 className="font-display text-lg font-semibold">{p.name}</h3>
        <p className="mt-1 text-sm text-slate-500">{p.description}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xl font-bold">${p.price}</span>
          <motion.button
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.05 }}
            className="rounded-full px-4 py-1.5 text-sm font-semibold text-white"
            style={{ background: p.color }}
          >
            Add
          </motion.button>
        </div>
      </div>
    </motion.article>
  );
}
