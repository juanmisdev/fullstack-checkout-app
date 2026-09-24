// Component tests — CardDeliveryDialog validation and dispatch.

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { CardDeliveryDialog } from './CardDeliveryPage';
import { store } from '@/store';
import { startCheckout } from '@/store/checkoutSlice';

const fillValidForm = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText('Card number'), '4242424242424242');
  await user.type(screen.getByLabelText('CVV'), '123');
  await user.type(screen.getByLabelText('Month'), '12');
  await user.type(screen.getByLabelText('Year'), '29');
  await user.type(screen.getByLabelText('Cardholder name'), 'John Doe');
  await user.type(screen.getByLabelText('Full name'), 'John Doe');
  await user.type(screen.getByLabelText('Email'), 'john@example.com');
  await user.type(screen.getByLabelText('Phone'), '+573001234567');
  await user.type(screen.getByLabelText('Address'), 'Calle 1 #2-3');
  await user.type(screen.getByLabelText('City'), 'Bogota');
  await user.type(screen.getByLabelText('Postal code'), '110111');
};

const renderDialog = () =>
  render(
    <Provider store={store}>
      <CardDeliveryDialog open onOpenChange={() => undefined} />
    </Provider>,
  );

describe('CardDeliveryDialog', () => {
  beforeEach(() => {
    localStorage.clear();
    store.dispatch({ type: 'checkout/backToProduct' });
    store.dispatch(startCheckout({ productId: 'prod_001', units: 1 }));
  });

  it('rejects an invalid card number with inline error feedback', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByLabelText('Card number'), '4242424242424241');
    await user.type(screen.getByLabelText('CVV'), '123');
    await user.type(screen.getByLabelText('Month'), '12');
    await user.type(screen.getByLabelText('Year'), '29');
    await user.type(screen.getByLabelText('Cardholder name'), 'John Doe');
    await user.type(screen.getByLabelText('Full name'), 'John Doe');
    await user.type(screen.getByLabelText('Email'), 'john@example.com');
    await user.type(screen.getByLabelText('Phone'), '+573001234567');
    await user.type(screen.getByLabelText('Address'), 'Calle 1 #2-3');
    await user.type(screen.getByLabelText('City'), 'Bogota');
    await user.type(screen.getByLabelText('Postal code'), '110111');

    const submit = screen.getByRole('button', { name: /continue to summary/i });
    await user.click(submit);

    expect(await screen.findByText('Invalid card number')).toBeInTheDocument();
    expect(store.getState().checkout.card).toBeNull();
  });

  it('submits valid card + delivery data to the store', async () => {
    const user = userEvent.setup();
    renderDialog();
    await fillValidForm(user);

    await user.click(screen.getByRole('button', { name: /continue to summary/i }));

    await waitFor(() => {
      const state = store.getState().checkout;
      expect(state.step).toBe('summary');
      expect(state.card?.number).toBe('4242 4242 4242 4242');
      expect(state.delivery?.email).toBe('john@example.com');
    });
  });

  it('uppercases the cardholder name while typing', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByLabelText('Cardholder name'), 'john');
    expect(screen.getByLabelText('Cardholder name')).toHaveValue('JOHN');
  });

  it('formats the card number in groups of four', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByLabelText('Card number'), '4242424242424242');
    expect(screen.getByLabelText('Card number')).toHaveValue('4242 4242 4242 4242');
  });
});