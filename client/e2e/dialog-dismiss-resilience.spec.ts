// E2E — Bug 1 regression: accidental dismissal must NOT close the card dialog;
// explicit Close steps back to product cleanly; reload never shows broken state.

import { test, expect } from '@playwright/test';
import { openProductDialog, DIALOG_TITLE } from './helpers';

test('dialog stays open on Escape and outside click, typed digits preserved', async ({ page }) => {
  await openProductDialog(page, 'Wireless Headphones');
  const number = page.getByLabel('Card number');
  await number.fill('4242');

  // Escape must be prevented: dialog stays open, state unchanged.
  await number.press('Escape');
  await expect(page.getByText(DIALOG_TITLE)).toBeVisible();
  await expect(number).toHaveValue('4242');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('checkout_state')!).step)).toBe(
    'card-delivery',
  );

  // Outside click (overlay) must also be prevented.
  await page.mouse.click(20, 20);
  await expect(page.getByText(DIALOG_TITLE)).toBeVisible();
  await expect(number).toHaveValue('4242');
});

test('explicit Close returns to product step cleanly (no Missing payment data)', async ({ page }) => {
  await openProductDialog(page, 'Wireless Headphones');
  await page.getByLabel('Card number').fill('4242 4242 4242 4242');

  // Radix's Close (X) button.
  await page.getByText('Close', { exact: true }).click();

  // Back on the product list, dialog unmounted, no broken state anywhere.
  await expect(page.getByRole('heading', { name: 'Our products' })).toBeVisible();
  await expect(page.getByText(DIALOG_TITLE)).toBeHidden();
  await expect(page.getByText('Missing payment data')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('checkout_state')!).step)).toBe(
    'product',
  );
});

test('reload at any step never shows Missing payment data', async ({ page }) => {
  // Reload from the card-delivery step (delivery persisted, card not).
  await openProductDialog(page, 'Wireless Headphones');
  await page.getByLabel('Card number').fill('4242 4242 4242 4242');
  await page.reload();
  // Persisted 'card-delivery' + delivery => dialog reopens coherently; if the
  // state were downgraded, the product list shows. Either way: no broken state.
  await expect(page.getByText('Missing payment data')).toHaveCount(0);
  const dialogOpen = await page.getByText(DIALOG_TITLE).isVisible();
  if (!dialogOpen) {
    await expect(page.getByRole('heading', { name: 'Our products' })).toBeVisible();
  }
});

test('reload after reaching summary downgrades to the product step (card data is never persisted)', async ({ page }) => {
  await openProductDialog(page, 'Wireless Headphones');
  await page.getByLabel('Card number').fill('4242 4242 4242 4242');
  await page.getByLabel('CVV').fill('123');
  await page.getByLabel('Month').fill('12');
  await page.getByLabel('Year').fill('29');
  await page.getByLabel('Cardholder name').fill('John Doe');
  await page.getByLabel('Full name').fill('John Doe');
  await page.getByLabel('Email').fill('john@example.com');
  await page.getByLabel('Phone').fill('+573001234567');
  await page.getByLabel('Address').fill('Calle 1 #2-3');
  await page.getByLabel('City').fill('Bogota');
  await page.getByLabel('Postal code').fill('110111');
  await page.getByRole('button', { name: /continue to summary/i }).click();
  await expect(page.getByText('Order summary')).toBeVisible();

  await page.reload();
  // Persisted 'summary' requires the full card object (never persisted for
  // security), so the store downgrades coherently to the product step.
  await expect(page.getByRole('heading', { name: 'Our products' })).toBeVisible();
  await expect(page.getByText('Missing payment data')).toHaveCount(0);
});