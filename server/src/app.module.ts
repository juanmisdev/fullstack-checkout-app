// App module — wires hexagonal layers: interface (controllers) -> application (use cases) -> infrastructure (adapters).

import { Injectable, Module } from '@nestjs/common';
import { ProductsController, TransactionsController, CheckoutController } from './interface/http/controllers';
import { CheckoutService } from './application/services/checkout.service';
import { TRANSACTION_REPOSITORY, ID_GENERATOR } from './application/ports/tokens';
import { CheckoutUseCase } from './application/use-cases/checkout.use-case';
import {
  InMemoryProductRepository,
  InMemoryTransactionRepository,
  InMemoryCustomerRepository,
  InMemoryDeliveryRepository,
} from './infrastructure/persistence/in-memory.repositories';
import { PaymentGatewayAdapter } from './infrastructure/gateways/payment-gateway.adapter';
import { Product } from './domain/products/product.entity';

@Injectable()
class UuidGenerator {
  generate(): string {
    return `tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

@Module({
  controllers: [ProductsController, TransactionsController, CheckoutController],
  providers: [
    CheckoutService,
    {
      // The use case is a plain class (no Nest decorators), so wire it explicitly:
      // constructor(repo, txRepo, customerRepo, deliveryRepo, gateway, idGenerator)
      provide: CheckoutUseCase,
      useFactory: (
        productRepo: InMemoryProductRepository,
        transactionRepo: InMemoryTransactionRepository,
        customerRepo: InMemoryCustomerRepository,
        deliveryRepo: InMemoryDeliveryRepository,
        gateway: PaymentGatewayAdapter,
        idGenerator: UuidGenerator,
      ) => new CheckoutUseCase(productRepo, transactionRepo, customerRepo, deliveryRepo, gateway, idGenerator),
      inject: [
        InMemoryProductRepository,
        InMemoryTransactionRepository,
        InMemoryCustomerRepository,
        InMemoryDeliveryRepository,
        PaymentGatewayAdapter,
        UuidGenerator,
      ],
    },
    { provide: UuidGenerator, useClass: UuidGenerator },
    PaymentGatewayAdapter,
    InMemoryProductRepository,
    InMemoryTransactionRepository,
    InMemoryCustomerRepository,
    InMemoryDeliveryRepository,
    { provide: TRANSACTION_REPOSITORY, useExisting: InMemoryTransactionRepository },
    { provide: ID_GENERATOR, useClass: UuidGenerator },
  ],
})
export class AppModule {
  constructor(private readonly productRepo: InMemoryProductRepository) {
    // Seed dummy products (DB seeding requirement).
    this.productRepo.seed([
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
}