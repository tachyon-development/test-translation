import { test, expect } from './fixtures/auth';

test.describe('Admin', () => {
  test('admin can view departments', async ({ adminPage }) => {
    await adminPage.goto('/admin/departments');
    await adminPage.waitForLoadState('networkidle');
    await expect(adminPage.getByRole('cell', { name: 'Maintenance', exact: true })).toBeVisible({ timeout: 10000 });
    await expect(adminPage.getByRole('cell', { name: 'Housekeeping', exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('admin can view audit log', async ({ adminPage }) => {
    await adminPage.goto('/admin/audit');
    await adminPage.waitForLoadState('networkidle');
    await expect(adminPage.locator('table')).toBeVisible({ timeout: 10000 });
  });

  test('admin can view rooms', async ({ adminPage }) => {
    await adminPage.goto('/admin/rooms');
    await adminPage.waitForLoadState('networkidle');
    await expect(adminPage.locator('text=412')).toBeVisible({ timeout: 10000 });
  });
});
