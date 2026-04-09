# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: escalation.spec.ts >> Escalation >> manager sees escalated workflows
- Location: e2e/escalation.spec.ts:4:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Escalation Center').or(locator('text=ESCALATION'))
Expected: visible
Error: strict mode violation: locator('text=Escalation Center').or(locator('text=ESCALATION')) resolved to 2 elements:
    1) <h3 class="font-display mb-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Escalation KPIs</h3> aka getByRole('heading', { name: 'Escalation KPIs' })
    2) <h2 class="font-display text-lg font-semibold text-[var(--text-primary)]">Escalation Center</h2> aka getByRole('heading', { name: 'Escalation Center' })

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('text=Escalation Center').or(locator('text=ESCALATION'))

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
          - heading "Escalation KPIs" [level=3] [ref=e34]
          - generic [ref=e35]:
            - generic [ref=e37]:
              - img [ref=e38]
              - text: Active
            - generic [ref=e41]:
              - generic [ref=e42]:
                - img [ref=e43]
                - text: SLA Miss
              - generic [ref=e46]: 2%
            - generic [ref=e48]:
              - img [ref=e49]
              - text: Escalated
      - generic [ref=e52]:
        - generic [ref=e53]: M
        - generic [ref=e54]:
          - paragraph [ref=e55]: manager
          - paragraph [ref=e56]: "00000000"
        - button "Logout" [ref=e57]:
          - img [ref=e58]
    - main [ref=e62]:
      - generic [ref=e63]:
        - generic [ref=e64]:
          - img [ref=e65]
          - heading "Escalation Center" [level=2] [ref=e67]
          - generic [ref=e68]: "1"
        - generic [ref=e72]: Live
      - generic [ref=e79]:
        - generic [ref=e80]:
          - generic [ref=e82]:
            - text: ESCALATED
            - generic [ref=e83]: — 121min overdue
          - generic [ref=e84]:
            - img [ref=e85]
            - generic [ref=e88]: OVERDUE
        - generic [ref=e89]:
          - generic [ref=e90]: Rm 0015
          - generic [ref=e91]: ·
          - generic [ref=e92]: Maintenance
        - generic [ref=e94]:
          - generic [ref=e95]:
            - img [ref=e96]
            - text: Original
            - generic [ref=e98]:
              - img [ref=e99]
              - text: EN
          - paragraph [ref=e102]: “The drain in my bathroom is completely clogged”
        - generic [ref=e103]:
          - generic [ref=e104]:
            - img [ref=e105]
            - generic [ref=e113]: "AI: maintenance"
          - generic [ref=e114]: 85% conf
          - generic [ref=e115]: "urgency: high"
        - generic [ref=e116]:
          - button "Override Dept" [ref=e117]:
            - img
            - text: Override Dept
          - button "Reassign" [ref=e118]:
            - img
            - text: Reassign
          - button "Resolve" [ref=e119]:
            - img
            - text: Resolve
          - button "Add Note" [ref=e120]:
            - img
            - text: Add Note
  - alert [ref=e121]
```

# Test source

```ts
  1  | import { test, expect } from './fixtures/auth';
  2  | 
  3  | test.describe('Escalation', () => {
  4  |   test('manager sees escalated workflows', async ({ managerPage }) => {
  5  |     await managerPage.goto('/manager');
  6  |     await managerPage.waitForLoadState('networkidle');
  7  |     // Assert escalation center visible
  8  |     await expect(
  9  |       managerPage
  10 |         .locator('text=Escalation Center')
  11 |         .or(managerPage.locator('text=ESCALATION'))
> 12 |     ).toBeVisible({ timeout: 10000 });
     |       ^ Error: expect(locator).toBeVisible() failed
  13 |   });
  14 | 
  15 |   test('manager can override classification', async ({ managerPage }) => {
  16 |     await managerPage.goto('/manager');
  17 |     await managerPage.waitForLoadState('networkidle');
  18 |     // If there are escalated workflows, try to override
  19 |     const overrideBtn = managerPage.locator('text=Override Dept').first();
  20 |     if (await overrideBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
  21 |       await overrideBtn.click();
  22 |       await expect(
  23 |         managerPage
  24 |           .locator('[data-testid="classification-override"]')
  25 |           .or(managerPage.locator('text=Override AI Classification'))
  26 |       ).toBeVisible({ timeout: 10000 });
  27 |     }
  28 |   });
  29 | });
  30 | 
```