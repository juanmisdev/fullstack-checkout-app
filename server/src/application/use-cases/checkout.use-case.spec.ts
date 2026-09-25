// Unit tests — Checkout use case (ROP pipeline) with in-memory adapters.

import { CheckoutUseCase, type CheckoutInput } from './checkout.use-case';
import { InMemoryProductRepository, InMemoryTransactionRepository, InMemoryCustomerRepository, InMemoryDeliveryRepository } from '../../infrastructure/persistence/in-memory.repositories';
import { Product } from '../../domain/products/product.entity';
import { PaymentGatewayPort } from '../ports/ports';

const product = Product.create({
  id: 'prod_001',
  name: 'Headphones',
  description: 'desc',
  priceInCents: 250000,
  imageUrl: 'img',
  stock: 10,
});

const validInput: CheckoutInput = {
  productId: 'prod_001',
  units: 2,
  card: { number: '4242424242424242', cvv: '123', expiryMonth: 12, expiryYear: 2099, holderName: 'JOHN DOE' },
  customer: { fullName: 'John Doe', email: 'john@example.com', phone: '+573001234567' },
  delivery: { address: 'Calle 1 #2-3', city: 'Bogota', postalCode: '110111' },
  baseFeeInCents: 500,
  deliveryFeeInCents: 10000,
};

const okGateway = (): PaymentGatewayPort => ({
  charge: async () => ({ ok: true, gatewayTransactionId: 'gw_1', status: 'APPROVED' as const }),
});

const failingGateway = (): PaymentGatewayPort => ({
  charge: async () => {
    throw new Error('gateway down');
  },
});

interface SetupOptions {
  gateway?: PaymentGatewayPort;
}

const setup = ({ gateway = okGateway() }: SetupOptions = {}) => {
  const productRepo = new InMemoryProductRepository();
  const txRepo = new InMemoryTransactionRepository();
  const customerRepo = new InMemoryCustomerRepository();
  const deliveryRepo = new InMemoryDeliveryRepository();
  productRepo.seed([product]);
  const useCase = new CheckoutUseCase(productRepo, txRepo, customerRepo, deliveryRepo, gateway, {
    generate: () => 'id_' + Math.random().toString(36).slice(2, 8),
  });
  return { useCase, productRepo, txRepo };
};

describe('CheckoutUseCase', () => {
  it('approves a valid checkout and decreases stock', async () => {
    const { useCase, productRepo } = setup({ gateway: okGateway() });
    const result = await useCase.execute(validInput);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('APPROVED');
      expect(result.value.totalInCents).toBe(2 * 250000 + 500 + 10000);
    }
    const updatedProduct = await productRepo.findById('prod_001');
    expect(updatedProduct?.stock).toBe(8); // 10 - 2 units
  });

  it('fails with INSUFFICIENT_STOCK when units exceed stock', async () => {
    const { useCase } = setup();
    const result = await useCase.execute({ ...validInput, units: 11 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect((result.error as { code?: string }).code).toBe('INSUFFICIENT_STOCK');
  });

  it('fails with PRODUCT_NOT_FOUND for unknown product', async () => {
    const { useCase } = setup();
    const result = await useCase.execute({ ...validInput, productId: 'nope' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect((result.error as { code?: string }).code).toBe('PRODUCT_NOT_FOUND');
  });

  it('fails fast on invalid card (luhn)', async () => {
    const { useCase } = setup();
    const result = await useCase.execute({
      ...validInput,
      card: { ...validInput.card, number: '4242424242424241' },
    });
    expect(result.ok).toBe(false);
  });

  it('declines the transaction when the gateway rejects', async () => {
    const { useCase, txRepo } = setup({ gateway: okGateway() });
    // Gateway that responds DECLINED
    const declinedGateway: PaymentGatewayPort = {
      charge: async () => ({ ok: true, gatewayTransactionId: 'gw_declined', status: 'DECLINED' as const }),
    };
    const declinedCase = new CheckoutUseCase(
      {
        findById: async () => product,
        list: async () => [product],
        decreaseStock: async () => product,
      },
      txRepo,
      {
        save: async () => undefined,
        findById: async () => null,
      },
      { save: async () => undefined },
      declinedGateway,
      { generate: () => 'id_1' },
    );
    const result = await declinedCase.execute(validInput);
    expect(result.ok).toBe(false);

    // The transaction was persisted as DECLINED
    const stored = await txRepo.findById('id_1');
    expect(stored?.status).toBe('DECLINED');
    void useCase;
  });

  it('fails when the gateway throws', async () => {
    const { useCase } = setup({ gateway: failingGateway() });
    const result = await useCase.execute(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Unexpected gateway failure');
  });
});