import { test, expect } from './fixtures/auth';

test.describe('Admin', () => {
  test('admin can view departments', async ({ adminPage }) => {
    await adminPage.goto('/admin/departments');
    await expect(adminPage.locator('text=Maintenance')).toBeVisible();
    await expect(adminPage.locator('text=Housekeeping')).toBeVisible();
  });

  test('admin can view audit log', async ({ adminPage }) => {
    await adminPage.goto('/admin/audit');
    await expect(adminPage.locator('table')).toBeVisible();
  });

  test('admin can view rooms', async ({ adminPage }) => {
    await adminPage.goto('/admin/rooms');
    await expect(adminPage.locator('text=412')).toBeVisible();
  });
});
