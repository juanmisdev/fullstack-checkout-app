// Unit tests — store rehydration (loadPersistedState + startup restore).

import { describe, it, expect, beforeEach, vi } from 'vitest';

const STORAGE_KEY = 'checkout_state';

describe('store rehydration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loadPersistedState returns null when storage is empty', async () => {
    const mod = await import('./index');
    expect(mod.loadPersistedState()).toBeNull();
  });

  it('loadPersistedState parses stored JSON into partial state', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ step: 'summary', productId: 'prod_001', units: 2, totalInCents: 260500 }),
    );
    const mod = await import('./index');
    expect(mod.loadPersistedState()).toMatchObject({
      step: 'summary',
      productId: 'prod_001',
      units: 2,
      totalInCents: 260500,
    });
  });

  it('loadPersistedState downgrades a persisted processing step to summary', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ step: 'processing', productId: 'prod_001', transactionId: 'tx_9' }),
    );
    const mod = await import('./index');
    expect(mod.loadPersistedState()).toMatchObject({ step: 'summary', transactionId: 'tx_9' });
  });

  it('loadPersistedState returns null for corrupted stored JSON', async () => {
    localStorage.setItem(STORAGE_KEY, 'not-json{');
    const mod = await import('./index');
    expect(mod.loadPersistedState()).toBeNull();
  });

  it('restores persisted progress into the store at import time', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ step: 'summary', productId: 'prod_001', units: 3 }),
    );
    vi.resetModules();
    const mod = await import('./index');
    const state = mod.store.getState().checkout;
    expect(state.step).toBe('summary');
    expect(state.productId).toBe('prod_001');
    expect(state.units).toBe(3);
  });
});