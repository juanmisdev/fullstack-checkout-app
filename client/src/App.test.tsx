// Component tests — App flow orchestration, including the checkout HTTP effect.

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import userEvent from '@testing-library/user-event';
import App from './App';
import { store } from '@/store';
import { startCheckout, saveCardAndDelivery, submitPayment, restoreState, type CardState, type DeliveryState } from '@/store/checkoutSlice';

vi.mock('@/api/client', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/api/client')>();
  return {
    ...mod,
    fetchProducts: vi.fn(),
    checkout: vi.fn(),
  };
});

import { fetchProducts, checkout } from '@/api/client';
const fetchProductsMock = vi.mocked(fetchProducts);
const checkoutMock = vi.mocked(checkout);

const product = {
  id: 'prod_001',
  name: 'Wireless Headphones',
  description: 'desc',
  priceInCents: 250000,
  imageUrl: 'img.png',
  stock: 5,
};

const card: CardState = {
  number: '4242424242424242',
  cvv: '123',
  expiryMonth: '12',
  expiryYear: '2099',
  holderName: 'JOHN DOE',
};

const delivery: DeliveryState = {
  fullName: 'John Doe',
  email: 'john@example.com',
  phone: '+573001234567',
  address: 'Calle 1',
  city: 'Bogota',
  postalCode: '110111',
};

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    store.dispatch({ type: 'checkout/backToProduct' });
    vi.clearAllMocks();
    fetchProductsMock.mockResolvedValue([product]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the product page on start', async () => {
    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Wireless Headphones' })).toBeInTheDocument());
  });

  it('runs the checkout request when entering processing and succeeds', async () => {
    checkoutMock.mockResolvedValue({
      transactionId: 'tx_1',
      status: 'APPROVED',
      totalInCents: 260500,
    });

    store.dispatch(startCheckout({ productId: 'prod_001', units: 1 }));
    store.dispatch(saveCardAndDelivery({ card, delivery }));
    store.dispatch(submitPayment({ idempotencyKey: 'idem-test-1' }));

    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );

    await waitFor(() => expect(checkoutMock).toHaveBeenCalledTimes(1));
    const payload = checkoutMock.mock.calls[0][0];
    expect(payload.card.number).toBe('4242424242424242');
    expect(payload.customer.email).toBe('john@example.com');
    expect(payload.deliveryFeeInCents).toBe(10000);
    expect(payload.idempotencyKey).toBe('idem-test-1');

    await waitFor(() => expect(store.getState().checkout.transactionStatus).toBe('APPROVED'));
    expect(store.getState().checkout.step).toBe('result');
  });

  it('runs the checkout request without an idempotency key when none was stored', async () => {
    checkoutMock.mockResolvedValue({
      transactionId: 'tx_3',
      status: 'APPROVED',
      totalInCents: 260500,
    });

    store.dispatch(startCheckout({ productId: 'prod_001', units: 1 }));
    store.dispatch(saveCardAndDelivery({ card, delivery }));
    store.dispatch(submitPayment({ idempotencyKey: 'idem-test-2' }));
    // Simulate an older persisted flow restored without the key.
    store.dispatch({ type: 'checkout/restoreState', payload: { idempotencyKey: null } });

    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );

    await waitFor(() => expect(checkoutMock).toHaveBeenCalledTimes(1));
    expect(checkoutMock.mock.calls[0][0].idempotencyKey).toBeUndefined();
    await waitFor(() => expect(store.getState().checkout.transactionStatus).toBe('APPROVED'));
  });

  it('dispatches paymentFailed when the checkout request throws', async () => {
    checkoutMock.mockRejectedValue(new Error('Checkout failed'));

    store.dispatch(startCheckout({ productId: 'prod_001', units: 1 }));
    store.dispatch(saveCardAndDelivery({ card, delivery }));
    store.dispatch(submitPayment({ idempotencyKey: 'idem-test-3' }));

    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );

    await waitFor(() => expect(store.getState().checkout.error).toBe('Checkout failed'));
    expect(store.getState().checkout.step).toBe('result');
  });

  it('dispatches paymentFailed on a DECLINED gateway response', async () => {
    checkoutMock.mockResolvedValue({ transactionId: 'tx_2', status: 'DECLINED', totalInCents: 260500 });

    store.dispatch(startCheckout({ productId: 'prod_001', units: 1 }));
    store.dispatch(saveCardAndDelivery({ card, delivery }));
    store.dispatch(submitPayment({ idempotencyKey: 'idem-test-4' }));

    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );

    await waitFor(() => expect(store.getState().checkout.transactionStatus).toBe('DECLINED'));
    expect(store.getState().checkout.error).toBe('Payment was declined');
  });
});
describe('App card-delivery step', () => {
  beforeEach(() => {
    localStorage.clear();
    store.dispatch({ type: 'checkout/backToProduct' });
    store.dispatch(restoreState({ delivery: null }));
    vi.clearAllMocks();
    fetchProductsMock.mockResolvedValue([product]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the card dialog on the card-delivery step and steps back to product on explicit close', async () => {
    const user = userEvent.setup();
    store.dispatch(startCheckout({ productId: 'prod_001', units: 1 }));

    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );

    await waitFor(() => expect(screen.getByText('Payment details')).toBeInTheDocument());
    expect(store.getState().checkout.step).toBe('card-delivery');

    // Explicit close (X button) -> onOpenChange(false) -> back to product step.
    await user.click(screen.getByText('Close'));
    await waitFor(() => {
      expect(store.getState().checkout.step).toBe('product');
      expect(screen.getByRole('heading', { name: 'Wireless Headphones' })).toBeInTheDocument();
    });
  });

  it('keeps the dialog open (no state jump) when dismissed accidentally, and falls back to product for unknown steps', async () => {
    store.dispatch(startCheckout({ productId: 'prod_001', units: 1 }));

    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );

    await waitFor(() => expect(screen.getByText('Payment details')).toBeInTheDocument());
    await userEvent.setup().type(screen.getByLabelText('Card number'), '4242');

    // Escape is blocked inside the dialog: no step change, dialog still open.
    fireEvent.keyDown(screen.getByLabelText('Card number'), { key: 'Escape' });
    expect(store.getState().checkout.step).toBe('card-delivery');
    expect(screen.getByText('Payment details')).toBeInTheDocument();

    // Unknown step renders the product page (default branch).
    store.dispatch({ type: 'checkout/restoreState', payload: { step: 'unknown' as never } });
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Wireless Headphones' })).toBeInTheDocument(),
    );
  });
});

