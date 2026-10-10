import { Suspense } from 'react';
import type { Metadata } from 'next';
import Catalog from '@/components/Catalog';
import { fetchFacets, fetchProducts, type Facets, type ProductPage } from '@/lib/api';
import { FOCUS_CATEGORY } from '@/lib/focus';
import { filtersFromParams } from '@/lib/filters';

export const metadata: Metadata = {
  title: 'Shop — Decors',
  description: FOCUS_CATEGORY ? 'Browse wedding cards and personalise one with your names, date and venue.' : 'Browse wedding cards, gift cards, wall decor and paints. Filter by colour, occasion and style.',
};

// Results depend on the URL, so render per request.
export const dynamic = 'force-dynamic';

type Params = Record<string, string | string[] | undefined>;

export default async function ShopPage({ searchParams }: { searchParams: Params }) {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    const value = Array.isArray(v) ? v[0] : v;
    if (value !== undefined) query.set(k, value);
  }
  const filters = filtersFromParams(query);

  // Fetch the filter options and the first page of results together, before the page is sent,
  // so shoppers see products immediately instead of a spinner followed by a request chain.
  let facets: Facets | null = null;
  let page: ProductPage | null = null;
  try {
    [facets, page] = await Promise.all([fetchFacets(), fetchProducts(filters)]);
  } catch {
    /* the client will retry and show a message if the API is really down */
  }
  const initialFilters = facets
    ? { ...filters, maxPrice: filters.maxPrice > 0 ? Math.min(filters.maxPrice, facets.maxPrice) : facets.maxPrice }
    : filters;

  return (
    <main>
      <Suspense fallback={<p className="p-10 text-center">Loading…</p>}>
        <Catalog initialFacets={facets} initialPage={facets ? page : null} initialFilters={initialFilters} />
      </Suspense>
    </main>
  );
}
