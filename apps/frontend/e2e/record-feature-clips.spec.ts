/**
 * HospiQ Feature Demo Clips — Side-by-Side Edition
 *
 * Every clip uses TWO browser contexts (640x720 each) recorded with video,
 * then stitched side-by-side via ffmpeg into a 1280x720 MP4.
 *
 * Run: npx playwright test e2e/record-feature-clips.spec.ts --workers=1
 * Output: docs/clips/clip-N-name.mp4 + docs/clips/demo-complete.mp4
 */
import { test, type Page, type APIRequestContext, type BrowserContext } from '@playwright/test';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
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
        font-size: 16px; font-weight: 700; text-align: center; padding: 10px 16px;
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

// ---------------------------------------------------------------------------
// Side-by-side context pair helper
// ---------------------------------------------------------------------------

interface ContextPair {
  leftCtx: BrowserContext;
  rightCtx: BrowserContext;
  leftPage: Page;
  rightPage: Page;
}

const SITE_PASSWORD = "OviieAiDemo2026";

async function createSideBySidePair(
  browser: import('@playwright/test').Browser,
): Promise<ContextPair> {
  const authCookie = {
    name: "hospiq-auth",
    value: SITE_PASSWORD,
    domain: new URL(PROD_URL).hostname,
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax" as const,
  };

  // Left = mobile guest kiosk (iPhone-like)
  const leftCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    recordVideo: { dir: RAW_DIR, size: { width: 390, height: 844 } },
  });
  // Right = full desktop dashboard
  const rightCtx = await browser.newContext({
    viewport: { width: 1280, height: 844 },
    recordVideo: { dir: RAW_DIR, size: { width: 1280, height: 844 } },
  });

  // Set auth cookie to bypass password gate
  await leftCtx.addCookies([authCookie]);
  await rightCtx.addCookies([authCookie]);

  const leftPage = await leftCtx.newPage();
  const rightPage = await rightCtx.newPage();
  return { leftCtx, rightCtx, leftPage, rightPage };
}

async function authenticatePage(page: Page, token: string, path: string) {
  await page.goto(`${PROD_URL}/`);
  await page.evaluate((t: string) => localStorage.setItem('hospiq_token', t), token);
  await page.goto(`${PROD_URL}${path}`);
  await page.waitForLoadState('networkidle');
}

// ---------------------------------------------------------------------------
// ffmpeg stitch helper
// ---------------------------------------------------------------------------

