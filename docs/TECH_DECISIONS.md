# Technology Decisions

Justifications for every major technology choice in HospiQ, including the trade-offs considered.

---

## Frontend: Next.js + shadcn/ui

**What:** Renders the five HospiQ views — guest kiosk, staff dashboard, manager analytics, admin panel, and login — with server components for fast initial loads and client components for real-time interactivity (SSE streams, WebSocket connections, D3 charts).

**Why:** Next.js provides file-based routing, server components for initial page loads, and excellent DX with Bun. shadcn/ui gives us accessible, customizable components without the weight of a full component library — critical for the custom D3 visualizations that need to integrate seamlessly.

**Trade-off:** Heavier than Vite + React for a purely client-side app. Justified by the multi-page structure (5 views) and future SSR potential for the kiosk view.

---

## Backend: Elysia on Bun

**What:** Serves the REST API (request submission, workflow CRUD, org management), maintains WebSocket connections for staff dashboards, and streams SSE events to guest browsers — all from a single Elysia server running on Railway at port 4000.

**Why:** Native WebSocket support eliminates the need for a separate WS service. End-to-end type safety with Drizzle. Bun's runtime performance is measurably faster than Node.js for HTTP handling — matters at 1000+ orgs scale.

**Trade-off:** Smaller ecosystem than Express. Mitigated by the focused scope of our API surface.

---

## Real-Time: WebSocket (staff) + SSE (guests)

**What:** WebSocket connections deliver live workflow updates to staff dashboards (new cards, claims, resolutions, escalations) and accept actions (claim, resolve). SSE streams push status progress to individual guest sessions (transcribed, classified, claimed, resolved).

**Why:** Staff dashboards need bidirectional communication (receive updates, send claims/status changes). Guests only need to receive status updates — SSE is simpler, auto-reconnects, and works through more proxies/firewalls. Matching the protocol to the access pattern reduces complexity and improves reliability.

**Trade-off:** Two real-time mechanisms to maintain. Justified by the fundamentally different interaction patterns.

---

## AI Classification: Groq Cloud API (Primary)

**What:** Receives guest request text (already translated to English by the prompt) and returns a structured classification: department, urgency level, and English summary. Runs llama-3.1-8b-instant via Groq's OpenAI-compatible endpoint, completing classification in approximately 500ms.

**Why:** Production classification uses the Groq cloud API (`llama-3.1-8b-instant`) via `https://api.groq.com/openai/v1/chat/completions`. Classification completes in ~500ms — compared to 1-2 minutes on CPU-only Ollama. This makes the guest experience feel near-instant.

**Trade-off:** Groq introduces an external dependency and sends request text to a third-party API. Mitigated by: (1) Groq's OpenAI-compatible API means swapping providers is trivial, (2) Ollama fallback ensures the system never stops functioning, (3) for privacy-sensitive deployments, set Ollama as primary.

---

## AI Fallback: Ollama on Railway

**What:** Serves as the circuit-breaker fallback when Groq is unavailable, running the same classification task using llama3 locally on Railway. Also acts as the default AI provider for local development and air-gapped environments where external API calls are not permitted.

**Why:** Ollama remains deployed on Railway as a fallback for when Groq is unavailable, and as the default for local development and air-gapped environments. The circuit breaker uses a tiered fallback: Groq -> Ollama -> manual_review. If Groq fails 3 consecutive times, the circuit breaker opens and routes to Ollama. If Ollama also fails, requests are flagged for manual staff review.

**Trade-off:** CPU-only inference is 1-2 minutes per classification vs. Groq's 500ms. Acceptable as a degraded-mode fallback since correctness matters more than speed when the primary provider is down.

---

## Speech-to-Text: Faster Whisper on Railway

**What:** Transcribes guest voice recordings (any language) into text and detects the spoken language. Runs as `fedirz/faster-whisper-server:latest-cpu` on port 8000, receiving audio as base64 through the BullMQ job queue rather than direct HTTP from the browser.

**Why:** Runs on Railway alongside the other backend services. Voice audio is passed as base64 through the BullMQ job queue rather than written to the filesystem, which simplifies the architecture and avoids shared volume mounts between services.

