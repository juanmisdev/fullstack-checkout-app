// Component tests — CardDeliveryDialog validation and dispatch.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { CardDeliveryDialog } from './CardDeliveryPage';
import { store } from '@/store';
import { startCheckout, restoreState } from '@/store/checkoutSlice';

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
    // backToProduct does not clear delivery; a previous test's saveCardAndDelivery
    // would otherwise prefill the dialog fields and corrupt later typing.
    store.dispatch(restoreState({ delivery: null }));
    store.dispatch(startCheckout({ productId: 'prod_001', units: 1 }));
  });

  it('keeps the submit button ENABLED with an invalid card number; invalid click shows errors, focuses first invalid field, and dispatches nothing', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByLabelText('Card number'), '4242424242424241');
    await user.type(screen.getByLabelText('CVV'), '123');
    await user.type(screen.getByLabelText('Month'), '12');
    await user.type(screen.getByLabelText('Year'), '29');
    await user.type(screen.getByLabelText('Cardholder name'), 'John Doe');
    await user.type(screen.getByLabelText('Full name'), 'John Doe');
    await user.type(screen.getByLabelText('Email'), 'hola');
    await user.type(screen.getByLabelText('Phone'), '+573001234567');
    await user.type(screen.getByLabelText('Address'), 'Calle 1 #2-3');
    await user.type(screen.getByLabelText('City'), 'Bogota');
    await user.type(screen.getByLabelText('Postal code'), '110111');

    const submit = screen.getByRole('button', { name: /continue to summary/i });
    // Never a dead end: invalid form still leaves the button clickable.
    expect(submit).toBeEnabled();
    await user.click(submit);

    // Nothing dispatched, but every invalid field now explains itself.
    expect(store.getState().checkout.card).toBeNull();
    expect(await screen.findByText(/Enter a valid 16-digit card number/)).toBeInTheDocument();
    expect(screen.getByText(/Enter a valid email/)).toBeInTheDocument();

    // Accessibility wiring: aria-invalid on invalid inputs pointing at errors.
    const email = screen.getByLabelText('Email');
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAttribute('aria-describedby', 'email-error');

    // Focus moved to the FIRST invalid field in DOM order (card number here).
    expect(document.activeElement).toBe(screen.getByLabelText('Card number'));

    // Summary count is announced via the polite live region.
    expect(screen.getByText(/2 fields need attention/)).toBeInTheDocument();

    // Fixing the fields clears the errors and lets the next submit through.
    await user.type(screen.getByLabelText('Email'), '@example.com');
    expect(screen.queryByText(/Enter a valid email/)).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText('Card number'));
    await user.type(screen.getByLabelText('Card number'), '4242424242424242');
    await user.click(submit);
    await waitFor(() => {
      expect(store.getState().checkout.step).toBe('summary');
    });
  });

  it('shows the expired-year error for month 12 / year 12 (format-valid but semantically expired)', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByLabelText('Card number'), '4242424242424242');
    await user.type(screen.getByLabelText('CVV'), '123');
    await user.type(screen.getByLabelText('Month'), '12');
    await user.type(screen.getByLabelText('Year'), '12');
    await user.type(screen.getByLabelText('Cardholder name'), 'John Doe');
    await user.type(screen.getByLabelText('Full name'), 'John Doe');
    await user.type(screen.getByLabelText('Email'), 'john@example.com');
    await user.type(screen.getByLabelText('Phone'), '+573001234567');
    await user.type(screen.getByLabelText('Address'), 'Calle 1 #2-3');
    await user.type(screen.getByLabelText('City'), 'Bogota');
    await user.type(screen.getByLabelText('Postal code'), '110111');

    await user.click(screen.getByRole('button', { name: /continue to summary/i }));

    // Year '12' normalizes to 2012 — the server rejects it; the client now
    // surfaces "expired" before the network round-trip.
    expect(await screen.findByText(/This card has expired/)).toBeInTheDocument();
    expect(screen.getByLabelText('Year')).toHaveAttribute('aria-invalid', 'true');
    expect(document.activeElement).toBe(screen.getByLabelText('Year'));
    expect(store.getState().checkout.step).toBe('card-delivery');
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

  it('submits via Enter key (native form semantics)', async () => {
    const user = userEvent.setup();
    renderDialog();
    await fillValidForm(user);
    fireEvent.submit(screen.getByLabelText('Card number').closest('form')!);
    await waitFor(() => {
      expect(store.getState().checkout.step).toBe('summary');
    });
  });

  it('enables the submit button once every field is valid', async () => {
    const user = userEvent.setup();
    renderDialog();
    const submit = screen.getByRole('button', { name: /continue to summary/i });
    // The button is never disabled by form validity — even pristine.
    expect(submit).toBeEnabled();
    await fillValidForm(user);
    expect(submit).toBeEnabled();
  });

  it('keeps the button enabled after an empty submit and shows the error summary', async () => {
    const user = userEvent.setup();
    renderDialog();
    const submit = screen.getByRole('button', { name: /continue to summary/i });
    await user.click(submit);

    expect(submit).toBeEnabled();
    expect(await screen.findByText(/11 fields need attention/)).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByLabelText('Card number'));
    expect(store.getState().checkout.step).toBe('card-delivery');
  });

  it('shows per-field errors after a valid submit is degraded, and clears them once fixed', async () => {
    const user = userEvent.setup();
    renderDialog();
    await fillValidForm(user);

    // onOpenChange is a stub, so the dialog stays mounted after submit and
    // `touched` remains true — degrading a field now surfaces its inline error.
    await user.click(screen.getByRole('button', { name: /continue to summary/i }));
    await user.clear(screen.getByLabelText('CVV'));

    expect(await screen.findByText(/CVV is the 3–4 digit code on the back/)).toBeInTheDocument();
    expect(screen.getByText(/1 field needs attention/)).toBeInTheDocument();

    await user.type(screen.getByLabelText('CVV'), '123');
    expect(screen.queryByText(/CVV is the 3–4 digit code/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue to summary/i })).toBeEnabled();
  });

  it('syncs autofilled DOM values into React state (self-healing timer)', async () => {
    const user = userEvent.setup();
    vi.useFakeTimers();
    renderDialog();

    // Simulate browser autofill: set DOM values directly WITHOUT input events,
    // exactly like Chrome autofill does. React state must stay empty here.
    const autofill = (label: string, value: string) => {
      const input = screen.getByLabelText(label) as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, value);
    };
    autofill('Card number', '4242424242424242');
    autofill('CVV', '123');
    autofill('Month', '12');
    autofill('Year', '29');
    autofill('Cardholder name', 'John Doe');
    autofill('Full name', 'John Doe');
    autofill('Email', 'john@example.com');
    autofill('Phone', '+573001234567');
    autofill('Address', 'Calle 1 #2-3');
    autofill('City', 'Bogota');
    autofill('Postal code', '110111');

    const submit = screen.getByRole('button', { name: /continue to summary/i });

    // The dialog's self-healing sync runs at 300ms and 1000ms after open.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    vi.useRealTimers();

    // State healed from the DOM: formatting applied, button enabled.
    expect(submit).toBeEnabled();
    expect(screen.getByLabelText('Card number')).toHaveValue('4242 4242 4242 4242');
    expect(screen.getByLabelText('Cardholder name')).toHaveValue('JOHN DOE');

    await user.click(submit);
    await waitFor(() => {
      expect(store.getState().checkout.card?.number).toBe('4242 4242 4242 4242');
      expect(store.getState().checkout.delivery?.email).toBe('john@example.com');
    });
  });
});
describe('CardDeliveryDialog dismissal resilience', () => {
  beforeEach(() => {
    localStorage.clear();
    store.dispatch({ type: 'checkout/backToProduct' });
    store.dispatch(restoreState({ delivery: null }));
    store.dispatch(startCheckout({ productId: 'prod_001', units: 1 }));
  });

  it('stays open when dismissed by Escape or outside click (accidental dismissal)', async () => {
    const user = userEvent.setup();
    renderDialog();

    // Radix fires onEscapeKeyDown / onInteractOutside before onOpenChange;
    // the dialog must preventDefault them so typed card data survives.
    await user.type(screen.getByLabelText('Card number'), '4242');
    screen.getByLabelText('Card number').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    fireEvent.focusOut(screen.getByLabelText('Card number'));

    // Dialog still mounted and typed digits are intact.
    expect(screen.getByLabelText('Card number')).toHaveValue('4242');
  });

  it('explicit close via onOpenChange(false) fires without submitting (host steps back to product)', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Provider store={store}>
        <CardDeliveryDialog open onOpenChange={onOpenChange} />
      </Provider>,
    );
    // Radix Dialog's Close (X) button triggers onOpenChange(false).
    await user.click(screen.getByText('Close'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(store.getState().checkout.step).toBe('card-delivery');
  });

  it('calls onSaved (not just onOpenChange) when the form submits successfully', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onSaved = vi.fn();
    render(
      <Provider store={store}>
        <CardDeliveryDialog open onOpenChange={onOpenChange} onSaved={onSaved} />
      </Provider>,
    );
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /continue to summary/i }));
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(store.getState().checkout.step).toBe('summary');
    expect(store.getState().checkout.card?.number).toBe('4242 4242 4242 4242');
  });
});