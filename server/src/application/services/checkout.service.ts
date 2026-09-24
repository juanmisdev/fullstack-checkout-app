// Application service layer — orchestrates use cases. Controllers stay thin.

import { Injectable } from '@nestjs/common';
import { CheckoutUseCase, CheckoutInput, CheckoutOutput, CheckoutError } from '../use-cases/checkout.use-case';
import { Result } from '../../domain/shared/result';
import { InMemoryProductRepository } from '../../infrastructure/persistence/in-memory.repositories';
import { IdGeneratorPort, TransactionRepositoryPort } from '../ports/ports';

export const BASE_FEE_IN_CENTS = 500; // base fee added always

@Injectable()
export class CheckoutService {
  constructor(
    private readonly checkoutUseCase: CheckoutUseCase,
    private readonly productRepo: InMemoryProductRepository,
    private readonly transactionRepo: TransactionRepositoryPort,
    private readonly idGenerator: IdGeneratorPort,
  ) {}

  listProducts() {
    return this.productRepo.list();
  }

  getProduct(id: string) {
    return this.productRepo.findById(id);
  }

  async checkout(input: CheckoutInput): Promise<Result<CheckoutOutput, CheckoutError>> {
    return this.checkoutUseCase.execute({ ...input, baseFeeInCents: BASE_FEE_IN_CENTS });
  }

  getTransaction(id: string) {
    return this.transactionRepo.findById(id);
  }

  newId(): string {
    return this.idGenerator.generate();
  }
}