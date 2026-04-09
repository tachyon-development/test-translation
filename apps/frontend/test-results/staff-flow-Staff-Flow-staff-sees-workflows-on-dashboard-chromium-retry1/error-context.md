# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: staff-flow.spec.ts >> Staff Flow >> staff sees workflows on dashboard
- Location: e2e/staff-flow.spec.ts:4:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Pending').or(locator('text=Claimed'))
Expected: visible
Error: strict mode violation: locator('text=Pending').or(locator('text=Claimed')) resolved to 2 elements:
    1) <h3 class="font-display text-sm font-semibold tracking-wide text-[var(--status-pending,#8a7fb5)]">Pending</h3> aka getByRole('heading', { name: 'Pending' })
    2) <h3 class="font-display text-sm font-semibold tracking-wide text-[var(--status-info,#6b8cae)]">Claimed</h3> aka getByRole('heading', { name: 'Claimed' })

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('text=Pending').or(locator('text=Claimed'))

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - generic [ref=e4]:
        - img [ref=e6]
        - heading "HospiQ" [level=1] [ref=e8]
      - generic [ref=e12]:
        - navigation [ref=e13]:
          - button "Dashboard" [ref=e14]:
            - img [ref=e15]
            - text: Dashboard
          - button "Analytics" [ref=e20]:
            - img [ref=e21]
            - text: Analytics
          - button "Manager" [ref=e23]:
            - img [ref=e24]
            - text: Manager
          - button "Admin" [ref=e29]:
            - img [ref=e30]
            - text: Admin
        - generic [ref=e33]:
          - heading "Queue Overview" [level=3] [ref=e34]
          - generic [ref=e35]:
            - generic [ref=e36]:
              - generic [ref=e37]:
                - img [ref=e38]
                - text: Total Active
              - generic [ref=e41]: "3"
            - generic [ref=e42]:
              - generic [ref=e43]:
                - img [ref=e44]
                - text: Escalated
              - generic [ref=e46]: "1"
            - generic [ref=e47]:
              - generic [ref=e48]:
                - img [ref=e49]
                - text: SLA On Track
              - generic [ref=e52]: 33%
        - generic [ref=e53]:
          - heading "Departments" [level=3] [ref=e54]
          - button "Maintenance 3" [ref=e56]:
            - text: Maintenance
            - generic [ref=e57]: "3"
      - generic [ref=e59]:
        - generic [ref=e60]: S
        - generic [ref=e61]:
          - paragraph [ref=e62]: staff
          - paragraph [ref=e63]: "00000000"
        - button "Logout" [ref=e64]:
          - img [ref=e65]
    - main [ref=e69]:
      - generic [ref=e70]:
        - generic [ref=e71]:
          - combobox [ref=e72]:
            - generic: All Departments
            - img [ref=e73]
          - combobox [ref=e75]:
            - generic: All Priorities
            - img [ref=e76]
          - generic [ref=e78]:
            - img [ref=e79]
            - textbox "Search room or request..." [ref=e82]
        - generic [ref=e86]: Live
      - generic [ref=e89]:
        - generic [ref=e90]:
          - generic [ref=e91]:
            - heading "Pending" [level=3] [ref=e92]
            - generic [ref=e93]: "2"
          - generic [ref=e94]:
            - generic [ref=e96] [cursor=pointer]:
              - generic [ref=e97]:
                - generic [ref=e99]: CRIT
                - generic [ref=e100]: Rm 0029
              - paragraph [ref=e101]: The air conditioner is broken. It is very hot
              - generic [ref=e102]:
                - generic [ref=e103]:
                  - generic [ref=e104]:
                    - img [ref=e105]
                    - generic [ref=e108]: OVERDUE
                  - generic [ref=e109]: Maintenance
                - generic [ref=e110]: 85%
            - generic [ref=e112] [cursor=pointer]:
              - generic [ref=e113]:
                - generic [ref=e115]: HIGH
                - generic [ref=e116]: Rm 0023
              - paragraph [ref=e117]: My faucet is leaking badly
              - generic [ref=e118]:
                - generic [ref=e119]:
                  - generic [ref=e120]:
                    - img [ref=e121]
                    - generic [ref=e124]: 23m
                  - generic [ref=e125]: Maintenance
                - generic [ref=e126]: 85%
        - generic [ref=e127]:
          - generic [ref=e128]:
            - heading "Claimed" [level=3] [ref=e129]
            - generic [ref=e130]: "0"
          - generic [ref=e133]:
            - img [ref=e134]
            - paragraph [ref=e137]: No tasks
        - generic [ref=e138]:
          - generic [ref=e139]:
            - heading "In Progress" [level=3] [ref=e140]
            - generic [ref=e141]: "0"
          - generic [ref=e144]:
            - img [ref=e145]
            - paragraph [ref=e148]: No tasks
        - generic [ref=e149]:
          - generic [ref=e150]:
            - heading "Escalated" [level=3] [ref=e151]
            - generic [ref=e152]: "1"
          - generic [ref=e155] [cursor=pointer]:
            - generic [ref=e156]:
              - generic [ref=e157]:
                - generic [ref=e158]: HIGH
                - generic [ref=e159]: ESCALATED
              - generic [ref=e160]: Rm 0015
            - paragraph [ref=e161]: The drain in my bathroom is completely clogged
            - generic [ref=e162]:
              - generic [ref=e163]:
                - generic [ref=e164]:
                  - img [ref=e165]
                  - generic [ref=e168]: OVERDUE
                - generic [ref=e169]: Maintenance
              - generic [ref=e170]: 85%
  - alert [ref=e171]
```

# Test source

```ts
  1  | import { test, expect } from './fixtures/auth';
  2  | 
  3  | test.describe('Staff Flow', () => {
  4  |   test('staff sees workflows on dashboard', async ({ staffPage }) => {
  5  |     await staffPage.goto('/dashboard');
  6  |     await staffPage.waitForLoadState('networkidle');
  7  |     // Assert kanban visible
  8  |     await expect(
  9  |       staffPage.locator('text=Pending').or(staffPage.locator('text=Claimed'))
> 10 |     ).toBeVisible({ timeout: 10000 });
     |       ^ Error: expect(locator).toBeVisible() failed
  11 |   });
  12 | 
  13 |   test('staff can claim a workflow', async ({ staffPage }) => {
  14 |     await staffPage.goto('/dashboard');
  15 |     await staffPage.waitForLoadState('networkidle');
  16 |     // Find a pending card and click it
  17 |     const card = staffPage.locator('[data-testid="workflow-card"]').first();
  18 |     await card.click({ timeout: 10000 });
  19 |     // Assert detail panel opens
  20 |     await expect(staffPage.locator('[data-testid="workflow-detail"]')).toBeVisible({ timeout: 10000 });
  21 |     // Click claim
  22 |     await staffPage.getByRole('button', { name: /claim/i }).click();
  23 |   });
  24 | 
  25 |   test('staff can filter by department', async ({ staffPage }) => {
  26 |     await staffPage.goto('/dashboard');
  27 |     await staffPage.waitForLoadState('networkidle');
  28 |     // Open department filter
  29 |     await staffPage.locator('[data-testid="dept-filter"]').click({ timeout: 10000 });
  30 |     await staffPage.click('text=Housekeeping');
  31 |     // Workflows should filter — the filter should be applied
  32 |     await expect(staffPage.locator('[data-testid="dept-filter"]')).toBeVisible({ timeout: 10000 });
  33 |   });
  34 | });
  35 | 
```