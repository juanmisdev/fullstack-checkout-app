// E2E — card form validation: always-enabled submit, inline per-field errors,
// focus management, maxLength, brand logos.

import { test, expect } from '@playwright/test';
import { openProductDialog, fillCardForm, DIALOG_TITLE } from './helpers';

const CONTINUE = /continue to summary/i;

test('submit button is ENABLED while the form is empty (never a dead end)', async ({ page }) => {
  await openProductDialog(page, 'Wireless Headphones');
  const button = page.getByRole('button', { name: CONTINUE });
  await expect(button).toBeEnabled();

  // An empty submit reveals inline errors and focuses the first invalid field.
  await button.click();
  await expect(page.getByText(/Enter a valid 16-digit card number/)).toBeVisible();
  await expect(page.getByLabel('Card number')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#card-number-error')).toBeVisible();
  await expect(page.locator('#card-number')).toBeFocused();
  await expect(page.getByText(/11 fields need attention/)).toBeVisible();
  await expect(page.getByText(DIALOG_TITLE)).toBeVisible();
});

test('submit button stays enabled with a valid form and proceeds to summary', async ({ page }) => {
  await openProductDialog(page, 'Wireless Headphones');
  await fillCardForm(page);
  await expect(page.getByRole('button', { name: CONTINUE })).toBeEnabled();
  await expect(page.locator('#email-error')).toHaveCount(0);

  await page.getByRole('button', { name: CONTINUE }).click();
  await expect(page.getByText('Order summary')).toBeVisible();
});

test('screenshot scenario: valid number/cvv, month 12 year 12, holder "12", email "hola" → per-field errors, focus on year (first invalid in DOM order)', async ({ page }) => {
  await openProductDialog(page, 'Wireless Headphones');
  await page.getByLabel('Card number').fill('4242 4242 4242 4242');
  await page.getByLabel('CVV').fill('123');
  await page.getByLabel('Month').fill('12');
  await page.getByLabel('Year').fill('12');
  await page.getByLabel('Cardholder name').fill('12');
  await page.getByLabel('Full name').fill('John Doe');
  await page.getByLabel('Email').fill('hola');
  await page.getByLabel('Phone').fill('+573001234567');
  await page.getByLabel('Address').fill('Calle 1 #2-3');
  await page.getByLabel('City').fill('Bogota');
  await page.getByLabel('Postal code').fill('110111');

  const button = page.getByRole('button', { name: CONTINUE });
  await expect(button).toBeEnabled();
  await button.click();

  // Per-field, actionable errors — not one generic banner.
  await expect(page.getByText(/Enter the name as printed on the card/)).toBeVisible();
  await expect(page.getByText(/Enter a valid email/)).toBeVisible();
  await expect(page.getByText(/This card has expired/)).toBeVisible();

  // Every invalid input is flagged for assistive tech.
  await expect(page.getByLabel('Cardholder name')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Year')).toHaveAttribute('aria-invalid', 'true');

  // Focus lands on the first invalid field in DOM order (year here: number,
  // cvv and month are valid; year '12' → 2012 → expired).
  await expect(page.locator('#exp-year')).toBeFocused();

  // Button stays enabled so the user can fix and resubmit immediately.
  await expect(button).toBeEnabled();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('checkout_state')!).step)).toBe(
    'card-delivery',
  );

  // Fix everything and the same button submits successfully.
  await page.getByLabel('Year').fill('29');
  await page.getByLabel('Cardholder name').fill('John Doe');
  await page.getByLabel('Email').fill('john@example.com');
  await button.click();
  await expect(page.getByText('Order summary')).toBeVisible();
});

test('year field caps at 2 characters', async ({ page }) => {
  await openProductDialog(page, 'Wireless Headphones');
  const year = page.getByLabel('Year');
  await year.fill('202');
  await expect(year).toHaveValue('20');
});

test('brand logo appears while typing VISA and MasterCard numbers', async ({ page }) => {
  await openProductDialog(page, 'Wireless Headphones');

  // VISA (starts with 4).
  await page.getByLabel('Card number').fill('4');
  await expect(page.getByText('VISA', { exact: true })).toBeVisible();

  // MasterCard (5555 5555 5555 4444).
  await page.getByLabel('Card number').fill('5555 5555 5555 4444');
  await expect(page.locator('[aria-label="MasterCard"]')).toBeVisible();
});