// E2E — idempotency: retry after a 500 keeps the UI coherent; double-submit protection.

import { test, expect } from '@playwright/test';
import { openProductDialog, fillCardForm } from './helpers';

const API = 'https://dp2txvb8v8.execute-api.us-east-1.amazonaws.com/api/v1';

test('failed payment (500) keeps the UI coherent; the attempt carried an idempotencyKey', async ({ page }) => {
  const idempotencyKeys: (string | undefined)[] = [];

  await page.route(`${API}/checkout`, async (route) => {
    const body = route.request().postDataJSON() as { idempotencyKey?: string };
    idempotencyKeys.push(body.idempotencyKey);
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: '{"message":"Simulated gateway outage"}',
    });
  });

  await openProductDialog(page, 'Mechanical Keyboard');
  await fillCardForm(page);
  await page.getByRole('button', { name: /continue to summary/i }).click();
  await expect(page.getByText('Order summary')).toBeVisible();

  await page.getByRole('button', { name: 'Pay now' }).click();

  // The failed attempt surfaces a declined result (error path mapped by the app).
  await expect(page.getByText(/PAYMENT DECLINED/i)).toBeVisible({ timeout: 20_000 });

  // The attempt sent an idempotencyKey (safe-retry contract).
  expect(idempotencyKeys.length).toBe(1);
  expect(idempotencyKeys[0]).toBeTruthy();

  // State is coherent afterwards: the result screen shows the declined state
  // and going back to the product list works without broken state.
  await page.getByRole('button', { name: /back to product/i }).click();
  await expect(page.getByRole('heading', { name: 'Our products' })).toBeVisible();
});

test('processing state disables the Pay button so double-submits cannot fire two requests', async ({ page }) => {
  let calls = 0;
  await page.route(`${API}/checkout`, async (route) => {
    calls += 1;
    // Simulated slow APPROVED response — no real charge hits the sandbox.
    await new Promise((r) => setTimeout(r, 1200));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { transactionId: 'tx_e2e_mock', status: 'APPROVED', totalInCents: 190500 },
      }),
    });
  });

  await openProductDialog(page, 'Mechanical Keyboard');
  await fillCardForm(page);
  await page.getByRole('button', { name: /continue to summary/i }).click();
  await expect(page.getByText('Order summary')).toBeVisible();

  const pay = page.getByRole('button', { name: 'Pay now' });
  await pay.click();
  // Immediately try again — the button is disabled while processing, so the
  // double click cannot fire a second request (asserted via `calls` below).
  // Bounded timeout: once the response lands the button unmounts, and an
  // unbounded locator wait would consume the whole test timeout.
  await pay.click({ force: true, timeout: 1_000 }).catch(() => undefined);

  // Mocked APPROVED lands on the receipt with the transaction id.
  await expect(page.getByText(/TOTAL PAID/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('APPROVED')).toBeVisible();
  expect(calls).toBe(1);
});