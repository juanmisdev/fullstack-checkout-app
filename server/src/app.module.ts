// App module — wires hexagonal layers: interface (controllers) -> application (use cases) -> infrastructure (adapters).
// Persistence adapters are chosen explicitly via PERSISTENCE_DRIVER: 'prisma' uses Postgres/Prisma,
// anything else (default) uses in-memory (local dev and tests). Kept explicit because @prisma/client
// auto-loads .env (including DATABASE_URL) on import, which makes DATABASE_URL-based selection unreliable.

import { Inject, Injectable, Module } from '@nestjs/common';
import { ProductsController, TransactionsController, CheckoutController } from './interface/http/controllers';
import { CheckoutService } from './application/services/checkout.service';
import { TRANSACTION_REPOSITORY, ID_GENERATOR, PRODUCT_REPOSITORY } from './application/ports/tokens';
import { CheckoutUseCase } from './application/use-cases/checkout.use-case';
import {
  InMemoryProductRepository,
  InMemoryTransactionRepository,
  InMemoryCustomerRepository,
  InMemoryDeliveryRepository,
} from './infrastructure/persistence/in-memory.repositories';
import {
  PrismaProductRepository,
  PrismaTransactionRepository,
  PrismaCustomerRepository,
  PrismaDeliveryRepository,
} from './infrastructure/persistence/prisma.repositories';
import { PaymentGatewayAdapter } from './infrastructure/gateways/payment-gateway.adapter';
import { ProductRepositoryPort, TransactionRepositoryPort, CustomerRepositoryPort, DeliveryRepositoryPort } from './application/ports/ports';
import { Product } from './domain/products/product.entity';

const USE_PRISMA = process.env.PERSISTENCE_DRIVER === 'prisma';

@Injectable()
class UuidGenerator {
  generate(): string {
    return `tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

type ProductRepo = ProductRepositoryPort & {
  list(): Promise<Product[]>;
  seed?(products: Product[]): void;
  ensureSeeded?(): Promise<void>;
};

// Shared seeding: Prisma repo seeds only when the table is empty; in-memory always seeds.
async function seedProducts(productRepo: ProductRepo): Promise<void> {
  if (typeof productRepo.ensureSeeded === 'function') {
    await productRepo.ensureSeeded();
    return;
  }
  if (typeof productRepo.seed === 'function')
    productRepo.seed([
    Product.create({
      id: 'prod_001',
      name: 'Wireless Headphones',
      description: 'Noise-cancelling over-ear wireless headphones, 30h battery life.',
      priceInCents: 250000,
      imageUrl: 'https://picsum.photos/seed/headphones/600/600',
      stock: 12,
    }),
    Product.create({
      id: 'prod_002',
      name: 'Mechanical Keyboard',
      description: 'Hot-swappable 75% mechanical keyboard with RGB backlight.',
      priceInCents: 180000,
      imageUrl: 'https://picsum.photos/seed/keyboard/600/600',
      stock: 8,
    }),
    Product.create({
      id: 'prod_003',
      name: 'Running Shoes',
      description: 'Lightweight running shoes with cushioned sole, unisex.',
      priceInCents: 320000,
      imageUrl: 'https://picsum.photos/seed/shoes/600/600',
      stock: 15,
    }),
  ]);
}

@Module({
  controllers: [ProductsController, TransactionsController, CheckoutController],
  providers: [
    CheckoutService,
    CheckoutUseCase,
    { provide: UuidGenerator, useClass: UuidGenerator },
    PaymentGatewayAdapter,
    // Both adapter families are registered as injectable providers so Nest can
    // always resolve the factory injects; the repo factories pick per driver.
    InMemoryProductRepository,
    InMemoryTransactionRepository,
    InMemoryCustomerRepository,
    InMemoryDeliveryRepository,
    PrismaProductRepository,
    PrismaTransactionRepository,
    PrismaCustomerRepository,
    PrismaDeliveryRepository,
    {
      provide: 'PRODUCT_REPO',
      useFactory: (prisma: PrismaProductRepository, mem: InMemoryProductRepository) => (USE_PRISMA ? prisma : mem),
      inject: [PrismaProductRepository, InMemoryProductRepository],
    },
    {
      provide: 'TX_REPO',
      useFactory: (prisma: PrismaTransactionRepository, mem: InMemoryTransactionRepository) => (USE_PRISMA ? prisma : mem),
      inject: [PrismaTransactionRepository, InMemoryTransactionRepository],
    },
    {
      provide: 'CUSTOMER_REPO',
      useFactory: (prisma: PrismaCustomerRepository, mem: InMemoryCustomerRepository) => (USE_PRISMA ? prisma : mem),
      inject: [PrismaCustomerRepository, InMemoryCustomerRepository],
    },
    {
      provide: 'DELIVERY_REPO',
      useFactory: (prisma: PrismaDeliveryRepository, mem: InMemoryDeliveryRepository) => (USE_PRISMA ? prisma : mem),
      inject: [PrismaDeliveryRepository, InMemoryDeliveryRepository],
    },
    {
      // The use case is a plain class (no Nest decorators), so wire it explicitly:
      // constructor(repo, txRepo, customerRepo, deliveryRepo, gateway, idGenerator)
      provide: CheckoutUseCase,
      useFactory: (productRepo, transactionRepo, customerRepo, deliveryRepo, gateway: PaymentGatewayAdapter, idGenerator: UuidGenerator) =>
        new CheckoutUseCase(productRepo, transactionRepo, customerRepo, deliveryRepo, gateway, idGenerator),
      inject: ['PRODUCT_REPO', 'TX_REPO', 'CUSTOMER_REPO', 'DELIVERY_REPO', PaymentGatewayAdapter, UuidGenerator],
    },
    { provide: TRANSACTION_REPOSITORY, useExisting: 'TX_REPO' },
    { provide: PRODUCT_REPOSITORY, useExisting: 'PRODUCT_REPO' },
    { provide: ID_GENERATOR, useClass: UuidGenerator },
  ],
})
export class AppModule {
  constructor(@Inject('PRODUCT_REPO') private readonly productRepo: ProductRepo) {
    void seedProducts(this.productRepo);
  }
}