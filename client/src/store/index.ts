// Redux store with state rehydration for refresh resilience.

import { configureStore } from '@reduxjs/toolkit';
import checkoutReducer, { restoreState, type CheckoutState } from './checkoutSlice';

const STORAGE_KEY = 'checkout_state';

interface PersistedSafeState {
  step?: CheckoutState['step'];
  productId?: string | null;
  units?: number;
  delivery?: CheckoutState['delivery'];
  transactionId?: string | null;
  transactionStatus?: CheckoutState['transactionStatus'];
  totalInCents?: number | null;
}

/** Loads persisted flow progress. Sensitive card data is NOT restored (only metadata). */
export const loadPersistedState = (): Partial<CheckoutState> | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const safe = JSON.parse(raw) as PersistedSafeState;
    // If a transaction was in flight (processing), resume at summary view.
    const step = safe.step === 'processing' ? 'summary' : (safe.step ?? 'product');
    return {
      step,
      productId: safe.productId ?? null,
      units: safe.units ?? 1,
      delivery: safe.delivery ?? null,
      transactionId: safe.transactionId ?? null,
      transactionStatus: safe.transactionStatus ?? null,
      totalInCents: safe.totalInCents ?? null,
    };
  } catch {
    return null;
  }
};

export const store = configureStore({
  reducer: { checkout: checkoutReducer },
});

// Restore persisted progress at startup (refresh resilience requirement).
const persisted = loadPersistedState();
if (persisted && Object.keys(persisted).length > 0) {
  store.dispatch(restoreState(persisted));
}

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;