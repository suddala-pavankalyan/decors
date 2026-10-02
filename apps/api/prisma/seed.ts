import { Category, PrismaClient } from '@prisma/client';
import { SEED_PRODUCTS } from './seed-data';

const prisma = new PrismaClient();
const toEnum = (c: string) => c.toUpperCase().replace(/-/g, '_') as Category;

async function main() {
  await prisma.product.deleteMany();
  for (const p of SEED_PRODUCTS) {
    await prisma.product.create({
      data: {
        name: p.name,
        category: toEnum(p.category),
        price: p.price,
        rating: p.rating,
        description: p.description,
        color: {
          connectOrCreate: {
            where: { name: p.colorName },
            create: { name: p.colorName, hex: p.color },
          },
        },
        tags: {
          connectOrCreate: p.tags.map((name) => ({ where: { name }, create: { name } })),
        },
      },
    });
  }
  console.log(`Seeded ${SEED_PRODUCTS.length} products`);
}

main().finally(() => prisma.$disconnect());
