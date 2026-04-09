/**
 * HospiQ Feature Demo Clips
 *
 * Records 7 independent feature clips with text overlays,
 * then concatenates them into a master demo video.
 *
 * Run: npx playwright test e2e/record-feature-clips.spec.ts --workers=1
 * Output: docs/clips/clip-*.mp4 + docs/demo-complete.mp4
 */
import { test, type Page, type APIRequestContext, type BrowserContext } from '@playwright/test';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROD_URL = 'https://hospiq-eight.vercel.app';
const API_URL = 'https://hospiq-api-production.up.railway.app';
const ORG_ID = '00000000-0000-0000-0000-000000000001';
const GOLD = '#d4a574';
const CORAL = '#c17767';
const SAGE = '#7c9885';

const CLIPS_DIR = resolve('docs/clips');
const RAW_DIR = resolve('test-results/feature-clips');

// ---------------------------------------------------------------------------
// Overlay helpers
// ---------------------------------------------------------------------------

async function showOverlay(page: Page, text: string, color: string = GOLD) {
  await page.evaluate(({ text, color }) => {
    let overlay = document.getElementById('demo-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'demo-overlay';
      overlay.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; z-index: 99999;
        color: #0f0f17; font-family: 'DM Sans', sans-serif;
        font-size: 18px; font-weight: 700; text-align: center; padding: 10px 16px;
        letter-spacing: 1px; text-transform: uppercase;
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
// Auth helper (retry pattern)
// ---------------------------------------------------------------------------

async function loginAs(request: APIRequestContext, email: string): Promise<string> {
  let lastError = '';
  for (let i = 0; i < 5; i++) {
    try {
      const res = await request.post(`${API_URL}/api/auth/login`, {
        data: { email, password: 'demo2026' },
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok()) {
        const body = await res.json();
        return body.token;
      }
      lastError = `HTTP ${res.status()}`;
      if (res.status() >= 500) await new Promise(r => setTimeout(r, 4000));
    } catch (e) {
      lastError = String(e);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  throw new Error(`Failed to login as ${email}: ${lastError}`);
}

async function authenticatedContext(
  browser: import('@playwright/test').Browser,
  request: APIRequestContext,
  email: string,
  opts?: { width?: number; height?: number },
): Promise<{ ctx: BrowserContext; page: Page; token: string }> {
  const token = await loginAs(request, email);
  const w = opts?.width ?? 1280;
  const h = opts?.height ?? 800;
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    recordVideo: { dir: RAW_DIR, size: { width: w, height: h } },
  });
  const page = await ctx.newPage();
  await page.goto(`${PROD_URL}/`);
  await page.evaluate((t: string) => localStorage.setItem('hospiq_token', t), token);
  return { ctx, page, token };
}

// ---------------------------------------------------------------------------
// ffmpeg helpers
// ---------------------------------------------------------------------------

function renameVideo(rawPath: string | undefined, destPath: string, maxDuration?: number) {
  if (!rawPath || !existsSync(rawPath)) {
    console.warn(`Video not found: ${rawPath}`);
    return;
  }
  try {
    const durationFlag = maxDuration ? `-t ${maxDuration}` : '';
    execSync(
      `ffmpeg -y -i "${rawPath}" ${durationFlag} -r 15 -c:v libx264 -preset fast -crf 23 "${destPath}"`,
      { stdio: 'pipe', timeout: 60000 },
    );
    console.log(`Saved: ${destPath}`);
  } catch (e) {
    console.error(`ffmpeg rename failed for ${destPath}:`, e);
  }
}

function stitchSideBySide(leftPath: string | undefined, rightPath: string | undefined, destPath: string, maxDuration: number) {
  if (!leftPath || !rightPath || !existsSync(leftPath) || !existsSync(rightPath)) {
    console.warn('Side-by-side stitch: missing video file(s)');
    return;
  }
  try {
    execSync(
      `ffmpeg -y -i "${leftPath}" -i "${rightPath}" ` +
      `-filter_complex "[0:v]scale=640:720[left];[1:v]scale=640:720[right];[left][right]hstack=inputs=2" ` +
      `-t ${maxDuration} -r 15 "${destPath}"`,
      { stdio: 'pipe', timeout: 60000 },
    );
    console.log(`Saved side-by-side: ${destPath}`);
  } catch (e) {
    console.error(`ffmpeg stitch failed for ${destPath}:`, e);
  }
}

// ---------------------------------------------------------------------------
// Ensure directories exist
// ---------------------------------------------------------------------------

test.beforeAll(() => {
  if (!existsSync(CLIPS_DIR)) mkdirSync(CLIPS_DIR, { recursive: true });
  if (!existsSync(RAW_DIR)) mkdirSync(RAW_DIR, { recursive: true });
});

// ---------------------------------------------------------------------------
// Clip 1: Multi-Language AI Classification (30s)
// ---------------------------------------------------------------------------
test('Clip 1 - Multi-Language AI Classification', async ({ browser, request }) => {
  test.setTimeout(120_000);

  const { ctx, page, token } = await authenticatedContext(browser, request, 'juan@hotel-mariana.com');

  await page.goto(`${PROD_URL}/dashboard`);
  await page.waitForLoadState('networkidle');
  await showOverlay(page, '3 Requests Incoming — English, Spanish, Mandarin');
  await page.waitForTimeout(3000);

  // Submit 3 requests via API in the background
  await page.evaluate(async ({ apiUrl, orgId, token }) => {
    const requests = [
      { text: 'My faucet is leaking badly', room_number: '301', org_id: orgId },
      { text: 'Necesito mas toallas por favor', room_number: '302', org_id: orgId },
      { text: '\u7a7a\u8c03\u574f\u4e86\uff0c\u623f\u95f4\u91cc\u975e\u5e38\u70ed', room_number: '303', org_id: orgId },
    ];
    for (const body of requests) {
      fetch(`${apiUrl}/api/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).catch(() => {});
      await new Promise(r => setTimeout(r, 500));
    }
  }, { apiUrl: API_URL, orgId: ORG_ID, token });

  await showOverlay(page, 'AI Processing — Groq translating + classifying all 3');
  await page.waitForTimeout(15000);

  // Refresh to ensure we see the new cards
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  await showOverlay(page, 'English -> Maintenance | Spanish -> Housekeeping | Mandarin -> Maintenance', SAGE);
  await page.waitForTimeout(5000);

  await showOverlay(page, 'AI translated all 3 and routed to correct departments', SAGE);
  await page.waitForTimeout(4000);

  const videoPath = await page.video()?.path();
  await ctx.close();
  renameVideo(videoPath, resolve(CLIPS_DIR, 'clip-1-multilang.mp4'), 30);
});

// ---------------------------------------------------------------------------
// Clip 2: Real-Time WebSocket — Guest to Staff (35s)
// ---------------------------------------------------------------------------
test('Clip 2 - Real-Time WebSocket Guest to Staff', async ({ browser, request }) => {
  test.setTimeout(120_000);

  const staffToken = await loginAs(request, 'juan@hotel-mariana.com');

  // Two 640x720 contexts for side-by-side
  const guestCtx = await browser.newContext({
    viewport: { width: 640, height: 720 },
    recordVideo: { dir: RAW_DIR, size: { width: 640, height: 720 } },
  });
  const staffCtx = await browser.newContext({
    viewport: { width: 640, height: 720 },
    recordVideo: { dir: RAW_DIR, size: { width: 640, height: 720 } },
  });

  const guestPage = await guestCtx.newPage();
  const staffPage = await staffCtx.newPage();

  // Staff: open dashboard
  await staffPage.goto(`${PROD_URL}/`);
  await staffPage.evaluate((t: string) => localStorage.setItem('hospiq_token', t), staffToken);
  await staffPage.goto(`${PROD_URL}/dashboard`);
  await staffPage.waitForLoadState('networkidle');
  await showOverlay(staffPage, 'Staff Dashboard — Live via WebSocket');
  await staffPage.waitForTimeout(2000);

  // Guest: open kiosk
  await guestPage.goto(`${PROD_URL}/`);
  await guestPage.waitForLoadState('networkidle');
  await showOverlay(guestPage, 'Guest Kiosk — Room 305');
  await guestPage.waitForTimeout(2000);

  // Guest: fill room
  const roomInput = guestPage.locator('[data-testid="room-input"]');
  if (await roomInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await roomInput.fill('305');
  }
  await guestPage.waitForTimeout(1000);

  // Guest: type request slowly
  await showOverlay(guestPage, 'Guest Submitting...');
  const textInput = guestPage.locator('[data-testid="request-input"]');
  if (await textInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await textInput.click();
    for (const char of "There's a water leak in my bathroom") {
      await textInput.press(char === ' ' ? 'Space' : char === "'" ? "'" : char);
      await guestPage.waitForTimeout(50);
    }
  }
  await guestPage.waitForTimeout(1500);

  // Staff: waiting
  await showOverlay(staffPage, 'Staff waiting for new requests...');

  // Guest: submit
  await showOverlay(guestPage, 'Submitting request...', GOLD);
  const submitBtn = guestPage.locator('[data-testid="submit-button"]');
  if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await submitBtn.click();
  }
  await guestPage.waitForTimeout(2000);

  // AI classifying
  await showOverlay(guestPage, 'AI Classifying via Groq (~10s)');
  await showOverlay(staffPage, 'AI Classifying incoming request...');
  await staffPage.waitForTimeout(12000);

  // Results
  await showOverlay(staffPage, 'New card on dashboard!', SAGE);
  await showOverlay(guestPage, 'Request routed to Maintenance!', SAGE);
  await guestPage.waitForTimeout(3000);

  // Final
  await showOverlay(staffPage, 'Real-time update via WebSocket', SAGE);
  await showOverlay(guestPage, 'Guest sees live progress', SAGE);
  await guestPage.waitForTimeout(4000);

  const guestVideoPath = await guestPage.video()?.path();
  const staffVideoPath = await staffPage.video()?.path();

  await guestCtx.close();
  await staffCtx.close();

  stitchSideBySide(guestVideoPath, staffVideoPath, resolve(CLIPS_DIR, 'clip-2-realtime.mp4'), 35);
});

// ---------------------------------------------------------------------------
// Clip 3: Staff Workflow Management (25s)
// ---------------------------------------------------------------------------
test('Clip 3 - Staff Workflow Management', async ({ browser, request }) => {
  test.setTimeout(90_000);

  const { ctx, page } = await authenticatedContext(browser, request, 'juan@hotel-mariana.com');

  await page.goto(`${PROD_URL}/dashboard`);
  await page.waitForLoadState('networkidle');
  await showOverlay(page, 'Staff Dashboard — Managing Workflows');
  await page.waitForTimeout(3000);

  // Click a workflow card
  const card = page.locator('[data-testid="workflow-card"]').first();
  if (await card.isVisible({ timeout: 5000 }).catch(() => false)) {
    await card.click();
    await page.waitForTimeout(1500);

    await showOverlay(page, 'Viewing request details + event timeline');
    await page.waitForTimeout(3000);

    // Click Claim button
    const claimBtn = page.getByRole('button', { name: /claim/i }).first();
    if (await claimBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await claimBtn.click();
      await page.waitForTimeout(1000);
      await showOverlay(page, 'Workflow claimed — assigned to staff member', SAGE);
      await page.waitForTimeout(3000);

      // Click Start Work / In Progress
      const startBtn = page.getByRole('button', { name: /start|in.?progress/i }).first();
      if (await startBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await startBtn.click();
        await page.waitForTimeout(1000);
        await showOverlay(page, 'Status: In Progress', SAGE);
        await page.waitForTimeout(3000);
      }
    } else {
      await showOverlay(page, 'Workflow already claimed — viewing details');
      await page.waitForTimeout(3000);
    }
  } else {
    await showOverlay(page, 'No workflow cards available — submit a request first', CORAL);
    await page.waitForTimeout(3000);
  }

  const videoPath = await page.video()?.path();
  await ctx.close();
  renameVideo(videoPath, resolve(CLIPS_DIR, 'clip-3-workflow.mp4'), 25);
});

// ---------------------------------------------------------------------------
// Clip 4: Manager Analytics (20s)
// ---------------------------------------------------------------------------
test('Clip 4 - Manager Analytics', async ({ browser, request }) => {
  test.setTimeout(60_000);

  const { ctx, page } = await authenticatedContext(browser, request, 'maria@hotel-mariana.com');

  await page.goto(`${PROD_URL}/analytics`);
  await page.waitForLoadState('networkidle');
  await showOverlay(page, 'Manager Analytics — D3 Visualizations');
  await page.waitForTimeout(3000);

  // Wait for D3 charts
  await page.waitForSelector('svg', { timeout: 10000 }).catch(() => {});
  await showOverlay(page, 'Stream Graph — Request volume by department (24h)');
  await page.waitForTimeout(4000);

  // Scroll down
  await page.evaluate(() => window.scrollBy(0, 400));
  await page.waitForTimeout(1000);
  await showOverlay(page, 'AI Confidence Distribution + Live Event Feed');
  await page.waitForTimeout(4000);

  const videoPath = await page.video()?.path();
  await ctx.close();
  renameVideo(videoPath, resolve(CLIPS_DIR, 'clip-4-analytics.mp4'), 20);
});

// ---------------------------------------------------------------------------
// Clip 5: SLA Escalation (20s)
// ---------------------------------------------------------------------------
test('Clip 5 - SLA Escalation', async ({ browser, request }) => {
  test.setTimeout(60_000);

  const { ctx, page } = await authenticatedContext(browser, request, 'maria@hotel-mariana.com');

  await page.goto(`${PROD_URL}/manager`);
  await page.waitForLoadState('networkidle');
  await showOverlay(page, 'Escalation Center — SLA Breach Monitoring', CORAL);
  await page.waitForTimeout(4000);

  // Show escalated cards
  const escalated = page.locator('[data-testid="workflow-card"], [data-testid="escalation-card"]').first();
  if (await escalated.isVisible({ timeout: 5000 }).catch(() => false)) {
    await showOverlay(page, 'Escalated workflows — coral severity styling', CORAL);
    await page.waitForTimeout(4000);
  } else {
    await showOverlay(page, 'No current escalations — all SLAs within threshold', SAGE);
    await page.waitForTimeout(3000);
  }

  await showOverlay(page, 'Managers can override AI classification', GOLD);
  await page.waitForTimeout(3000);

  const videoPath = await page.video()?.path();
  await ctx.close();
  renameVideo(videoPath, resolve(CLIPS_DIR, 'clip-5-escalation.mp4'), 20);
});

// ---------------------------------------------------------------------------
// Clip 6: Demo Landing Page (15s)
// ---------------------------------------------------------------------------
test('Clip 6 - Demo Landing Page', async ({ browser }) => {
  test.setTimeout(30_000);

  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: RAW_DIR, size: { width: 1280, height: 800 } },
  });
  const page = await ctx.newPage();

  await page.goto(`${PROD_URL}/demo`);
  await page.waitForLoadState('networkidle');
  await showOverlay(page, 'HospiQ — Choose a role to explore');
  await page.waitForTimeout(3000);

  // Hover over each role card
  const roleCards = page.locator('[data-testid="role-card"]');
  const cardCount = await roleCards.count().catch(() => 0);
  for (let i = 0; i < Math.min(cardCount, 4); i++) {
    await roleCards.nth(i).hover();
    await page.waitForTimeout(800);
  }
  await page.waitForTimeout(1000);

  await showOverlay(page, 'One-click access to Guest, Staff, Manager, Admin views', SAGE);
  await page.waitForTimeout(3000);

  const videoPath = await page.video()?.path();
  await ctx.close();
  renameVideo(videoPath, resolve(CLIPS_DIR, 'clip-6-demo.mp4'), 15);
});

// ---------------------------------------------------------------------------
// Clip 7: Admin — Departments & Rooms (15s)
// ---------------------------------------------------------------------------
test('Clip 7 - Admin Departments and Rooms', async ({ browser, request }) => {
  test.setTimeout(60_000);

  const { ctx, page } = await authenticatedContext(browser, request, 'admin@hotel-mariana.com');

  await page.goto(`${PROD_URL}/admin/departments`);
  await page.waitForLoadState('networkidle');
  await showOverlay(page, 'Admin — Configure departments + SLA rules');
  await page.waitForTimeout(4000);

  // Wait for table to load
  await page.waitForSelector('table, [role="table"], .grid', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(2000);

  await page.goto(`${PROD_URL}/admin/rooms`);
  await page.waitForLoadState('networkidle');
  await showOverlay(page, 'Admin — Manage rooms + QR code generation');
  await page.waitForTimeout(4000);

  const videoPath = await page.video()?.path();
  await ctx.close();
  renameVideo(videoPath, resolve(CLIPS_DIR, 'clip-7-admin.mp4'), 15);
});

// ---------------------------------------------------------------------------
// Master video: concatenate all clips with 1s black transitions
// ---------------------------------------------------------------------------
test('Concatenate master demo video', async () => {
  test.setTimeout(120_000);

  // Wait a moment for all files to be finalized
  await new Promise(r => setTimeout(r, 2000));

  const clipFiles = [
    'clip-1-multilang.mp4',
    'clip-2-realtime.mp4',
    'clip-3-workflow.mp4',
    'clip-4-analytics.mp4',
    'clip-5-escalation.mp4',
    'clip-6-demo.mp4',
    'clip-7-admin.mp4',
  ];

  const existing = clipFiles.filter(f => existsSync(resolve(CLIPS_DIR, f)));
  if (existing.length === 0) {
    console.warn('No clips found — skipping master video creation');
    return;
  }

  console.log(`Found ${existing.length}/${clipFiles.length} clips. Creating master video...`);

  // Create a 1-second black frame video for transitions
  const blackPath = resolve(RAW_DIR, 'black.mp4');
  try {
    execSync(
      `ffmpeg -y -f lavfi -i color=c=black:s=1280x800:d=1 -r 15 -c:v libx264 -preset fast "${blackPath}"`,
      { stdio: 'pipe', timeout: 30000 },
    );
  } catch (e) {
    console.error('Failed to create black transition frame:', e);
  }

  // Build concat file
  const concatLines: string[] = [];
  for (let i = 0; i < existing.length; i++) {
    concatLines.push(`file '${resolve(CLIPS_DIR, existing[i])}'`);
    if (i < existing.length - 1 && existsSync(blackPath)) {
      concatLines.push(`file '${blackPath}'`);
    }
  }

  const concatFile = resolve(RAW_DIR, 'concat.txt');
  writeFileSync(concatFile, concatLines.join('\n'));

  const masterPath = resolve('docs/clips/demo-complete.mp4');
  try {
    execSync(
      `ffmpeg -y -f concat -safe 0 -i "${concatFile}" -c:v libx264 -preset fast -crf 23 "${masterPath}"`,
      { stdio: 'pipe', timeout: 120000 },
    );
    console.log(`Master video saved: ${masterPath}`);
  } catch (e) {
    console.error('Master video concat failed:', e);
    // Fallback: try copy codec
    try {
      execSync(
        `ffmpeg -y -f concat -safe 0 -i "${concatFile}" -c copy "${masterPath}"`,
        { stdio: 'pipe', timeout: 120000 },
      );
      console.log(`Master video saved (copy codec): ${masterPath}`);
    } catch (e2) {
      console.error('Master video concat fallback also failed:', e2);
    }
  }
});
