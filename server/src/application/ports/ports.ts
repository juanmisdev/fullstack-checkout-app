// Ports & Adapters — driven ports (outbound interfaces owned by the domain/application layer).

import { Product } from '../../domain/products/product.entity';
import { Transaction } from '../../domain/transactions/transaction.entity';
import { Customer, Delivery } from '../../domain/customers/customer.entity';

export interface ProductRepositoryPort {
  findById(id: string): Promise<Product | null>;
  decreaseStock(id: string, units: number): Promise<Product>;
}

export interface TransactionRepositoryPort {
  save(transaction: Transaction): Promise<void>;
  findById(id: string): Promise<Transaction | null>;
}

export interface CustomerRepositoryPort {
  save(customer: Customer): Promise<void>;
  findById(id: string): Promise<Customer | null>;
}

export interface DeliveryRepositoryPort {
  save(delivery: Delivery): Promise<void>;
}

// Outbound port for the external payment gateway sandbox.
export interface PaymentGatewayPort {
  /**
   * Charges the given amount in cents. Returns the gateway transaction id
   * on success, or throws a GatewayError on failure.
   */
  charge(input: PaymentGatewayChargeInput): Promise<PaymentGatewayChargeResult>;
}

export interface PaymentGatewayChargeInput {
  amountInCents: number;
  customerEmail: string;
  cardToken: string;
  reference: string;
}

export type PaymentGatewayChargeResult = {
  ok: true;
  gatewayTransactionId: string;
  status: 'APPROVED' | 'DECLINED';
};

export class GatewayError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
  }
}

export interface IdGeneratorPort {
  generate(): string;
}

export interface ClockPort {
  now(): Date;
}