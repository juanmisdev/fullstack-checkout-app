// Component tests — SummaryPage totals, card meta and actions.

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { SummaryPage } from './SummaryPage';
import { store } from '@/store';
import { startCheckout, saveCardAndDelivery, submitPayment, backToSummary, type CardState, type DeliveryState } from '@/store/checkoutSlice';

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

const seedSummaryState = (totalInCents = 250000) => {
  store.dispatch({ type: 'checkout/backToProduct' });
  store.dispatch(startCheckout({ productId: 'prod_001', units: 1 }));
  store.dispatch(saveCardAndDelivery({ card, delivery }));
  store.dispatch({ type: 'checkout/restoreState', payload: { totalInCents } });
};

describe('SummaryPage', () => {
  beforeEach(() => {
    localStorage.clear();
    seedSummaryState(250000);
  });

  it('renders product amount, fees and total', () => {
    render(
      <Provider store={store}>
        <SummaryPage />
      </Provider>,
    );

    expect(screen.getByText('Order summary')).toBeInTheDocument();
    expect(screen.getByText('$2,500.00')).toBeInTheDocument();
    expect(screen.getByText('$5.00')).toBeInTheDocument(); // base fee
    expect(screen.getByText('$100.00')).toBeInTheDocument(); // delivery fee
    expect(screen.getByText('$2,605.00')).toBeInTheDocument(); // total
  });

  it('shows the masked card meta', () => {
    render(
      <Provider store={store}>
        <SummaryPage />
      </Provider>,
    );
    expect(screen.getByText('VISA •••• 4242')).toBeInTheDocument();
  });

  it('shows a fallback message when card data is missing', () => {
    store.dispatch({ type: 'checkout/backToProduct' });
    render(
      <Provider store={store}>
        <SummaryPage />
      </Provider>,
    );
    expect(screen.getByText('Missing payment data')).toBeInTheDocument();
  });

  it('Pay now moves the flow to processing', async () => {
    const user = userEvent.setup();
    render(
      <Provider store={store}>
        <SummaryPage />
      </Provider>,
    );
    await user.click(screen.getByRole('button', { name: 'Pay now' }));
    expect(store.getState().checkout.step).toBe('processing');
    // App is not mounted here, so no network call happens in this test.
  });

  it('shows a processing state on the Pay button and disables the actions while processing', () => {
    store.dispatch({ type: 'checkout/backToProduct' });
    store.dispatch(startCheckout({ productId: 'prod_001', units: 1 }));
    store.dispatch(saveCardAndDelivery({ card, delivery }));
    store.dispatch(submitPayment({ idempotencyKey: 'idem-test-1' }));

    render(
      <Provider store={store}>
        <SummaryPage />
      </Provider>,
    );

    const payButton = screen.getByRole('button', { name: /processing payment/i });
    expect(payButton).toBeDisabled();
    expect(payButton).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
  });

  it('Back is disabled while processing and returns to summary otherwise', async () => {
    const user = userEvent.setup();
    render(
      <Provider store={store}>
        <SummaryPage />
      </Provider>,
    );
    await user.click(screen.getByRole('button', { name: 'Pay now' }));
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    expect(store.getState().checkout.step).toBe('processing');

    store.dispatch(backToSummary());
    expect(store.getState().checkout.step).toBe('summary');
    void submitPayment;
  });
});