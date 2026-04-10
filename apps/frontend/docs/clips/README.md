# HospiQ Feature Demo Clips

Individual feature demo recordings with text overlay annotations.

## Clips

| Clip | File | Duration | Description |
|------|------|----------|-------------|
| 1 | `clip-1-multilang.mp4` | 30s | **Multi-Language AI Classification** -- 3 requests (English, Spanish, Mandarin) submitted via API, AI translates and routes each to the correct department |
| 2 | `clip-2-realtime.mp4` | 35s | **Real-Time WebSocket** -- Side-by-side guest kiosk + staff dashboard showing live request flow |
| 3 | `clip-3-workflow.mp4` | 25s | **Staff Workflow Management** -- Click card, view details/timeline, claim workflow, start work |
| 4 | `clip-4-analytics.mp4` | 20s | **Manager Analytics** -- D3 stream graph, AI confidence distribution, live event feed |
| 5 | `clip-5-escalation.mp4` | 20s | **SLA Escalation** -- Manager escalation center, coral-styled breach cards, AI override |
| 6 | `clip-6-demo.mp4` | 15s | **Demo Landing Page** -- Role selector with one-click access to all views |
| 7 | `clip-7-admin.mp4` | 15s | **Admin Departments and Rooms** -- Department SLA config, room management, QR codes |

## Master Video

`demo-complete.mp4` -- All 7 clips concatenated with 1-second black transitions.

## How to Record

```bash
npx playwright test e2e/record-feature-clips.spec.ts --workers=1
```

Requires: Playwright, ffmpeg installed, production endpoints accessible.
