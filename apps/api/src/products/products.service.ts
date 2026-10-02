import { Injectable } from '@nestjs/common';
import { Product } from './product';
import { SEED_PRODUCTS } from './seed';
import { QueryProductsDto } from './query-products.dto';

@Injectable()
export class ProductsService {
  // In-memory for now; swap for Prisma/Postgres without touching the controller.
  private readonly items: Product[] = SEED_PRODUCTS;

  search(q: QueryProductsDto): { total: number; items: Product[] } {
    const text = q.q?.trim().toLowerCase();
    let out = this.items.filter((p) => {
      if (text && !`${p.name} ${p.description} ${p.tags.join(' ')}`.toLowerCase().includes(text)) return false;
      if (q.categories?.length && !q.categories.includes(p.category)) return false;
      if (q.colors?.length && !q.colors.includes(p.colorName)) return false;
      if (q.tags?.length && !q.tags.some((t) => p.tags.includes(t))) return false;
      if (q.minPrice !== undefined && p.price < q.minPrice) return false;
      if (q.maxPrice !== undefined && p.price > q.maxPrice) return false;
      return true;
    });
    if (q.sort === 'price-asc') out = [...out].sort((a, b) => a.price - b.price);
    if (q.sort === 'price-desc') out = [...out].sort((a, b) => b.price - a.price);
    if (q.sort === 'rating') out = [...out].sort((a, b) => b.rating - a.rating);
    return { total: out.length, items: out };
  }

  facets() {
    const colors = new Map<string, string>();
    const tags = new Set<string>();
    let max = 0;
    for (const p of this.items) {
      colors.set(p.colorName, p.color);
      p.tags.forEach((t) => tags.add(t));
      max = Math.max(max, p.price);
    }
    return {
      categories: ['wedding-cards', 'gift-cards', 'wall-decor', 'paints'],
      colors: [...colors].map(([name, hex]) => ({ name, hex })),
      tags: [...tags].sort(),
      maxPrice: max,
    };
  }
}
