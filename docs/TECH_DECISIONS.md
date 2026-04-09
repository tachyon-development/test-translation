# Technology Decisions

Justifications for every major technology choice in HospiQ, including the trade-offs considered.

---

## Frontend: Next.js + shadcn/ui

**Why:** Next.js provides file-based routing, server components for initial page loads, and excellent DX with Bun. shadcn/ui gives us accessible, customizable components without the weight of a full component library — critical for the custom D3 visualizations that need to integrate seamlessly.

**Trade-off:** Heavier than Vite + React for a purely client-side app. Justified by the multi-page structure (5 views) and future SSR potential for the kiosk view.

---

## Backend: Elysia on Bun

**Why:** Native WebSocket support eliminates the need for a separate WS service. End-to-end type safety with Drizzle. Bun's runtime performance is measurably faster than Node.js for HTTP handling — matters at 1000+ orgs scale.

**Trade-off:** Smaller ecosystem than Express. Mitigated by the focused scope of our API surface.

---

## Real-Time: WebSocket (staff) + SSE (guests)

**Why:** Staff dashboards need bidirectional communication (receive updates, send claims/status changes). Guests only need to receive status updates — SSE is simpler, auto-reconnects, and works through more proxies/firewalls. Matching the protocol to the access pattern reduces complexity and improves reliability.

**Trade-off:** Two real-time mechanisms to maintain. Justified by the fundamentally different interaction patterns.

---

## AI Classification: Groq Cloud (Primary) + Ollama (Fallback)

**Why:** Production classification uses the Groq cloud API (`llama-3.1-8b-instant`) via `https://api.groq.com/openai/v1/chat/completions`. Classification completes in ~500ms — compared to 1-2 minutes on CPU-only Ollama. This makes the guest experience feel near-instant. Ollama remains deployed on Railway as a fallback for when Groq is unavailable, and as the default for local development and air-gapped environments.

**Circuit breaker:** The system uses a tiered fallback: Groq -> Ollama -> manual_review. If Groq fails 3 consecutive times, the circuit breaker opens and routes to Ollama. If Ollama also fails, requests are flagged for manual staff review.

**Trade-off:** Groq introduces an external dependency and sends request text to a third-party API. Mitigated by: (1) Groq's OpenAI-compatible API means swapping providers is trivial, (2) Ollama fallback ensures the system never stops functioning, (3) for privacy-sensitive deployments, set Ollama as primary.

---

## Speech-to-Text: Faster Whisper on Railway

**Why:** Runs as `fedirz/faster-whisper-server:latest-cpu` on port 8000 on Railway. Voice audio is passed as base64 through the BullMQ job queue rather than written to the filesystem, which simplifies the architecture and avoids shared volume mounts between services.

**Trade-off:** Base64 encoding increases payload size by ~33%. Acceptable because voice clips are short (typically < 30 seconds) and the BullMQ queue handles the serialization cleanly.

---

## Database: PostgreSQL

**Why:** Relational data model fits naturally (workflows to events, requests to classifications). Row Level Security enforces multi-tenant isolation at the database level — a single misconfigured query can't leak data across organizations. pgcrypto provides encryption at rest without application-level complexity. Drizzle ORM provides type-safe queries with zero runtime overhead.

**Trade-off:** Aggregate analytics queries on large datasets may slow down. Mitigated by Redis caching layer (10s TTL on dashboard stats) and potential read replicas.

---

## Queue: Redis + BullMQ

**Why:** Single Redis instance serves four concerns (queue, pub/sub, cache, timers) — operational simplicity. BullMQ provides reliable job processing with retries, backoff, delayed jobs (SLA timers), and dead letter queues out of the box. Simpler than RabbitMQ/Kafka for our message patterns.

**Trade-off:** Redis is single-threaded. At extreme scale, Kafka would provide better throughput and durability. For 1000+ orgs with moderate request volume, Redis handles this comfortably. Horizontal scaling path: Redis Cluster.

---

## Deployment: Vercel (Frontend) + Railway (Backend)

**Why:** Vercel provides edge CDN, zero-config Next.js deployment, and automatic preview deployments on PRs — ideal for the frontend. Railway provides managed Docker containers with built-in Postgres and Redis provisioning — ideal for the backend services (API, Worker, Ollama, Whisper). This split lets each layer scale independently with the right tool.

**Production URLs:**
- Frontend: `https://hospiq-eight.vercel.app`
- Backend: Railway (API, Worker, Postgres, Redis, Ollama, Whisper)

**Trade-off:** Split deployment adds operational complexity vs. a single Docker Compose. Justified by: (1) Vercel's CDN gives global latency benefits for the frontend, (2) Railway's managed services reduce ops burden for databases, (3) Docker Compose remains available for local development.

---

## Observability: Grafana + Loki

**Why:** Lightweight alternative to ELK stack (2 containers vs 3, fraction of the RAM). Docker logging driver sends logs to Loki without a sidecar. Grafana can also query PostgreSQL directly for operational dashboards.

**Trade-off:** Less powerful full-text search than Elasticsearch. Sufficient for structured JSON log querying.