function stitchSideBySide(
  leftPath: string | undefined,
  rightPath: string | undefined,
  destPath: string,
  maxDuration: number,
) {
  if (!leftPath || !rightPath || !existsSync(leftPath) || !existsSync(rightPath)) {
    console.warn('Side-by-side stitch: missing video file(s)');
    return;
  }
  try {
    // Left=mobile (390x844), Right=desktop (1280x844). Scale to same height, stack horizontally.
    execSync(
      `ffmpeg -y -i "${leftPath}" -i "${rightPath}" ` +
      `-filter_complex "[0:v]scale=390:844[left];[1:v]scale=1280:844[right];[left][right]hstack=inputs=2" ` +
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
// Clip 1: Multi-Language (40s)
// LEFT: Guest Kiosk (Mandarin request) | RIGHT: Staff Dashboard
// ---------------------------------------------------------------------------
test('Clip 1 - Multi-Language', async ({ browser, request }) => {
  test.setTimeout(180_000);

  const staffToken = await loginAs(request, 'juan@hotel-mariana.com');
  const { leftCtx, rightCtx, leftPage, rightPage } = await createSideBySidePair(browser);

  // RIGHT: Staff dashboard
  await authenticatePage(rightPage, staffToken, '/dashboard');
  await showOverlay(rightPage, 'STAFF — Dashboard live via WebSocket');
  await rightPage.waitForTimeout(2000);

  // LEFT: Guest kiosk
  await leftPage.goto(`${PROD_URL}/`);
  await leftPage.waitForLoadState('networkidle');
  await showOverlay(leftPage, 'GUEST — Mandarin-speaking guest');
  await leftPage.waitForTimeout(2000);

  // LEFT: Fill room number
  const roomInput = leftPage.locator('[data-testid="room-input"]');
  if (await roomInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await roomInput.fill('601');
  }
  await leftPage.waitForTimeout(1000);

  // LEFT: Type Mandarin request
  await showOverlay(leftPage, 'GUEST — Typing in Mandarin Chinese');
  const textInput = leftPage.locator('[data-testid="request-input"]');
  if (await textInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await textInput.click();
    await textInput.fill('\u7a7a\u8c03\u574f\u4e86\uff0c\u623f\u95f4\u91cc\u975e\u5e38\u70ed');
    await leftPage.waitForTimeout(1500);
  }

  await showOverlay(leftPage, 'GUEST — Mandarin: AC is broken, very hot');
  await leftPage.waitForTimeout(3000);

  // RIGHT: Waiting state
  await showOverlay(rightPage, 'STAFF — Watching for incoming requests...');
  await rightPage.waitForTimeout(1000);

  // LEFT: Submit
  await showOverlay(leftPage, 'GUEST — Submitting Mandarin request', GOLD);
  const submitBtn = leftPage.locator('[data-testid="submit-button"]');
  if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await submitBtn.click();
  }
  await leftPage.waitForTimeout(2000);

  // AI processing phase — wait for Groq classification + SSE to update stepper
  await showOverlay(leftPage, 'AI — Groq translating Mandarin + classifying (~10s)');
  await showOverlay(rightPage, 'STAFF — AI processing Mandarin request...');
  await rightPage.waitForTimeout(15000);

  // Results
  await showOverlay(leftPage, 'GUEST — Request routed! Team has been notified', SAGE);
  await showOverlay(rightPage, 'STAFF — New card appeared: auto-translated from Mandarin!', SAGE);
  await leftPage.waitForTimeout(6000);

  // Final hold
  await showOverlay(leftPage, 'GUEST — Progress stepper shows live status', SAGE);
  await showOverlay(rightPage, 'STAFF — Mandarin auto-translated to English', SAGE);
  await leftPage.waitForTimeout(5000);

  // Stitch
  const leftVideo = await leftPage.video()?.path();
  const rightVideo = await rightPage.video()?.path();
  await leftCtx.close();
  await rightCtx.close();
  stitchSideBySide(leftVideo, rightVideo, resolve(CLIPS_DIR, 'clip-1-multilang.mp4'), 40);
});

// ---------------------------------------------------------------------------
// Clip 2: Real-Time Flow (35s)
// LEFT: Guest Kiosk | RIGHT: Staff Dashboard
// ---------------------------------------------------------------------------
test('Clip 2 - Real-Time Flow', async ({ browser, request }) => {
  test.setTimeout(180_000);

  const staffToken = await loginAs(request, 'juan@hotel-mariana.com');
  const { leftCtx, rightCtx, leftPage, rightPage } = await createSideBySidePair(browser);

  // RIGHT: Staff dashboard
  await authenticatePage(rightPage, staffToken, '/dashboard');
  await showOverlay(rightPage, 'STAFF — Dashboard live via WebSocket');
  await rightPage.waitForTimeout(2000);

  // LEFT: Guest kiosk
  await leftPage.goto(`${PROD_URL}/`);
  await leftPage.waitForLoadState('networkidle');
  await showOverlay(leftPage, 'GUEST — Room 305');
  await leftPage.waitForTimeout(2000);

  // LEFT: Fill room
  const roomInput = leftPage.locator('[data-testid="room-input"]');
  if (await roomInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await roomInput.fill('305');
  }
  await leftPage.waitForTimeout(1000);

  // LEFT: Type request slowly for visual effect
  await showOverlay(leftPage, 'GUEST — Typing emergency request');
  const textInput = leftPage.locator('[data-testid="request-input"]');
  if (await textInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await textInput.click();
    const msg = "There's a water leak flooding my bathroom!";
    for (const char of msg) {
      await textInput.press(char === ' ' ? 'Space' : char === "'" ? "'" : char === '!' ? '!' : char);
      await leftPage.waitForTimeout(50);
    }
  }
  await leftPage.waitForTimeout(1500);

  // RIGHT: Waiting
  await showOverlay(rightPage, 'STAFF — Waiting for new requests...');

  // LEFT: Submit
  await showOverlay(leftPage, 'GUEST — Submitting...', GOLD);
  const submitBtn = leftPage.locator('[data-testid="submit-button"]');
  if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await submitBtn.click();
  }
  await leftPage.waitForTimeout(2000);

  // AI classifying
  await showOverlay(leftPage, 'AI — Classifying via Groq (~10s)');
  await showOverlay(rightPage, 'STAFF — AI classifying incoming request...');
  await rightPage.waitForTimeout(12000);

  // Results
  await showOverlay(leftPage, 'GUEST — Routed to Maintenance!', SAGE);
  await showOverlay(rightPage, 'STAFF — New workflow card appeared!', SAGE);
  await leftPage.waitForTimeout(3000);

  // Final
  await showOverlay(leftPage, 'GUEST — Live progress via WebSocket', SAGE);
  await showOverlay(rightPage, 'STAFF — Real-time update received', SAGE);
  await leftPage.waitForTimeout(4000);

  const leftVideo = await leftPage.video()?.path();
  const rightVideo = await rightPage.video()?.path();
  await leftCtx.close();
  await rightCtx.close();
  stitchSideBySide(leftVideo, rightVideo, resolve(CLIPS_DIR, 'clip-2-realtime.mp4'), 35);
});

// ---------------------------------------------------------------------------
// Clip 3: Staff Claims -> Guest Sees Update (30s)
// LEFT: Guest progress stepper | RIGHT: Staff Dashboard
// ---------------------------------------------------------------------------
test('Clip 3 - Staff Claims Guest Sees Update', async ({ browser, request }) => {
  test.setTimeout(180_000);

  const staffToken = await loginAs(request, 'juan@hotel-mariana.com');
  const { leftCtx, rightCtx, leftPage, rightPage } = await createSideBySidePair(browser);

  // Submit a request via API so both views have something to work with
  try {
    await request.post(`${API_URL}/api/requests`, {
      data: {
        text: 'The drain in my bathroom is completely clogged',
        room_number: '305',
        org_id: ORG_ID,
      },
      headers: { 'Content-Type': 'application/json' },
    });
  } catch { /* best effort */ }

  // Wait for Groq to process
  await new Promise(r => setTimeout(r, 12000));

  // LEFT: Guest kiosk — submit same request so we land on the progress stepper
  await leftPage.goto(`${PROD_URL}/`);
  await leftPage.waitForLoadState('networkidle');

  const roomInput = leftPage.locator('[data-testid="room-input"]');
  if (await roomInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await roomInput.fill('305');
  }
  const textInput = leftPage.locator('[data-testid="request-input"]');
  if (await textInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await textInput.fill('The drain in my bathroom is completely clogged');
  }
  const submitBtn = leftPage.locator('[data-testid="submit-button"]');
  if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await submitBtn.click();
  }
  await leftPage.waitForTimeout(2000);

  await showOverlay(leftPage, 'GUEST — Waiting for help (progress stepper)');
  await leftPage.waitForTimeout(10000);

  // RIGHT: Staff dashboard
  await authenticatePage(rightPage, staffToken, '/dashboard');
  await showOverlay(rightPage, 'STAFF — Dashboard with workflow cards');
  await rightPage.waitForTimeout(2000);

  // RIGHT: Click a workflow card
  const card = rightPage.locator('[data-testid="workflow-card"]').first();
  if (await card.isVisible({ timeout: 5000 }).catch(() => false)) {
    await showOverlay(rightPage, 'STAFF — Opening workflow detail...');
    await card.click();
    await rightPage.waitForTimeout(2000);

    // RIGHT: Click Claim
    const claimBtn = rightPage.getByRole('button', { name: /claim/i }).first();
    if (await claimBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await claimBtn.click();
      await rightPage.waitForTimeout(1500);
      await showOverlay(rightPage, 'STAFF — Workflow claimed!', SAGE);
      await showOverlay(leftPage, 'GUEST — Staff member assigned!', SAGE);
      await leftPage.waitForTimeout(3000);

      // RIGHT: Click Resolve
      const resolveBtn = rightPage.getByRole('button', { name: /resolve|complete/i }).first();
      if (await resolveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await resolveBtn.click();
        await rightPage.waitForTimeout(1500);
        await showOverlay(rightPage, 'STAFF — Workflow resolved!', SAGE);
        await showOverlay(leftPage, 'GUEST — Request resolved!', SAGE);
        await leftPage.waitForTimeout(3000);
      }
    } else {
      await showOverlay(rightPage, 'STAFF — Viewing workflow details', GOLD);
      await showOverlay(leftPage, 'GUEST — Stepper shows Team Notified', SAGE);
      await leftPage.waitForTimeout(4000);
    }
  } else {
    await showOverlay(rightPage, 'STAFF — No workflow cards yet', CORAL);
    await showOverlay(leftPage, 'GUEST — Waiting for assignment...', GOLD);
    await leftPage.waitForTimeout(4000);
  }

  const leftVideo = await leftPage.video()?.path();
  const rightVideo = await rightPage.video()?.path();
  await leftCtx.close();
  await rightCtx.close();
  stitchSideBySide(leftVideo, rightVideo, resolve(CLIPS_DIR, 'clip-3-claims.mp4'), 30);
});

