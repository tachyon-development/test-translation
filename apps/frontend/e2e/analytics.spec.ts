import { test, expect } from './fixtures/auth';

test.describe('Analytics', () => {
  test('analytics page loads with KPI cards', async ({ managerPage }) => {
    await managerPage.goto('/analytics');
    await managerPage.waitForLoadState('networkidle');
    // Wait for the analytics page to load
    await expect(managerPage.locator('h1, h2').filter({ hasText: /analytics/i })).toBeVisible({ timeout: 10000 });
  });

  test('D3 charts render', async ({ managerPage }) => {
    await managerPage.goto('/analytics');
    await managerPage.waitForLoadState('networkidle');
    // Assert SVG elements exist (at least 3 D3 charts)
    const svgCount = await managerPage.locator('svg').count();
    expect(svgCount).toBeGreaterThanOrEqual(3);
  });

  test('system health shows services', async ({ managerPage }) => {
    await managerPage.goto('/analytics');
    await managerPage.waitForLoadState('networkidle');
    await expect(
      managerPage
        .locator('text=PostgreSQL')
        .or(managerPage.locator('text=Redis'))
    ).toBeVisible({ timeout: 10000 });
  });
});
