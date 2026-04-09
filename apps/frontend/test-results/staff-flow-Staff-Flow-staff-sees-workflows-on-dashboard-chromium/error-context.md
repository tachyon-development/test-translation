# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: staff-flow.spec.ts >> Staff Flow >> staff sees workflows on dashboard
- Location: e2e/staff-flow.spec.ts:4:7

# Error details

```
Error: Failed to login after 3 attempts
```

# Test source

```ts
  1  | import { test as base, type Page, type APIRequestContext } from '@playwright/test';
  2  | 
  3  | type CustomFixtures = {
  4  |   staffPage: Page;
  5  |   managerPage: Page;
  6  |   adminPage: Page;
  7  |   guestPage: Page;
  8  | };
  9  | 
  10 | async function loginAs(page: Page, request: APIRequestContext, email: string, password: string = 'demo2026') {
  11 |   let token: string | null = null;
  12 | 
  13 |   // Retry login up to 3 times (API may be restarting)
  14 |   for (let attempt = 0; attempt < 3; attempt++) {
  15 |     try {
  16 |       const response = await request.post('http://localhost:80/api/auth/login', {
  17 |         data: { email, password },
  18 |         headers: { 'Content-Type': 'application/json' },
  19 |       });
  20 |       if (response.ok()) {
  21 |         const body = await response.json();
  22 |         token = body.token;
  23 |         break;
  24 |       }
  25 |     } catch {
  26 |       // Wait and retry
  27 |       await new Promise(r => setTimeout(r, 2000));
  28 |     }
  29 |   }
  30 | 
> 31 |   if (!token) throw new Error('Failed to login after 3 attempts');
     |                     ^ Error: Failed to login after 3 attempts
  32 | 
  33 |   // Navigate to the app first so localStorage is accessible
  34 |   await page.goto('/');
  35 |   await page.evaluate((t: string) => localStorage.setItem('hospiq_token', t), token);
  36 | }
  37 | 
  38 | export const test = base.extend<CustomFixtures>({
  39 |   staffPage: async ({ browser, request }, use) => {
  40 |     const page = await browser.newPage();
  41 |     await loginAs(page, request, 'juan@hotel-mariana.com');
  42 |     await use(page);
  43 |     await page.close();
  44 |   },
  45 |   managerPage: async ({ browser, request }, use) => {
  46 |     const page = await browser.newPage();
  47 |     await loginAs(page, request, 'maria@hotel-mariana.com');
  48 |     await use(page);
  49 |     await page.close();
  50 |   },
  51 |   adminPage: async ({ browser, request }, use) => {
  52 |     const page = await browser.newPage();
  53 |     await loginAs(page, request, 'admin@hotel-mariana.com');
  54 |     await use(page);
  55 |     await page.close();
  56 |   },
  57 |   guestPage: async ({ browser }, use) => {
  58 |     const page = await browser.newPage();
  59 |     await use(page);
  60 |     await page.close();
  61 |   },
  62 | });
  63 | 
  64 | export { expect } from '@playwright/test';
  65 | 
```