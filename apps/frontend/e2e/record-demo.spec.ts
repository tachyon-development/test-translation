/**
 * Real-time Demo Recording
 *
 * Captures a side-by-side recording of:
 * - Left: Guest kiosk submitting a request
 * - Right: Staff dashboard showing the request appear in real-time
 *
 * Run: cd apps/frontend && npx playwright test e2e/record-demo.spec.ts --headed
 * Output: screenshots in test-results/demo-recording/
 */
import { test as base, expect } from '@playwright/test';

const test = base.extend({});

test.use({
  video: 'on',
  screenshot: 'on',
  viewport: { width: 1280, height: 800 },
});

test('record real-time demo', async ({ browser, request }) => {
  test.setTimeout(60000);

  // Login as staff
  let token: string | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
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
  if (!token) throw new Error('Failed to login');

  // Create two browser contexts
  const staffContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: 'test-results/demo-recording/', size: { width: 1280, height: 800 } },
  });
  const guestContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: 'test-results/demo-recording/', size: { width: 1280, height: 800 } },
  });

  const staffPage = await staffContext.newPage();
  const guestPage = await guestContext.newPage();

  // Staff: set token and open dashboard
  await staffPage.goto('http://localhost/');
  await staffPage.evaluate((t: string) => localStorage.setItem('hospiq_token', t), token);
  await staffPage.goto('http://localhost/dashboard');
  await staffPage.waitForLoadState('networkidle');
  await staffPage.waitForTimeout(2000);

  // Screenshot 1: Staff dashboard before
  await staffPage.screenshot({ path: 'test-results/demo-recording/01-staff-dashboard-before.png' });

  // Guest: open kiosk
  await guestPage.goto('http://localhost/');
  await guestPage.waitForLoadState('networkidle');
  await guestPage.waitForTimeout(1000);

  // Screenshot 2: Guest kiosk
  await guestPage.screenshot({ path: 'test-results/demo-recording/02-guest-kiosk.png' });

  // Guest: fill in room and request
  await guestPage.fill('[data-testid="room-input"]', '412');
  await guestPage.fill('[data-testid="request-input"]', 'My faucet is leaking badly - please help!');
  await guestPage.waitForTimeout(500);

  // Screenshot 3: Guest filled form
  await guestPage.screenshot({ path: 'test-results/demo-recording/03-guest-filled.png' });

  // Guest: submit
  await guestPage.click('[data-testid="submit-button"]');
  await guestPage.waitForTimeout(1000);

  // Screenshot 4: Guest progress stepper
  await guestPage.screenshot({ path: 'test-results/demo-recording/04-guest-processing.png' });

  // Wait for the request to flow through the system
  await staffPage.waitForTimeout(5000);

  // Screenshot 5: Staff dashboard after — new card should appear
  await staffPage.screenshot({ path: 'test-results/demo-recording/05-staff-dashboard-after.png' });

  // Wait a bit more for classification
  await staffPage.waitForTimeout(10000);

  // Screenshot 6: Final state
  await staffPage.screenshot({ path: 'test-results/demo-recording/06-staff-final.png' });
  await guestPage.screenshot({ path: 'test-results/demo-recording/07-guest-final.png' });

  // Close contexts to save videos
  await staffContext.close();
  await guestContext.close();

  console.log('\n📸 Screenshots saved to test-results/demo-recording/');
  console.log('🎬 Videos saved to test-results/demo-recording/*.webm');
});
