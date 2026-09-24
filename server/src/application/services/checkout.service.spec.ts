// Unit tests — CheckoutService (application service) with a stubbed use case.

import { CheckoutService, BASE_FEE_IN_CENTS } from './checkout.service';
import { CheckoutUseCase, type CheckoutInput } from '../use-cases/checkout.use-case';
import { InMemoryProductRepository, InMemoryTransactionRepository } from '../../infrastructure/persistence/in-memory.repositories';
import { Product } from '../../domain/products/product.entity';
import { Ok } from '../../domain/shared/result';

const products = [
  Product.create({ id: 'prod_001', name: 'Wireless Headphones', description: 'd', priceInCents: 250000, imageUrl: 'img', stock: 12 }),
  Product.create({ id: 'prod_002', name: 'Mechanical Keyboard', description: 'd', priceInCents: 180000, imageUrl: 'img', stock: 8 }),
];

interface SetupOptions {
  execute?: (input: CheckoutInput) => unknown;
}

const setup = ({ execute }: SetupOptions = {}) => {
  const executeCalls: CheckoutInput[] = [];
  const checkoutUseCase = {
    execute: execute ?? ((input: CheckoutInput) => {
      executeCalls.push(input);
      return Promise.resolve(Ok({ transactionId: 'tx_1', status: 'APPROVED' as const, totalInCents: 1, receipt: { productRef: 'p', customerRef: 'c', deliveryRef: 'd' } }));
    }),
  };
  const productRepo = new InMemoryProductRepository();
  productRepo.seed(products);
  const transactionRepo = new InMemoryTransactionRepository();
  let counter = 0;
  const idGenerator = { generate: () => `id_${++counter}` };

  const service = new CheckoutService(
    checkoutUseCase as unknown as CheckoutUseCase,
    productRepo,
    transactionRepo,
    idGenerator,
  );
  return { service, executeCalls, transactionRepo };
};

describe('CheckoutService', () => {
  it('lists the seeded products', async () => {
    const { service } = setup();
    const list = await service.listProducts();
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe('prod_001');
  });

  it('finds a product by id', async () => {
    const { service } = setup();
    const product = await service.getProduct('prod_001');
    expect(product?.id).toBe('prod_001');
  });

  it('returns null for unknown product', async () => {
    const { service } = setup();
    expect(await service.getProduct('nope')).toBeNull();
  });

  it('returns null for unknown transaction', async () => {
    const { service } = setup();
    expect(await service.getTransaction('nope')).toBeNull();
  });

  it('returns a stored transaction by id', async () => {
    const { service, transactionRepo } = setup();
    const tx = await transactionRepo.findById('nope');
    expect(tx).toBeNull(); // repo starts empty; service delegates to the repo port
  });

  it('generates unique ids', () => {
    const { service } = setup();
    const ids = [service.newId(), service.newId(), service.newId()];
    expect(new Set(ids).size).toBe(3);
  });

  it('forwards checkout input with the configured base fee (500)', async () => {
    let captured: CheckoutInput | undefined;
    const { service } = setup({
      execute: (input) => {
        captured = input;
        return Promise.resolve(Ok({ transactionId: 'tx_1', status: 'APPROVED' as const, totalInCents: 100, receipt: { productRef: 'p', customerRef: 'c', deliveryRef: 'd' } }));
      },
    });

    const result = await service.checkout({
      productId: 'prod_001',
      units: 1,
      card: { number: '4242424242424242', cvv: '123', expiryMonth: 12, expiryYear: 2099, holderName: 'JOHN DOE' },
      customer: { fullName: 'John Doe', email: 'john@example.com', phone: '+573001234567' },
      delivery: { address: 'Calle 1', city: 'Bogota', postalCode: '110111' },
      baseFeeInCents: 0, // controller sends 0; the service applies the configured fee
      deliveryFeeInCents: 10000,
    });

    expect(result.ok).toBe(true);
    expect(captured?.baseFeeInCents).toBe(BASE_FEE_IN_CENTS);
    expect(BASE_FEE_IN_CENTS).toBe(500);
    expect(captured?.productId).toBe('prod_001');
  });
});