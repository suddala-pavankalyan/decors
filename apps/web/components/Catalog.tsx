'use client';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { fetchFacets, fetchProducts, type Facets, type Filters, type Product } from '@/lib/api';
import { filtersFromParams, filtersToQuery } from '@/lib/filters';
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
  const searchParams = useSearchParams();
  const spString = searchParams.toString();
  // The URL is the shareable record of the filters; local state drives the UI so typing stays instant.
  const lastWritten = useRef(spString);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [filters, setFilters] = useState<Filters>(() => filtersFromParams(searchParams));
  const [items, setItems] = useState<Product[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchFacets()
      .then((f) => {
        setFacets(f);
        // No price in the URL (0) or one above the catalog's top price: show everything.
        setFilters((x) => ({ ...x, maxPrice: x.maxPrice > 0 ? Math.min(x.maxPrice, f.maxPrice) : f.maxPrice }));
      })
      .catch(() => setError(true));
  }, []);

  // Someone arrived via a different link (e.g. a category tile) while this page was already open.
  useEffect(() => {
    if (spString === lastWritten.current) return;
    lastWritten.current = spString;
    setFilters((x) => {
      const next = filtersFromParams(new URLSearchParams(spString));
      return { ...next, maxPrice: next.maxPrice > 0 ? next.maxPrice : facets?.maxPrice ?? 0 };
    });
  }, [spString, facets]);

  // Keep the address bar in step with the filters.
  useEffect(() => {
    if (!facets) return;
    const qs = filtersToQuery(filters, facets.maxPrice);
    if (qs === lastWritten.current) return;
    lastWritten.current = qs;
    window.history.replaceState(null, '', qs ? `/shop?${qs}` : '/shop');
  }, [filters, facets]);

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
    <div className="mx-auto max-w-7xl px-4 pb-16">
    <div className="mb-6">
      <h1 className="font-display text-4xl font-bold">The <span className="text-spectrum">collection</span></h1>
      <p className="mt-1 text-slate-500" aria-live="polite">
        {items.length} piece{items.length === 1 ? '' : 's'}{filters.q.trim() ? <> for “{filters.q.trim()}”</> : null}
      </p>
    </div>
    <div className="grid gap-6 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
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
    </div>
  );
}