// ---------------------------------------------------------------------------
// Clip 4: Analytics + Escalation (25s)
// LEFT: Analytics (D3 charts) | RIGHT: Escalation Center
// ---------------------------------------------------------------------------
test('Clip 4 - Analytics and Escalation', async ({ browser, request }) => {
  test.setTimeout(120_000);

  const managerToken = await loginAs(request, 'maria@hotel-mariana.com');
  const { leftCtx, rightCtx, leftPage, rightPage } = await createSideBySidePair(browser);

  // LEFT: Analytics
  await authenticatePage(leftPage, managerToken, '/analytics');
  await showOverlay(leftPage, 'ANALYTICS — Real-time D3 visualizations');
  await leftPage.waitForTimeout(2000);

  // Wait for D3 SVGs to render
  await leftPage.waitForSelector('svg', { timeout: 10000 }).catch(() => {});
  await leftPage.waitForTimeout(2000);

  // RIGHT: Escalation center
  await authenticatePage(rightPage, managerToken, '/manager');
  await showOverlay(rightPage, 'ESCALATION — SLA breach monitoring', CORAL);
  await rightPage.waitForTimeout(2000);

  // Show both views simultaneously
  await showOverlay(leftPage, 'ANALYTICS — Stream graph + confidence distribution');
  await showOverlay(rightPage, 'ESCALATION — Active escalation cards', CORAL);
  await leftPage.waitForTimeout(4000);

  // Scroll analytics to show more
  await leftPage.evaluate(() => window.scrollBy(0, 400));
  await leftPage.waitForTimeout(1000);
  await showOverlay(leftPage, 'ANALYTICS — AI confidence + live event feed');
  await leftPage.waitForTimeout(4000);

  // Show escalated items if any
  const escalated = rightPage.locator('[data-testid="workflow-card"], [data-testid="escalation-card"]').first();
  if (await escalated.isVisible({ timeout: 3000 }).catch(() => false)) {
    await showOverlay(rightPage, 'ESCALATION — Workflows breaching SLA', CORAL);
  } else {
    await showOverlay(rightPage, 'ESCALATION — All SLAs within threshold', SAGE);
  }
  await leftPage.waitForTimeout(4000);

  const leftVideo = await leftPage.video()?.path();
  const rightVideo = await rightPage.video()?.path();
  await leftCtx.close();
  await rightCtx.close();
  stitchSideBySide(leftVideo, rightVideo, resolve(CLIPS_DIR, 'clip-4-analytics-escalation.mp4'), 25);
});

