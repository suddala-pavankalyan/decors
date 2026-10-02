export interface ProductImage { url: string; alt: string }
export interface Product {
  id: string; name: string; category: string; price: number;
  color: string; colorName: string; tags: string[]; rating: number; description: string;
  image: ProductImage | null;
}
export interface ProductDetail extends Product { images: ProductImage[]; related: Product[] }
export interface ProductPage { total: number; items: Product[]; hasMore: boolean }
export interface Hall { category: string; count: number; colors: string[] }
export interface Overview {
  halls: Hall[]; featured: Product[]; popularTags: string[];
  colors: { name: string; hex: string }[]; tags: string[];
}
export interface Facets {
  categories: string[]; colors: { name: string; hex: string }[]; tags: string[]; maxPrice: number;
}
export interface Filters {
  q: string; categories: string[]; colors: string[]; tags: string[]; maxPrice: number; sort: string;
}

export const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function fetchFacets(): Promise<Facets> {
  const r = await fetch(`${API}/products/facets`, { cache: 'no-store' });
  return r.json();
}

export const PAGE_SIZE = 24;

export async function fetchOverview(): Promise<Overview> {
  const r = await fetch(`${API}/products/overview`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed to load the overview');
  return r.json();
}

/** One page of results. `offset` skips what's already loaded; `signal` lets callers cancel stale requests. */
export async function fetchProducts(
  f: Filters,
  opts: { limit?: number; offset?: number; signal?: AbortSignal } = {},
): Promise<ProductPage> {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q.trim());
  if (f.categories.length) p.set('categories', f.categories.join(','));
  if (f.colors.length) p.set('colors', f.colors.join(','));
  if (f.tags.length) p.set('tags', f.tags.join(','));
  if (f.maxPrice > 0) p.set('maxPrice', String(f.maxPrice));
  if (f.sort) p.set('sort', f.sort);
  p.set('limit', String(opts.limit ?? PAGE_SIZE));
  if (opts.offset) p.set('offset', String(opts.offset));
  const r = await fetch(`${API}/products?${p}`, { cache: 'no-store', signal: opts.signal });
  if (!r.ok) throw new Error('Failed to load products');
  return r.json();
}

export async function fetchProduct(id: string): Promise<ProductDetail | null> {
  const r = await fetch(`${API}/products/${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('Failed to load product');
  return r.json();
}
