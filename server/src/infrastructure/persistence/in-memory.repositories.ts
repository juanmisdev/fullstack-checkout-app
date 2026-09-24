// Infrastructure adapters — in-memory repositories for dev, driven by ports.

import { Injectable } from '@nestjs/common';
import { ProductRepositoryPort, TransactionRepositoryPort, CustomerRepositoryPort, DeliveryRepositoryPort } from '../../application/ports/ports';
import { Product } from '../../domain/products/product.entity';
import { Transaction } from '../../domain/transactions/transaction.entity';
import { Customer, Delivery } from '../../domain/customers/customer.entity';
import { InsufficientStockError } from '../../domain/shared/errors';

@Injectable()
export class InMemoryProductRepository implements ProductRepositoryPort {
  private products = new Map<string, Product>();

  seed(products: Product[]): void {
    this.products = new Map(products.map((p) => [p.id, p]));
  }

  async findById(id: string): Promise<Product | null> {
    return this.products.get(id) ?? null;
  }

  async list(): Promise<Product[]> {
    return [...this.products.values()];
  }

  async decreaseStock(id: string, units: number): Promise<Product> {
    const product = this.products.get(id);
    if (!product) throw new Error('Product not found');
    const updated = product.decreaseStock(units);
    this.products.set(id, updated);
    return updated;
  }
}

@Injectable()
export class InMemoryTransactionRepository implements TransactionRepositoryPort {
  private transactions = new Map<string, Transaction>();

  async save(transaction: Transaction): Promise<void> {
    this.transactions.set(transaction.id, transaction);
  }

  async findById(id: string): Promise<Transaction | null> {
    return this.transactions.get(id) ?? null;
  }
}

@Injectable()
export class InMemoryCustomerRepository implements CustomerRepositoryPort {
  private customers = new Map<string, Customer>();

  async save(customer: Customer): Promise<void> {
    this.customers.set(customer.id, customer);
  }

  async findById(id: string): Promise<Customer | null> {
    return this.customers.get(id) ?? null;
  }
}

@Injectable()
export class InMemoryDeliveryRepository implements DeliveryRepositoryPort {
  private deliveries = new Map<string, Delivery>();

  async save(delivery: Delivery): Promise<void> {
    this.deliveries.set(delivery.id, delivery);
  }
}