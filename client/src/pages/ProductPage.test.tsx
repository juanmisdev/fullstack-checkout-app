// Component tests — ProductPage rendering and interactions (network mocked).

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { ProductPage } from './ProductPage';
import { store } from '@/store';
import { startCheckout } from '@/store/checkoutSlice';
import type { ProductDto } from '@/api/client';

vi.mock('@/api/client', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/api/client')>();
  return {
    ...mod,
    fetchProduct: vi.fn(),
  };
});

import { fetchProduct } from '@/api/client';
const fetchProductMock = vi.mocked(fetchProduct);

const product: ProductDto = {
  id: 'prod_001',
  name: 'Wireless Headphones',
  description: 'Noise-cancelling over-ear headphones.',
  priceInCents: 250000,
  imageUrl: 'img.png',
  stock: 3,
};

const renderPage = () =>
  render(
    <Provider store={store}>
      <ProductPage />
    </Provider>,
  );

describe('ProductPage', () => {
  beforeEach(() => {
    localStorage.clear();
    store.dispatch({ type: 'checkout/backToProduct' });
    vi.clearAllMocks();
    fetchProductMock.mockResolvedValue(product);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the loading state first', () => {
    fetchProductMock.mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getByText('Loading product…')).toBeInTheDocument();
  });

  it('renders the loaded product with name, price and stock', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Wireless Headphones' })).toBeInTheDocument());
    expect(screen.getByText('$2,500.00')).toBeInTheDocument();
    expect(screen.getByText('3 in stock')).toBeInTheDocument();
  });

  it('shows the error message when the fetch fails', async () => {
    fetchProductMock.mockRejectedValue(new Error('Failed to load product (500)'));
    renderPage();
    await waitFor(() => expect(screen.getByText('Failed to load product (500)')).toBeInTheDocument());
  });

  it('increments and decrements the units selector within stock limits', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('Increase units')).toBeEnabled());

    await user.click(screen.getByLabelText('Increase units'));
    await user.click(screen.getByLabelText('Increase units'));
    expect(screen.getByText('3')).toBeInTheDocument();
    // capped at stock: the increase button is disabled
    expect(screen.getByLabelText('Increase units')).toBeDisabled();

    await user.click(screen.getByLabelText('Decrease units'));
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('dispatches startCheckout with the selected units on pay click', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: /pay with credit card/i })).toBeEnabled());

    await user.click(screen.getByLabelText('Increase units'));
    await user.click(screen.getByRole('button', { name: /pay with credit card/i }));

    const state = store.getState().checkout;
    expect(state.step).toBe('card-delivery');
    expect(state.units).toBe(2);
    expect(state.productId).toBe('prod_001');
    void startCheckout; // reducer transition is asserted through store state
  });
});