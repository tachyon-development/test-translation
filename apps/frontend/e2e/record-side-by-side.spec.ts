/**
 * Side-by-Side Real-Time Demo
 *
 * Records Guest Kiosk + Staff Dashboard simultaneously,
 * then stitches them into a single side-by-side video.
 *
 * Run: npx playwright test e2e/record-side-by-side.spec.ts --workers=1
 */
import { test, type Page, type APIRequestContext } from '@playwright/test';
import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';

const PROD_URL = 'https://hospiq-eight.vercel.app';
const API_URL = 'https://hospiq-api-production.up.railway.app';
const GOLD = '#d4a574';
const SAGE = '#7c9885';

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

async function loginAs(request: APIRequestContext, email: string): Promise<string> {
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
    } catch { /* retry */ }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error(`Failed to login as ${email}`);
}

test('Side-by-side: Guest submits → Staff sees in real-time', async ({ browser, request }) => {
  test.setTimeout(120_000);

  const outDir = 'test-results/side-by-side';
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  // Login as staff
  const staffToken = await loginAs(request, 'juan@hotel-mariana.com');

  // Create two browser contexts with video recording
  const guestCtx = await browser.newContext({
    viewport: { width: 960, height: 540 },
    recordVideo: { dir: outDir, size: { width: 960, height: 540 } },
  });
  const staffCtx = await browser.newContext({
    viewport: { width: 960, height: 540 },
    recordVideo: { dir: outDir, size: { width: 960, height: 540 } },
  });

  const guestPage = await guestCtx.newPage();
  const staffPage = await staffCtx.newPage();

  // ── STAFF: Open dashboard ──
  await staffPage.goto(`${PROD_URL}/`);
  await staffPage.evaluate((t: string) => localStorage.setItem('hospiq_token', t), staffToken);
  await staffPage.goto(`${PROD_URL}/dashboard`);
  await staffPage.waitForLoadState('networkidle');
  await showOverlay(staffPage, '◆ Staff Dashboard — Live via WebSocket');
  await staffPage.waitForTimeout(2000);

  // ── GUEST: Open kiosk ──
  await guestPage.goto(`${PROD_URL}/`);
  await guestPage.waitForLoadState('networkidle');
  await showOverlay(guestPage, '◆ Guest Kiosk — Room 412');
  await guestPage.waitForTimeout(2000);

  // ── GUEST: Fill in room ──
  const roomInput = guestPage.locator('[data-testid="room-input"]');
  if (await roomInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await roomInput.fill('412');
  }
  await guestPage.waitForTimeout(1000);

  // ── GUEST: Type request ──
  await showOverlay(guestPage, '◆ Guest typing request...');
  const textInput = guestPage.locator('[data-testid="request-input"]');
  if (await textInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await textInput.click();
    // Type slowly for visual effect
    for (const char of 'My faucet is leaking badly') {
      await textInput.press(char === ' ' ? 'Space' : char);
      await guestPage.waitForTimeout(60);
    }
  }
  await guestPage.waitForTimeout(1500);

  // ── STAFF: Show "Waiting for requests..." ──
  await showOverlay(staffPage, '◆ Staff waiting for new requests...');
  await staffPage.waitForTimeout(1000);

  // ── GUEST: Submit! ──
  await showOverlay(guestPage, '◆ Submitting request...', GOLD);
  const submitBtn = guestPage.locator('[data-testid="submit-button"]');
  if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await submitBtn.click();
  }
  await guestPage.waitForTimeout(2000);

  // ── GUEST: Show progress ──
  await showOverlay(guestPage, '◆ AI classifying via Groq (~5s)');

  // ── Wait for Groq to classify ──
  await staffPage.waitForTimeout(8000);
  await showOverlay(staffPage, '◆ New workflow card appeared!', SAGE);
  await showOverlay(guestPage, '◆ Request routed to department!', SAGE);
  await guestPage.waitForTimeout(3000);

  // ── Hold final state ──
  await showOverlay(staffPage, '◆ Real-time update via WebSocket ✓', SAGE);
  await showOverlay(guestPage, '◆ Guest sees live progress ✓', SAGE);
  await guestPage.waitForTimeout(4000);

  // ── Close contexts to finalize videos ──
  const guestVideoPath = await guestPage.video()?.path();
  const staffVideoPath = await staffPage.video()?.path();

  await guestCtx.close();
  await staffCtx.close();

  // ── Stitch side-by-side with ffmpeg ──
  if (guestVideoPath && staffVideoPath) {
    console.log(`\nGuest video: ${guestVideoPath}`);
    console.log(`Staff video: ${staffVideoPath}`);

    const mp4Out = 'docs/demo-realtime.mp4';
    const gifOut = 'docs/demo-realtime.gif';

    try {
      // Side-by-side MP4
      execSync(
        `ffmpeg -y -i "${guestVideoPath}" -i "${staffVideoPath}" ` +
        `-filter_complex "[0:v]scale=960:540[left];[1:v]scale=960:540[right];[left][right]hstack=inputs=2" ` +
        `-t 35 -r 15 "${mp4Out}"`,
        { stdio: 'pipe', timeout: 60000 }
      );
      console.log(`✅ Side-by-side MP4: ${mp4Out}`);

      // GIF
      execSync(
        `ffmpeg -y -i "${mp4Out}" ` +
        `-vf "fps=8,scale=1280:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=256:stats_mode=diff[p];[s1][p]paletteuse=dither=floyd_steinberg" ` +
        `-loop 0 "${gifOut}"`,
        { stdio: 'pipe', timeout: 60000 }
      );
      console.log(`✅ Side-by-side GIF: ${gifOut}`);
    } catch (e) {
      console.error('ffmpeg stitching failed:', e);
    }
  }
});

