'use client';
import { useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import type { ProductImage } from '@/lib/api';

export default function Gallery({ images, accent }: { images: ProductImage[]; accent: string }) {
  const [i, setI] = useState(0);
  if (images.length === 0) {
    return <div className="aspect-[4/3] rounded-3xl" style={{ background: accent }} />;
  }
  return (
    <div>
      <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-xl" style={{ background: accent }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0"
          >
            <Image src={images[i].url} alt={images[i].alt} fill priority sizes="(min-width:1024px) 50vw, 100vw"
              className="object-cover" />
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="mt-3 flex gap-3">
        {images.map((img, idx) => (
          <motion.button
            key={img.url} type="button" whileHover={{ y: -3 }} whileTap={{ scale: 0.95 }}
            onClick={() => setI(idx)} aria-label={`Show image ${idx + 1}`}
            className={`relative h-20 w-24 overflow-hidden rounded-xl border-2 ${
              idx === i ? 'border-fuchsia-500' : 'border-transparent opacity-70'
            }`}
          >
            <Image src={img.url} alt="" fill sizes="96px" className="object-cover" />
          </motion.button>
        ))}
      </div>
    </div>
  );
}
