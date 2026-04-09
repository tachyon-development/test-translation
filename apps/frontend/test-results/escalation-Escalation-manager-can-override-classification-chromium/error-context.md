# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: escalation.spec.ts >> Escalation >> manager can override classification
- Location: e2e/escalation.spec.ts:15:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-testid="classification-override"]').or(locator('text=Override AI Classification'))
Expected: visible
Error: strict mode violation: locator('[data-testid="classification-override"]').or(locator('text=Override AI Classification')) resolved to 2 elements:
    1) <div role="dialog" tabindex="-1" id="radix-_r_a_" data-state="open" aria-labelledby="radix-_r_b_" aria-describedby="radix-_r_c_" data-testid="classification-override" class="fixed left-[50%] top-[50%] z-50 grid w-full translate-x-[-50%] translate-y-[-50%] gap-4 border p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-…>…</div> aka getByTestId('classification-override')
    2) <h2 id="radix-_r_b_" class="text-lg font-semibold leading-none tracking-tight text-[var(--text-primary)]">Override AI Classification</h2> aka getByRole('heading', { name: 'Override AI Classification' })

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('[data-testid="classification-override"]').or(locator('text=Override AI Classification'))

```

# Page snapshot

```yaml
- generic:
  - generic:
    - complementary:
      - generic:
        - generic:
          - img
        - heading [level=1]: HospiQ
      - generic:
        - generic:
          - generic:
            - generic:
              - navigation:
                - button:
                  - img
                  - text: Dashboard
                - button:
                  - img
                  - text: Analytics
                - button:
                  - img
                  - text: Manager
                - button:
                  - img
                  - text: Admin
              - generic:
                - heading [level=3]: Escalation KPIs
                - generic:
                  - generic:
                    - generic:
                      - img
                      - text: Active
                  - generic:
                    - generic:
                      - img
                      - text: SLA Miss
                    - generic: 2%
                  - generic:
                    - generic:
                      - img
                      - text: Escalated
      - generic:
        - generic:
          - generic: M
          - generic:
            - paragraph: manager
            - paragraph: "00000000"
          - button:
            - img
    - generic:
      - main:
        - generic:
          - generic:
            - img
            - heading [level=2]: Escalation Center
            - generic: "1"
          - generic:
            - generic:
              - generic: Reconnecting
        - generic:
          - generic:
            - generic:
              - generic:
                - generic:
                  - generic:
                    - generic:
                      - generic:
                        - generic:
                          - generic:
                            - text: ESCALATED
                            - generic: — 121min overdue
                        - generic:
                          - img
                          - generic: OVERDUE
                      - generic:
                        - generic: Rm 0015
                        - generic: ·
                        - generic: Maintenance
                      - generic:
                        - generic:
                          - generic:
                            - img
                            - text: Original
                            - generic:
                              - img
                              - text: EN
                          - paragraph: “The drain in my bathroom is completely clogged”
                      - generic:
                        - generic:
                          - img
                          - generic: "AI: maintenance"
                        - generic: 85% conf
                        - generic: "urgency: high"
                      - generic:
                        - button:
                          - img
                          - text: Override Dept
                        - button:
                          - img
                          - text: Reassign
                        - button:
                          - img
                          - text: Resolve
                        - button:
                          - img
                          - text: Add Note
  - alert
  - dialog "Override AI Classification" [ref=e2]:
    - generic [ref=e3]:
      - heading "Override AI Classification" [level=2] [ref=e4]
      - paragraph [ref=e5]: Override the AI-assigned department and priority for this workflow.
    - generic [ref=e6]:
      - paragraph [ref=e7]: Current AI Classification
      - generic [ref=e8]:
        - generic [ref=e9]:
          - generic [ref=e10]: Department
          - generic [ref=e11]: Maintenance
        - generic [ref=e12]:
          - generic [ref=e13]: Priority
          - generic [ref=e14]: HIGH
    - img [ref=e16]
    - generic [ref=e18]:
      - generic [ref=e19]:
        - generic [ref=e20]: New Department
        - combobox [active] [ref=e21]:
          - img [ref=e22]
      - generic [ref=e24]:
        - generic [ref=e25]: New Priority
        - combobox [ref=e26]:
          - generic:
            - generic: High
          - img [ref=e27]
      - generic [ref=e29]:
        - generic [ref=e30]: Reason for Override
        - textbox "Explain why the AI classification is incorrect..." [ref=e31]
    - generic [ref=e32]:
      - button "Cancel" [ref=e33]
      - button "Apply Override" [disabled]
    - button "Close" [ref=e34]:
      - img [ref=e35]
      - generic [ref=e38]: Close
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
  12 |     ).toBeVisible({ timeout: 10000 });
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
> 26 |       ).toBeVisible({ timeout: 10000 });
     |         ^ Error: expect(locator).toBeVisible() failed
  27 |     }
  28 |   });
  29 | });
  30 | 
```