**Trade-off:** Base64 encoding increases payload size by ~33%. Acceptable because voice clips are short (typically < 30 seconds) and the BullMQ queue handles the serialization cleanly.

---

## Database: PostgreSQL + Drizzle ORM

**What:** Stores all persistent state — organizations, users, guest requests, transcriptions, classifications, workflows, workflow events, and SLA configurations. Row Level Security enforces multi-tenant isolation so each organization's data is invisible to others. Drizzle ORM provides type-safe query building that maps directly to the TypeScript domain types.

**Why:** Relational data model fits naturally (workflows to events, requests to classifications). Row Level Security enforces multi-tenant isolation at the database level — a single misconfigured query can't leak data across organizations. pgcrypto provides encryption at rest without application-level complexity. Drizzle ORM provides type-safe queries with zero runtime overhead.

**Trade-off:** Aggregate analytics queries on large datasets may slow down. Mitigated by Redis caching layer (10s TTL on dashboard stats) and potential read replicas.

---

## Queue: Redis + BullMQ

**What:** Serves four roles: (1) BullMQ job queue for transcription, classification, and integration jobs with retries and backoff; (2) pub/sub channels for broadcasting real-time events to API WebSocket/SSE handlers; (3) cache layer for dashboard aggregate stats with 10s TTL; (4) delayed jobs for SLA countdown timers that fire escalation workflows.

**Why:** Single Redis instance serves four concerns (queue, pub/sub, cache, timers) — operational simplicity. BullMQ provides reliable job processing with retries, backoff, delayed jobs (SLA timers), and dead letter queues out of the box. Simpler than RabbitMQ/Kafka for our message patterns.

**Trade-off:** Redis is single-threaded. At extreme scale, Kafka would provide better throughput and durability. For 1000+ orgs with moderate request volume, Redis handles this comfortably. Horizontal scaling path: Redis Cluster.

---

## Observability: Grafana + Loki

**What:** Collects structured JSON logs from all backend services (API, Worker, Ollama, Whisper) via the Docker logging driver into Loki, and visualizes them in Grafana dashboards alongside direct PostgreSQL queries for operational metrics like SLA breach rates and classification latency.

**Why:** Lightweight alternative to ELK stack (2 containers vs 3, fraction of the RAM). Docker logging driver sends logs to Loki without a sidecar. Grafana can also query PostgreSQL directly for operational dashboards.

**Trade-off:** Less powerful full-text search than Elasticsearch. Sufficient for structured JSON log querying.

---

## Hosting: Vercel (Frontend)

**What:** Hosts the Next.js frontend at `https://hospiq-eight.vercel.app`, serving the guest kiosk, staff dashboard, and manager views via edge CDN with automatic preview deployments on every pull request.

**Why:** Vercel provides edge CDN, zero-config Next.js deployment, and automatic preview deployments on PRs — ideal for the frontend.

**Trade-off:** Split deployment (Vercel + Railway) adds operational complexity vs. a single Docker Compose. Justified by Vercel's CDN giving global latency benefits for the frontend. Docker Compose remains available for local development.

---

## Hosting: Railway (Backend)

**What:** Runs the five backend services as managed Docker containers — Elysia API, BullMQ Worker, Ollama, faster-whisper-server, plus managed PostgreSQL and Redis instances — with built-in provisioning, environment variable management, and zero-downtime deploys.

**Why:** Railway provides managed Docker containers with built-in Postgres and Redis provisioning — ideal for the backend services (API, Worker, Ollama, Whisper). This split lets each layer scale independently with the right tool.

**Trade-off:** Vendor lock-in to Railway's container platform. Mitigated by standard Docker images that can deploy anywhere, and Docker Compose for local/self-hosted environments.

---

## Analytics: D3.js

**What:** Powers the manager analytics command center with interactive visualizations — request volume heatmaps, department load bar charts, SLA compliance trend lines, and response time distributions — rendered client-side with live data from the API.

**Why:** Full control over custom visualizations that match the HospiQ design system. No opinionated chart library constraining the analytics views. D3 integrates cleanly with React via refs and shadcn/ui containers.

**Trade-off:** Higher implementation effort than Chart.js or Recharts. Justified by the need for highly custom, interactive analytics that go beyond standard chart types.

