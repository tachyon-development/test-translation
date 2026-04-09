# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: analytics.spec.ts >> Analytics >> system health shows services
- Location: e2e/analytics.spec.ts:19:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=PostgreSQL').or(locator('text=Redis'))
Expected: visible
Error: strict mode violation: locator('text=PostgreSQL').or(locator('text=Redis')) resolved to 2 elements:
    1) <span class="text-xs text-[var(--text-secondary)]">PostgreSQL</span> aka getByText('PostgreSQL')
    2) <span class="text-xs text-[var(--text-secondary)]">Redis</span> aka getByText('Redis')

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('text=PostgreSQL').or(locator('text=Redis'))

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - generic [ref=e4]:
        - img [ref=e6]
        - heading "HospiQ" [level=1] [ref=e8]
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
      - generic [ref=e34]:
        - generic [ref=e35]: M
        - generic [ref=e36]:
          - paragraph [ref=e37]: manager
          - paragraph [ref=e38]: "00000000"
        - button "Logout" [ref=e39]:
          - img [ref=e40]
    - main [ref=e44]:
      - generic [ref=e45]:
        - heading "HospiQ Analytics" [level=2] [ref=e46]
        - generic [ref=e47]: Hotel Mariana
      - generic [ref=e49]:
        - generic [ref=e50]:
          - generic [ref=e51]:
            - paragraph [ref=e52]: Active Workflows
            - paragraph [ref=e53]: "24"
            - generic [ref=e54]:
              - generic [ref=e55]: ▲ 3.0
              - generic [ref=e56]: vs last hour
          - generic [ref=e57]:
            - paragraph [ref=e58]: Avg Response
            - paragraph [ref=e59]: 6.4min
            - generic [ref=e60]:
              - generic [ref=e61]: ▼ 1.2m
              - generic [ref=e62]: vs yesterday
          - generic [ref=e63]:
            - paragraph [ref=e64]: Resolved
            - paragraph [ref=e65]: 76.6%
            - generic [ref=e66]:
              - generic [ref=e67]: ▲ 2.1%
              - generic [ref=e68]: vs yesterday
          - generic [ref=e69]:
            - paragraph [ref=e70]: SLA Miss
            - paragraph [ref=e71]: 2.5%
            - generic [ref=e72]:
              - generic [ref=e73]: ▼ 0.8%
              - generic [ref=e74]: vs yesterday
        - generic [ref=e75]:
          - generic [ref=e76]:
            - heading "Request Volume (24h)" [level=3] [ref=e77]
            - img [ref=e79]:
              - generic [ref=e86]:
                - generic [ref=e89]: 09:00
                - generic [ref=e91]: 12:00
                - generic [ref=e93]: 15:00
                - generic [ref=e95]: 18:00
                - generic [ref=e97]: 21:00
                - generic [ref=e99]: 00:00
                - generic [ref=e101]: 03:00
                - generic [ref=e103]: 06:00
          - generic [ref=e105]:
            - heading "Department Load" [level=3] [ref=e106]
            - img [ref=e108]:
              - generic [ref=e109]:
                - generic [ref=e120]: "24"
                - generic [ref=e121]: active
                - generic [ref=e122]:
                  - generic [ref=e125]: maintenance (5/10)
                  - generic [ref=e128]: housekeeping (5/15)
                  - generic [ref=e131]: concierge (5/8)
                  - generic [ref=e134]: front-desk (7/10)
                  - generic [ref=e137]: kitchen (2/8)
        - generic [ref=e138]:
          - generic [ref=e139]:
            - heading "AI Confidence Distribution" [level=3] [ref=e140]
            - img [ref=e142]:
              - generic [ref=e143]:
                - generic [ref=e145]: threshold
                - generic [ref=e151]:
                  - generic [ref=e154]: "0.5"
                  - generic [ref=e156]: "0.6"
                  - generic [ref=e158]: "0.7"
                  - generic [ref=e160]: "0.8"
                  - generic [ref=e162]: "0.9"
                  - generic [ref=e164]: "1.0"
                - generic [ref=e165]:
                  - generic [ref=e168]: "0"
                  - generic [ref=e170]: "10"
                  - generic [ref=e172]: "20"
                  - generic [ref=e174]: "30"
                  - generic [ref=e176]: "40"
                  - generic [ref=e178]: "50"
          - generic [ref=e179]:
            - generic [ref=e180]:
              - heading "Live Event Feed" [level=3] [ref=e181]
              - generic [ref=e182]: Live
            - generic [ref=e186]:
              - generic [ref=e187]:
                - generic "AI" [ref=e188]
                - generic [ref=e189]:
                  - paragraph [ref=e190]: AI routed Room 215 to Concierge (0.86)
                  - paragraph [ref=e191]: 06:09:22 AM
                - generic [ref=e192]: AI
              - generic [ref=e193]:
                - generic "Resolved" [ref=e194]
                - generic [ref=e195]:
                  - paragraph [ref=e196]: "Room 215: Late checkout request resolved"
                  - paragraph [ref=e197]: 06:08:37 AM
                - generic [ref=e198]: Resolved
              - generic [ref=e199]:
                - generic "Assigned" [ref=e200]
                - generic [ref=e201]:
                  - paragraph [ref=e202]: Room 118 assigned to Concierge
                  - paragraph [ref=e203]: 06:07:52 AM
                - generic [ref=e204]: Assigned
              - generic [ref=e205]:
                - generic "Assigned" [ref=e206]
                - generic [ref=e207]:
                  - paragraph [ref=e208]: Room 503 assigned to Front Desk
                  - paragraph [ref=e209]: 06:07:07 AM
                - generic [ref=e210]: Assigned
              - generic [ref=e211]:
                - generic "Resolved" [ref=e212]
                - generic [ref=e213]:
                  - paragraph [ref=e214]: "Room 201: Extra towels requested resolved"
                  - paragraph [ref=e215]: 06:06:22 AM
                - generic [ref=e216]: Resolved
              - generic [ref=e217]:
                - generic "Assigned" [ref=e218]
                - generic [ref=e219]:
                  - paragraph [ref=e220]: Room 305 assigned to Kitchen
                  - paragraph [ref=e221]: 06:05:37 AM
                - generic [ref=e222]: Assigned
              - generic [ref=e223]:
                - generic "AI" [ref=e224]
                - generic [ref=e225]:
                  - paragraph [ref=e226]: AI routed Room 215 to Concierge (0.86)
                  - paragraph [ref=e227]: 06:04:52 AM
                - generic [ref=e228]: AI
              - generic [ref=e229]:
                - generic "Escalated" [ref=e230]
                - generic [ref=e231]:
                  - paragraph [ref=e232]: Room 503 escalated — SLA at risk
                  - paragraph [ref=e233]: 06:04:07 AM
                - generic [ref=e234]: Escalated
              - generic [ref=e235]:
                - generic "New" [ref=e236]
                - generic [ref=e237]:
                  - paragraph [ref=e238]: "Room 412: Late checkout request"
                  - paragraph [ref=e239]: 06:03:22 AM
                - generic [ref=e240]: New
              - generic [ref=e241]:
                - generic "AI" [ref=e242]
                - generic [ref=e243]:
                  - paragraph [ref=e244]: AI routed Room 412 to Housekeeping (0.86)
                  - paragraph [ref=e245]: 06:02:37 AM
                - generic [ref=e246]: AI
              - generic [ref=e247]:
                - generic "New" [ref=e248]
                - generic [ref=e249]:
                  - paragraph [ref=e250]: "Room 601: AC not working"
                  - paragraph [ref=e251]: 06:01:52 AM
                - generic [ref=e252]: New
              - generic [ref=e253]:
                - generic "Escalated" [ref=e254]
                - generic [ref=e255]:
                  - paragraph [ref=e256]: Room 412 escalated — SLA at risk
                  - paragraph [ref=e257]: 06:01:07 AM
                - generic [ref=e258]: Escalated
              - generic [ref=e259]:
                - generic "Assigned" [ref=e260]
                - generic [ref=e261]:
                  - paragraph [ref=e262]: Room 201 assigned to Kitchen
                  - paragraph [ref=e263]: 06:00:22 AM
                - generic [ref=e264]: Assigned
              - generic [ref=e265]:
                - generic "AI" [ref=e266]
                - generic [ref=e267]:
                  - paragraph [ref=e268]: AI routed Room 215 to Maintenance (0.85)
                  - paragraph [ref=e269]: 05:59:37 AM
                - generic [ref=e270]: AI
              - generic [ref=e271]:
                - generic "Assigned" [ref=e272]
                - generic [ref=e273]:
                  - paragraph [ref=e274]: Room 503 assigned to Maintenance
                  - paragraph [ref=e275]: 05:58:52 AM
                - generic [ref=e276]: Assigned
              - generic [ref=e277]:
                - generic "AI" [ref=e278]
                - generic [ref=e279]:
                  - paragraph [ref=e280]: AI routed Room 215 to Housekeeping (0.88)
                  - paragraph [ref=e281]: 05:58:07 AM
                - generic [ref=e282]: AI
              - generic [ref=e283]:
                - generic "Escalated" [ref=e284]
                - generic [ref=e285]:
                  - paragraph [ref=e286]: Room 601 escalated — SLA at risk
                  - paragraph [ref=e287]: 05:57:22 AM
                - generic [ref=e288]: Escalated
              - generic [ref=e289]:
                - generic "Resolved" [ref=e290]
                - generic [ref=e291]:
                  - paragraph [ref=e292]: "Room 720: Noise complaint resolved"
                  - paragraph [ref=e293]: 05:56:37 AM
                - generic [ref=e294]: Resolved
              - generic [ref=e295]:
                - generic "Resolved" [ref=e296]
                - generic [ref=e297]:
                  - paragraph [ref=e298]: "Room 720: Noise complaint resolved"
                  - paragraph [ref=e299]: 05:55:52 AM
                - generic [ref=e300]: Resolved
              - generic [ref=e301]:
                - generic "New" [ref=e302]
                - generic [ref=e303]:
                  - paragraph [ref=e304]: "Room 503: Room service order"
                  - paragraph [ref=e305]: 05:55:07 AM
                - generic [ref=e306]: New
        - generic [ref=e308]:
          - heading "System Health" [level=3] [ref=e309]
          - generic [ref=e310]:
            - generic [ref=e311]: Ollama
            - generic [ref=e314]: UP
          - generic [ref=e315]:
            - generic [ref=e316]: Whisper
            - generic [ref=e319]: UP
          - generic [ref=e320]:
            - generic [ref=e321]: PostgreSQL
            - generic [ref=e324]: UP
          - generic [ref=e325]:
            - generic [ref=e326]: Redis
            - generic [ref=e329]: UP
  - alert [ref=e330]
