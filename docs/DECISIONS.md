# Architecture Decisions

**Domain:** Hospitality (Hotels & Resorts)
**Challenge:** Real-Time AI-Powered Workflow System

---

## What I Built

A guest at a hotel speaks into a kiosk — in Mandarin, Spanish, or any language. Within seconds, the AI translates their words, understands what they need (maintenance? room service? concierge?), and routes it to the right team. Staff see it appear instantly on their dashboard. The guest watches the progress in real-time on their phone.

---

## How It Meets the Four Core Requirements

### 1. Real-Time Input Processing

Guests submit requests two ways — **voice** or **text** — in any of 90+ languages.

**Voice path:** The browser's MediaRecorder captures audio. The recording is sent to the API, which passes it (as base64) through a job queue to **Whisper** — an open-source speech-to-text model. Whisper transcribes the audio and detects the language automatically. The guest sees "Transcribing..." on their progress stepper while this happens.

**Text path:** Text goes directly to classification, skipping transcription. This means text requests are processed even faster (~5 seconds end-to-end).

Both paths feed into the same classification pipeline, so the rest of the system doesn't care whether the input was voice or text.

### 2. AI Integration

The AI does three things in a single prompt:
- **Translates** the request to English (if it isn't already)
- **Classifies** which department should handle it (Maintenance, Housekeeping, Kitchen, Concierge, or Front Desk)
- **Assesses urgency** (low, medium, high, critical) which determines the SLA deadline

I currently use **Groq's cloud API** running `llama-3.1-8b-instant`, which returns results in ~500ms. The AI layer is behind a simple interface — swapping to a self-hosted model, OpenAI, Anthropic, or any OpenAI-compatible API is a one-line config change. No vendor lock-in.

If the AI provider is unavailable, a **circuit breaker** automatically falls back to a local Ollama instance. If that also fails, the request is flagged for **manual staff review** — the system never stops working.

### 3. Workflow Generation

Once the AI classifies a request, the system automatically:
- Creates a **workflow** assigned to the correct department
- Sets an **SLA deadline** based on urgency (e.g., critical = 15 min, low = 2 hours)
- Schedules an **escalation timer** — if the deadline passes without resolution, the workflow auto-escalates to a manager
- Logs everything to an **audit trail** for compliance

Each workflow moves through a lifecycle: **Pending → Claimed → In Progress → Resolved** (or **Escalated** if the SLA is missed). Every state change is recorded as an event with a timestamp and the actor who made it.

### 4. Multi-Client Real-Time Updates

This is where the architecture gets interesting. Four different types of users watch the same data update simultaneously:

- **Guests** receive updates via **Server-Sent Events (SSE)** — a lightweight one-way stream. They see their progress stepper advance: "Received → Transcribing → Understanding → Routing → Team Notified."
- **Staff** connect via **WebSocket** — a persistent two-way connection. New workflow cards appear on their kanban board instantly. When one staff member claims a task, every other connected staff member sees the card move columns in real-time.
- **Managers** see the same WebSocket feed but filtered to escalated items and analytics. D3.js visualizations update live.
- **Admins** manage configuration — departments, SLA rules, users, integrations.

The real-time layer works through **Redis Pub/Sub**. When a worker creates a workflow, it publishes an event to Redis. The API server subscribes to those channels and fans out to every connected WebSocket and SSE client. This decouples the AI processing (slow) from the real-time delivery (instant).

---

## Architecture at a Glance

![Architecture](diagrams/architecture.png)

**Why this shape:**

- **Frontend on Vercel** — Global CDN means the guest kiosk loads fast anywhere in the world. One Next.js app serves all four views (guest, staff, manager, admin).

- **API + Workers on Railway** — The API handles HTTP requests and WebSocket connections. **Workers** are separate background processes that do the heavy lifting — they pick up jobs from a queue (transcribe audio, call the AI, create workflows) so the API stays fast and responsive. Think of it like a restaurant: the API is the host who takes your order, and the workers are the kitchen staff who actually prepare the food. I run **multiple workers** so if one goes down, the others keep processing. Need to handle more volume? Just add more workers — no code changes needed.

- **AI Classification (Groq)** — Currently using Groq's cloud API for fast classification (~500ms). The AI layer is abstracted behind a simple interface — I can swap to a self-hosted model, OpenAI, Anthropic, or any provider with a one-line configuration change. No vendor lock-in.

- **Whisper for Voice** — Converts speech to text in any language. Runs as its own service so voice processing doesn't slow down text requests.

- **PostgreSQL** — Single source of truth. Row-Level Security ensures Hotel A can never see Hotel B's data, even if there's a bug in the application code.

- **Redis** — Does four jobs in one: message queue (BullMQ), real-time event broadcasting (pub/sub), dashboard caching, and SLA countdown timers.

---

## Key Decisions

| Decision | What I Chose | Why |
|----------|--------------|-----|
| **AI Provider** | Groq cloud (swappable) | ~500ms classification; can switch to self-hosted or any OpenAI-compatible API |
| **Real-time** | WebSocket + SSE | Staff get two-way live updates; guests receive progress via lightweight SSE |
| **Queue system** | Redis + BullMQ | One service handles queue, cache, pub/sub, and SLA timers |
| **Database** | PostgreSQL + RLS | Multi-tenant isolation enforced at the database level, not application code |
| **Voice** | Whisper (faster-whisper) | Local speech-to-text, no external API keys, supports 90+ languages |
| **Frontend** | Next.js + shadcn/ui + D3.js | Server-rendered pages, accessible components, custom analytics charts |
| **Workers** | Multiple replicas | Background processors for AI tasks — scale by adding more |
| **Deployment** | Vercel + Railway | Frontend on edge CDN, backend on managed containers |

---

## Redundancy — Nothing Has a Single Point of Failure

```
AI CLASSIFICATION — 3-tier fallback:

  ┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
  │  Groq Cloud  │────▶│  Self-hosted  │────▶│  Manual Review   │
  │  (~500ms)    │     │  Ollama      │     │  (staff assigns) │
  │  PRIMARY     │     │  FALLBACK    │     │  LAST RESORT     │
  └─────────────┘     └──────────────┘     └─────────────────┘

  Circuit breaker: 3 failures opens the circuit → fallback activates
                   30 seconds later → retries the primary
```

| What Fails | What Happens | Recovery |
|------------|-------------|----------|
| **AI provider down** | Circuit breaker activates → falls back to self-hosted model → then manual review | Automatic, zero downtime |
| **Worker crashes** | BullMQ detects stalled job → re-queues to another worker | Automatic, ~5 seconds |
| **Redis down** | API serves from PostgreSQL, queue holds in memory | Dashboard stale but functional |
| **WebSocket drops** | Auto-reconnects with exponential backoff | Transparent to user |
| **Database down** | Redis holds queued jobs → workers drain on recovery | No data loss |

---

## Scalability — Built to Grow

| Layer | How It Scales |
|-------|--------------|
| **Frontend** | Vercel edge CDN — already global, zero config |
| **API** | Stateless — add replicas behind a load balancer |
| **Workers** | Each worker processes jobs independently. 2 workers = 2x throughput. 10 workers = 10x. Just change a number in the config. |
| **AI** | Swap provider or add multiple endpoints. The abstraction layer makes this trivial. |
| **Database** | Connection pooling, read replicas for analytics, table partitioning for audit logs |
| **Redis** | Single instance handles thousands of orgs. Upgrade path: Redis Cluster for sharding |

The architecture separates concerns so each layer scales independently. During peak check-in hours, spin up 10 workers. At 2 AM, scale back to 2. The queue absorbs the burst and workers drain it at their own pace.

---

## What Makes It Work

1. **Any language in, English out** — AI translates and classifies in one step
2. **True real-time** — WebSocket push, not polling. Staff see cards appear live.
3. **No single point of failure** — Every critical path has a fallback
4. **AI provider is swappable** — Groq today, your own model tomorrow. One config change.
5. **Multi-tenant by default** — Database-level isolation, not application-level filtering
6. **Scales horizontally** — More workers = more throughput. No architecture changes needed.