describe('App card-delivery submit path', () => {
  beforeEach(() => {
    localStorage.clear();
    store.dispatch({ type: 'checkout/backToProduct' });
    store.dispatch(restoreState({ delivery: null }));
    vi.clearAllMocks();
    fetchProductsMock.mockResolvedValue([product]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('a successful submit advances to summary and the dialog close after submit is a no-op', async () => {
    const user = userEvent.setup();
    store.dispatch(startCheckout({ productId: 'prod_001', units: 1 }));

    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );
    await waitFor(() => expect(screen.getByText('Payment details')).toBeInTheDocument());

    await user.type(screen.getByLabelText('Card number'), '4242424242424242');
    await user.type(screen.getByLabelText('CVV'), '123');
    await user.type(screen.getByLabelText('Month'), '12');
    await user.type(screen.getByLabelText('Year'), '29');
    await user.type(screen.getByLabelText('Cardholder name'), 'John Doe');
    await user.type(screen.getByLabelText('Full name'), 'John Doe');
    await user.type(screen.getByLabelText('Email'), 'john@example.com');
    await user.type(screen.getByLabelText('Phone'), '+573001234567');
    await user.type(screen.getByLabelText('Address'), 'Calle 1');
    await user.type(screen.getByLabelText('City'), 'Bogota');
    await user.type(screen.getByLabelText('Postal code'), '110111');

    await user.click(screen.getByRole('button', { name: /continue to summary/i }));

    await waitFor(() => expect(screen.getByText('Order summary')).toBeInTheDocument());
    expect(store.getState().checkout.step).toBe('summary');
  });
});