```

# Test source

```ts
  1  | import { test, expect } from './fixtures/auth';
  2  | 
  3  | test.describe('Analytics', () => {
  4  |   test('analytics page loads with KPI cards', async ({ managerPage }) => {
  5  |     await managerPage.goto('/analytics');
  6  |     await managerPage.waitForLoadState('networkidle');
  7  |     // Wait for the analytics page to load
  8  |     await expect(managerPage.locator('h1, h2').filter({ hasText: /analytics/i })).toBeVisible({ timeout: 10000 });
  9  |   });
  10 | 
  11 |   test('D3 charts render', async ({ managerPage }) => {
  12 |     await managerPage.goto('/analytics');
  13 |     await managerPage.waitForLoadState('networkidle');
  14 |     // Assert SVG elements exist (at least 3 D3 charts)
  15 |     const svgCount = await managerPage.locator('svg').count();
  16 |     expect(svgCount).toBeGreaterThanOrEqual(3);
  17 |   });
  18 | 
  19 |   test('system health shows services', async ({ managerPage }) => {
  20 |     await managerPage.goto('/analytics');
  21 |     await managerPage.waitForLoadState('networkidle');
  22 |     await expect(
  23 |       managerPage
  24 |         .locator('text=PostgreSQL')
  25 |         .or(managerPage.locator('text=Redis'))
> 26 |     ).toBeVisible({ timeout: 10000 });
     |       ^ Error: expect(locator).toBeVisible() failed
  27 |   });
  28 | });
  29 | 
```