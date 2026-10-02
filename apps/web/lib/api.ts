export interface Product {
  id: string; name: string; category: string; price: number;
  color: string; colorName: string; tags: string[]; rating: number; description: string;
}
export interface Facets {
  categories: string[]; colors: { name: string; hex: string }[]; tags: string[]; maxPrice: number;
}
export interface Filters {
  q: string; categories: string[]; colors: string[]; tags: string[]; maxPrice: number; sort: string;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function fetchFacets(): Promise<Facets> {
  const r = await fetch(`${API}/products/facets`, { cache: 'no-store' });
  return r.json();
}

export async function fetchProducts(f: Filters): Promise<{ total: number; items: Product[] }> {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.categories.length) p.set('categories', f.categories.join(','));
  if (f.colors.length) p.set('colors', f.colors.join(','));
  if (f.tags.length) p.set('tags', f.tags.join(','));
  p.set('maxPrice', String(f.maxPrice));
  if (f.sort) p.set('sort', f.sort);
  const r = await fetch(`${API}/products?${p}`, { cache: 'no-store' });
  return r.json();
}
