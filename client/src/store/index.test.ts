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
      step: 'product', // summary without cardMeta is incoherent -> downgrade
      productId: 'prod_001',
      units: 2,
      totalInCents: 260500,
    });
  });

  it('loadPersistedState downgrades a persisted processing step to summary', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        step: 'processing',
        productId: 'prod_001',
        transactionId: 'tx_9',
        cardMeta: { last4: '4242', holderName: 'JOHN DOE' },
        delivery: { address: 'Calle 1', city: 'Bogota', postalCode: '110111' },
      }),
    );
    const mod = await import('./index');
    expect(mod.loadPersistedState()).toMatchObject({ step: 'summary', transactionId: 'tx_9' });
  });

  it('downgrades summary/processing without cardMeta to product', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ step: 'summary', productId: 'prod_001', delivery: { address: 'x', city: 'y', postalCode: 'z' } }),
    );
    const mod = await import('./index');
    expect(mod.loadPersistedState()).toMatchObject({ step: 'product', productId: 'prod_001' });
  });

  it('downgrades card-delivery without delivery to product', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ step: 'card-delivery', productId: 'prod_001', units: 2 }));
    const mod = await import('./index');
    expect(mod.loadPersistedState()).toMatchObject({ step: 'product', productId: 'prod_001', units: 2 });
  });

  it('keeps card-delivery when delivery data is present', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ step: 'card-delivery', productId: 'prod_001', delivery: { address: 'x', city: 'y', postalCode: 'z' } }),
    );
    const mod = await import('./index');
    expect(mod.loadPersistedState()).toMatchObject({ step: 'card-delivery' });
  });

  it('keeps result only when transactionId, status and total are all present', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        step: 'result',
        productId: 'prod_001',
        transactionId: 'tx_1',
        transactionStatus: 'APPROVED',
        totalInCents: 260500,
        cardMeta: { last4: '4242', holderName: 'JOHN DOE' },
        delivery: { address: 'x', city: 'y', postalCode: 'z' },
      }),
    );
    const mod = await import('./index');
    expect(mod.loadPersistedState()).toMatchObject({ step: 'result', transactionId: 'tx_1' });
  });

  it('downgrades an incomplete result step to product', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ step: 'result', productId: 'prod_001', transactionId: 'tx_1' }),
    );
    const mod = await import('./index');
    expect(mod.loadPersistedState()).toMatchObject({ step: 'product', productId: 'prod_001' });
  });

  it('loadPersistedState returns null for corrupted stored JSON', async () => {
    localStorage.setItem(STORAGE_KEY, 'not-json{');
    const mod = await import('./index');
    expect(mod.loadPersistedState()).toBeNull();
  });

  it('restores persisted progress into the store at import time', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        step: 'summary',
        productId: 'prod_001',
        units: 3,
        cardMeta: { last4: '4242', holderName: 'JOHN DOE' },
        delivery: { address: 'x', city: 'y', postalCode: 'z' },
      }),
    );
    vi.resetModules();
    const mod = await import('./index');
    const state = mod.store.getState().checkout;
    expect(state.step).toBe('summary');
    expect(state.productId).toBe('prod_001');
    expect(state.units).toBe(3);
  });
});