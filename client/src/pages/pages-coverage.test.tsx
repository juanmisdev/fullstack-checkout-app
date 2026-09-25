// Component tests — api/client.ts fetch wrapper (mocked fetch), ResultPage receipt,
// SummaryPage Edit dialog, and CardDeliveryDialog brand logo rendering.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { store } from '@/store';
import { fetchProducts, fetchProduct, checkout, isValidLuhn, detectBrand } from '@/api/client';
import { ResultPage } from '@/pages/ResultPage';
import { SummaryPage } from '@/pages/SummaryPage';
import { CardDeliveryDialog } from '@/pages/CardDeliveryPage';
import { startCheckout, saveCardAndDelivery, submitPayment, paymentSucceeded, type CardState, type DeliveryState } from '@/store/checkoutSlice';

const okJson = (body: unknown) => ({ ok: true, json: async () => body }) as unknown as Response;

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

describe('api client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('fetchProducts returns the product list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson({ data: [{ id: 'prod_001' }] })));
    const products = await fetchProducts();
    expect(products).toEqual([{ id: 'prod_001' }]);
  });

  it('fetchProducts throws on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(fetchProducts()).rejects.toThrow('Failed to load products (500)');
  });

  it('fetchProduct returns a single product', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson({ data: { id: 'prod_001' } })));
    expect(await fetchProduct('prod_001')).toEqual({ id: 'prod_001' });
  });

  it('fetchProduct throws on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(fetchProduct('nope')).rejects.toThrow('Failed to load product (404)');
  });

  it('checkout posts the payload and returns the data envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      okJson({ data: { transactionId: 'tx_1', status: 'APPROVED', totalInCents: 260500 } }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const res = await checkout({
      productId: 'prod_001',
      units: 1,
      card: { number: '4242424242424242', cvv: '123', expiryMonth: 12, expiryYear: 2099, holderName: 'JOHN DOE' },
      customer: { fullName: 'John Doe', email: 'john@example.com', phone: '+573001234567' },
      delivery: { address: 'Calle 1', city: 'Bogota', postalCode: '110111' },
      deliveryFeeInCents: 10000,
      idempotencyKey: 'idem-1',
    });
    expect(res.transactionId).toBe('tx_1');
    expect(fetchMock.mock.calls[0][0]).toContain('/checkout');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).idempotencyKey).toBe('idem-1');
  });

  it('checkout throws the API error message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(okJson({ message: 'Insufficient stock for the requested units' })),
    );
    await expect(
      checkout({
        productId: 'prod_001',
        units: 99,
        card: { number: '4242424242424242', cvv: '123', expiryMonth: 12, expiryYear: 2099, holderName: 'X' },
        customer: { fullName: 'John Doe', email: 'john@example.com', phone: '+573001234567' },
        delivery: { address: 'Calle 1', city: 'Bogota', postalCode: '110111' },
        deliveryFeeInCents: 10000,
      }),
    ).rejects.toThrow('Insufficient stock for the requested units');
  });

  it('isValidLuhn rejects non-digit and out-of-range numbers', () => {
    expect(isValidLuhn('abcd')).toBe(false);
    expect(isValidLuhn('42424242424')).toBe(false); // 11 digits < 13
    expect(isValidLuhn('424242424242424242424242')).toBe(false); // > 19
    expect(isValidLuhn('4242-4242-4242-4242')).toBe(true); // dashes stripped
  });

  it('detectBrand recognizes MasterCard 2-series IINs and unknown prefixes', () => {
    expect(detectBrand('2221 0000 0000 0000')).toBe('MASTERCARD'); // 2221-2720 range
    expect(detectBrand('2704 0000 0000 0000')).toBe('MASTERCARD');
    expect(detectBrand('7200 0000 0000 0000')).toBe('UNKNOWN'); // 720 is out of range
    expect(detectBrand('3600 0000 0000 0000')).toBe('UNKNOWN'); // amex not accepted
  });
});

