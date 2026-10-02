import { Category } from '@prisma/client';

export const CATEGORY_SLUGS = Object.values(Category).map((c) => fromEnum(c));
export const toEnum = (c: string) => c.toUpperCase().replace(/-/g, '_') as Category;
export function fromEnum(c: Category): 'wedding-cards' | 'gift-cards' | 'wall-decor' | 'paints' {
  return c.toLowerCase().replace(/_/g, '-') as ReturnType<typeof fromEnum>;
}
