// Component tests — ProductPage listing rendering and interactions (network mocked).

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
    fetchProducts: vi.fn(),
  };
});

import { fetchProducts } from '@/api/client';
const fetchProductsMock = vi.mocked(fetchProducts);

const products: ProductDto[] = [
  {
    id: 'prod_001',
    name: 'Wireless Headphones',
    description: 'Noise-cancelling over-ear headphones.',
    priceInCents: 250000,
    imageUrl: 'img1.png',
    stock: 12,
  },
  {
    id: 'prod_002',
    name: 'Mechanical Keyboard',
    description: 'Hot-swappable 75% mechanical keyboard.',
    priceInCents: 180000,
    imageUrl: 'img2.png',
    stock: 8,
  },
  {
    id: 'prod_003',
    name: 'Running Shoes',
    description: 'Lightweight running shoes.',
    priceInCents: 320000,
    imageUrl: 'img3.png',
    stock: 0,
  },
];

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
    fetchProductsMock.mockResolvedValue(products);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the loading state first', () => {
    fetchProductsMock.mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getByText('Loading products…')).toBeInTheDocument();
  });

  it('renders all 3 mocked products with name, price and stock badge', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Wireless Headphones' })).toBeInTheDocument(),
    );
    expect(screen.getByRole('heading', { name: 'Mechanical Keyboard' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Running Shoes' })).toBeInTheDocument();
    expect(screen.getByText('$2,500.00')).toBeInTheDocument();
    expect(screen.getByText('$1,800.00')).toBeInTheDocument();
    expect(screen.getByText('$3,200.00')).toBeInTheDocument();
    expect(screen.getByText('12 in stock')).toBeInTheDocument();
    expect(screen.getByText('8 in stock')).toBeInTheDocument();
    expect(screen.getByText('Out of stock')).toBeInTheDocument();
  });

  it('shows the error message when the fetch fails', async () => {
    fetchProductsMock.mockRejectedValue(new Error('Failed to load products (500)'));
    renderPage();
    await waitFor(() => expect(screen.getByText('Failed to load products (500)')).toBeInTheDocument());
  });

  it('increments and decrements the units stepper within stock limits', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('Increase units for Wireless Headphones')).toBeEnabled());

    await user.click(screen.getByLabelText('Increase units for Wireless Headphones'));
    await user.click(screen.getByLabelText('Increase units for Wireless Headphones'));
    expect(screen.getByText('3')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Decrease units for Wireless Headphones'));
    expect(screen.getByText('2')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Decrease units for Wireless Headphones'));
    const unitsLabels = screen.getAllByText('1');
    expect(unitsLabels[0]).toBeInTheDocument();
    // capped at 1: the decrease button is disabled at the floor
    expect(screen.getByLabelText('Decrease units for Wireless Headphones')).toBeDisabled();
  });

  it('caps the stepper at the product stock', async () => {
    const user = userEvent.setup();
    renderPage();
    const increase = await screen.findByLabelText('Increase units for Mechanical Keyboard');
    for (let i = 0; i < 9; i++) await user.click(increase);
    expect(increase).toBeDisabled(); // stock 8 reached
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('dispatches startCheckout with productId and units on pay click', async () => {
    const user = userEvent.setup();
    renderPage();
    const payButtons = await screen.findAllByRole('button', { name: /pay with credit card/i });
    expect(payButtons).toHaveLength(3);
    await user.click(screen.getByLabelText('Increase units for Wireless Headphones'));
    await user.click(payButtons[0]);

    const state = store.getState().checkout;
    expect(state.step).toBe('card-delivery');
    expect(state.units).toBe(2);
    expect(state.productId).toBe('prod_001');
    void startCheckout; // reducer transition is asserted through store state
  });

  it('disables the buy button for out-of-stock products', async () => {
    renderPage();
    const payButtons = await screen.findAllByRole('button', { name: /pay with credit card/i });
    expect(payButtons[2]).toBeDisabled();
  });
});