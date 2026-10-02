import type { Filters } from '@/lib/api';

export const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export const hasActiveFilters = (f: Filters) =>
  f.q.trim() !== '' || f.categories.length > 0 || f.colors.length > 0 || f.tags.length > 0;

/** Clears search + facet filters but keeps price cap and sort. */
export const clearFilters = (f: Filters): Filters => ({ ...f, q: '', categories: [], colors: [], tags: [] });
