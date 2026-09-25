// E2E — loading feedback: Pay button disabled + spinner text, actions locked.

import { test, expect } from '@playwright/test';
import { openProductDialog, fillCardForm } from './helpers';

const API = 'https://dp2txvb8v8.execute-api.us-east-1.amazonaws.com/api/v1';

test('Pay now disables the button, shows Processing payment…, and locks Back/Edit', async ({ page }) => {
  await page.route(`${API}/checkout`, async (route) => {
    // Simulated slow APPROVED response — no real charge hits the sandbox.
    await new Promise((r) => setTimeout(r, 2000));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { transactionId: 'tx_e2e_loading', status: 'APPROVED', totalInCents: 190500 },
      }),
    });
  });

  await openProductDialog(page, 'Running Shoes');
  await fillCardForm(page);
  await page.getByRole('button', { name: /continue to summary/i }).click();
  await expect(page.getByText('Order summary')).toBeVisible();

  const pay = page.getByRole('button', { name: 'Pay now' });
  await pay.click();

  // During the 2s window: button disabled with the processing label.
  await expect(page.getByRole('button', { name: /processing payment/i })).toBeDisabled();
  await expect(page.getByText('Processing payment…')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Edit' })).toBeDisabled();

  // The slow mocked response resolves to the receipt.
  await expect(page.getByText(/TOTAL PAID/i)).toBeVisible({ timeout: 15_000 });
});