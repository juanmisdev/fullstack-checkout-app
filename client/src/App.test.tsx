// Component tests — App flow orchestration, including the checkout HTTP effect.

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import App from './App';
import { store } from '@/store';
import { startCheckout, saveCardAndDelivery, submitPayment, type CardState, type DeliveryState } from '@/store/checkoutSlice';

vi.mock('@/api/client', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/api/client')>();
  return {
    ...mod,
    fetchProduct: vi.fn(),
    checkout: vi.fn(),
  };
});

import { fetchProduct, checkout } from '@/api/client';
const fetchProductMock = vi.mocked(fetchProduct);
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
    fetchProductMock.mockResolvedValue(product);
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
    store.dispatch(submitPayment());

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

    await waitFor(() => expect(store.getState().checkout.transactionStatus).toBe('APPROVED'));
    expect(store.getState().checkout.step).toBe('result');
  });

  it('dispatches paymentFailed when the checkout request throws', async () => {
    checkoutMock.mockRejectedValue(new Error('Checkout failed'));

    store.dispatch(startCheckout({ productId: 'prod_001', units: 1 }));
    store.dispatch(saveCardAndDelivery({ card, delivery }));
    store.dispatch(submitPayment());

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
    store.dispatch(submitPayment());

    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );

    await waitFor(() => expect(store.getState().checkout.transactionStatus).toBe('DECLINED'));
    expect(store.getState().checkout.error).toBe('Payment was declined');
  });
});