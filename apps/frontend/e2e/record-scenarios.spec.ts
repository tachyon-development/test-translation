/**
 * HospiQ Demo Scenario Recordings
 *
 * Records 6 demo scenarios with in-browser text overlay annotations.
 * Each scenario is a separate test so they can run independently.
 *
 * Run: npx playwright test e2e/record-scenarios.spec.ts --workers=1
 * Output: test-results/scenarios/*.webm
 */
import { test as base, expect, type Page, type APIRequestContext, type BrowserContext } from '@playwright/test';

// ---------------------------------------------------------------------------
// Overlay helpers
// ---------------------------------------------------------------------------

const GOLD = '#d4a574';
const CORAL = '#c17767';
const SAGE = '#7c9885';

async function showOverlay(page: Page, text: string, color: string = GOLD) {
  await page.evaluate(({ text, color }) => {
    let overlay = document.getElementById('demo-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'demo-overlay';
      overlay.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; z-index: 99999;
        background: ${color}; color: #0f0f17; font-family: 'DM Sans', sans-serif;
        font-size: 18px; font-weight: 600; text-align: center; padding: 8px 16px;
        letter-spacing: 0.5px;
      `;
      document.body.appendChild(overlay);
    }
    overlay.textContent = text;
    overlay.style.background = color;
    overlay.style.display = 'block';
  }, { text, color });
}

async function hideOverlay(page: Page) {
  await page.evaluate(() => {
    const el = document.getElementById('demo-overlay');
    if (el) el.style.display = 'none';
  });
}

// ---------------------------------------------------------------------------
// Auth helper (retry pattern from fixtures/auth.ts)
// ---------------------------------------------------------------------------

async function loginAs(
  request: APIRequestContext,
  email: string,
  password: string = 'demo2026',
): Promise<string> {
  let token: string | null = null;
  let lastError: string = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await request.post('http://localhost:80/api/auth/login', {
        data: { email, password },
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok()) {
        const body = await res.json();
        token = body.token;
        break;
      }
      lastError = `HTTP ${res.status()}: ${await res.text().catch(() => 'no body')}`;
      // On 502/503, wait longer for backend to recover
      if (res.status() >= 500) {
        await new Promise(r => setTimeout(r, 4000));
      }
    } catch (e) {
      lastError = String(e);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  if (!token) throw new Error(`Failed to login as ${email} after 5 attempts. Last error: ${lastError}`);
  return token;
}

async function authenticatedContext(
  browser: import('@playwright/test').Browser,
  request: APIRequestContext,
  email: string,
): Promise<{ ctx: BrowserContext; page: Page }> {
  const token = await loginAs(request, email);
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: 'test-results/scenarios/', size: { width: 1280, height: 800 } },
  });
  const page = await ctx.newPage();
  await page.goto('http://localhost/');
  await page.evaluate((t: string) => localStorage.setItem('hospiq_token', t), token);
  return { ctx, page };
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

const test = base.extend({});

test.use({
  viewport: { width: 1280, height: 800 },
});

test.describe('Demo Scenario Recordings', () => {

  // -------------------------------------------------------------------------
  // Scenario 1: Guest Request -> Staff Real-Time (side-by-side)
  // -------------------------------------------------------------------------
  test('Scenario 1 - Guest Request + Staff Real-Time', async ({ browser, request }) => {
    test.setTimeout(90_000);

    const staffToken = await loginAs(request, 'juan@hotel-mariana.com');

    // Staff context
    const staffCtx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      recordVideo: { dir: 'test-results/scenarios/', size: { width: 1280, height: 800 } },
    });
    const staffPage = await staffCtx.newPage();
    await staffPage.goto('http://localhost/');
    await staffPage.evaluate((t: string) => localStorage.setItem('hospiq_token', t), staffToken);

    // Guest context
    const guestCtx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      recordVideo: { dir: 'test-results/scenarios/', size: { width: 1280, height: 800 } },
    });
    const guestPage = await guestCtx.newPage();

    // Staff: open dashboard
    await staffPage.goto('http://localhost/dashboard');
    await staffPage.waitForLoadState('networkidle');
    await showOverlay(staffPage, 'STAFF DASHBOARD \u2014 Watching in real-time');
    await staffPage.waitForTimeout(3000);

    // Guest: open kiosk
    await guestPage.goto('http://localhost/');
    await guestPage.waitForLoadState('networkidle');
    await showOverlay(guestPage, 'GUEST KIOSK \u2014 Submitting a request');
    await guestPage.waitForTimeout(2000);

    // Guest: fill form
    await guestPage.fill('[data-testid="room-input"]', '412');
    await guestPage.fill('[data-testid="request-input"]', 'My faucet is leaking badly - please help!');
    await guestPage.waitForTimeout(1500);

    // Guest: submit
    await showOverlay(guestPage, 'Request submitted...', SAGE);
    await guestPage.click('[data-testid="submit-button"]');
    await guestPage.waitForTimeout(2000);

    // Show AI classifying
    await showOverlay(guestPage, 'AI classifying...', GOLD);
    await showOverlay(staffPage, 'AI classifying the request...', GOLD);
    await guestPage.waitForTimeout(3000);

    // Show routing
    await showOverlay(guestPage, 'Routed to Maintenance', SAGE);
    await showOverlay(staffPage, 'Routed to Maintenance', SAGE);
    await staffPage.waitForTimeout(3000);

    // Final state
    await showOverlay(staffPage, 'New card appeared!', SAGE);
    await staffPage.waitForTimeout(3000);

    // Cleanup
    await staffCtx.close();
    await guestCtx.close();

    console.log('Scenario 1 recorded.');
  });

  // -------------------------------------------------------------------------
  // Scenario 2: Staff Claim + Resolve Workflow
  // -------------------------------------------------------------------------
  test('Scenario 2 - Staff Claim + Resolve Workflow', async ({ browser, request }) => {
    test.setTimeout(60_000);

    const { ctx, page } = await authenticatedContext(browser, request, 'juan@hotel-mariana.com');

    await page.goto('http://localhost/dashboard');
    await page.waitForLoadState('networkidle');
    await showOverlay(page, 'STAFF \u2014 Claiming a workflow');
    await page.waitForTimeout(3000);

    // Click a workflow card
    const card = page.locator('[data-testid="workflow-card"]').first();
    if (await card.isVisible({ timeout: 5000 }).catch(() => false)) {
      await card.click();
      await page.waitForTimeout(1500);
      await showOverlay(page, 'Viewing workflow details + event timeline');
      await page.waitForTimeout(3000);

      // Click claim button
      const claimBtn = page.getByRole('button', { name: /claim/i });
      if (await claimBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await claimBtn.click();
        await page.waitForTimeout(1000);
        await showOverlay(page, 'Workflow claimed \u2014 now assigned to Juan', SAGE);
        await page.waitForTimeout(3000);
      } else {
        await showOverlay(page, 'Workflow already claimed');
        await page.waitForTimeout(3000);
      }
    } else {
      await showOverlay(page, 'No workflow cards available \u2014 submit a guest request first', CORAL);
      await page.waitForTimeout(3000);
    }

    await ctx.close();
    console.log('Scenario 2 recorded.');
  });

  // -------------------------------------------------------------------------
  // Scenario 3: Manager Analytics Dashboard
  // -------------------------------------------------------------------------
  test('Scenario 3 - Manager Analytics Dashboard', async ({ browser, request }) => {
    test.setTimeout(60_000);

    const { ctx, page } = await authenticatedContext(browser, request, 'maria@hotel-mariana.com');

    await page.goto('http://localhost/analytics');
    await page.waitForLoadState('networkidle');
    await showOverlay(page, 'MANAGER \u2014 Analytics Command Center');
    await page.waitForTimeout(4000);

    // Wait for D3 charts (SVGs)
    await page.waitForSelector('svg', { timeout: 10000 }).catch(() => {});
    await showOverlay(page, 'D3 Stream Graph \u2014 Request volume by department (24h)');
    await page.waitForTimeout(4000);

    // Scroll down to show more
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(1000);
    await showOverlay(page, 'Real-time KPIs + AI confidence histogram');
    await page.waitForTimeout(4000);

    // Scroll down more for system health
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(1000);
    await showOverlay(page, 'System Health \u2014 Service status monitor', SAGE);
    await page.waitForTimeout(3000);

    await ctx.close();
    console.log('Scenario 3 recorded.');
  });

  // -------------------------------------------------------------------------
  // Scenario 4: Manager Escalation View
  // -------------------------------------------------------------------------
  test('Scenario 4 - Manager Escalation View', async ({ browser, request }) => {
    test.setTimeout(60_000);

    const { ctx, page } = await authenticatedContext(browser, request, 'maria@hotel-mariana.com');

    await page.goto('http://localhost/manager');
    await page.waitForLoadState('networkidle');
    await showOverlay(page, 'ESCALATION CENTER \u2014 SLA breaches requiring attention', CORAL);
    await page.waitForTimeout(4000);

    // Check for escalated cards
    const escalated = page.locator('[data-testid="workflow-card"], [data-testid="escalation-card"]').first();
    if (await escalated.isVisible({ timeout: 5000 }).catch(() => false)) {
      await showOverlay(page, 'Escalated workflows with coral severity styling', CORAL);
      await page.waitForTimeout(4000);
    } else {
      await showOverlay(page, 'No current escalations \u2014 all SLAs within threshold', SAGE);
      await page.waitForTimeout(4000);
    }

    await ctx.close();
    console.log('Scenario 4 recorded.');
  });

  // -------------------------------------------------------------------------
  // Scenario 5: Demo Landing Page
  // -------------------------------------------------------------------------
  test('Scenario 5 - Demo Landing Page', async ({ browser }) => {
    test.setTimeout(30_000);

    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      recordVideo: { dir: 'test-results/scenarios/', size: { width: 1280, height: 800 } },
    });
    const page = await ctx.newPage();

    await page.goto('http://localhost/demo');
    await page.waitForLoadState('networkidle');
    await showOverlay(page, 'HospiQ \u2014 Choose a role to explore');
    await page.waitForTimeout(5000);

    // Hover over role cards for visual effect
    const roleCards = page.locator('[data-testid="role-card"]');
    const cardCount = await roleCards.count().catch(() => 0);
    for (let i = 0; i < Math.min(cardCount, 4); i++) {
      await roleCards.nth(i).hover();
      await page.waitForTimeout(800);
    }
    await page.waitForTimeout(2000);

    await ctx.close();
    console.log('Scenario 5 recorded.');
  });

  // -------------------------------------------------------------------------
  // Scenario 6: Admin Settings
  // -------------------------------------------------------------------------
  test('Scenario 6 - Admin Settings', async ({ browser, request }) => {
    test.setTimeout(60_000);

    const { ctx, page } = await authenticatedContext(browser, request, 'admin@hotel-mariana.com');

    await page.goto('http://localhost/admin');
    await page.waitForLoadState('networkidle');
    await showOverlay(page, 'ADMIN \u2014 Departments, Users, Rooms, Integrations');
    await page.waitForTimeout(4000);

    // Navigate to departments
    await page.goto('http://localhost/admin/departments');
    await page.waitForLoadState('networkidle');
    await showOverlay(page, 'Department Management \u2014 SLA targets + escalation rules');
    await page.waitForTimeout(4000);

    // Navigate to rooms
    await page.goto('http://localhost/admin/rooms');
    await page.waitForLoadState('networkidle');
    await showOverlay(page, 'Room Directory \u2014 Floor plans + QR code mapping');
    await page.waitForTimeout(4000);

    await ctx.close();
    console.log('Scenario 6 recorded.');
  });

});
