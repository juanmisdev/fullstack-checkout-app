// Unit tests — Transaction state machine.

import { Transaction } from './transaction.entity';

const pendingProps = {
  id: 'tx_1',
  productRef: 'prod_001',
  customerRef: 'cus_1',
  amountInCents: 250000,
  baseFeeInCents: 500,
  deliveryFeeInCents: 10000,
  status: 'PENDING' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Transaction entity', () => {
  it('creates a PENDING transaction', () => {
    const tx = Transaction.createPending({
      id: 'tx_1',
      productRef: 'prod_001',
      customerRef: 'cus_1',
      amountInCents: 250000,
      baseFeeInCents: 500,
      deliveryFeeInCents: 10000,
    });
    expect(tx.status).toBe('PENDING');
    expect(tx.isPending()).toBe(true);
  });

  it('rejects non-positive amounts', () => {
    expect(() =>
      Transaction.createPending({
        id: 'tx_1',
        productRef: 'p',
        customerRef: 'c',
        amountInCents: 0,
        baseFeeInCents: 0,
        deliveryFeeInCents: 0,
      }),
    ).toThrow('Amount must be positive');
  });

  it('total = amount + base fee + delivery fee', () => {
    const tx = Transaction.createPending({
      id: 'tx_1',
      productRef: 'p',
      customerRef: 'c',
      amountInCents: 250000,
      baseFeeInCents: 500,
      deliveryFeeInCents: 10000,
    });
    expect(tx.totalInCents()).toBe(260500);
  });

  it('approve transitions PENDING -> APPROVED', () => {
    const tx = Transaction.createPending({ ...pendingProps });
    const approved = tx.approve('gw_123');
    expect(approved.status).toBe('APPROVED');
  });

  it('approve rejects non-PENDING', () => {
    const tx = Transaction.createPending({ ...pendingProps }).approve('gw_1');
    expect(() => tx.approve('gw_2')).toThrow('Only PENDING transactions can be approved');
  });

  it('decline transitions PENDING -> DECLINED', () => {
    const tx = Transaction.createPending({ ...pendingProps });
    expect(tx.decline().status).toBe('DECLINED');
  });

  it('decline rejects non-PENDING', () => {
    const tx = Transaction.createPending({ ...pendingProps }).decline();
    expect(() => tx.decline()).toThrow('Only PENDING transactions can be declined');
  });
});