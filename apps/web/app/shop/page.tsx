import { Suspense } from 'react';
import type { Metadata } from 'next';
import Catalog from '@/components/Catalog';

export const metadata: Metadata = {
  title: 'Shop — Decors',
  description: 'Browse wedding cards, gift cards, wall decor and paints. Filter by colour, occasion and style.',
};

export default function ShopPage() {
  return (
    <main>
      <Suspense fallback={<p className="p-10 text-center">Loading…</p>}>
        <Catalog />
      </Suspense>
    </main>
  );
}
