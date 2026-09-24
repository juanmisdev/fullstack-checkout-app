// Unit tests — In-memory repositories.

import {
  InMemoryProductRepository,
  InMemoryTransactionRepository,
  InMemoryCustomerRepository,
  InMemoryDeliveryRepository,
} from './in-memory.repositories';
import { Product } from '../../domain/products/product.entity';
import { Transaction } from '../../domain/transactions/transaction.entity';
import { Customer, Delivery } from '../../domain/customers/customer.entity';

const product = () =>
  Product.create({
    id: 'prod_001',
    name: 'Headphones',
    description: 'desc',
    priceInCents: 250000,
    imageUrl: 'img',
    stock: 10,
  });

describe('InMemoryProductRepository', () => {
  it('seeds and finds products', async () => {
    const repo = new InMemoryProductRepository();
    repo.seed([product()]);
    expect(await repo.findById('prod_001')).not.toBeNull();
    expect(await repo.findById('nope')).toBeNull();
  });

  it('lists seeded products', async () => {
    const repo = new InMemoryProductRepository();
    repo.seed([product()]);
    expect((await repo.list()).length).toBe(1);
  });

  it('decreaseStock persists the reduction', async () => {
    const repo = new InMemoryProductRepository();
    repo.seed([product()]);
    const updated = await repo.decreaseStock('prod_001', 3);
    expect(updated.stock).toBe(7);
    expect((await repo.findById('prod_001'))?.stock).toBe(7);
  });

  it('decreaseStock throws for unknown product', async () => {
    const repo = new InMemoryProductRepository();
    await expect(repo.decreaseStock('nope', 1)).rejects.toThrow('Product not found');
  });
});

describe('InMemoryTransactionRepository', () => {
  it('saves and finds transactions', async () => {
    const repo = new InMemoryTransactionRepository();
    const tx = Transaction.createPending({
      id: 'tx_1',
      productRef: 'p',
      customerRef: 'c',
      amountInCents: 100,
      baseFeeInCents: 0,
      deliveryFeeInCents: 0,
    });
    await repo.save(tx);
    expect((await repo.findById('tx_1'))?.status).toBe('PENDING');
    expect(await repo.findById('nope')).toBeNull();
  });
});

describe('InMemoryCustomerRepository', () => {
  it('saves and finds customers', async () => {
    const repo = new InMemoryCustomerRepository();
    const customer = Customer.create({ id: 'cus_1', fullName: 'John', email: 'j@x.com', phone: '123' });
    await repo.save(customer);
    expect(await repo.findById('cus_1')).not.toBeNull();
    expect(await repo.findById('nope')).toBeNull();
  });
});

describe('InMemoryDeliveryRepository', () => {
  it('saves deliveries', async () => {
    const repo = new InMemoryDeliveryRepository();
    const delivery = Delivery.create({
      id: 'd_1',
      transactionRef: 'tx_1',
      customerRef: 'cus_1',
      productRef: 'p',
      address: 'Calle 1',
      city: 'Bogota',
      postalCode: '110111',
    });
    await expect(repo.save(delivery)).resolves.toBeUndefined();
  });
});