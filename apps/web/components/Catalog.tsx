'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { fetchFacets, fetchProducts, type Facets, type Filters, type Product } from '@/lib/api';
import Dropdown, { type Option } from './Dropdown';
import FilterSidebar from './FilterSidebar';
import ProductCard from './ProductCard';
import SearchBox from './SearchBox';

const SORT_OPTIONS: Option[] = [
  { value: '', label: 'Featured' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
];

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
        <div className="relative z-30 mb-4 flex gap-3">
          <SearchBox facets={facets} filters={filters} onChange={setFilters} />
          <Dropdown
            ariaLabel="Sort products"
            placeholder="Sort by"
            value={filters.sort}
            onChange={(sort) => setFilters({ ...filters, sort })}
            options={SORT_OPTIONS}
            className="w-40 shrink-0 sm:w-52"
          />
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
