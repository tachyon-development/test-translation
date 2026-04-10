import { test, expect } from './fixtures/auth';

test.describe('Real-time Sync', () => {
  test('staff sees guest request in real-time', async ({ browser, request }) => {
    // Two browser contexts
    const staffContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const staffPage = await staffContext.newPage();
    const guestPage = await guestContext.newPage();

    // Login staff via API with retry
    let token: string | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const loginRes = await request.post('http://localhost:80/api/auth/login', {
          data: { email: 'juan@hotel-mariana.com', password: 'demo2026' },
          headers: { 'Content-Type': 'application/json' },
        });
        if (loginRes.ok()) {
          const body = await loginRes.json();
          token = body.token;
          break;
        }
      } catch {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    if (!token) throw new Error('Failed to login after 3 attempts');

    // Navigate first, then set token
    await staffPage.goto('/');
    await staffPage.evaluate(
      (t: string) => localStorage.setItem('hospiq_token', t),
      token
    );

    // Staff opens dashboard
    await staffPage.goto('/dashboard');
    await staffPage.waitForLoadState('networkidle');
    await staffPage.waitForSelector('[data-testid="kanban-board"]', { timeout: 10000 });

    // Count current cards
    const initialCount = await staffPage
      .locator('[data-testid="workflow-card"]')
      .count();

    // Guest submits request
    await guestPage.goto('/');
    await guestPage.fill('[data-testid="room-input"]', '505');
    await guestPage.fill(
      '[data-testid="request-input"]',
      'Playwright test request ' + Date.now()
    );
    await guestPage.click('[data-testid="submit-button"]');

    // Staff should see new card within 15 seconds
    await expect(
      staffPage.locator('[data-testid="workflow-card"]')
    ).toHaveCount(initialCount + 1, { timeout: 15000 });

    await staffContext.close();
    await guestContext.close();
  });
});
