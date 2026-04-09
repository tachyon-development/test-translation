import { test as base, type Page, type APIRequestContext } from '@playwright/test';

type CustomFixtures = {
  staffPage: Page;
  managerPage: Page;
  adminPage: Page;
  guestPage: Page;
};

async function loginAs(page: Page, request: APIRequestContext, email: string, password: string = 'demo2026') {
  let token: string | null = null;

  // Retry login up to 3 times (API may be restarting)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await request.post('http://localhost:80/api/auth/login', {
        data: { email, password },
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok()) {
        const body = await response.json();
        token = body.token;
        break;
      }
    } catch {
      // Wait and retry
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  if (!token) throw new Error('Failed to login after 3 attempts');

  // Navigate to the app first so localStorage is accessible
  await page.goto('/');
  await page.evaluate((t: string) => localStorage.setItem('hospiq_token', t), token);
}

export const test = base.extend<CustomFixtures>({
  staffPage: async ({ browser, request }, use) => {
    const page = await browser.newPage();
    await loginAs(page, request, 'juan@hotel-mariana.com');
    await use(page);
    await page.close();
  },
  managerPage: async ({ browser, request }, use) => {
    const page = await browser.newPage();
    await loginAs(page, request, 'maria@hotel-mariana.com');
    await use(page);
    await page.close();
  },
  adminPage: async ({ browser, request }, use) => {
    const page = await browser.newPage();
    await loginAs(page, request, 'admin@hotel-mariana.com');
    await use(page);
    await page.close();
  },
  guestPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await use(page);
    await page.close();
  },
});

export { expect } from '@playwright/test';
