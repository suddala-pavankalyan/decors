'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  fetchFacets, fetchProducts, type Facets, type Filters, type Product, type ProductPage,
} from '@/lib/api';
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
  { value: 'newest', label: 'Newest first' },
];

/** Identity of a filter set, used to know whether the products on screen are up to date. */
const keyOf = (f: Filters) => JSON.stringify([f.q.trim(), f.categories, f.colors, f.tags, f.maxPrice, f.sort, f.minRating, f.inStock]);

interface Props {
  /** Filter options and the first page, fetched on the server so the page paints with content. */
  initialFacets: Facets | null;
  initialPage: ProductPage | null;
  initialFilters: Filters;
}

export default function Catalog({ initialFacets, initialPage, initialFilters }: Props) {
  const searchParams = useSearchParams();
  const spString = searchParams.toString();
  // The URL is the shareable record of the filters; local state drives the UI so typing stays instant.
  const lastWritten = useRef(spString);
  const [facets, setFacets] = useState<Facets | null>(initialFacets);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [items, setItems] = useState<Product[]>(initialPage?.items ?? []);
  const [total, setTotal] = useState(initialPage?.total ?? 0);
  const [corrected, setCorrected] = useState<string | null>(initialPage?.correctedQuery ?? null);
  const [hasMore, setHasMore] = useState(initialPage?.hasMore ?? false);
  const [loading, setLoading] = useState(initialPage === null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  // Which filters the items on screen belong to (null until the first results arrive).
  const shownKey = useRef<string | null>(initialPage ? keyOf(initialFilters) : null);
  const moreCtl = useRef<AbortController | null>(null);

  // Server couldn't prefetch (API was down then): load the filter options in the browser.
  useEffect(() => {
    if (facets) return;
    fetchFacets()
      .then((f) => {
        setFacets(f);
        setFilters((x) => ({ ...x, maxPrice: x.maxPrice > 0 ? Math.min(x.maxPrice, f.maxPrice) : f.maxPrice }));
      })
      .catch(() => setError('We couldn’t reach the shop right now. Please try again.'));
  }, [facets]);

  // Someone arrived via a different link (e.g. a category tile) while this page was already open.
  useEffect(() => {
    if (spString === lastWritten.current) return;
    lastWritten.current = spString;
    setFilters((x) => {
      const next = filtersFromParams(new URLSearchParams(spString));
      return { ...next, maxPrice: next.maxPrice > 0 ? next.maxPrice : facets?.maxPrice ?? x.maxPrice };
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

  // Fetch the first page whenever the filters change. Older requests are cancelled, so a slow
  // earlier response can never overwrite the results of a newer search.
  useEffect(() => {
    if (!facets) return;
    const key = keyOf(filters);
    if (key === shownKey.current) { setLoading(false); return; }
    moreCtl.current?.abort();
    const ctl = new AbortController();
    // Typing is debounced; chips, sort and links fetch immediately.
    const typing = filters.q.trim() !== (shownKey.current ? JSON.parse(shownKey.current)[0] : '');
    const t = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const page = await fetchProducts(filters, { signal: ctl.signal });
        setItems(page.items);
        setCorrected(page.correctedQuery ?? null);
        setTotal(page.total);
        setHasMore(page.hasMore);
        shownKey.current = key;
        setLoading(false);
      } catch (e) {
        if (ctl.signal.aborted) return; // superseded by a newer request
        setError('We couldn’t update the results. Please try again.');
        setLoading(false);
      }
    }, typing ? 200 : 0);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [filters, facets]);

  const loadMore = useCallback(async () => {
    const key = keyOf(filters);
    if (key !== shownKey.current || loadingMore) return;
    const ctl = new AbortController();
    moreCtl.current = ctl;
    setLoadingMore(true);
    setError('');
    try {
      const page = await fetchProducts(filters, { offset: items.length, signal: ctl.signal });
      if (shownKey.current !== key) return; // filters changed while loading
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.items.filter((p) => !seen.has(p.id))];
      });
      setTotal(page.total);
      setHasMore(page.hasMore);
    } catch {
      if (!ctl.signal.aborted) setError('We couldn’t load more products. Please try again.');
    } finally {
      if (!ctl.signal.aborted) setLoadingMore(false);
    }
  }, [filters, items.length, loadingMore]);

  if (!facets) {
    return (
      <div className="mx-auto max-w-7xl px-4 pb-16 text-center">
        {error ? <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p> : <p className="p-10">Loading…</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16">
    <div className="mb-6">
      <h1 className="text-4xl font-extrabold">The <span className="text-spectrum">collection</span></h1>
      <p className="mt-1 text-slate-500" aria-live="polite">
        {total} piece{total === 1 ? '' : 's'}{filters.q.trim() ? <> for “{corrected ?? filters.q.trim()}”</> : null}
      </p>
      {corrected && (
        <p className="mt-1 text-sm text-slate-500" data-testid="did-you-mean">
          No exact matches for “{filters.q.trim()}”, so we corrected the spelling.{' '}
          <button type="button" onClick={() => setFilters({ ...filters, q: corrected })} className="font-semibold text-fuchsia-700 hover:underline">Search “{corrected}”</button>
        </p>
      )}
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

        {error && (
          <p role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">
            {error}
            <button type="button" onClick={() => { shownKey.current = null; setFilters((f) => ({ ...f })); }}
              className="shrink-0 font-semibold underline">Retry</button>
          </p>
        )}

        {/* Old results stay on screen (slightly faded) while new ones load, so the page never goes blank. */}
        <motion.div layout aria-busy={loading} className={`grid gap-5 transition-opacity sm:grid-cols-2 xl:grid-cols-3 ${loading ? 'opacity-60' : ''}`}>
          <AnimatePresence mode="popLayout" initial={false}>
            {items.map((p, i) => <ProductCard key={p.id} p={p} priority={i < 3} />)}
          </AnimatePresence>
        </motion.div>

        {!loading && items.length === 0 && !error && (
          <p className="mt-10 text-center text-slate-500">No matches — try loosening a filter.</p>
        )}

        {hasMore && (
          <div className="mt-8 text-center">
            <button type="button" onClick={loadMore} disabled={loadingMore || loading}
              className="rounded-full border border-slate-300 bg-white px-8 py-2.5 text-sm font-semibold transition hover:border-fuchsia-400 hover:text-fuchsia-700 disabled:opacity-60">
              {loadingMore ? 'Loading…' : `Show more (${Math.max(total - items.length, 0)} left)`}
            </button>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}

