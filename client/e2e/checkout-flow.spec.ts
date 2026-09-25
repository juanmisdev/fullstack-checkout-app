// E2E — full happy path against the deployed sandbox API.
// WARNING: creates ONE real (sandbox) charge. Run at most once; afterwards
// reset stock with `cd server && npx ts-node -r dotenv/config prisma/seed.ts`.

import { test, expect } from '@playwright/test';
import { openProductDialog, fillCardForm } from './helpers';

test.describe.configure({ mode: 'serial' });

let stockBefore: string | null = null;

test('full checkout: dialog → summary → processing → APPROVED receipt → stock decremented', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('div.rounded-xl.border', { hasText: 'Wireless Headphones' }).first();
  await expect(card).toBeVisible();

  // Capture the stock badge before the purchase.
  stockBefore = await card.getByText(/in stock/).textContent();

  await card.getByRole('button', { name: /pay with credit card/i }).click();
  await expect(page.getByText('Payment details')).toBeVisible();

  await fillCardForm(page);
  await page.getByRole('button', { name: /continue to summary/i }).click();

  // Summary shows the masked card + fees + total.
  await expect(page.getByText('Order summary')).toBeVisible();
  await expect(page.getByText('VISA •••• 4242')).toBeVisible();
  await expect(page.getByText('$5.00')).toBeVisible(); // base fee
  await expect(page.getByText('$100.00')).toBeVisible(); // delivery fee
  const totalRow = page.locator('div.font-semibold', { hasText: 'Total' });
  await expect(totalRow).toContainText(/\$[\d,]+\.\d{2}/);

  // Pay now → processing state → receipt.
  await page.getByRole('button', { name: 'Pay now' }).click();
  await expect(page.getByText(/Processing payment…/)).toBeVisible();

  // Sandbox cold start + async settlement can take a few seconds.
  await expect(page.getByText(/TOTAL PAID/i)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('APPROVED')).toBeVisible();

  // Receipt shows fees and TOTAL PAID.
  await expect(page.getByText('Base fee')).toBeVisible();
  await expect(page.getByText('Delivery')).toBeVisible();
  await expect(page.getByText('Visa •••• 4242')).toBeVisible();

  // Continue shopping returns to the product list with stock decremented by 1.
  await page.getByRole('button', { name: /continue shopping/i }).click();
  await expect(page.getByRole('heading', { name: 'Our products' })).toBeVisible();

  const cardAfter = page.locator('div.rounded-xl.border', { hasText: 'Wireless Headphones' }).first();
  await expect(cardAfter.getByText(/in stock/)).toBeVisible();
  const stockAfter = await cardAfter.getByText(/in stock/).textContent();
  const beforeNum = parseInt((stockBefore ?? '').match(/\d+/)?.[0] ?? '0', 10);
  const afterNum = parseInt((stockAfter ?? '').match(/\d+/)?.[0] ?? '0', 10);
  expect(afterNum).toBe(beforeNum - 1);
});