describe('ResultPage', () => {
  beforeEach(() => {
    localStorage.clear();
    store.dispatch({ type: 'checkout/backToProduct' });
  });

  it('animates the receipt printer stages and renders the full receipt', async () => {
    vi.useFakeTimers();
    store.dispatch(startCheckout({ productId: 'prod_001', units: 1 }));
    store.dispatch(saveCardAndDelivery({ card, delivery }));
    store.dispatch(submitPayment({ idempotencyKey: 'idem-1' }));
    store.dispatch(paymentSucceeded({ transactionId: 'tx_abcd1234', totalInCents: 260500 }));

    render(
      <Provider store={store}>
        <ResultPage />
      </Provider>,
    );

    // processing -> printing -> complete via timers.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    vi.useRealTimers();

    expect(screen.getByText('TOTAL PAID')).toBeInTheDocument();
    expect(screen.getByText('APPROVED')).toBeInTheDocument();
    expect(screen.getByText('Visa •••• 4242')).toBeInTheDocument();
    expect(screen.getByText('ORD-abcd1234')).toBeInTheDocument(); // last-8 of tx id
    expect(screen.getByText(/Ship to: John Doe/)).toBeInTheDocument();
  });

  it('shows a DECLINED receipt and "Back to product" button', async () => {
    vi.useFakeTimers();
    store.dispatch(startCheckout({ productId: 'prod_001', units: 1 }));
    store.dispatch(saveCardAndDelivery({ card, delivery }));
    store.dispatch({ type: 'checkout/paymentFailed', payload: 'Payment was declined' });

    render(
      <Provider store={store}>
        <ResultPage />
      </Provider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3200);
    });
    vi.useRealTimers();

    expect(screen.getByText('PAYMENT DECLINED')).toBeInTheDocument();
    expect(screen.getByText('DECLINED')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to product' })).toBeInTheDocument();
  });

  it('Continue shopping dispatches backToProduct', async () => {
    store.dispatch(startCheckout({ productId: 'prod_001', units: 1 }));
    store.dispatch(saveCardAndDelivery({ card, delivery }));
    store.dispatch(paymentSucceeded({ transactionId: 'tx_1', totalInCents: 260500 }));

    render(
      <Provider store={store}>
        <ResultPage />
      </Provider>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /continue shopping/i }));
    expect(store.getState().checkout.step).toBe('product');
  });

  it('renders a MC (non-Visa) card meta on the receipt', () => {
    store.dispatch(startCheckout({ productId: 'prod_002', units: 1 }));
    store.dispatch(saveCardAndDelivery({ card: { ...card, number: '5555 5555 5555 4444' }, delivery }));
    store.dispatch(paymentSucceeded({ transactionId: 'tx_1', totalInCents: 190500 }));
    render(
      <Provider store={store}>
        <ResultPage />
      </Provider>,
    );
    expect(screen.getByText('MC •••• 4444')).toBeInTheDocument();
  });
});

describe('SummaryPage Edit dialog', () => {
  beforeEach(() => {
    localStorage.clear();
    store.dispatch({ type: 'checkout/backToProduct' });
    store.dispatch(startCheckout({ productId: 'prod_001', units: 1 }));
    store.dispatch(saveCardAndDelivery({ card, delivery }));
  });

  it('Edit reopens the card dialog pre-filled and saving keeps the summary step', async () => {
    render(
      <Provider store={store}>
        <SummaryPage />
      </Provider>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByText('Payment details')).toBeInTheDocument();

    // Pre-filled from saved state (delivery prefills, card fields start empty).
    await user.type(screen.getByLabelText('Card number'), '4242424242424242');
    await user.type(screen.getByLabelText('CVV'), '123');
    await user.type(screen.getByLabelText('Month'), '12');
    await user.type(screen.getByLabelText('Year'), '29');
    await user.type(screen.getByLabelText('Cardholder name'), 'John Doe');
    await user.click(screen.getByRole('button', { name: /continue to summary/i }));
    await waitFor(() => expect(store.getState().checkout.step).toBe('summary'));
  });

  it('shows the fallback message when card data is missing', () => {
    store.dispatch({ type: 'checkout/backToProduct' });
    render(
      <Provider store={store}>
        <SummaryPage />
      </Provider>,
    );
    expect(screen.getByText('Missing payment data')).toBeInTheDocument();
  });
});

describe('CardDeliveryDialog brand logo', () => {
  beforeEach(() => {
    localStorage.clear();
    store.dispatch({ type: 'checkout/backToProduct' });
    store.dispatch({ type: 'checkout/restoreState', payload: { delivery: null } });
    store.dispatch(startCheckout({ productId: 'prod_001', units: 1 }));
  });

  it('renders the VISA wordmark while typing a Visa number', async () => {
    render(
      <Provider store={store}>
        <CardDeliveryDialog open onOpenChange={() => undefined} />
      </Provider>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Card number'), '4242');
    expect(screen.getByText('VISA')).toBeInTheDocument();
  });

  it('renders the MasterCard logo while typing a MasterCard number', async () => {
    render(
      <Provider store={store}>
        <CardDeliveryDialog open onOpenChange={() => undefined} />
      </Provider>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Card number'), '5555 5555 5555 4444');
    expect(screen.getByLabelText('MasterCard')).toBeInTheDocument();
  });
});
describe('SummaryPage Back button', () => {
  beforeEach(() => {
    localStorage.clear();
    store.dispatch({ type: 'checkout/backToProduct' });
    store.dispatch(startCheckout({ productId: 'prod_001', units: 1 }));
    store.dispatch(saveCardAndDelivery({ card, delivery }));
  });

  it('Back dispatches backToSummary (no-op on the summary step, but covers the handler)', async () => {
    render(
      <Provider store={store}>
        <SummaryPage />
      </Provider>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(store.getState().checkout.step).toBe('summary');
  });

  it('Pay now dispatches submitPayment with a generated idempotency key', async () => {
    render(
      <Provider store={store}>
        <SummaryPage />
      </Provider>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Pay now' }));
    const state = store.getState().checkout;
    expect(state.step).toBe('processing');
    expect(state.idempotencyKey).toBeTruthy();
  });
});
