// E2E — product listing: 3 products, prices, stock badges, responsive grid.

import { test, expect } from '@playwright/test';

const PRODUCT_NAMES = ['Wireless Headphones', 'Mechanical Keyboard', 'Running Shoes'];

test('renders 3 products with names, prices and stock badges on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Our products' })).toBeVisible();
  for (const name of PRODUCT_NAMES) {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }

  // Prices rendered from priceInCents.
  await expect(page.getByText('$2,500.00')).toBeVisible();
  await expect(page.getByText('$1,800.00')).toBeVisible();
  await expect(page.getByText('$3,200.00')).toBeVisible();

  // Stock badges ("N in stock").
  const badges = page.getByText(/in stock|Out of stock/);
  await expect(badges).toHaveCount(3);
});

test('grid is 3 columns on desktop (1440px) and 1 column on mobile (375px)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const grid = page.locator('.grid');
  await expect(grid).toBeVisible();
  const desktopColumns = await grid.evaluate(
    (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
  );
  expect(desktopColumns).toBe(3);

  await page.setViewportSize({ width: 375, height: 800 });
  await page.waitForTimeout(300);
  const mobileColumns = await grid.evaluate(
    (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
  );
  expect(mobileColumns).toBe(1);
});