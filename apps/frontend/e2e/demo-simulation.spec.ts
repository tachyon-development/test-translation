import { test, expect } from '@playwright/test';

test.describe('Demo Simulation', () => {
  test('demo page loads with role buttons', async ({ page }) => {
    await page.goto('/demo');
    await expect(page.locator('text=Guest')).toBeVisible();
    await expect(page.locator('text=Staff')).toBeVisible();
    await expect(page.locator('text=Manager')).toBeVisible();
    await expect(page.locator('text=Admin')).toBeVisible();
  });

  test('guest role button navigates to kiosk', async ({ page }) => {
    await page.goto('/demo');
    await page.click('text=Guest');
    await expect(page).toHaveURL('/');
  });
});
