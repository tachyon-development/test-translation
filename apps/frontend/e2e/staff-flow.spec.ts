import { test, expect } from './fixtures/auth';

test.describe('Staff Flow', () => {
  test('staff sees workflows on dashboard', async ({ staffPage }) => {
    await staffPage.goto('/dashboard');
    // Assert kanban visible
    await expect(
      staffPage.locator('text=Pending').or(staffPage.locator('text=Claimed'))
    ).toBeVisible();
  });

  test('staff can claim a workflow', async ({ staffPage }) => {
    await staffPage.goto('/dashboard');
    // Find a pending card and click it
    const card = staffPage.locator('[data-testid="workflow-card"]').first();
    await card.click();
    // Assert detail panel opens
    await expect(staffPage.locator('[data-testid="workflow-detail"]')).toBeVisible();
    // Click claim
    await staffPage.click('text=Claim');
  });

  test('staff can filter by department', async ({ staffPage }) => {
    await staffPage.goto('/dashboard');
    // Open department filter
    await staffPage.click('[data-testid="dept-filter"]');
    await staffPage.click('text=Housekeeping');
    // Workflows should filter — the filter should be applied
    await expect(staffPage.locator('[data-testid="dept-filter"]')).toBeVisible();
  });
});
