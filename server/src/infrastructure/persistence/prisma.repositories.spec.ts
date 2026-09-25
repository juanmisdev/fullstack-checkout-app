// Prisma repository adapter tests — mapping and error logic with a mocked
// PrismaClient. No database involved: the mock delegates capture the calls the
// adapters make, and entity mapping is asserted against known rows.

jest.mock('@prisma/client', () => {
  const $queryRaw = jest.fn();
  const delegates = {
    product: {
      count: jest.fn(),
      createMany: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    transaction: { upsert: jest.fn(), findUnique: jest.fn() },
    customer: { upsert: jest.fn(), findUnique: jest.fn() },
    delivery: { upsert: jest.fn() },
  };
  const PrismaClient = jest.fn(() => ({ ...delegates, $queryRaw }));
  return { PrismaClient, __delegates: delegates, __queryRaw: $queryRaw };
});

import { PrismaClient } from '@prisma/client';

// Shared $queryRaw mock (the module-level client creates its own instance, but
// all instances spread the SAME delegate mocks, so this controls every repo).
const queryRawMock = (jest.requireMock('@prisma/client') as { __queryRaw: jest.Mock })
  .__queryRaw;

// Access the shared mock delegates the factory returned.
const prisma = new (PrismaClient as jest.Mock)();

import {
  PrismaProductRepository,
  PrismaTransactionRepository,
  PrismaCustomerRepository,
  PrismaDeliveryRepository,
} from './prisma.repositories';
import { Product } from '../../domain/products/product.entity';
import { Transaction } from '../../domain/transactions/transaction.entity';
import { Customer, Delivery } from '../../domain/customers/customer.entity';
import { InsufficientStockError } from '../../domain/shared/errors';

const productRow = {
  id: 'prod_001',
  name: 'Wireless Headphones',
  description: 'desc',
  priceInCents: 250000,
  imageUrl: 'img.png',
  stock: 5,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PrismaProductRepository', () => {
  let repo: PrismaProductRepository;

  beforeEach(() => {
    repo = new PrismaProductRepository();
  });

  it('ensureSeeded creates the 3 products when the table is empty', async () => {
    (prisma.product.count as jest.Mock).mockResolvedValue(0);
    await repo.ensureSeeded();
    expect(prisma.product.count).toHaveBeenCalled();
    expect(prisma.product.createMany).toHaveBeenCalledTimes(1);
    expect((prisma.product.createMany as jest.Mock).mock.calls[0][0].data).toHaveLength(3);
  });

  it('ensureSeeded skips seeding when products exist', async () => {
    (prisma.product.count as jest.Mock).mockResolvedValue(3);
    await repo.ensureSeeded();
    expect(prisma.product.createMany).not.toHaveBeenCalled();
  });

  it('findById maps a row to a Product entity', async () => {
    (prisma.product.findUnique as jest.Mock).mockResolvedValue(productRow);
    const product = await repo.findById('prod_001');
    expect(prisma.product.findUnique).toHaveBeenCalledWith({ where: { id: 'prod_001' } });
    expect(product).toBeInstanceOf(Product);
    expect(product!.id).toBe('prod_001');
    expect(product!.stock).toBe(5);
  });

  it('findById returns null for a missing row', async () => {
    (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
    expect(await repo.findById('nope')).toBeNull();
  });

  it('list maps all rows to Product entities in id order', async () => {
    (prisma.product.findMany as jest.Mock).mockResolvedValue([productRow, { ...productRow, id: 'prod_002' }]);
    const products = await repo.list();
    expect(prisma.product.findMany).toHaveBeenCalledWith({ orderBy: { id: 'asc' } });
    expect(products).toHaveLength(2);
    expect(products[1].id).toBe('prod_002');
  });

  it('decreaseStock returns the updated product on a successful atomic update', async () => {
    const updatedRow = { ...productRow, stock: 4 };
    queryRawMock.mockResolvedValue([updatedRow]);
    const product = await repo.decreaseStock('prod_001', 1);
    expect(product.stock).toBe(4);
  });

  it('decreaseStock throws InsufficientStockError when the conditional update matches no row', async () => {
    queryRawMock.mockResolvedValue([]);
    await expect(repo.decreaseStock('prod_001', 999)).rejects.toThrow(InsufficientStockError);
  });
});

describe('PrismaTransactionRepository', () => {
  let repo: PrismaTransactionRepository;

  beforeEach(() => {
    repo = new PrismaTransactionRepository();
  });

  const makeTx = (status: Transaction['props']['status'] = 'PENDING') =>
    Transaction.fromPersistence({
      id: 'tx_1',
      productRef: 'prod_001',
      customerRef: 'cus_1',
      amountInCents: 250000,
      baseFeeInCents: 500,
      deliveryFeeInCents: 10000,
      status,
      gatewayTransactionId: status === 'PENDING' ? undefined : 'gw_1',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    });

  it('save upserts with update branch for an existing transaction', async () => {
    (prisma.transaction.upsert as jest.Mock).mockResolvedValue({});
    await repo.save(makeTx('APPROVED'));
    const call = (prisma.transaction.upsert as jest.Mock).mock.calls[0][0];
    expect(call.where).toEqual({ id: 'tx_1' });
    expect(call.update.status).toBe('APPROVED');
    expect(call.update.gatewayTransactionId).toBe('gw_1');
    expect(call.create.id).toBe('tx_1');
  });

  it('findById maps a row to a Transaction entity', async () => {
    (prisma.transaction.findUnique as jest.Mock).mockResolvedValue({
      id: 'tx_1',
      productRef: 'prod_001',
      customerRef: 'cus_1',
      amountInCents: 250000,
      baseFeeInCents: 500,
      deliveryFeeInCents: 10000,
      status: 'APPROVED',
      gatewayTransactionId: 'gw_1',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    });
    const tx = await repo.findById('tx_1');
    expect(tx).toBeInstanceOf(Transaction);
    expect(tx!.status).toBe('APPROVED');
    expect(tx!.totalInCents()).toBe(260500);
  });

  it('findById returns null for a missing row', async () => {
    (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(null);
    expect(await repo.findById('nope')).toBeNull();
  });
});

describe('PrismaCustomerRepository', () => {
  let repo: PrismaCustomerRepository;

  beforeEach(() => {
    repo = new PrismaCustomerRepository();
  });

  const makeCustomer = () =>
    Customer.fromPersistence({
      id: 'cus_1',
      fullName: 'John Doe',
      email: 'john@example.com',
      phone: '+573001234567',
      createdAt: new Date('2026-01-01'),
    });

  it('save upserts the customer with create data and empty update branch', async () => {
    (prisma.customer.upsert as jest.Mock).mockResolvedValue({});
    await repo.save(makeCustomer());
    const call = (prisma.customer.upsert as jest.Mock).mock.calls[0][0];
    expect(call.where).toEqual({ id: 'cus_1' });
    expect(call.update).toEqual({});
    expect(call.create.email).toBe('john@example.com');
  });

  it('findById maps a row to a Customer entity', async () => {
    (prisma.customer.findUnique as jest.Mock).mockResolvedValue({
      id: 'cus_1',
      fullName: 'John Doe',
      email: 'john@example.com',
      phone: '+573001234567',
      createdAt: new Date('2026-01-01'),
    });
    const customer = await repo.findById('cus_1');
    expect(customer).toBeInstanceOf(Customer);
    expect(customer!.id).toBe('cus_1');
  });

  it('findById returns null for a missing row', async () => {
    (prisma.customer.findUnique as jest.Mock).mockResolvedValue(null);
    expect(await repo.findById('nope')).toBeNull();
  });
});

describe('PrismaDeliveryRepository', () => {
  let repo: PrismaDeliveryRepository;

  beforeEach(() => {
    repo = new PrismaDeliveryRepository();
  });

  it('save upserts the delivery with create data and empty update branch', async () => {
    const delivery = Delivery.fromPersistence({
      id: 'del_1',
      transactionRef: 'tx_1',
      customerRef: 'cus_1',
      productRef: 'prod_001',
      address: 'Calle 1',
      city: 'Bogota',
      postalCode: '110111',
      status: 'PENDING',
      createdAt: new Date('2026-01-01'),
    });
    (prisma.delivery.upsert as jest.Mock).mockResolvedValue({});
    await repo.save(delivery);
    const call = (prisma.delivery.upsert as jest.Mock).mock.calls[0][0];
    expect(call.where).toEqual({ id: 'del_1' });
    expect(call.update).toEqual({});
    expect(call.create.status).toBe('PENDING');
    expect(call.create.address).toBe('Calle 1');
  });
});