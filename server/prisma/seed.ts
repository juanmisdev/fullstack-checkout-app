// Seed script — dummy products required by the test. Run: npx ts-node prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PRODUCTS = [
  {
    id: 'prod_001',
    name: 'Wireless Headphones',
    description: 'Noise-cancelling over-ear wireless headphones, 30h battery life.',
    priceInCents: 250000,
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=600&fit=crop&auto=format',
    stock: 12,
  },
  {
    id: 'prod_002',
    name: 'Mechanical Keyboard',
    description: 'Hot-swappable 75% mechanical keyboard with RGB backlight.',
    priceInCents: 180000,
    imageUrl: 'https://images.unsplash.com/photo-1541140532154-b024d705b90a?w=600&h=600&fit=crop&auto=format',
    stock: 8,
  },
  {
    id: 'prod_003',
    name: 'Running Shoes',
    description: 'Lightweight running shoes with cushioned sole, unisex.',
    priceInCents: 320000,
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=600&fit=crop&auto=format',
    stock: 15,
  },
];

async function main() {
  for (const product of PRODUCTS) {
    // Upsert keeps the seed idempotent: existing products keep their current stock.
    await prisma.product.upsert({
      where: { id: product.id },
      update: {
        name: product.name,
        description: product.description,
        priceInCents: product.priceInCents,
        imageUrl: product.imageUrl,
        stock: product.stock,
      },
      create: product,
    });
  }
  const count = await prisma.product.count();
  console.log(`Seeded ${PRODUCTS.length} products (total in DB: ${count}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());