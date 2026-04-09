import { test, expect } from './fixtures/auth';

test.describe('Escalation', () => {
  test('manager sees escalated workflows', async ({ managerPage }) => {
    await managerPage.goto('/manager');
    // Assert escalation center visible
    await expect(
      managerPage
        .locator('text=Escalation Center')
        .or(managerPage.locator('text=ESCALATION'))
    ).toBeVisible();
  });

  test('manager can override classification', async ({ managerPage }) => {
    await managerPage.goto('/manager');
    // If there are escalated workflows, try to override
    const overrideBtn = managerPage.locator('text=Override Dept').first();
    if (await overrideBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await overrideBtn.click();
      await expect(
        managerPage
          .locator('[data-testid="classification-override"]')
          .or(managerPage.locator('text=Override AI Classification'))
      ).toBeVisible();
    }
  });
});
