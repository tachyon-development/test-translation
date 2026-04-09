import { test, expect } from './fixtures/auth';

test.describe('Fault Tolerance', () => {
  test('system handles AI unavailability gracefully', async ({ guestPage }) => {
    // Intercept Ollama calls to simulate failure
    await guestPage.route('**/api/generate', (route) => route.abort());
    await guestPage.goto('/');
    await guestPage.fill('[data-testid="room-input"]', '412');
    await guestPage.fill('[data-testid="request-input"]', 'Test with AI down');
    await guestPage.click('[data-testid="submit-button"]');
    // Should eventually show some status (manual_review or processing)
    await expect(
      guestPage.locator('[data-testid="progress-stepper"]')
    ).toBeVisible({ timeout: 10000 });
  });
});
