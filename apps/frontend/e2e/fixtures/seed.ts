// Ensures test data exists before suite runs.
// Could call a seed API endpoint or just verify data exists.
//
// Usage: import in a test file's beforeAll to prime the database
// with known fixtures (rooms, departments, demo users, etc.).
//
// Example:
//   import { seedTestData } from './fixtures/seed';
//   test.beforeAll(async ({ request }) => { await seedTestData(request); });

import type { APIRequestContext } from '@playwright/test';

export async function seedTestData(request: APIRequestContext) {
  // POST to the backend seed endpoint if available
  try {
    const res = await request.post('/api/seed', { timeout: 10_000 });
    if (res.ok()) {
      console.log('[seed] Test data seeded successfully');
    } else {
      console.warn(`[seed] Seed endpoint returned ${res.status()} — skipping`);
    }
  } catch {
    console.warn('[seed] Seed endpoint not available — assuming data exists');
  }
}
