import { test as base, Page } from '@playwright/test';

// Login helper per role
async function loginAs(page: Page, email: string, password: string = 'demo2026') {
  const response = await page.request.post('/api/auth/login', {
    data: { email, password },
  });
  const { token } = await response.json();
  await page.evaluate((t) => localStorage.setItem('hospiq_token', t), token);
}

export const test = base.extend({
  staffPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await loginAs(page, 'juan@hotel-mariana.com');
    await use(page);
    await page.close();
  },
  managerPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await loginAs(page, 'maria@hotel-mariana.com');
    await use(page);
    await page.close();
  },
  adminPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await loginAs(page, 'admin@hotel-mariana.com');
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