// ---------------------------------------------------------------------------
// Clip 5: Admin + Demo (20s)
// LEFT: Demo landing | RIGHT: Admin departments
// ---------------------------------------------------------------------------
test('Clip 5 - Admin and Demo', async ({ browser, request }) => {
  test.setTimeout(120_000);

  const adminToken = await loginAs(request, 'admin@hotel-mariana.com');
  const { leftCtx, rightCtx, leftPage, rightPage } = await createSideBySidePair(browser);

  // LEFT: Demo page (no auth needed)
  await leftPage.goto(`${PROD_URL}/demo`);
  await leftPage.waitForLoadState('networkidle');
  await showOverlay(leftPage, 'DEMO — One-click role access');
  await leftPage.waitForTimeout(2000);

  // Hover over role cards for visual effect
  const roleCards = leftPage.locator('[data-testid="role-card"]');
  const cardCount = await roleCards.count().catch(() => 0);
  for (let i = 0; i < Math.min(cardCount, 4); i++) {
    await roleCards.nth(i).hover();
    await leftPage.waitForTimeout(800);
  }

  // RIGHT: Admin departments
  await authenticatePage(rightPage, adminToken, '/admin/departments');
  await showOverlay(rightPage, 'ADMIN — Department & SLA configuration');
  await rightPage.waitForTimeout(2000);

  // Wait for table
  await rightPage.waitForSelector('table, [role="table"], .grid', { timeout: 5000 }).catch(() => {});
  await rightPage.waitForTimeout(2000);

  // Final overlays
  await showOverlay(leftPage, 'DEMO — Guest, Staff, Manager, Admin views', SAGE);
  await showOverlay(rightPage, 'ADMIN — Departments, rooms, SLA rules', SAGE);
  await leftPage.waitForTimeout(5000);

  const leftVideo = await leftPage.video()?.path();
  const rightVideo = await rightPage.video()?.path();
  await leftCtx.close();
  await rightCtx.close();
  stitchSideBySide(leftVideo, rightVideo, resolve(CLIPS_DIR, 'clip-5-admin-demo.mp4'), 20);
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
    'clip-3-claims.mp4',
    'clip-4-analytics-escalation.mp4',
    'clip-5-admin-demo.mp4',
  ];

  const existing = clipFiles.filter(f => existsSync(resolve(CLIPS_DIR, f)));
  if (existing.length === 0) {
    console.warn('No clips found — skipping master video creation');
    return;
  }

  console.log(`Found ${existing.length}/${clipFiles.length} clips. Creating master video...`);

  // Create a 1-second black frame video for transitions (1280x720 to match stitched output)
  const blackPath = resolve(RAW_DIR, 'black.mp4');
  try {
    execSync(
      `ffmpeg -y -f lavfi -i color=c=black:s=1280x720:d=1 -r 15 -c:v libx264 -preset fast "${blackPath}"`,
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

  const masterPath = resolve(CLIPS_DIR, 'demo-complete.mp4');
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
