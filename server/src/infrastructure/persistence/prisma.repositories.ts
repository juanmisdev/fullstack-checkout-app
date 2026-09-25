// Infrastructure adapters — Prisma/PostgreSQL repositories, driven by the SAME ports.
// Swappable with the in-memory adapters: hexagonal ports remain untouched.

import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ProductRepositoryPort, TransactionRepositoryPort, CustomerRepositoryPort, DeliveryRepositoryPort } from '../../application/ports/ports';
import { Product } from '../../domain/products/product.entity';
import { Transaction } from '../../domain/transactions/transaction.entity';
import { Customer, Delivery } from '../../domain/customers/customer.entity';
import { InsufficientStockError } from '../../domain/shared/errors';

const prisma = new PrismaClient({
  datasources: process.env.DATABASE_URL?.includes('pool_timeout')
    ? undefined
    : {
        db: {
          url:
            process.env.DATABASE_URL +
            (process.env.DATABASE_URL?.includes('?') ? '&' : '?') +
            'pool_timeout=25&connection_limit=2',
        },
      },
});

@Injectable()
export class PrismaProductRepository implements ProductRepositoryPort {
  // Seed only when the table is empty — keeps behavior parity with in-memory seeding.
  async ensureSeeded(): Promise<void> {
    const count = await prisma.product.count();
    if (count > 0) return;
    await prisma.product.createMany({
      data: [
        {
          id: 'prod_001',
          name: 'Wireless Headphones',
          description: 'Noise-cancelling over-ear wireless headphones, 30h battery life.',
          priceInCents: 250000,
          imageUrl: 'https://picsum.photos/seed/headphones/600/600',
          stock: 12,
        },
        {
          id: 'prod_002',
          name: 'Mechanical Keyboard',
          description: 'Hot-swappable 75% mechanical keyboard with RGB backlight.',
          priceInCents: 180000,
          imageUrl: 'https://picsum.photos/seed/keyboard/600/600',
          stock: 8,
        },
        {
          id: 'prod_003',
          name: 'Running Shoes',
          description: 'Lightweight running shoes with cushioned sole, unisex.',
          priceInCents: 320000,
          imageUrl: 'https://picsum.photos/seed/shoes/600/600',
          stock: 15,
        },
      ],
    });
  }

  async findById(id: string): Promise<Product | null> {
    const row = await prisma.product.findUnique({ where: { id } });
    return row ? Product.fromPersistence(row) : null;
  }

  async list(): Promise<Product[]> {
    const rows = await prisma.product.findMany({ orderBy: { id: 'asc' } });
    return rows.map((row) => Product.fromPersistence(row));
  }

  async decreaseStock(id: string, units: number): Promise<Product> {
    // Atomic conditional update: fails if stock became insufficient concurrently.
    const rows = await prisma.$queryRaw<Array<{ id: string; name: string; description: string; priceInCents: number; imageUrl: string; stock: number }>>`
      UPDATE "Product" SET stock = stock - ${units}
      WHERE id = ${id} AND stock >= ${units}
      RETURNING id, name, description, "priceInCents", "imageUrl", stock`;
    const row = rows[0];
    if (!row) throw new InsufficientStockError();
    return Product.fromPersistence(row);
  }
}

@Injectable()
export class PrismaTransactionRepository implements TransactionRepositoryPort {
  async save(transaction: Transaction): Promise<void> {
    const props = transaction instanceof Transaction ? transaction['props'] : transaction;
    await prisma.transaction.upsert({
      where: { id: props.id },
      update: {
        status: props.status,
        gatewayTransactionId: props.gatewayTransactionId,
        updatedAt: new Date(),
      },
      create: {
        id: props.id,
        productRef: props.productRef,
        customerRef: props.customerRef,
        amountInCents: props.amountInCents,
        baseFeeInCents: props.baseFeeInCents,
        deliveryFeeInCents: props.deliveryFeeInCents,
        status: props.status,
        gatewayTransactionId: props.gatewayTransactionId,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      },
    });
  }

  async findById(id: string): Promise<Transaction | null> {
    const row = await prisma.transaction.findUnique({ where: { id } });
    return row ? Transaction.fromPersistence({
      id: row.id,
      productRef: row.productRef,
      customerRef: row.customerRef,
      amountInCents: row.amountInCents,
      baseFeeInCents: row.baseFeeInCents,
      deliveryFeeInCents: row.deliveryFeeInCents,
      status: row.status as Transaction['props']['status'],
      gatewayTransactionId: row.gatewayTransactionId ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }) : null;
  }
}

@Injectable()
export class PrismaCustomerRepository implements CustomerRepositoryPort {
  async save(customer: Customer): Promise<void> {
    const props = customer['props'];
    await prisma.customer.upsert({
      where: { id: props.id },
      update: {},
      create: {
        id: props.id,
        fullName: props.fullName,
        email: props.email,
        phone: props.phone,
        createdAt: props.createdAt,
      },
    });
  }

  async findById(id: string): Promise<Customer | null> {
    const row = await prisma.customer.findUnique({ where: { id } });
    return row ? Customer.fromPersistence(row) : null;
  }
}

@Injectable()
export class PrismaDeliveryRepository implements DeliveryRepositoryPort {
  async save(delivery: Delivery): Promise<void> {
    const props = delivery['props'];
    await prisma.delivery.upsert({
      where: { id: props.id },
      update: {},
      create: {
        id: props.id,
        transactionRef: props.transactionRef,
        customerRef: props.customerRef,
        productRef: props.productRef,
        address: props.address,
        city: props.city,
        postalCode: props.postalCode,
        status: props.status,
        createdAt: props.createdAt,
      },
    });
  }
}