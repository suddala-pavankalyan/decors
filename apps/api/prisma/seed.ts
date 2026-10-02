import { Category, PrismaClient } from '@prisma/client';
import { SEED_PRODUCTS } from './seed-data';

const prisma = new PrismaClient();
const toEnum = (c: string) => c.toUpperCase().replace(/-/g, '_') as Category;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

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
        images: {
          create: [0, 1, 2].map((i) => ({
            position: i,
            alt: `${p.name} – view ${i + 1}`,
            // Placeholder photos; replace with real uploads (S3/Cloudinary) later.
            url: `https://picsum.photos/seed/${slug(p.name)}-${i}/1200/900`,
          })),
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