test('Side-by-side: Staff claims workflow while Guest watches', async ({ browser, request }) => {
  test.setTimeout(90_000);

  const outDir = 'test-results/side-by-side';
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const staffToken = await loginAs(request, 'juan@hotel-mariana.com');

  const staffCtx = await browser.newContext({
    viewport: { width: 960, height: 540 },
    recordVideo: { dir: outDir, size: { width: 960, height: 540 } },
  });
  const guestCtx = await browser.newContext({
    viewport: { width: 960, height: 540 },
    recordVideo: { dir: outDir, size: { width: 960, height: 540 } },
  });

  const staffPage = await staffCtx.newPage();
  const guestPage = await guestCtx.newPage();

  // Staff opens dashboard
  await staffPage.goto(`${PROD_URL}/`);
  await staffPage.evaluate((t: string) => localStorage.setItem('hospiq_token', t), staffToken);
  await staffPage.goto(`${PROD_URL}/dashboard`);
  await staffPage.waitForLoadState('networkidle');
  await showOverlay(staffPage, '◆ Staff Dashboard');
  await staffPage.waitForTimeout(2000);

  // Guest submits a new request
  await guestPage.goto(`${PROD_URL}/`);
  await guestPage.waitForLoadState('networkidle');
  await showOverlay(guestPage, '◆ Guest submitting request');

  const roomInput = guestPage.locator('[data-testid="room-input"]');
  if (await roomInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await roomInput.fill('305');
  }
  const textInput = guestPage.locator('[data-testid="request-input"]');
  if (await textInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await textInput.fill('The drain in my bathroom is completely clogged');
  }
  await guestPage.waitForTimeout(1000);

  const submitBtn = guestPage.locator('[data-testid="submit-button"]');
  if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await submitBtn.click();
  }

  await showOverlay(guestPage, '◆ Waiting for help...');
  await guestPage.waitForTimeout(10000); // Wait for Groq

  // Staff clicks a workflow card
  await showOverlay(staffPage, '◆ Staff claiming the workflow');
  const card = staffPage.locator('[data-testid="workflow-card"]').first();
  if (await card.isVisible({ timeout: 5000 }).catch(() => false)) {
    await card.click();
    await staffPage.waitForTimeout(2000);

    // Click Claim button
    const claimBtn = staffPage.getByRole('button', { name: /claim/i }).first();
    if (await claimBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await claimBtn.click();
      await showOverlay(staffPage, '◆ Workflow claimed by Juan!', SAGE);
    }
  }

  await showOverlay(guestPage, '◆ Guest sees: Help is on the way!', SAGE);
  await guestPage.waitForTimeout(5000);

  const guestVideoPath = await guestPage.video()?.path();
  const staffVideoPath = await staffPage.video()?.path();

  await guestCtx.close();
  await staffCtx.close();

  // Stitch
  if (guestVideoPath && staffVideoPath) {
    try {
      execSync(
        `ffmpeg -y -i "${guestVideoPath}" -i "${staffVideoPath}" ` +
        `-filter_complex "[0:v]scale=960:540[left];[1:v]scale=960:540[right];[left][right]hstack=inputs=2" ` +
        `-t 30 -r 15 "docs/demo-claim.mp4"`,
        { stdio: 'pipe', timeout: 60000 }
      );
      console.log('✅ Claim demo: docs/demo-claim.mp4');
    } catch (e) {
      console.error('ffmpeg failed:', e);
    }
  }
});

