// Unit tests — checkout HTTP wrapper (fetch mocked) and fetchProduct errors.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { checkout, fetchProduct, buildCheckoutRequest } from './client';
import type { CardState, DeliveryState } from '@/store/checkoutSlice';

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

const payload = buildCheckoutRequest('prod_001', 1, card, delivery);

describe('checkout HTTP wrapper', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('POSTs the payload and unwraps { data } on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: { transactionId: 'tx_1', status: 'APPROVED', totalInCents: 260500 } }), {
          status: 200,
        }),
      ),
    );

    const result = await checkout(payload);

    expect(result).toEqual({ transactionId: 'tx_1', status: 'APPROVED', totalInCents: 260500 });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/checkout'),
      expect.objectContaining({ method: 'POST', headers: { 'Content-Type': 'application/json' } }),
    );
  });

  it('throws with the backend message on error responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Payment declined' }), { status: 402 }),
      ),
    );

    await expect(checkout(payload)).rejects.toThrow('Payment declined');
  });

  it('throws a generic message when the body has neither data nor message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 500 })),
    );

    await expect(checkout(payload)).rejects.toThrow('Checkout failed');
  });

  it('fetchProduct unwraps { data } and rejects with status on HTTP errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ data: { id: 'prod_001', name: 'Wireless Headphones', description: '', priceInCents: 1, imageUrl: '', stock: 1 } }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(new Response('nope', { status: 404 })),
    );

    const product = await fetchProduct('prod_001');
    expect(product.id).toBe('prod_001');

    await expect(fetchProduct('nope')).rejects.toThrow('Failed to load product (404)');
  });
});