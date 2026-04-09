import { test, expect } from './fixtures/auth';

test.describe('Guest Flow', () => {
  test('guest can submit a text request', async ({ guestPage }) => {
    await guestPage.goto('/');
    // Select room
    await guestPage.fill('[data-testid="room-input"]', '412');
    // Type request
    await guestPage.fill('[data-testid="request-input"]', 'My faucet is leaking badly');
    // Submit
    await guestPage.click('[data-testid="submit-button"]');
    // Assert progress stepper appears
    await expect(guestPage.locator('[data-testid="progress-stepper"]')).toBeVisible();
    // Wait for "Received" step
    await expect(guestPage.locator('text=Received')).toBeVisible();
  });

  test('guest can select room via URL parameter', async ({ guestPage }) => {
    await guestPage.goto('/?room=412');
    // Assert room field is pre-filled
    await expect(guestPage.locator('[data-testid="room-input"]')).toHaveValue('412');
  });

  test('guest sees error gracefully if submission fails', async ({ guestPage }) => {
    // Intercept API to force failure
    await guestPage.route('**/api/requests', (route) => route.abort());
    await guestPage.goto('/');
    await guestPage.fill('[data-testid="room-input"]', '412');
    await guestPage.fill('[data-testid="request-input"]', 'Test request');
    await guestPage.click('[data-testid="submit-button"]');
    // Assert error toast or message appears
    await expect(
      guestPage
        .locator('text=error')
        .or(guestPage.locator('text=failed'))
        .or(guestPage.locator('text=retry'))
        .or(guestPage.locator('text=Retry'))
    ).toBeVisible({ timeout: 5000 });
  });
});
