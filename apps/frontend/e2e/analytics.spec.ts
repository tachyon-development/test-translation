import { test, expect } from './fixtures/auth';

test.describe('Analytics', () => {
  test('analytics page loads with KPI cards', async ({ managerPage }) => {
    await managerPage.goto('/analytics');
    // Assert KPI cards visible
    await expect(
      managerPage
        .locator('text=Active')
        .or(managerPage.locator('text=Avg Resp'))
        .or(managerPage.locator('text=Active Workflows'))
        .or(managerPage.locator('text=Avg Response'))
    ).toBeVisible();
  });

  test('D3 charts render', async ({ managerPage }) => {
    await managerPage.goto('/analytics');
    // Assert SVG elements exist (at least 3 D3 charts)
    await expect(managerPage.locator('svg')).toHaveCount(3, { timeout: 10000 });
  });

  test('system health shows services', async ({ managerPage }) => {
    await managerPage.goto('/analytics');
    await expect(
      managerPage
        .locator('text=PostgreSQL')
        .or(managerPage.locator('text=Redis'))
    ).toBeVisible();
  });
});
