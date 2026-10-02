import { Injectable, NotFoundException } from '@nestjs/common';
import { Category, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { publicUrl } from '../uploads/public-url';
import { fromEnum, toEnum } from './category';
import { QueryProductsDto } from './query-products.dto';
import { Product, ProductDetail, ProductSummary } from './product';

const CATEGORIES = Object.values(Category);

export const DEFAULT_PAGE_SIZE = 24;

/** What a product card needs: only the first photo is loaded (lists never show the rest). */
export const include = {
  color: true,
  tags: true,
  images: { orderBy: [{ position: 'asc' }, { id: 'asc' }], take: 1 },
} satisfies Prisma.ProductInclude;
type Row = Prisma.ProductGetPayload<{ include: typeof include }>;

/** The detail page needs every photo. */
const includeAllImages = {
  color: true,
  tags: true,
  images: { orderBy: [{ position: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.ProductInclude;

export const toDto = (r: Row): ProductSummary => ({
  id: r.id,
  name: r.name,
  category: fromEnum(r.category),
  price: r.price,
  color: r.color.hex,
  colorName: r.color.name,
  tags: r.tags.map((t) => t.name),
  rating: r.rating,
  description: r.description,
  image: r.images[0] ? { url: publicUrl(r.images[0].url), alt: r.images[0].alt } : null,
});

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async search(q: QueryProductsDto): Promise<{ total: number; items: ProductSummary[]; hasMore: boolean }> {
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
    // `id` breaks ties so pages never repeat or skip a product when many share a price/rating.
    const orderBy: Prisma.ProductOrderByWithRelationInput[] =
      q.sort === 'price-asc' ? [{ price: 'asc' }, { id: 'asc' }]
      : q.sort === 'price-desc' ? [{ price: 'desc' }, { id: 'asc' }]
      : q.sort === 'rating' ? [{ rating: 'desc' }, { id: 'asc' }]
      : [{ createdAt: 'asc' }, { id: 'asc' }];
    const take = q.limit ?? DEFAULT_PAGE_SIZE;
    const skip = q.offset ?? 0;

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({ where, orderBy, skip, take, include }),
    ]);
    return { total, items: rows.map(toDto), hasMore: skip + rows.length < total };
  }

  /**
   * Everything the landing page needs in one round trip, computed in the database
   * (counts and colours per category, the top-rated pieces, popular tags) instead of
   * downloading the whole catalog to count it in the browser.
   */
  async overview() {
    const [facets, perCategoryColour, featured, popular] = await Promise.all([
      this.facets(),
      this.prisma.product.groupBy({ by: ['category', 'colorId'], _count: { _all: true } }),
      this.prisma.product.findMany({ orderBy: [{ rating: 'desc' }, { id: 'asc' }], take: 6, include }),
      this.prisma.tag.findMany({
        where: { products: { some: {} } },
        orderBy: [{ products: { _count: 'desc' } }, { name: 'asc' }],
        take: 5,
        select: { name: true },
      }),
    ]);
    const hexById = new Map((await this.prisma.color.findMany({ select: { id: true, hex: true } })).map((c) => [c.id, c.hex]));
    const halls = CATEGORIES.map((c) => {
      const rows = perCategoryColour.filter((r) => r.category === c).sort((a, b) => b._count._all - a._count._all);
      return {
        category: fromEnum(c),
        count: rows.reduce((n, r) => n + r._count._all, 0),
        colors: rows.slice(0, 6).map((r) => hexById.get(r.colorId)).filter((h): h is string => !!h),
      };
    });
    return {
      halls,
      featured: featured.map(toDto),
      popularTags: popular.map((t) => t.name),
      colors: facets.colors,
      tags: facets.tags,
    };
  }

  async findOne(id: string): Promise<ProductDetail> {
    const row = await this.prisma.product.findUnique({ where: { id }, include: includeAllImages });
    if (!row) throw new NotFoundException('Product not found');
    const related = await this.prisma.product.findMany({
      where: {
        id: { not: id },
        OR: [{ category: row.category }, { colorId: row.colorId }],
      },
      include,
      take: 4,
      orderBy: { rating: 'desc' },
    });
    return {
      ...toDto(row),
      images: row.images.map((i) => ({ url: publicUrl(i.url), alt: i.alt })),
      related: related.map(toDto),
    };
  }

  async facets() {
    const [colors, tags, max] = await Promise.all([
      // Only offer colours/tags that at least one product uses (deleted products can leave them behind).
      this.prisma.color.findMany({ where: { products: { some: {} } }, orderBy: { id: 'asc' } }),
      this.prisma.tag.findMany({ where: { products: { some: {} } }, orderBy: { name: 'asc' } }),
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