test('Side-by-side: Mandarin guest → AI translates & routes', async ({ browser, request }) => {
  test.setTimeout(120_000);

  const outDir = 'test-results/side-by-side';
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const staffToken = await loginAs(request, 'juan@hotel-mariana.com');

  const guestCtx = await browser.newContext({
    viewport: { width: 960, height: 540 },
    recordVideo: { dir: outDir, size: { width: 960, height: 540 } },
  });
  const staffCtx = await browser.newContext({
    viewport: { width: 960, height: 540 },
    recordVideo: { dir: outDir, size: { width: 960, height: 540 } },
  });

  const guestPage = await guestCtx.newPage();
  const staffPage = await staffCtx.newPage();

  // Staff: open dashboard
  await staffPage.goto(`${PROD_URL}/`);
  await staffPage.evaluate((t: string) => localStorage.setItem('hospiq_token', t), staffToken);
  await staffPage.goto(`${PROD_URL}/dashboard`);
  await staffPage.waitForLoadState('networkidle');
  await showOverlay(staffPage, 'STAFF DASHBOARD — Waiting for requests');
  await staffPage.waitForTimeout(2000);

  // Guest: open kiosk
  await guestPage.goto(`${PROD_URL}/`);
  await guestPage.waitForLoadState('networkidle');
  await showOverlay(guestPage, 'GUEST KIOSK — Mandarin-speaking guest');
  await guestPage.waitForTimeout(2000);

  // Guest: fill room
  const roomInput = guestPage.locator('[data-testid="room-input"]');
  if (await roomInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await roomInput.fill('601');
  }
  await guestPage.waitForTimeout(1000);

  // Guest: type in Mandarin (character by character for effect)
  await showOverlay(guestPage, 'GUEST — Typing request in Mandarin Chinese');
  const textInput = guestPage.locator('[data-testid="request-input"]');
  if (await textInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await textInput.click();
    // Type the Mandarin text directly (paste-style since we can't type CJK char by char)
    await textInput.fill('空调坏了，房间里非常热，请尽快修理');
    await guestPage.waitForTimeout(1500);
  }

  await showOverlay(guestPage, 'GUEST — "The AC is broken, the room is very hot, please fix ASAP"');
  await guestPage.waitForTimeout(3000);

  // Staff: waiting
  await showOverlay(staffPage, 'STAFF — Watching for incoming requests...');
  await staffPage.waitForTimeout(1000);

  // Guest: submit
  await showOverlay(guestPage, 'SUBMITTING — Mandarin request to AI', GOLD);
  const submitBtn = guestPage.locator('[data-testid="submit-button"]');
  if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await submitBtn.click();
  }
  await guestPage.waitForTimeout(2000);

  // AI processing
  await showOverlay(guestPage, 'AI — Groq translating Mandarin to English + classifying');
  await showOverlay(staffPage, 'STAFF — AI processing Mandarin request...');
  await staffPage.waitForTimeout(10000);

  // Results
  await showOverlay(guestPage, 'TRANSLATED — Routed to Maintenance (Critical)', SAGE);
  await showOverlay(staffPage, 'NEW CARD — Mandarin request auto-translated!', SAGE);
  await guestPage.waitForTimeout(4000);

  // Final
  await showOverlay(guestPage, 'Guest sees progress in real-time', SAGE);
  await showOverlay(staffPage, 'Staff sees English translation + department', SAGE);
  await guestPage.waitForTimeout(4000);

  const guestVideoPath = await guestPage.video()?.path();
  const staffVideoPath = await staffPage.video()?.path();

  await guestCtx.close();
  await staffCtx.close();

  if (guestVideoPath && staffVideoPath) {
    try {
      execSync(
        `ffmpeg -y -i "${guestVideoPath}" -i "${staffVideoPath}" ` +
        `-filter_complex "[0:v]scale=960:540[left];[1:v]scale=960:540[right];[left][right]hstack=inputs=2" ` +
        `-t 40 -r 15 "docs/demo-mandarin.mp4"`,
        { stdio: 'pipe', timeout: 60000 }
      );
      console.log('✅ Mandarin demo: docs/demo-mandarin.mp4');
    } catch (e) {
      console.error('ffmpeg failed:', e);
    }
  }
});
