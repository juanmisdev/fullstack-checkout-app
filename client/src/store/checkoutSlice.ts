// Redux Toolkit slice — checkout flow state with localStorage persistence
// for resilience on refresh (test requirement).

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface CardState {
  number: string;
  cvv: string;
  expiryMonth: string;
  expiryYear: string;
  holderName: string;
}

export interface DeliveryState {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
}

export interface CheckoutState {
  step: 'product' | 'card-delivery' | 'summary' | 'processing' | 'result';
  productId: string | null;
  units: number;
  card: CardState | null;
  delivery: DeliveryState | null;
  transactionId: string | null;
  transactionStatus: 'APPROVED' | 'DECLINED' | null;
  totalInCents: number | null;
  idempotencyKey: string | null;
  error: string | null;
}

const initialState: CheckoutState = {
  step: 'product',
  productId: null,
  units: 1,
  card: null,
  delivery: null,
  transactionId: null,
  transactionStatus: null,
  totalInCents: null,
  idempotencyKey: null,
  error: null,
};

// NOTE: sensitive card data is stored ONLY as last4 + brand for display;
// raw number/cvv are never persisted to localStorage.
const persistSafeState = (state: CheckoutState): void => {
  const safe = {
    step: state.step,
    productId: state.productId,
    units: state.units,
    delivery: state.delivery,
    transactionId: state.transactionId,
    transactionStatus: state.transactionStatus,
    totalInCents: state.totalInCents,
    cardMeta: state.card
      ? { last4: state.card.number.replace(/\D/g, '').slice(-4), holderName: state.card.holderName }
      : null,
  };
  try {
    localStorage.setItem('checkout_state', JSON.stringify(safe));
  } catch {
    // storage unavailable — flow continues without persistence
  }
};

const checkoutSlice = createSlice({
  name: 'checkout',
  initialState,
  reducers: {
    startCheckout(state, action: PayloadAction<{ productId: string; units: number }>) {
      state.productId = action.payload.productId;
      state.units = action.payload.units;
      state.step = 'card-delivery';
      persistSafeState(state);
    },
    saveCardAndDelivery(state, action: PayloadAction<{ card: CardState; delivery: DeliveryState }>) {
      state.card = action.payload.card;
      state.delivery = action.payload.delivery;
      state.step = 'summary';
      persistSafeState(state);
    },
    submitPayment(state, action: PayloadAction<{ idempotencyKey: string }>) {
      state.step = 'processing';
      state.idempotencyKey = action.payload.idempotencyKey;
      state.error = null;
      persistSafeState(state);
    },
    paymentSucceeded(state, action: PayloadAction<{ transactionId: string; totalInCents: number }>) {
      state.transactionId = action.payload.transactionId;
      state.totalInCents = action.payload.totalInCents;
      state.transactionStatus = 'APPROVED';
      state.step = 'result';
      persistSafeState(state);
    },
    paymentFailed(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.transactionStatus = 'DECLINED';
      state.step = 'result';
      persistSafeState(state);
    },
    backToSummary(state) {
      state.step = 'summary';
      persistSafeState(state);
    },
    backToProduct(state) {
      state.step = 'product';
      state.card = null;
      state.transactionId = null;
      state.transactionStatus = null;
      state.totalInCents = null;
      state.idempotencyKey = null;
      state.error = null;
      persistSafeState(state);
    },
    restoreState(state, action: PayloadAction<Partial<CheckoutState>>) {
      Object.assign(state, action.payload);
    },
  },
});

export const {
  startCheckout,
  saveCardAndDelivery,
  submitPayment,
  paymentSucceeded,
  paymentFailed,
  backToSummary,
  backToProduct,
  restoreState,
} = checkoutSlice.actions;

export default checkoutSlice.reducer;