'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import type { Product } from '@/lib/api';
import { useStore } from '@/lib/store';

export default function AddToCartButton({
  p, label = 'Add', className = '',
}: { p: Product; label?: string; className?: string }) {
  const add = useStore((s) => s.addToCart);
  const [added, setAdded] = useState(false);
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
      {added ? '✓ Added' : label}
    </motion.button>
  );
}
