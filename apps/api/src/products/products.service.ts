import { Injectable } from '@nestjs/common';
import { Category, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryProductsDto } from './query-products.dto';
import { Product } from './product';

const toEnum = (c: string) => c.toUpperCase().replace(/-/g, '_') as Category;
const fromEnum = (c: Category) => c.toLowerCase().replace(/_/g, '-') as Product['category'];
const CATEGORIES = Object.values(Category);

const include = { color: true, tags: true } satisfies Prisma.ProductInclude;
type Row = Prisma.ProductGetPayload<{ include: typeof include }>;

const toDto = (r: Row): Product => ({
  id: r.id,
  name: r.name,
  category: fromEnum(r.category),
  price: r.price,
  color: r.color.hex,
  colorName: r.color.name,
  tags: r.tags.map((t) => t.name),
  rating: r.rating,
  description: r.description,
});

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async search(q: QueryProductsDto): Promise<{ total: number; items: Product[] }> {
    const text = q.q?.trim();
    const categories = q.categories?.map(toEnum).filter((c) => CATEGORIES.includes(c));
    const where: Prisma.ProductWhereInput = {
      ...(text && {
        OR: [
          { name: { contains: text, mode: 'insensitive' } },
          { description: { contains: text, mode: 'insensitive' } },
          { tags: { some: { name: { contains: text, mode: 'insensitive' } } } },
        ],
      }),
      ...(q.categories?.length && { category: { in: categories } }),
      ...(q.colors?.length && { color: { name: { in: q.colors } } }),
      ...(q.tags?.length && { tags: { some: { name: { in: q.tags } } } }),
      ...((q.minPrice !== undefined || q.maxPrice !== undefined) && {
        price: { gte: q.minPrice, lte: q.maxPrice },
      }),
    };
    const orderBy: Prisma.ProductOrderByWithRelationInput =
      q.sort === 'price-asc' ? { price: 'asc' }
      : q.sort === 'price-desc' ? { price: 'desc' }
      : q.sort === 'rating' ? { rating: 'desc' }
      : { createdAt: 'asc' };

    const rows = await this.prisma.product.findMany({ where, orderBy, include });
    return { total: rows.length, items: rows.map(toDto) };
  }

  async facets() {
    const [colors, tags, max] = await Promise.all([
      this.prisma.color.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.tag.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.product.aggregate({ _max: { price: true } }),
    ]);
    return {
      categories: CATEGORIES.map(fromEnum),
      colors: colors.map((c) => ({ name: c.name, hex: c.hex })),
      tags: tags.map((t) => t.name),
      maxPrice: max._max.price ?? 0,
    };
  }
}
