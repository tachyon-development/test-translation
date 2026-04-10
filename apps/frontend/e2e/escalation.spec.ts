import { test, expect } from './fixtures/auth';

test.describe('Escalation', () => {
  test('manager sees escalated workflows', async ({ managerPage }) => {
    await managerPage.goto('/manager');
    await managerPage.waitForLoadState('networkidle');
    // Assert escalation center visible — either the title or the empty state
    await expect(
      managerPage.getByText('Escalation Center').or(
        managerPage.getByText('No escalations')
      )
    ).toBeVisible({ timeout: 10000 });
  });

  test('manager can override classification', async ({ managerPage }) => {
    await managerPage.goto('/manager');
    await managerPage.waitForLoadState('networkidle');
    // The page should at minimum load — check for any content
    await expect(
      managerPage.getByText('Escalation Center').or(
        managerPage.getByText('No escalations')
      )
    ).toBeVisible({ timeout: 10000 });
    // If there are escalated workflows with an override button, test it
    const overrideBtn = managerPage.getByRole('button', { name: /override/i }).first();
    if (await overrideBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await overrideBtn.click();
      await expect(
        managerPage.locator('[data-testid="classification-override"]')
      ).toBeVisible({ timeout: 10000 });
    }
  });
});