---

## Unit Testing: Bun Test Runner

**What:** 98 unit tests across all three packages, running in ~370ms with zero external dependencies. Covers:
- **API:** JWT sign/verify/tamper detection (7 tests), circuit breaker state machine with in-memory Redis mock (9 tests), field mapping transforms including dot-notation resolution, uppercase, truncate, prefix, map, and iso639 (21 tests)
- **Worker:** Classification prompt structure and content verification (10 tests), fuzzy department matching across all 5 strategies — exact name, slug, slug-contains, name-contains, first-word (14 tests)
- **DB:** Schema export verification for all 14 tables, 9 enum types, and relation definitions (28 tests), seed ID determinism, UUID format, and uniqueness across all entity sets (9 tests)

**Why:** Bun's built-in test runner (`bun:test`) provides Jest-compatible syntax with zero configuration and near-instant startup. Tests run without Docker, databases, or any external services — pure logic verification. The `matchDepartment` function was extracted into its own module specifically to enable thorough testing of the fuzzy matching logic that routes requests to the correct hotel department.

**Trade-off:** No test coverage for database queries or Redis interactions at the unit level — those are validated by the E2E tests. Unit tests focus on pure business logic (classification prompts, department matching, field transforms, auth tokens, circuit breaker state) where fast feedback matters most.

**Run:** `bun test apps/api/src/__tests__ apps/worker/src/__tests__ packages/db/src/__tests__`

---

## E2E Testing: Playwright

**What:** 18 end-to-end tests across 8 test suites that simulate real user workflows against the full running application:
- **Guest flow** (3 tests): Submit text request, room pre-fill via URL param, graceful error on network failure
- **Staff flow** (3 tests): View kanban dashboard, claim a workflow, filter by department
- **Real-time sync** (1 test): Two browser contexts — guest submits a request, staff dashboard receives it via WebSocket within 15 seconds (the "killer test")
- **Escalation** (2 tests): Manager sees escalated workflows, override AI classification
- **Fault tolerance** (1 test): System handles AI service unavailability gracefully
- **Analytics** (3 tests): KPI cards render, D3 SVG charts present, system health indicators
- **Admin** (3 tests): View departments, audit log, rooms
- **Demo simulation** (2 tests): Role selection buttons, guest navigation

Custom test fixtures provide pre-authenticated pages per role (staff, manager, admin, guest) with retry logic for API availability.

**Why:** Cross-browser E2E testing validates the real-time WebSocket and SSE flows that unit tests cannot cover. Playwright's auto-wait and network interception make async UI testing reliable. The two-context real-time sync test proves the entire pipeline works: guest submission → Redis queue → Groq classification → workflow creation → Redis pub/sub → WebSocket push → dashboard update.

**Trade-off:** Slower than unit tests (~2 minutes vs 370ms) and requires the full stack running (Docker locally or production deployment). Mitigated by running Playwright separately from unit tests, with `retries: 1` for flaky network conditions.

**Run locally:** `cd apps/frontend && npx playwright test`
**Run against production:** Tests auto-detect the running stack via `webServer` config.

---

## Demo Recordings: Playwright + ffmpeg

**What:** 5 side-by-side video clips recorded via Playwright's video capture, stitched with ffmpeg, showcasing the application against the live production deployment:
1. Multi-language AI classification (Mandarin guest → staff sees translated card)
2. Real-time WebSocket flow (guest submits → staff dashboard updates live)
3. Staff claims and resolves (guest stepper updates in parallel)
4. Manager analytics + escalation center (D3 charts alongside SLA breach monitoring)
5. Demo landing + admin settings (role selection alongside department configuration)

Each clip injects on-screen text overlay banners via `page.evaluate()` to annotate what's happening.

**Why:** Video evidence of real-time features is more compelling than screenshots. Side-by-side format shows cause-and-effect (guest action → staff reaction) which static docs cannot convey. Recordings run against production to prove the deployed system works end-to-end.

**Trade-off:** Video files add ~4MB to the repo. Justified as demo assets for judges/stakeholders. Can be regenerated anytime with `npx playwright test e2e/record-feature-clips.spec.ts --workers=1`.
