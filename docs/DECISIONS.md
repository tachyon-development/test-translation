# HospiQ — Architecture Decisions

**Domain:** Hospitality (Hotels & Resorts)
**Challenge:** Real-Time AI-Powered Workflow System

---

## What We Built

A guest at a hotel speaks into a kiosk — in Mandarin, Spanish, or any language. Within seconds, the AI translates their words, understands what they need (maintenance? room service? concierge?), and routes it to the right team. Staff see it appear instantly on their dashboard. The guest watches the progress in real-time on their phone.

**Live demo:** https://hospiq-eight.vercel.app (password: OviieAiDemo2026)

---

## Architecture at a Glance

![Architecture](diagrams/architecture.png)

**Why this shape:**

- **Frontend on Vercel** — Global CDN means the guest kiosk loads fast anywhere in the world. One Next.js app serves all four views (guest, staff, manager, admin).

- **API + Workers on Railway** — The API handles HTTP requests and WebSocket connections. Workers run separately so slow AI processing never blocks the API. We run **2 workers for redundancy** — if one crashes, the other keeps processing.

- **Groq for AI** — Cloud-based LLM that classifies requests in ~500ms. If Groq goes down, we fall back to a local Ollama instance. If that fails too, staff can classify manually. Three layers of redundancy.

- **Whisper for Voice** — Converts speech to text in any language. Runs as its own service so voice processing doesn't slow down text requests.

- **PostgreSQL** — Single source of truth. Row-Level Security ensures Hotel A can never see Hotel B's data, even if there's a bug in the application code.

- **Redis** — Does four jobs in one: message queue (BullMQ), real-time event broadcasting (pub/sub), dashboard caching, and SLA countdown timers.

---

## Key Decisions

| Decision | What We Chose | Why |
|----------|--------------|-----|
| **AI Provider** | Groq cloud + Ollama fallback | Speed (~500ms) with redundancy if the cloud is down |
| **Real-time** | WebSocket (staff) + SSE (guests) | Staff need two-way communication; guests only receive updates |
| **Queue system** | Redis + BullMQ | One service handles queue, cache, pub/sub, and timers |
| **Database** | PostgreSQL + Drizzle ORM | Relational data fits naturally; RLS enforces tenant isolation |
| **Voice** | Whisper (faster-whisper) | Local speech-to-text, no API keys, supports all languages |
| **Frontend** | Next.js + shadcn/ui + D3.js | Server-rendered pages, accessible components, custom charts |
| **Workers** | 2 replicas | If one crashes mid-job, BullMQ re-queues to the other |
| **Deployment** | Vercel + Railway | Frontend on CDN edge, backend on managed containers |

---

## How It Handles Failure

```
Guest submits request
    │
    ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Groq Cloud  │────▶│ Ollama Local │────▶│  Manual Review   │
│  (~500ms)    │     │ (~90 sec)    │     │  (staff assigns) │
│  PRIMARY     │     │  FALLBACK    │     │  LAST RESORT     │
└─────────────┘     └──────────────┘     └─────────────────┘
       │                    │
       │  Circuit breaker:  │
       │  3 failures = open │
       │  30s = retry       │
```

- **Worker crashes** → BullMQ detects stalled job, re-queues to other worker
- **Redis down** → API serves from PostgreSQL, dashboard shows stale data with warning
- **WebSocket drops** → Auto-reconnects with backoff; poll endpoint as fallback
- **Database down** → Redis holds queued jobs; workers drain the queue on recovery

---

## What Makes It Work

1. **Any language in, English out** — Groq translates and classifies in one prompt
2. **True real-time** — WebSocket push, not polling. Staff see cards appear live
3. **Graceful degradation** — Every critical path has a fallback
4. **Multi-tenant by default** — PostgreSQL RLS, not application-level filtering
5. **One command to run locally** — `docker compose up` boots all 10 services
