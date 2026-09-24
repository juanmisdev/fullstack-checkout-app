// Component tests — SummaryPage totals, card meta and actions.

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { SummaryPage } from './SummaryPage';
import { store } from '@/store';
import { startCheckout, saveCardAndDelivery, submitPayment, type CardState, type DeliveryState } from '@/store/checkoutSlice';

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

  it('Back returns to the summary step context', async () => {
    const user = userEvent.setup();
    render(
      <Provider store={store}>
        <SummaryPage />
      </Provider>,
    );
    await user.click(screen.getByRole('button', { name: 'Pay now' }));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(store.getState().checkout.step).toBe('summary');
    void submitPayment;
  });
});