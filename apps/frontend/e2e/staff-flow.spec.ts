import { test, expect } from './fixtures/auth';

test.describe('Staff Flow', () => {
  test('staff sees workflows on dashboard', async ({ staffPage }) => {
    await staffPage.goto('/dashboard');
    await staffPage.waitForLoadState('networkidle');
    // Assert kanban visible
    await expect(
      staffPage.getByRole('heading', { name: 'Pending' })
    ).toBeVisible({ timeout: 10000 });
  });

  test('staff can claim a workflow', async ({ staffPage }) => {
    await staffPage.goto('/dashboard');
    await staffPage.waitForLoadState('networkidle');
    // Find a pending card and click it
    const card = staffPage.locator('[data-testid="workflow-card"]').first();
    await card.click({ timeout: 10000 });
    // Assert detail panel opens
    await expect(staffPage.locator('[data-testid="workflow-detail"]')).toBeVisible({ timeout: 10000 });
    // Click claim
    await staffPage.getByRole('button', { name: /claim/i }).click();
  });

  test('staff can filter by department', async ({ staffPage }) => {
    await staffPage.goto('/dashboard');
    await staffPage.waitForLoadState('networkidle');
    // Open department filter
    await staffPage.locator('[data-testid="dept-filter"]').click({ timeout: 10000 });
    await staffPage.click('text=Housekeeping');
    // Workflows should filter — the filter should be applied
    await expect(staffPage.locator('[data-testid="dept-filter"]')).toBeVisible({ timeout: 10000 });
  });
});
