import type { Filters } from '@/lib/api';

export const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export const hasActiveFilters = (f: Filters) =>
  f.q.trim() !== '' || f.categories.length > 0 || f.colors.length > 0 || f.tags.length > 0 || f.minRating > 0 || f.inStock;

/** Clears search + facet filters but keeps price cap and sort. */
export const clearFilters = (f: Filters): Filters => ({ ...f, q: '', categories: [], colors: [], tags: [], minRating: 0, inStock: false });

const SORTS = ['price-asc', 'price-desc', 'rating', 'newest'];
const csv = (v: string | null) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

/** Read shop filters from a URL query. `maxPrice` is 0 when the URL doesn't set one (filled in once the catalog loads). */
export function filtersFromParams(p: { get(name: string): string | null }): Filters {
  const max = Number(p.get('maxPrice'));
  const sort = p.get('sort') ?? '';
  return {
    q: p.get('q') ?? '',
    categories: csv(p.get('categories')),
    colors: csv(p.get('colors')),
    tags: csv(p.get('tags')),
    maxPrice: Number.isFinite(max) && max > 0 ? max : 0,
    sort: SORTS.includes(sort) ? sort : '',
    minRating: [3, 4].includes(Number(p.get('minRating'))) ? Number(p.get('minRating')) : 0,
    inStock: p.get('inStock') === 'true',
  };
}

/** Query string for the current filters; defaults are left out so URLs stay short. */
export function filtersToQuery(f: Filters, catalogMax: number): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q.trim());
  if (f.categories.length) p.set('categories', f.categories.join(','));
  if (f.colors.length) p.set('colors', f.colors.join(','));
  if (f.tags.length) p.set('tags', f.tags.join(','));
  if (f.maxPrice > 0 && f.maxPrice < catalogMax) p.set('maxPrice', String(f.maxPrice));
  if (f.minRating > 0) p.set('minRating', String(f.minRating));
  if (f.inStock) p.set('inStock', 'true');
  if (f.sort) p.set('sort', f.sort);
  return p.toString();
}
