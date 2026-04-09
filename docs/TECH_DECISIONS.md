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

## AI: Ollama (local llama3) + Whisper.cpp (local)

**Why:** No API keys required to run the demo. Complete privacy — guest data never leaves the server. Judges can run the full system with `docker compose up` without signing up for anything.

**Trade-off:** Slower inference than cloud APIs. Lower model quality than GPT-4/Claude. Mitigated by: (1) the task is classification, not open-ended generation — smaller models handle this well, (2) queue-based architecture absorbs latency, (3) in production, swap for cloud API with the same interface.

---

## Database: PostgreSQL

**Why:** Relational data model fits naturally (workflows to events, requests to classifications). Row Level Security enforces multi-tenant isolation at the database level — a single misconfigured query can't leak data across organizations. pgcrypto provides encryption at rest without application-level complexity. Drizzle ORM provides type-safe queries with zero runtime overhead.

**Trade-off:** Aggregate analytics queries on large datasets may slow down. Mitigated by Redis caching layer (10s TTL on dashboard stats) and potential read replicas.

---

## Queue: Redis + BullMQ

**Why:** Single Redis instance serves four concerns (queue, pub/sub, cache, timers) — operational simplicity. BullMQ provides reliable job processing with retries, backoff, delayed jobs (SLA timers), and dead letter queues out of the box. Simpler than RabbitMQ/Kafka for our message patterns.

**Trade-off:** Redis is single-threaded. At extreme scale, Kafka would provide better throughput and durability. For 1000+ orgs with moderate request volume, Redis handles this comfortably. Horizontal scaling path: Redis Cluster.

---

## Observability: Grafana + Loki

**Why:** Lightweight alternative to ELK stack (2 containers vs 3, fraction of the RAM). Docker logging driver sends logs to Loki without a sidecar. Grafana can also query PostgreSQL directly for operational dashboards.

**Trade-off:** Less powerful full-text search than Elasticsearch. Sufficient for structured JSON log querying.
