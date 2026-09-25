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

/**
 * Decides which persisted step can be safely restored.
 * Restorable steps and their required fields:
 * - 'card-delivery': delivery present
 * - 'result': cardMeta + delivery + transactionId + transactionStatus + totalInCents
 * 'summary'/'processing' are NOT restorable: rendering the summary (and paying)
 * requires the full card object, which is intentionally never persisted
 * (sensitive data). Anything else (incoherent state) falls back to 'product'.
 */
const restorableStep = (
  safe: PersistedSafeState,
): { step: CheckoutState['step']; hasCardMeta: boolean } => {
  const hasCardMeta = typeof (safe as { cardMeta?: unknown }).cardMeta === 'object' && (safe as { cardMeta?: unknown }).cardMeta !== null;
  const hasDelivery = safe.delivery !== null && safe.delivery !== undefined;
  const hasResult =
    hasCardMeta && hasDelivery &&
    !!safe.transactionId && !!safe.transactionStatus && typeof safe.totalInCents === 'number';

  switch (safe.step) {
    case 'card-delivery':
      return hasDelivery ? { step: 'card-delivery', hasCardMeta } : { step: 'product', hasCardMeta };
    case 'result':
      return hasResult ? { step: 'result', hasCardMeta } : { step: 'product', hasCardMeta };
    default:
      return { step: 'product', hasCardMeta };
  }
};

/** Loads persisted flow progress. Sensitive card data is NOT restored (only metadata). */
export const loadPersistedState = (): Partial<CheckoutState> | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const safe = JSON.parse(raw) as PersistedSafeState;
    // Downgrade incoherent states: a step is only restored when the fields it
    // needs were persisted too (e.g. 'summary' without cardMeta -> 'product').
    const { step } = restorableStep(safe);
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