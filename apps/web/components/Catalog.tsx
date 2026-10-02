'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { fetchFacets, fetchProducts, type Facets, type Filters, type Product } from '@/lib/api';
import FilterSidebar from './FilterSidebar';
import ProductCard from './ProductCard';

export default function Catalog() {
  const [facets, setFacets] = useState<Facets | null>(null);
  const [filters, setFilters] = useState<Filters>({
    q: '', categories: [], colors: [], tags: [], maxPrice: 1000, sort: '',
  });
  const [items, setItems] = useState<Product[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchFacets()
      .then((f) => { setFacets(f); setFilters((x) => ({ ...x, maxPrice: f.maxPrice })); })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    if (!facets) return;
    const t = setTimeout(() => {
      fetchProducts(filters).then((r) => setItems(r.items)).catch(() => setError(true));
    }, 150);
    return () => clearTimeout(t);
  }, [filters, facets]);

  if (error) return <p className="p-10 text-center">Couldn’t reach the API. Is it running on port 4000?</p>;
  if (!facets) return <p className="p-10 text-center">Loading…</p>;

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 pb-16 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="lg:sticky lg:top-4 lg:self-start">
        <FilterSidebar facets={facets} filters={filters} onChange={setFilters} />
      </div>
      <div>
        <div className="mb-4 flex gap-3">
          <input
            placeholder="Search cards, decor, paints…" value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            className="min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-5 py-2 outline-none focus:border-fuchsia-400"
          />
          <select value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
            className="w-32 shrink-0 rounded-full border border-slate-200 bg-white px-3 sm:w-auto sm:px-4">
            <option value="">Sort</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="rating">Top rated</option>
          </select>
        </div>
        <motion.div layout className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {items.map((p) => <ProductCard key={p.id} p={p} />)}
          </AnimatePresence>
        </motion.div>
        {items.length === 0 && <p className="mt-10 text-center text-slate-500">No matches — try loosening a filter.</p>}
      </div>
    </div>
  );
}
