// Unit tests — checkout slice reducer transitions and safe persistence.

import { describe, it, expect, beforeEach } from 'vitest';
import checkoutReducer, {
  startCheckout,
  saveCardAndDelivery,
  submitPayment,
  paymentSucceeded,
  paymentFailed,
  backToProduct,
  restoreState,
  type CheckoutState,
  type CardState,
  type DeliveryState,
} from './checkoutSlice';

const initialState: CheckoutState = {
  step: 'product',
  productId: null,
  units: 1,
  card: null,
  delivery: null,
  transactionId: null,
  transactionStatus: null,
  totalInCents: null,
  idempotencyKey: null,
  error: null,
};

const card: CardState = {
  number: '4242424242424242',
  cvv: '123',
  expiryMonth: '12',
  expiryYear: '2099',
  holderName: 'John Doe',
};

const delivery: DeliveryState = {
  fullName: 'John Doe',
  email: 'john@example.com',
  phone: '+573001234567',
  address: 'Calle 1',
  city: 'Bogota',
  postalCode: '110111',
};

const readStorage = (): Record<string, unknown> =>
  JSON.parse(localStorage.getItem('checkout_state') ?? '{}') as Record<string, unknown>;

describe('checkoutSlice', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('startCheckout sets step card-delivery and persists safe state', () => {
    const state = checkoutReducer(initialState, startCheckout({ productId: 'prod_001', units: 2 }));

    expect(state.step).toBe('card-delivery');
    expect(state.productId).toBe('prod_001');
    expect(state.units).toBe(2);

    const stored = readStorage();
    expect(stored.step).toBe('card-delivery');
    // Raw card data must never be persisted
    expect(localStorage.getItem('checkout_state')).not.toContain('4242424242424242');
    expect(localStorage.getItem('checkout_state')).not.toContain('"cvv"');
  });

  it('saveCardAndDelivery stores card + delivery and moves to summary', () => {
    const started = checkoutReducer(initialState, startCheckout({ productId: 'prod_001', units: 1 }));
    const state = checkoutReducer(started, saveCardAndDelivery({ card, delivery }));

    expect(state.step).toBe('summary');
    expect(state.card).toEqual(card);
    expect(state.delivery).toEqual(delivery);
  });

  it('submitPayment stores the idempotency key, moves to processing and clears the error', () => {
    const started = checkoutReducer(initialState, startCheckout({ productId: 'prod_001', units: 1 }));
    const summarized = checkoutReducer(started, saveCardAndDelivery({ card, delivery }));
    const state = checkoutReducer(summarized, submitPayment({ idempotencyKey: 'idem-1' }));

    expect(state.step).toBe('processing');
    expect(state.idempotencyKey).toBe('idem-1');
    expect(state.error).toBeNull();
  });

  it('backToProduct resets the idempotency key together with the transient data', () => {
    const started = checkoutReducer(initialState, startCheckout({ productId: 'prod_001', units: 1 }));
    const summarized = checkoutReducer(started, saveCardAndDelivery({ card, delivery }));
    const processing = checkoutReducer(summarized, submitPayment({ idempotencyKey: 'idem-1' }));
    const state = checkoutReducer(processing, backToProduct());

    expect(state.step).toBe('product');
    expect(state.idempotencyKey).toBeNull();
  });

  it('paymentSucceeded stores the transaction and moves to result', () => {
    const state = checkoutReducer(
      initialState,
      paymentSucceeded({ transactionId: 'tx_1', totalInCents: 260500 }),
    );

    expect(state.step).toBe('result');
    expect(state.transactionId).toBe('tx_1');
    expect(state.transactionStatus).toBe('APPROVED');
    expect(state.totalInCents).toBe(260500);
  });

  it('paymentFailed stores the error and moves to result', () => {
    const state = checkoutReducer(initialState, paymentFailed('Payment declined'));

    expect(state.step).toBe('result');
    expect(state.error).toBe('Payment declined');
    expect(state.transactionStatus).toBe('DECLINED');
  });

  it('backToProduct resets transient checkout data', () => {
    const succeeded = checkoutReducer(
      initialState,
      paymentSucceeded({ transactionId: 'tx_1', totalInCents: 260500 }),
    );
    const withCard = checkoutReducer(succeeded, saveCardAndDelivery({ card, delivery }));
    const state = checkoutReducer(withCard, backToProduct());

    expect(state.step).toBe('product');
    expect(state.card).toBeNull();
    expect(state.transactionId).toBeNull();
    expect(state.totalInCents).toBeNull();
  });

  it('restoreState merges persisted fields into the current state', () => {
    const state = checkoutReducer(initialState, restoreState({ step: 'summary', productId: 'prod_001' }));

    expect(state.step).toBe('summary');
    expect(state.productId).toBe('prod_001');
    // Fields not present in the payload stay untouched
    expect(state.units).toBe(1);
  });
});