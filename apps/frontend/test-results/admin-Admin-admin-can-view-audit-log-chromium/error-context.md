# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin.spec.ts >> Admin >> admin can view audit log
- Location: e2e/admin.spec.ts:11:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('table')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('table')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - img [ref=e4]
    - heading "Something went wrong" [level=1] [ref=e6]
    - paragraph [ref=e7]: We hit an unexpected snag. Please try again, and if the issue persists, our team is here to help.
    - button "Try again" [ref=e8]:
      - img [ref=e9]
      - text: Try again
  - alert [ref=e12]
```

# Test source

```ts
  1  | import { test, expect } from './fixtures/auth';
  2  | 
  3  | test.describe('Admin', () => {
  4  |   test('admin can view departments', async ({ adminPage }) => {
  5  |     await adminPage.goto('/admin/departments');
  6  |     await adminPage.waitForLoadState('networkidle');
  7  |     await expect(adminPage.getByRole('cell', { name: 'Maintenance', exact: true })).toBeVisible({ timeout: 10000 });
  8  |     await expect(adminPage.getByRole('cell', { name: 'Housekeeping', exact: true })).toBeVisible({ timeout: 10000 });
  9  |   });
  10 | 
  11 |   test('admin can view audit log', async ({ adminPage }) => {
  12 |     await adminPage.goto('/admin/audit');
  13 |     await adminPage.waitForLoadState('networkidle');
> 14 |     await expect(adminPage.locator('table')).toBeVisible({ timeout: 10000 });
     |                                              ^ Error: expect(locator).toBeVisible() failed
  15 |   });
  16 | 
  17 |   test('admin can view rooms', async ({ adminPage }) => {
  18 |     await adminPage.goto('/admin/rooms');
  19 |     await adminPage.waitForLoadState('networkidle');
  20 |     await expect(adminPage.locator('text=412')).toBeVisible({ timeout: 10000 });
  21 |   });
  22 | });
  23 | 
```