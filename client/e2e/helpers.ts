// Shared E2E helpers — selectors, form filling, and a locator for the card dialog.

import { expect, type Page } from '@playwright/test';

export const DIALOG_TITLE = 'Payment details';

export async function openProductDialog(page: Page, productName: string): Promise<void> {
  await page.goto('/');
  const card = page.locator('div.rounded-xl.border', { hasText: productName }).first();
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: /pay with credit card/i }).click();
  await expect(page.getByText(DIALOG_TITLE)).toBeVisible();
}

export async function fillCardForm(page: Page, opts?: { number?: string }): Promise<void> {
  const labels: [string, string][] = [
    ['Card number', opts?.number ?? '4242 4242 4242 4242'],
    ['CVV', '123'],
    ['Month', '12'],
    ['Year', '29'],
    ['Cardholder name', 'John Doe'],
    ['Full name', 'John Doe'],
    ['Email', 'john@example.com'],
    ['Phone', '+573001234567'],
    ['Address', 'Calle 1 #2-3'],
    ['City', 'Bogota'],
    ['Postal code', '110111'],
  ];
  for (const [label, value] of labels) {
    await page.getByLabel(label).fill(value);
  }
}

export async function submitToSummary(page: Page): Promise<void> {
  await page.getByRole('button', { name: /continue to summary/i }).click();
  await expect(page.getByText('Order summary')).toBeVisible();
}