# HospiQ — Real-Time AI-Powered Hospitality Workflow System

## Design Document

**Domain:** Hospitality (Hotels, Resorts)
**Challenge:** Real-Time AI-Powered Workflow System — Architecture Challenge
**Date:** 2026-04-09

---

## 1. Overview

HospiQ is a real-time AI-powered workflow system for the hospitality industry. Guests submit requests via voice (any language) or text through a hotel kiosk or mobile device. The system transcribes, translates, classifies urgency, and routes to the correct department — all in real-time. Staff see tasks appear instantly on a live dashboard with SLA countdown timers. Managers monitor operations through an analytics command center. The system handles partial failures gracefully and scales horizontally.

**Core Flow:**
```
Guest speaks Mandarin about a leaking faucet
  → Whisper transcribes audio
  → Ollama translates + classifies (maintenance, high urgency)
  → Workflow created with 30min SLA timer
  → Staff dashboard updates instantly via WebSocket
  → Guest watches progress via SSE
  → Staff resolves or system auto-escalates on SLA breach
```

---

## 2. Architecture Diagram

```mermaid
graph TB
    subgraph External["External Clients"]
        GK["Guest Kiosk / Mobile"]
        SD["Staff Dashboard"]
        MD["Manager Dashboard"]
        AD["Admin Panel"]
    end

    subgraph Docker["Docker Compose — 10 Services"]

        subgraph Gateway["Gateway Layer"]
            NG["nginx :80<br/>Reverse Proxy + TLS"]
        end

        subgraph Application["Application Layer"]
            FE["frontend :3000<br/>Next.js + shadcn/ui + Bun"]
            API["api :4000<br/>Elysia + Bun<br/>REST + WebSocket + SSE"]
            WK["worker ×2<br/>Bun + BullMQ<br/>Job Processing"]
        end

        EXT["External APIs<br/>PMS / Slack / Jira / Webhooks"]

        subgraph AI["AI Layer"]
            OL["ollama :11434<br/>llama3<br/>Translate / Classify / Summarize"]
            WH["whisper :8080<br/>whisper.cpp<br/>Speech-to-Text"]
        end

        subgraph Data["Data Layer"]
            PG["postgres :5432<br/>PostgreSQL 16 + pgcrypto<br/>Primary Store + RLS"]
            RD["redis :6379<br/>Redis 7<br/>Queue + Pub/Sub + Cache + Timers"]
        end

        subgraph Observability["Observability Layer"]
            LK["loki :3100<br/>Log Aggregation"]
            GF["grafana :3001<br/>Dashboards + Alerts"]
        end
    end

    GK -->|"HTTPS"| NG
    SD -->|"HTTPS + WSS"| NG
    MD -->|"HTTPS + WSS"| NG
    AD -->|"HTTPS"| NG

    NG -->|"/"| FE
    NG -->|"/api/*"| API
    NG -->|"/ws/*"| API

    API -->|"enqueue jobs"| RD
    API -->|"read/write"| PG
    API <-->|"pub/sub"| RD

    WK -->|"dequeue jobs"| RD
    WK -->|"HTTP"| OL
    WK -->|"HTTP"| WH
    WK -->|"read/write"| PG
    WK -->|"publish events"| RD
    WK -->|"outbound integrations"| EXT

    GF -->|"query"| LK
    GF -->|"query"| PG

    style Gateway fill:#2d2d3f,stroke:#d4a574,color:#fff
    style Application fill:#2d2d3f,stroke:#7c9885,color:#fff
    style AI fill:#2d2d3f,stroke:#c17767,color:#fff
    style Data fill:#2d2d3f,stroke:#d4a574,color:#fff
    style Observability fill:#2d2d3f,stroke:#7c9885,color:#fff
```

---

## 3. UML Sequence Diagrams

### 3.1 Voice Request — Full Lifecycle

```mermaid
sequenceDiagram
    actor Guest
    participant FE as Frontend
    participant API as Elysia API
    participant Redis
    participant Worker
    participant Whisper
    participant Ollama
    participant PG as PostgreSQL
    participant WS as WebSocket
    actor Staff

    Note over Guest,Staff: Step 1 — Input

    Guest->>FE: Records voice (Mandarin)
    FE->>API: POST /api/requests/voice (audio file)
    API->>PG: INSERT request (status: 'queued')
    API->>Redis: Enqueue → 'transcription' queue
    API-->>FE: 200 { request_id }
    FE->>API: Opens SSE /api/requests/:id/stream
    FE-->>Guest: "Processing your request..."

    Note over Worker,Whisper: Step 2 — Transcription

    Redis->>Worker: Dequeue transcription job
    Worker->>Whisper: POST /transcribe (audio)
    Whisper-->>Worker: { text: "水龙头漏水", lang: "zh", confidence: 0.94 }
    Worker->>PG: INSERT transcription
    Worker->>PG: UPDATE request (original_text, lang)
    Worker->>Redis: Publish → request:{id}:status
    Redis-->>API: SSE push
    API-->>FE: "Transcribed ✓"
    Worker->>Redis: Enqueue → 'classification' queue

    Note over Worker,Ollama: Step 3 — AI Classification

    Redis->>Worker: Dequeue classification job
    Worker->>Ollama: POST /api/generate (translate + classify prompt)
    Ollama-->>Worker: { translated: "My faucet is leaking badly",<br/>department: "maintenance",<br/>urgency: "high",<br/>summary: "Active water leak from faucet" }
    Worker->>PG: INSERT ai_classification
    Worker->>PG: UPDATE request (status: 'classified')
    Worker->>Redis: Publish → request:{id}:status
    API-->>FE: "Understood ✓ Routing to maintenance..."

    Note over Worker,PG: Step 4 — Workflow Creation

    Worker->>PG: SELECT department SLA (high = 30min)
    Worker->>PG: INSERT workflow (status: 'pending', sla_deadline)
    Worker->>PG: INSERT workflow_event (type: 'created')
    Worker->>PG: INSERT audit_log
    Worker->>Redis: Delayed job → 'escalation-check' (30min)
    Worker->>Redis: Publish → org:{id}:dept:{maint_id}
    API-->>FE: "Maintenance team notified ✓"

    Note over Staff,WS: Step 5 — Staff Real-Time Update

    Redis-->>API: Pub/sub event
    API->>WS: Push workflow to connected staff
    WS-->>Staff: New card appears on dashboard
    Staff->>API: POST /api/workflows/:id/claim
    API->>PG: UPDATE workflow (assigned_to, status: 'claimed')
    API->>Redis: Publish → request:{id}:status
    API-->>FE: "Juan from maintenance is on the way"

    Note over Staff,PG: Step 6 — Resolution

    Staff->>API: PATCH /api/workflows/:id/status { resolved }
    API->>PG: UPDATE workflow (resolved_at, resolution_note)
    API->>PG: INSERT workflow_event (type: 'resolved')
    API->>PG: INSERT audit_log
    API->>Redis: Cancel delayed escalation job
    API->>Redis: Publish → request:{id}:status
    API-->>FE: "Resolved ✓"
    FE-->>Guest: Feedback prompt (thumbs up/down)
```

### 3.2 SLA Breach — Escalation Flow

```mermaid
sequenceDiagram
    participant Redis
    participant Worker
    participant PG as PostgreSQL
    participant API as Elysia API
    actor Manager
    actor Staff

    Note over Redis,Staff: SLA Timer Fires

    Redis->>Worker: Delayed job fires (30min elapsed)
    Worker->>PG: SELECT workflow WHERE id = :id
    Worker->>Worker: Check: status still 'pending' or 'claimed'?

    alt Workflow still unresolved
        Worker->>PG: UPDATE workflow (status: 'escalated')
        Worker->>PG: SELECT department.escalation_to → Manager
        Worker->>PG: UPDATE workflow (escalated_to: manager_id)
        Worker->>PG: INSERT workflow_event (type: 'escalated')
        Worker->>PG: INSERT audit_log
        Worker->>Redis: Publish → org:{id}:workflows (escalation alert)
        Worker->>Redis: Delayed job → 'escalation-check' tier 2 (15min)
        API-->>Manager: Escalation alert (red banner + sound)
        API-->>Staff: Card turns red, escalation badge

    else Workflow already resolved
        Worker->>Worker: No-op, discard job
    end
```

### 3.3 Fault Tolerance — AI Service Down

```mermaid
sequenceDiagram
    participant Redis
    participant Worker
    participant Ollama
    participant PG as PostgreSQL
    actor Staff

    Note over Worker,Ollama: Circuit Breaker — Open State

    Redis->>Worker: Dequeue classification job
    Worker->>Worker: Check circuit breaker for 'ollama'
    Worker->>Worker: State: OPEN (3 consecutive failures)

    Worker->>PG: UPDATE request (status: 'manual_review')
    Worker->>PG: INSERT workflow (department: NULL, priority: 'medium')
    Worker->>PG: INSERT workflow_event (type: 'created', payload: 'AI unavailable')
    Worker->>Redis: Publish → org:{id}:workflows
    API-->>Staff: Card shows "Needs Manual Classification" badge
    Staff->>Staff: Reads original text, assigns department manually

    Note over Worker,Ollama: Circuit Breaker — Recovery

    Worker->>Worker: 30s elapsed → State: HALF-OPEN
    Redis->>Worker: Next classification job
    Worker->>Ollama: POST /api/generate (test request)
    Ollama-->>Worker: 200 OK — Success!
    Worker->>Worker: State: CLOSED (resume normal)
```

---

## 4. Data Model

### 4.1 Entity Relationship Diagram

```mermaid
erDiagram
    organizations ||--o{ users : "has"
    organizations ||--o{ departments : "has"
    organizations ||--o{ rooms : "has"
    organizations ||--o{ requests : "receives"
    organizations ||--o{ workflows : "manages"
    organizations ||--o{ audit_log : "tracks"
    organizations ||--o{ integrations : "configures"

    integrations ||--o{ integration_events : "logs"
    integrations ||--o{ field_mappings : "maps"

    users ||--o{ requests : "submits (as guest)"
    users ||--o{ workflows : "assigned_to"
    users ||--o{ workflow_events : "acts"

    departments ||--o{ workflows : "routes_to"

    rooms ||--o{ requests : "originates_from"

    requests ||--o| transcriptions : "has"
    requests ||--o| ai_classifications : "has"
    requests ||--|| workflows : "generates"

    workflows ||--o{ workflow_events : "has"
    workflows ||--o{ notifications : "triggers"

    organizations {
        uuid id PK
        text name
        text slug UK
        jsonb settings
        timestamp created_at
    }

    users {
        uuid id PK
        uuid org_id FK
        text name
        enum role
        uuid department_id FK
        text email
        text password_hash
        timestamp created_at
    }

    departments {
        uuid id PK
        uuid org_id FK
        text name
        text slug
        jsonb sla_config
        uuid escalation_to FK
        boolean active
        timestamp created_at
    }

    rooms {
        uuid id PK
        uuid org_id FK
        text number
        int floor
        text zone
        timestamp created_at
    }

    requests {
        uuid id PK
        uuid org_id FK
        uuid guest_id FK
        uuid room_id FK
        text original_text
        text original_lang
        text translated
        text audio_url
        enum status
        timestamp created_at
    }

    transcriptions {
        uuid id PK
        uuid request_id FK
        text audio_url
        text source_lang
        text transcript
        float confidence
        int duration_ms
        timestamp processed_at
    }

    ai_classifications {
        uuid id PK
        uuid request_id FK
        text model
        text ai_category
        uuid matched_department_id FK
        enum urgency
        text summary
        float confidence
        jsonb raw_response
        timestamp processed_at
    }

    workflows {
        uuid id PK
        uuid request_id FK
        uuid org_id FK
        uuid department_id FK
        uuid assigned_to FK
        enum priority
        timestamp sla_deadline
        boolean escalated
        uuid escalated_to FK
        timestamp escalated_at
        timestamp resolved_at
        text resolution_note
        enum status
        timestamp created_at
    }

    workflow_events {
        uuid id PK
        uuid workflow_id FK
        uuid actor_id FK
        enum event_type
        jsonb payload
        timestamp created_at
    }

    notifications {
        uuid id PK
        uuid request_id FK
        uuid user_id FK
        enum type
        jsonb payload
        boolean delivered
        timestamp created_at
    }

    audit_log {
        uuid id PK
        uuid org_id FK
        uuid actor_id FK
        text action
        text resource_type
        uuid resource_id
        jsonb metadata
        text ip_address
        timestamp created_at
    }

    integrations {
        uuid id PK
        uuid org_id FK
        text name
        enum type
        text provider
        jsonb config
        jsonb auth
        boolean active
        enum trigger_on
        text filter_departments
        timestamp created_at
    }

    integration_events {
        uuid id PK
        uuid integration_id FK
        uuid workflow_id FK
        enum status
        int http_status
        jsonb request_payload
        jsonb response_body
        int latency_ms
        timestamp created_at
    }

    field_mappings {
        uuid id PK
        uuid integration_id FK
        text source_field
        text target_field
        text transform
        timestamp created_at
    }
```

### 4.2 Table Details

**Encryption (pgcrypto):** PII columns encrypted at rest — `original_text`, `translated`, `transcript`, `resolution_note`, `audit_log.metadata`, `audit_log.ip_address`. Encryption key from `ENCRYPTION_KEY` env var. Drizzle custom column types handle encrypt/decrypt transparently.

**Row Level Security:** All tables with `org_id` enforce RLS. JWT contains `org_id` — Postgres session variable `app.current_org` set on each connection. Queries physically cannot access other tenants' data.

**Indexes:**
- `requests(org_id, status, created_at)` — dashboard filtering
- `workflows(org_id, department_id, status)` — staff queue
- `workflows(sla_deadline)` WHERE status IN ('pending','claimed') — SLA checks
- `audit_log(org_id, created_at)` — audit trail pagination
- `workflow_events(workflow_id, created_at)` — timeline rendering

---

## 5. Redis Architecture

### 5.1 Job Queues (BullMQ)

| Queue | Purpose | Retry | Backoff |
|---|---|---|---|
| `transcription` | Audio → Whisper STT | 3 attempts | Exponential (1s, 4s, 16s) |
| `classification` | Text → Ollama translate/classify | 3 attempts | Exponential (1s, 4s, 16s) |
| `notification` | Fan-out real-time updates | 5 attempts | Linear (500ms) |
| `escalation-check` | Delayed SLA timer jobs | 1 attempt | N/A (fires once) |
| `integration` | Outbound enterprise integration dispatch | 3 attempts | Exponential (2s, 8s, 32s) |

**Dead Letter Queues:** `transcription:failed`, `classification:failed`, `integration:failed` → Jobs land here after max retries. Worker marks request as `manual_review` (AI queues) or logs failure to `integration_events` (integration queue). Staff sees badge.

### 5.2 Pub/Sub Channels

```
org:{org_id}:workflows           — all workflow events (staff dashboards)
org:{org_id}:dept:{dept_id}      — department-specific (filtered staff view)
org:{org_id}:analytics           — aggregated stats (manager dashboard)
request:{request_id}:status      — individual progress (guest SSE)
system:health                    — service health changes
```

### 5.3 Cache Layer

```
org:{org_id}:stats               — dashboard KPIs (TTL 10s)
org:{org_id}:dept:{dept_id}:queue — dept queue count (TTL 5s)
user:{user_id}:session           — auth session (TTL 24h)
circuit:{service}                — circuit breaker state (ollama, whisper)
```

### 5.4 SLA Timer Mechanism

```
1. Workflow created → BullMQ delayed job (delay = sla_deadline - now)
2. Job fires → Worker checks: workflow.status ∈ {pending, claimed}?
3. If unresolved → escalate to dept.escalation_to
4. Queue second-tier delayed job (manager → GM, 15min)
5. If already resolved → no-op, discard
```

---

## 6. API Endpoints

### 6.1 Auth
```
POST   /api/auth/login              → JWT (org_id + user_id + role)
POST   /api/auth/register           → staff/manager registration (admin only)
```

### 6.2 Requests (Guest-Facing)
```
POST   /api/requests                → submit text request { text, room_number, lang? }
POST   /api/requests/voice          → upload audio, triggers Whisper → LLM pipeline
POST   /api/requests/batch          → submit multiple requests (peak hour handling)
GET    /api/requests/:id/status     → poll fallback if SSE drops
SSE    /api/requests/:id/stream     → real-time status for guest
```

### 6.3 Workflows (Staff-Facing)
```
GET    /api/workflows               → list (filtered by dept, status, priority)
GET    /api/workflows/:id           → detail + events timeline
POST   /api/workflows/:id/claim     → staff claims task
PATCH  /api/workflows/:id/status    → update (in_progress, resolved)
POST   /api/workflows/:id/escalate  → manual escalation
POST   /api/workflows/:id/comment   → add note
PATCH  /api/workflows/:id/classify  → manager overrides AI classification
```

### 6.4 Analytics (Manager-Facing)
```
GET    /api/analytics/overview      → KPIs (active, avg time, resolution rate, SLA %)
GET    /api/analytics/departments   → per-department breakdown
GET    /api/analytics/ai            → confidence distribution, accuracy over time
GET    /api/analytics/stream        → real-time stream graph data (last 24h)
```

### 6.5 Admin
```
GET    /api/org/departments         → list departments
POST   /api/org/departments         → create department
PATCH  /api/org/departments/:id     → update SLA, escalation contact
GET    /api/org/rooms               → list rooms
POST   /api/org/rooms               → create room
GET    /api/org/audit-log           → paginated audit trail
GET    /api/org/users               → list users
POST   /api/org/users               → invite user
```

### 6.6 Enterprise Integrations
```
GET    /api/integrations            → list org integrations
POST   /api/integrations            → create integration (webhook, PMS, etc.)
GET    /api/integrations/:id        → integration detail + config
PATCH  /api/integrations/:id        → update config, auth, field mappings
DELETE /api/integrations/:id        → remove integration
POST   /api/integrations/:id/test   → send test payload, return request/response
PATCH  /api/integrations/:id/toggle → enable/disable
GET    /api/integrations/:id/events → paginated event log (success/fail history)
GET    /api/integrations/:id/mappings → list field mappings
PUT    /api/integrations/:id/mappings → replace all field mappings
GET    /api/integrations/providers  → list available adapters (opera, slack, jira, etc.)
```

### 6.7 System
```
GET    /api/health                  → API server status
GET    /api/health/services         → Ollama, Whisper, Postgres, Redis status
WS     /ws/dashboard                → staff real-time (Elysia native WebSocket)
```

---

## 7. Frontend Design

### 7.1 Design Direction

**Aesthetic:** "Luxury Command Center" — the visual language of a high-end hotel lobby married with the information density of an air traffic control system. Dark, warm, refined. Every pixel feels intentional.

**Typography:**
- Display: **Cormorant Garamond** — elegant serif, evokes luxury hospitality
- Body: **DM Sans** — geometric, clean, excellent readability on dark backgrounds
- Monospace: **JetBrains Mono** — for status codes, timestamps, technical details

**Color Palette:**
```css
:root {
  /* Base */
  --bg-primary: #0f0f17;        /* Deep void — almost black with blue undertone */
  --bg-secondary: #1a1a2e;      /* Charcoal panel backgrounds */
  --bg-elevated: #222238;       /* Cards, modals */
  --bg-surface: #2a2a42;        /* Hover states, active items */

  /* Text */
  --text-primary: #e8e4df;      /* Warm white — not harsh */
  --text-secondary: #9a9486;    /* Muted warm gray */
  --text-accent: #d4a574;       /* Gold — for emphasis */

  /* Accent — Warm Gold */
  --accent: #d4a574;            /* Primary accent — warm amber gold */
  --accent-glow: #d4a57433;     /* Glow effect behind accent elements */

  /* Status Colors — Elevated, not default */
  --status-success: #7c9885;    /* Sage green — resolved */
  --status-warning: #c9a84c;    /* Warm yellow — approaching SLA */
  --status-danger: #c17767;     /* Soft coral — breached / critical */
  --status-info: #6b8cae;       /* Steel blue — in progress */
  --status-pending: #8a7fb5;    /* Muted lavender — waiting */

  /* Priority Badges */
  --priority-low: #5a6e5f;      /* Dark sage */
  --priority-medium: #6b8cae;   /* Steel blue */
  --priority-high: #c9a84c;     /* Warm yellow */
  --priority-critical: #c17767; /* Soft coral with pulse animation */
}
```

**Motion Philosophy:**
- Spring-based animations (framer-motion) — nothing linear, everything organic
- Staggered card entrances on dashboard load (50ms delay per card)
- Fluid number counters on KPI cards (count up on mount, smooth interpolation on change)
- Progress stepper: each step slides in from right with a subtle scale + fade
- Workflow card appears: slides up + fades in with a warm glow pulse
- Escalation alert: gentle shake + red pulse glow
- Resolution: card compresses smoothly and slides to "Resolved" column with a green shimmer

**Visual Effects:**
- Subtle noise texture overlay on dark backgrounds (grain — feels physical)
- Warm gradient glow behind active/important elements
- Glass morphism on modals (backdrop-blur with warm tint)
- SLA countdown timer: circular arc that depletes, color transitions from sage → yellow → coral
- Custom cursor on kiosk mode (larger, warm glow ring)

### 7.2 Guest Kiosk View (`/`)

**Layout:** Full-screen, centered content. Clean and calming — a guest shouldn't feel like they're using enterprise software.

```
┌─────────────────────────────────────────────┐
│                                             │
│            ╔══════════════════╗              │
│            ║    HospiQ Logo   ║              │
│            ║  "How can we     ║              │
│            ║   help you?"     ║              │
│            ╚══════════════════╝              │
│                                             │
│         ┌──────────────────────┐            │
│         │ Room Number: [412 ▼] │            │
│         └──────────────────────┘            │
│                                             │
│              ╭──────────╮                   │
│              │    🎤    │  ← Pulsing        │
│              │  (hold)  │    warm glow      │
│              ╰──────────╯    ring           │
│                                             │
│         ┌──────────────────────┐            │
│         │ Or type your request │            │
│         └──────────────────────┘            │
│                                             │
│   ── After submission: Progress Stepper ──  │
│                                             │
│     ● Received                              │
│     ◐ Transcribing... (animated spinner)    │
│     ○ Understanding                         │
│     ○ Routing                               │
│     ○ Assigned                              │
│     ○ Resolved                              │
│                                             │
│   "Juan from maintenance is on the way"     │
│                                             │
└─────────────────────────────────────────────┘
```

**Animations:**
- Microphone button: continuous subtle pulse (radial gradient glow, 2s ease)
- While recording: waveform visualization (canvas, real-time audio levels)
- Progress stepper: each step animates in sequence — icon scales up, checkmark draws with SVG path animation, connector line fills left-to-right
- Status text: typewriter effect for updates ("Juan from maintenance...")
- Background: very subtle floating particles (warm gold, low opacity, slow drift)

### 7.3 Staff Dashboard (`/dashboard`)

**Layout:** Sidebar + kanban board. Dense but not cluttered. Information hierarchy through color and type weight.

```
┌──────┬──────────────────────────────────────────────────────┐
│      │  ┌─ Filters ────────────────────────────────────┐    │
│  ◆   │  │ All Depts ▼  │  All Priority ▼  │  Search   │    │
│      │  └──────────────────────────────────────────────┘    │
│ Dept │                                                      │
│ ──── │  PENDING (3)    CLAIMED (2)     IN PROGRESS (1)      │
│ All  │  ┌──────────┐   ┌──────────┐   ┌──────────┐        │
│ Maint│  │▊ HIGH    │   │▊ MED     │   │▊ LOW     │        │
│ House│  │ Rm 412   │   │ Rm 203   │   │ Rm 103   │        │
│ Conc │  │ Water    │   │ Towels   │   │ WiFi pwd │        │
│ Front│  │ leak     │   │ request  │   │ help     │        │
│ Kitch│  │ ◔ 24min  │   │ ◔ 1h 2m  │   │ ◔ 3h 10m │        │
│      │  │ 94% conf │   │ 87% conf │   │ 91% conf │        │
│ ──── │  └──────────┘   └──────────┘   └──────────┘        │
│ Queue│  ┌──────────┐   ┌──────────┐                        │
│  12  │  │▊ CRIT    │   │▊ HIGH   │    ESCALATED (1)        │
│      │  │ Rm 601   │   │ Lobby   │   ┌──────────┐         │
│ SLA  │  │ Broken   │   │ Spill   │   │▊ HIGH    │         │
│ 92%  │  │ AC unit  │   │ cleanup │   │ Rm 305   │         │
│      │  │ ◔ 8min   │   │ ◔ 45min │   │ Clogged  │         │
│      │  │ ⚡ pulse │   │ 89% conf│   │ drain    │         │
│      │  └──────────┘   └──────────┘   │ ⚠ SLA!  │         │
│      │                                 └──────────┘         │
└──────┴──────────────────────────────────────────────────────┘
```

**Card Design:**
- Left border color = priority (sage/blue/yellow/coral)
- SLA timer: circular arc SVG, depletes in real-time, color transitions as deadline approaches
- Critical cards: subtle pulse glow animation (coral)
- Confidence score: small, muted — visible but not distracting
- Click → slide-out panel from right (400px, glass morphism backdrop)

**D3 Visualizations on Staff Dashboard:**
- **SLA Countdown Arc:** Custom D3 radial arc per card. Starts full (sage), depletes clockwise, transitions through yellow to coral. Smooth CSS transition on color. When breached: arc turns coral + gentle pulse.

**Animations:**
- New card: slides in from top of column with spring animation + warm glow flash
- Claiming: card smoothly translates from Pending → Claimed column (FLIP animation)
- Escalation: card border pulses coral, shake animation (3 cycles), escalation badge fades in

### 7.4 Manager Analytics (`/analytics`)

**Layout:** Full-width dashboard. KPI cards top, charts below in a 2×2 grid, live feed on the right.

```
┌─────────────────────────────────────────────────────────────────┐
│  HospiQ Analytics                              Hotel Mariana    │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │    23    │  │  8.4min  │  │   94.2%  │  │   2.1%   │       │
│  │  Active  │  │ Avg Resp │  │ Resolved │  │ SLA Miss │       │
│  │  ▲ +3   │  │ ▼ -1.2m  │  │ ▲ +2.1% │  │ ▼ -0.8% │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                 │
│  ┌─────────────────────────┐  ┌─────────────────────────┐      │
│  │  Request Stream (D3)   │  │  Department Load (D3)   │      │
│  │                        │  │                          │      │
│  │  ~~~~ flowing stream   │  │    ╱╲   radial gauge    │      │
│  │  ~~~~  graph showing   │  │   ╱  ╲  per department  │      │
│  │  ~~~~   volume over    │  │  maint: ████░░ 73%      │      │
│  │  ~~~~    last 24 hrs   │  │  house: ██████░ 91%     │      │
│  │                        │  │  conc:  ██░░░░░ 28%     │      │
│  └─────────────────────────┘  └─────────────────────────┘      │
│                                                                 │
│  ┌─────────────────────────┐  ┌─────────────────────────┐      │
│  │  AI Performance (D3)   │  │  Live Event Feed        │      │
│  │                        │  │                          │      │
│  │  confidence histogram  │  │  09:14 ● Rm 412 resolved│      │
│  │  ▇▇▇▇▇▇██████▇▇▇     │  │  09:12 ● Rm 601 claimed │      │
│  │  0.5  0.7  0.9  1.0   │  │  09:10 ⚠ Rm 305 escalate│      │
│  │                        │  │  09:08 ● Rm 203 assigned│      │
│  │  accuracy trend line   │  │  09:05 ● Rm 103 created │      │
│  └─────────────────────────┘  └─────────────────────────┘      │
│                                                                 │
│  ┌────────────── System Health ──────────────┐                 │
│  │ Ollama ● UP  Whisper ● UP  PG ● UP  Redis ● UP            │
│  └───────────────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────────┘
```

**D3 Visualizations (Custom, not chart libraries):**

1. **Stream Graph** (`/analytics` — request volume)
   - D3 `d3.stack()` with `d3.curveBasis` for smooth flowing layers
   - Each layer = department, colored with palette
   - Updates every 10s with smooth transition (1s ease)
   - Hover: tooltip shows exact count per department at that time
   - Last 24 hours, auto-scrolling

2. **Radial Gauge Chart** (department load)
   - D3 arc generator — one ring per department
   - Rings fill based on active/capacity ratio
   - Color transitions: sage (low) → yellow (busy) → coral (overloaded)
   - Pulse animation when a department crosses 80% capacity
   - Center text: total active across all departments

3. **Confidence Histogram** (AI performance)
   - D3 histogram with smooth bar transitions on data update
   - Vertical line at 0.7 threshold — below = "low confidence" zone (coral tint)
   - Overlay: trend line showing 7-day moving average
   - Hover: bar highlights, shows count + percentage

4. **SLA Compliance Arc** (KPI card enhancement)
   - Large radial arc in the SLA KPI card
   - Fills clockwise, percentage in center
   - Color: sage (>95%) → yellow (85-95%) → coral (<85%)
   - Animated on mount: sweeps from 0 to current value

**KPI Card Animations:**
- Numbers count up on mount (framer-motion `useSpring`)
- Delta indicators (▲/▼) fade in after number finishes counting
- Positive delta: sage text. Negative: coral text.
- Cards stagger in: 100ms delay between each

### 7.5 Manager Escalation View (`/manager`)

```
┌─────────────────────────────────────────────────────────────┐
│  ┌─ Compact KPIs ─┐   ESCALATION CENTER                    │
│  │ 23 active      │                                        │
│  │ 2.1% SLA miss  │   ┌─────────────────────────────────┐  │
│  │ 3 escalated    │   │ ▊ ESCALATED — 12min overdue     │  │
│  └────────────────┘   │ Rm 305 · Maintenance             │  │
│                        │ "Clogged drain in bathroom"      │  │
│                        │ AI: maintenance (87% conf)       │  │
│                        │                                   │  │
│                        │ [Override Dept ▼] [Reassign ▼]   │  │
│                        │ [Resolve] [Add Note]              │  │
│                        │                                   │  │
│                        │ Timeline:                         │  │
│                        │  09:05 Created (auto)             │  │
│                        │  09:05 Assigned → Maintenance     │  │
│                        │  09:35 SLA breached (30min)       │  │
│                        │  09:35 Escalated → Maria (mgr)   │  │
│                        └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 7.6 Admin Settings (`/admin`)

Clean settings layout — tabs for Organization, Departments, Users, Rooms, Audit Log. Standard CRUD with shadcn/ui tables and forms. Nothing flashy needed here — function over form.

### 7.7 Demo Landing Page (`/demo`)

**For judges — one-click access to all views:**

```
┌─────────────────────────────────────────────────┐
│                                                 │
│              HospiQ Demo                        │
│     "Real-Time AI-Powered Hospitality"          │
│                                                 │
│     Choose a role to explore:                   │
│                                                 │
│     ┌─────────┐  ┌─────────┐  ┌─────────┐     │
│     │  Guest  │  │  Staff  │  │ Manager │     │
│     │  Kiosk  │  │Dashboard│  │Analytics│     │
│     └─────────┘  └─────────┘  └─────────┘     │
│                  ┌─────────┐                    │
│                  │  Admin  │                    │
│                  │ Settings│                    │
│                  └─────────┘                    │
│                                                 │
│     [▶ Run Simulation] ← auto-fires requests   │
│                                                 │
│     💡 Open two windows side-by-side:           │
│        Guest kiosk + Staff dashboard            │
│        to see real-time updates flow            │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 8. Docker Compose

### 8.1 Services (10 Containers)

| Service | Image / Build | Port | Purpose |
|---|---|---|---|
| nginx | `nginx:alpine` | 80 | Reverse proxy, routing, TLS |
| frontend | `./apps/frontend` (Bun) | 3000 | Next.js + shadcn/ui |
| api | `./apps/api` (Bun) | 4000 | Elysia REST + WebSocket + SSE |
| worker | `./apps/worker` (Bun) ×2 | — | BullMQ job processing |
| ollama | `ollama/ollama` | 11434 | Local LLM (llama3) |
| whisper | `whisper.cpp` | 8080 | Speech-to-text |
| postgres | `postgres:16-alpine` | 5432 | Primary store + pgcrypto + RLS |
| redis | `redis:7-alpine` | 6379 | Queue + pub/sub + cache + timers |
| loki | `grafana/loki` | 3100 | Log aggregation |
| grafana | `grafana/grafana` | 3001 | Observability dashboards |

### 8.2 Project Structure

> See **Section 21** for the complete, final project structure (includes Playwright tests, integrations, shared components, seed data modules, QR generation).

---

## 9. Technology Justifications

*Required by challenge — "you must justify your selections."*

### Frontend: Next.js + shadcn/ui
**Why:** Next.js provides file-based routing, server components for initial page loads, and excellent DX with Bun. shadcn/ui gives us accessible, customizable components without the weight of a full component library — critical for the custom D3 visualizations that need to integrate seamlessly.
**Trade-off:** Heavier than Vite + React for a purely client-side app. Justified by the multi-page structure (5 views) and future SSR potential for the kiosk view.

### Backend: Elysia on Bun
**Why:** Native WebSocket support eliminates the need for a separate WS service. End-to-end type safety with Drizzle. Bun's runtime performance is measurably faster than Node.js for HTTP handling — matters at 1000+ orgs scale.
**Trade-off:** Smaller ecosystem than Express. Mitigated by the focused scope of our API surface.

### Real-Time: WebSocket (staff) + SSE (guests)
**Why:** Staff dashboards need bidirectional communication (receive updates, send claims/status changes). Guests only need to receive status updates — SSE is simpler, auto-reconnects, and works through more proxies/firewalls. Matching the protocol to the access pattern reduces complexity and improves reliability.
**Trade-off:** Two real-time mechanisms to maintain. Justified by the fundamentally different interaction patterns.

### AI Layer: Ollama (local llama3) + Whisper.cpp (local)
**Why:** No API keys required to run the demo. Complete privacy — guest data never leaves the server. Judges can run the full system with `docker compose up` without signing up for anything.
**Trade-off:** Slower inference than cloud APIs. Lower model quality than GPT-4/Claude. Mitigated by: (1) the task is classification, not open-ended generation — smaller models handle this well, (2) queue-based architecture absorbs latency, (3) design doc acknowledges "in production, swap for cloud API with the same interface."

### Database: PostgreSQL
**Why:** Relational data model fits naturally (workflows → events, requests → classifications). Row Level Security enforces multi-tenant isolation at the database level — a single misconfigured query can't leak data across organizations. pgcrypto provides encryption at rest without application-level complexity. Drizzle ORM provides type-safe queries with zero runtime overhead.
**Trade-off:** Aggregate analytics queries on large datasets may slow down. Mitigated by Redis caching layer (10s TTL on dashboard stats) and potential read replicas.

### Queue: Redis + BullMQ
**Why:** Single Redis instance serves four concerns (queue, pub/sub, cache, timers) — operational simplicity. BullMQ provides reliable job processing with retries, backoff, delayed jobs (SLA timers), and dead letter queues out of the box. Simpler than RabbitMQ/Kafka for our message patterns.
**Trade-off:** Redis is single-threaded. At extreme scale, Kafka would provide better throughput and durability. For 1000+ orgs with moderate request volume, Redis handles this comfortably. Horizontal scaling path: Redis Cluster.

### Observability: Grafana + Loki
**Why:** Lightweight alternative to ELK stack (2 containers vs 3, fraction of the RAM). Docker logging driver sends logs to Loki without a sidecar. Grafana can also query PostgreSQL directly for operational dashboards.
**Trade-off:** Less powerful full-text search than Elasticsearch. Sufficient for structured JSON log querying.

---

## 10. Scalability Strategy

**Target:** 1000+ organizations, concurrent real-time connections.

| Layer | Strategy |
|---|---|
| **Frontend** | CDN-deployed Next.js. Static assets cached. Server components reduce client bundle. |
| **API** | Stateless Elysia servers behind nginx. Horizontal scale: add replicas. JWT auth = no session affinity needed (except WebSocket — use Redis-backed sticky sessions). |
| **Workers** | `deploy.replicas: N` in Docker Compose. Each worker processes jobs independently. Scale workers = scale throughput linearly. |
| **Database** | Connection pooling (PgBouncer). Read replicas for analytics queries. Partition `audit_log` and `workflow_events` by `created_at`. Indexes on hot query paths. |
| **Redis** | Single instance handles thousands of orgs. Upgrade path: Redis Cluster for sharding. BullMQ supports multi-node Redis. |
| **AI** | Queue absorbs burst traffic. Multiple Ollama instances behind a load balancer. Swap to cloud API (OpenAI/Anthropic) for production scale. |

---

## 11. Fault Tolerance

| Failure | Handling |
|---|---|
| **Ollama down** | Circuit breaker opens → requests flagged "manual_review" → staff classifies manually → system continues operating |
| **Whisper down** | Circuit breaker → voice requests queued in DLQ → text requests unaffected → retry when service recovers |
| **Redis down** | API returns errors for new requests. Existing data in Postgres still accessible. Dashboard shows stale state with warning. |
| **Postgres down** | System is unavailable. Redis queue holds pending jobs. On recovery, workers drain the queue. No data loss. |
| **Network drop (guest)** | SSE auto-reconnects. Missed updates stored in `notifications` table. On reconnect, flush pending notifications. Poll endpoint as fallback. |
| **Network drop (staff)** | WebSocket auto-reconnects with Elysia. On reconnect, server sends full current queue state. No missed assignments. |
| **Worker crash** | BullMQ detects stalled job → re-queues automatically. Another worker picks it up. At-least-once processing guaranteed. |
| **Integration target down** | 3 retries with exponential backoff. Failed events logged to `integration_events`. Admin sees failure in integration dashboard. Does not block workflow processing. |

---

## 12. Demo Experience

### 12.1 Setup (One Command)

```bash
git clone <repo> && cd hospiq
cp .env.example .env
./scripts/setup.sh    # docker compose up + pull llama3 + run migrations + seed
```

### 12.2 Seed Data

`packages/db/seed.ts` creates:
- 1 organization: "Hotel Mariana"
- 5 departments with SLA configs (4 tiers each)
- 33 rooms across 6 floors
- 12 demo users: 2 guests, 7 staff (across all depts), 2 managers, 1 admin
- 8 pre-loaded requests in all states + 50 historical requests for analytics
- 3 enterprise integrations (Opera PMS, Slack, Jira)
- ~100 audit log entries
- See Section 20 for full details

### 12.3 Simulation Script

```bash
bun scripts/simulate.ts
```

Auto-fires 1 request every 5 seconds in random languages (English, Spanish, Mandarin, French, Japanese) with random categories and urgencies. Judges can watch requests flow through the system in real-time.

### 12.4 Judge Demo Flow

1. Open `/demo` — see role selection
2. Open **two browser windows side by side**
3. Left: Guest Kiosk (`/`) — submit a request
4. Right: Staff Dashboard (`/dashboard`) — watch it appear live
5. Claim it on staff side → guest sees "Juan is on the way"
6. Open `/analytics` — see D3 charts updating in real-time
7. Run simulation → watch the system handle volume
8. Kill Ollama container → see fault tolerance in action (manual review mode)

---

## 13. Implementation Priority

> See **Section 22** for the final, updated implementation priority (3 phases, 22 steps).

---

## 14. Playwright E2E Testing

### 14.1 Test Structure

```
apps/frontend/
  └── e2e/
      ├── playwright.config.ts
      ├── fixtures/
      │   ├── auth.ts                 # Login helper — returns authenticated page per role
      │   └── seed.ts                 # Ensures test data exists before suite runs
      ├── guest-flow.spec.ts
      ├── staff-flow.spec.ts
      ├── realtime-sync.spec.ts
      ├── escalation.spec.ts
      ├── fault-tolerance.spec.ts
      ├── analytics.spec.ts
      ├── admin.spec.ts
      └── demo-simulation.spec.ts
```

### 14.2 Test Suites

**`guest-flow.spec.ts` — Guest submits request and watches progress**
```
test: guest can submit a text request
  → navigate to kiosk (/)
  → select room 412
  → type "My faucet is leaking badly"
  → click submit
  → assert progress stepper appears
  → wait for "Received" step to be active
  → wait for "Understood" step (AI classification completes)
  → wait for "Routed" step (workflow created)
  → assert final status message contains department name

test: guest can submit in a foreign language
  → type "水龙头漏水很严重" (Mandarin)
  → submit
  → assert "Transcribed" or "Understood" step completes
  → assert translated text appears in English

test: guest sees error gracefully if submission fails
  → disconnect API (intercept network)
  → attempt submit
  → assert error toast appears with retry button

test: guest can select room via URL parameter
  → navigate to /?room=412
  → assert room field is pre-filled with "412"
```

**`staff-flow.spec.ts` — Staff manages workflows**
```
test: staff sees existing workflows on dashboard load
  → login as staff (maintenance dept)
  → navigate to /dashboard
  → assert kanban columns visible (Pending, Claimed, In Progress, Escalated)
  → assert at least 1 workflow card visible

test: staff can claim a workflow
  → find a "Pending" workflow card
  → click the card → assert slide-out detail panel opens
  → click "Claim" button
  → assert card moves to "Claimed" column
  → assert card shows staff name

test: staff can resolve a workflow
  → find a "Claimed" workflow card (claimed by this user)
  → open detail panel
  → click "Resolve"
  → type resolution note: "Fixed the faucet"
  → confirm
  → assert card disappears from active columns

test: staff can filter by department
  → click department filter → select "Housekeeping"
  → assert only housekeeping workflows visible

test: staff can filter by priority
  → click priority filter → select "High"
  → assert only high-priority cards visible
```

**`realtime-sync.spec.ts` — The killer test: two browser contexts**
```
test: staff sees guest request appear in real-time
  → create two browser contexts (guestCtx, staffCtx)
  → staffCtx: login as staff, navigate to /dashboard, count current cards
  → guestCtx: navigate to kiosk (/), select room, type request, submit
  → staffCtx: wait for new card to appear (card count increases by 1)
  → assert new card contains request summary text
  → assert new card appeared within 10 seconds of submission

test: guest sees staff claim in real-time
  → create two browser contexts (guestCtx, staffCtx)
  → guestCtx: submit request, wait for "Routed" step
  → staffCtx: login as staff, find the new workflow, click "Claim"
  → guestCtx: assert progress stepper updates to "Assigned"
  → guestCtx: assert staff name appears in status message

test: guest sees resolution in real-time
  → continue from claim test
  → staffCtx: resolve the workflow
  → guestCtx: assert "Resolved" step activates
  → guestCtx: assert feedback prompt appears

test: multiple staff see same update
  → create three contexts (guest, staff1, staff2)
  → guest submits request
  → both staff1 and staff2 see the card appear
  → staff1 claims → staff2 sees card move to "Claimed"
```

**`escalation.spec.ts` — SLA breach and escalation**
```
test: workflow escalates after SLA deadline
  → seed a workflow with sla_deadline = now - 1 minute (already breached)
  → trigger escalation check (POST /api/test/trigger-escalation or wait)
  → login as manager, navigate to /manager
  → assert escalated workflow appears with red badge
  → assert escalation timeline shows SLA breach event

test: manager can override AI classification
  → login as manager
  → find escalated workflow
  → click "Override Dept" → select different department
  → confirm override
  → assert workflow moved to new department
  → assert audit log shows manual override
```

**`fault-tolerance.spec.ts` — System degrades gracefully**
```
test: system handles AI service outage
  → (requires docker control or API mock)
  → simulate Ollama being unavailable (intercept /api/generate with 503)
  → submit a guest request
  → assert request enters "manual_review" state
  → staff dashboard shows "Needs Manual Classification" badge
  → staff can manually assign department and priority

test: guest SSE reconnects after network drop
  → submit request
  → wait for SSE connection established
  → simulate network interruption (page.route intercept)
  → restore network
  → assert SSE reconnects
  → assert subsequent updates still arrive
```

**`analytics.spec.ts` — Manager analytics dashboard**
```
test: analytics page loads with KPI cards
  → login as manager
  → navigate to /analytics
  → assert 4 KPI cards visible (Active, Avg Resp, Resolved %, SLA Miss %)
  → assert numbers are rendered (not NaN or empty)

test: D3 charts render
  → assert stream graph SVG element exists with paths
  → assert department gauge SVG element exists with arcs
  → assert confidence histogram SVG element exists with bars

test: analytics update in real-time
  → note current "Active" KPI value
  → submit a new request via API
  → assert "Active" KPI increments within 15 seconds

test: system health indicators show status
  → assert health bar shows all services
  → assert each service shows green indicator
```

**`admin.spec.ts` — Admin settings**
```
test: admin can create a department
  → login as admin
  → navigate to /admin/departments
  → click "Add Department"
  → fill: name "Spa", SLA 45min
  → save
  → assert new department appears in list

test: admin can manage rooms
  → navigate to /admin/rooms
  → click "Add Room"
  → fill: number "501", floor 5, zone "East Wing"
  → save
  → assert room appears in list

test: admin can view audit log
  → navigate to /admin/audit
  → assert audit entries visible
  → assert entries show actor, action, timestamp
  → test pagination (click next page)
```

**`demo-simulation.spec.ts` — Demo experience works**
```
test: demo page loads with role buttons
  → navigate to /demo
  → assert 4 role buttons visible (Guest, Staff, Manager, Admin)
  → click "Guest" → assert redirects to kiosk
  → go back → click "Staff" → assert redirects to dashboard (logged in)

test: simulation button fires requests
  → navigate to /demo
  → open staff dashboard in second tab
  → click "Run Simulation" on demo page
  → assert staff dashboard receives new cards within 10 seconds
  → assert at least 2 new cards appear within 30 seconds
```

### 14.3 Playwright Config

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:80',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  webServer: {
    command: 'docker compose up',
    url: 'http://localhost:80/api/health',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
```

### 14.4 Running Tests

```bash
# Full suite
bunx playwright test

# Specific suite
bunx playwright test realtime-sync

# With UI (visual debugging)
bunx playwright test --ui

# Record video of full demo flow (for README GIF)
bunx playwright test demo-simulation --project=chromium
```

---

## 15. QR Code System

### 15.1 Flow

```
Hotel prints QR code for Room 412
  → QR encodes: https://hospiq.hotel-mariana.com/room/412
  → Guest scans with phone camera
  → Lands on kiosk page with room pre-filled
  → No app install, no login required
```

### 15.2 Implementation

**Route:** `/:orgSlug/room/:roomNumber` → redirects to `/?room=412&org=hotel-mariana`

**QR Generation:**
- Admin panel (`/admin/rooms`) has "Generate QR" button per room
- Uses `qrcode` npm package to generate SVG
- Download as PNG for printing
- Batch generate: "Download All QR Codes" → ZIP of PNGs organized by floor

**QR Card Design (for printing):**
```
┌─────────────────────┐
│      ╔═══════╗      │
│      ║  QR   ║      │
│      ║ CODE  ║      │
│      ╚═══════╝      │
│                     │
│  Room 412           │
│  Hotel Mariana      │
│                     │
│  Scan to request    │
│  assistance         │
└─────────────────────┘
```

---

## 16. WebSocket Authentication

### 16.1 Connection Flow

```mermaid
sequenceDiagram
    participant Client as Staff Browser
    participant API as Elysia API
    participant Redis

    Client->>API: WS upgrade /ws/dashboard?token=<JWT>
    API->>API: Verify JWT → extract org_id, user_id, role, department_id
    alt Token valid
        API-->>Client: 101 Switching Protocols
        API->>Redis: Subscribe org:{org_id}:workflows
        API->>Redis: Subscribe org:{org_id}:dept:{dept_id}
        API->>API: Send current queue state snapshot
        API-->>Client: { type: 'snapshot', workflows: [...] }
    else Token invalid/expired
        API-->>Client: 4001 Unauthorized (close frame)
    end

    loop On Redis pub/sub event
        Redis-->>API: Workflow event
        API-->>Client: { type: 'workflow_update', data: {...} }
    end

    Note over Client,API: Heartbeat every 30s to detect stale connections
    Client->>API: { type: 'ping' }
    API-->>Client: { type: 'pong' }
```

### 16.2 Token Refresh

- JWT has 1h expiry
- Client sends refresh request before expiry via WS message: `{ type: 'refresh', refreshToken: '...' }`
- Server validates refresh token, sends new JWT: `{ type: 'token', jwt: '...' }`
- No disconnection needed for refresh

---

## 17. UI States

Every view must handle 4 states. No empty screens, no hanging spinners, no cryptic errors.

### 17.1 State Definitions

| State | Visual | Implementation |
|---|---|---|
| **Loading** | Skeleton screens matching final layout shape. Subtle shimmer animation (warm gold tint). | shadcn Skeleton components. Staggered shimmer delay per element. |
| **Empty** | Illustration + contextual message + action. Not just "No data." | Per-view empty states (see below). Warm, encouraging tone. |
| **Error** | Toast notification (top-right, coral accent) + inline error with retry. | React Error Boundary at route level. Toast for transient errors. Inline for persistent. |
| **Success** | Brief toast (sage accent) + subtle animation on the affected element. | 3s auto-dismiss. Success confirms the action without blocking. |

### 17.2 Empty States Per View

**Guest Kiosk:** N/A — always shows input form.

**Staff Dashboard:**
```
┌──────────────────────────────┐
│                              │
│     ☕                       │
│     "All clear — no          │
│      pending requests"       │
│                              │
│     Your department is       │
│     caught up. Nice work.    │
│                              │
└──────────────────────────────┘
```

**Manager Analytics (no data yet):**
```
┌──────────────────────────────┐
│                              │
│     📊                       │
│     "Analytics will appear   │
│      as requests flow in"    │
│                              │
│     [▶ Run Simulation]       │
│     to generate demo data    │
│                              │
└──────────────────────────────┘
```

**Manager Escalation (no escalations):**
```
┌──────────────────────────────┐
│                              │
│     ✨                       │
│     "No escalations —        │
│      SLAs are holding"       │
│                              │
└──────────────────────────────┘
```

**Admin Audit Log (no entries):**
```
┌──────────────────────────────┐
│                              │
│     "Audit log is empty.     │
│      Activity will be        │
│      recorded as the         │
│      system is used."        │
│                              │
└──────────────────────────────┘
```

### 17.3 Skeleton Screens

```
Staff Dashboard skeleton:
┌──────┬──────────────────────────────────────┐
│ ░░░░ │  ░░░░░░░░░░   ░░░░░░░░░░            │
│ ░░░░ │  ┌──────────┐  ┌──────────┐         │
│ ░░░░ │  │ ░░░░░░░░ │  │ ░░░░░░░░ │         │
│ ░░░░ │  │ ░░░░░░   │  │ ░░░░░░   │         │
│ ░░░░ │  │ ░░░░     │  │ ░░░░     │         │
│      │  └──────────┘  └──────────┘         │
│      │  ┌──────────┐                        │
│      │  │ ░░░░░░░░ │                        │
│      │  │ ░░░░░░   │                        │
│      │  └──────────┘                        │
└──────┴──────────────────────────────────────┘

Shimmer: left-to-right warm gold gradient sweep, 1.5s, infinite
Stagger: 50ms delay between each skeleton card
```

### 17.4 Connection Status Indicator

All real-time views show a subtle connection status pill (top-right):

```
Connected:    ● Live          (sage dot, fades to 50% opacity when idle)
Reconnecting: ◐ Reconnecting  (yellow dot, pulse animation)
Disconnected: ● Offline        (coral dot, static) + "Retrying in 3s..."
```

---

## 18. Mobile Responsive Design

### 18.1 Guest Kiosk — Mobile First

The kiosk must work on:
- **Mounted tablet** (1024px) — landscape, larger touch targets
- **Guest's phone** (375px) — portrait, via QR code scan

```
Mobile (375px):                    Tablet (1024px):
┌─────────────────┐                ┌────────────────────────────────┐
│   HospiQ        │                │                                │
│                 │                │        HospiQ                  │
│  Room: [412]    │                │                                │
│                 │                │   Room: [412 ▼]                │
│     ╭────╮      │                │                                │
│     │ 🎤 │      │                │        ╭──────────╮            │
│     ╰────╯      │                │        │    🎤    │            │
│                 │                │        ╰──────────╯            │
│  ┌────────────┐ │                │                                │
│  │ Type here  │ │                │   ┌───────────────────────┐    │
│  └────────────┘ │                │   │ Or type your request  │    │
│                 │                │   └───────────────────────┘    │
│  Progress:      │                │                                │
│  ● ◐ ○ ○ ○ ○   │                │   ● Received  ◐ Processing... │
│  (horizontal)   │                │   ○ Routing   ○ Assigned      │
│                 │                │                                │
└─────────────────┘                └────────────────────────────────┘
```

**Key responsive decisions:**
- Progress stepper: horizontal dots on mobile, vertical list on tablet/desktop
- Mic button: smaller on mobile (56px), larger on tablet (80px)
- Room selector: simple number input on mobile, dropdown on tablet
- Animations: reduced motion on mobile (respect `prefers-reduced-motion`)

### 18.2 Staff Dashboard — Desktop Primary

Staff dashboards are desktop-first (staff use laptops/desktops at their station). But for a quick mobile check:

- Kanban → stacked list view on mobile (no horizontal scroll)
- Cards show condensed info (priority + room + summary only)
- Slide-out detail panel → full-screen modal on mobile
- Claim/Resolve actions remain accessible as bottom sheet buttons

---

## 19. Environment Variables

### 19.1 `.env.example`

```bash
# ──────────────────────────────────────
# HospiQ Environment Configuration
# Copy to .env and fill in values
# ──────────────────────────────────────

# ── Database ──
POSTGRES_DB=hospiq
POSTGRES_USER=hospiq
POSTGRES_PASSWORD=change_me_in_production
DATABASE_URL=postgres://hospiq:change_me_in_production@postgres:5432/hospiq

# ── Redis ──
REDIS_URL=redis://redis:6379

# ── Auth ──
JWT_SECRET=generate_a_random_32_char_string_here
JWT_EXPIRY=1h
REFRESH_TOKEN_EXPIRY=7d

# ── Encryption (pgcrypto) ──
ENCRYPTION_KEY=generate_a_random_64_char_hex_string_here

# ── AI Services ──
OLLAMA_URL=http://ollama:11434
OLLAMA_MODEL=llama3
WHISPER_URL=http://whisper:8080

# ── Observability ──
GRAFANA_PASSWORD=admin
LOKI_URL=http://loki:3100

# ── Application ──
NODE_ENV=development
API_PORT=4000
FRONTEND_URL=http://localhost:80
CORS_ORIGINS=http://localhost:80,http://localhost:3000

# ── Worker ──
WORKER_CONCURRENCY=5
MAX_RETRIES=3
CIRCUIT_BREAKER_THRESHOLD=3
CIRCUIT_BREAKER_RESET_MS=30000

# ── SLA Defaults (minutes, overridden by department settings) ──
SLA_LOW=120
SLA_MEDIUM=60
SLA_HIGH=30
SLA_CRITICAL=15
```

---

## 20. Comprehensive Seed Data

### 20.1 Organization

```typescript
const org = {
  name: "Hotel Mariana",
  slug: "hotel-mariana",
  settings: {
    timezone: "America/New_York",
    defaultLanguage: "en",
    supportedLanguages: ["en", "es", "zh", "fr", "ja", "ko", "ar", "pt"],
    retentionDays: 90,
    theme: { primaryColor: "#d4a574", logo: "/assets/hotel-mariana-logo.svg" }
  }
};
```

### 20.2 Departments (5)

| Name | Slug | SLA Config `{ low, medium, high, critical }` (min) | Escalation To |
|---|---|---|---|
| Maintenance | `maintenance` | `{ 120, 60, 30, 15 }` | Maria Torres (manager) |
| Housekeeping | `housekeeping` | `{ 90, 45, 20, 10 }` | Maria Torres (manager) |
| Concierge | `concierge` | `{ 60, 30, 15, 10 }` | Maria Torres (manager) |
| Front Desk | `front-desk` | `{ 30, 15, 10, 5 }` | Maria Torres (manager) |
| Kitchen / Room Service | `kitchen` | `{ 45, 25, 15, 10 }` | Carlos Rivera (manager) |

### 20.3 Users (12)

| Name | Role | Department | Email |
|---|---|---|---|
| **Demo Guest** | guest | — | guest@demo.hospiq.com |
| **Anonymous Guest** | guest | — | anon@demo.hospiq.com |
| Juan Hernandez | staff | Maintenance | juan@hotel-mariana.com |
| Pedro Santos | staff | Maintenance | pedro@hotel-mariana.com |
| Ana Garcia | staff | Housekeeping | ana@hotel-mariana.com |
| Lisa Chen | staff | Housekeeping | lisa@hotel-mariana.com |
| Sophie Dubois | staff | Concierge | sophie@hotel-mariana.com |
| James Wilson | staff | Front Desk | james@hotel-mariana.com |
| Yuki Tanaka | staff | Kitchen | yuki@hotel-mariana.com |
| Maria Torres | manager | — (all depts) | maria@hotel-mariana.com |
| Carlos Rivera | manager | Kitchen | carlos@hotel-mariana.com |
| **Admin** | admin | — | admin@hotel-mariana.com |

**Demo passwords:** All demo accounts use `demo2026` for easy judge access.

### 20.4 Rooms (33)

| Floor | Rooms | Zone |
|---|---|---|
| 1 | 101, 102, 103, 104, 105 | Lobby Wing |
| 2 | 201, 202, 203, 204, 205 | Garden Wing |
| 3 | 301, 302, 303, 304, 305 | Ocean Wing |
| 4 | 401, 402, 403, 404, 405, 410, 411, 412 | Penthouse Wing |
| 5 | 501, 502, 503, 504, 505 | Skyline Wing |
| 6 | 601, 602, 603, 604, 605 | Presidential Wing |

### 20.5 Pre-loaded Requests (8 — covering all states)

| # | Room | Language | Original Text | Translated | Status | Department | Priority | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | 412 | zh | "水龙头漏水很严重" | "The faucet is leaking badly" | **resolved** | Maintenance | High | Resolved by Juan, 22min response |
| 2 | 305 | en | "The drain in my bathroom is completely clogged" | — | **escalated** | Maintenance | High | SLA breached, escalated to Maria |
| 3 | 203 | es | "Necesitamos más toallas por favor" | "We need more towels please" | **claimed** | Housekeeping | Medium | Claimed by Ana |
| 4 | 103 | en | "Can someone help me connect to the WiFi?" | — | **in_progress** | Front Desk | Low | James helping remotely |
| 5 | 601 | ja | "エアコンが壊れています。とても暑いです" | "The air conditioner is broken. It is very hot" | **pending** | Maintenance | Critical | Just classified, waiting for staff |
| 6 | 302 | fr | "Pouvez-vous recommander un bon restaurant?" | "Can you recommend a good restaurant?" | **resolved** | Concierge | Low | Sophie resolved, 8min response |
| 7 | 201 | en | "There's a large spill in the lobby near the elevator" | — | **claimed** | Housekeeping | High | Lisa en route |
| 8 | 403 | ko | "룸서비스 메뉴를 받을 수 있나요?" | "Can I get a room service menu?" | **processing** | Kitchen | Low | Currently being classified by AI |

### 20.6 Pre-loaded Workflow Events (for timeline demos)

Request #1 (resolved — full lifecycle):
```
09:00:00  request.created        (system)    Guest submitted voice request
09:00:02  transcription.complete (system)    Whisper: zh detected, confidence 0.94
09:00:05  classification.complete(system)    Ollama: maintenance, high, confidence 0.91
09:00:05  workflow.created       (system)    SLA deadline: 09:30:00
09:00:12  workflow.claimed       (Juan)      "On my way to Room 412"
09:08:30  workflow.status_change (Juan)      in_progress → "Identified the issue"
09:22:00  workflow.resolved      (Juan)      "Replaced washer on faucet, leak fixed"
09:22:00  guest.feedback         (Guest)     👍 thumbs up
```

Request #2 (escalated — SLA breach):
```
08:15:00  request.created        (system)    Guest submitted text request
08:15:03  classification.complete(system)    Ollama: maintenance, high, confidence 0.87
08:15:03  workflow.created       (system)    SLA deadline: 08:45:00
08:45:00  workflow.sla_breach    (system)    30min SLA exceeded
08:45:00  workflow.escalated     (system)    Escalated to Maria Torres (manager)
08:50:00  workflow.comment       (Maria)     "All maintenance staff occupied. Calling contractor."
```

### 20.7 Pre-loaded Analytics Data

Seed 50 historical requests over the past 7 days to populate charts:
- Distribution across all 5 departments (weighted: maintenance 30%, housekeeping 25%, concierge 20%, front desk 15%, kitchen 10%)
- Languages: English 40%, Spanish 20%, Mandarin 15%, French 10%, Japanese 10%, Korean 5%
- Priorities: Low 35%, Medium 35%, High 20%, Critical 10%
- AI confidence: normal distribution centered at 0.88, std dev 0.08
- Resolution times: log-normal distribution, median 15min
- SLA compliance: 94% overall
- 3 past escalations with full event timelines

### 20.8 Pre-loaded Audit Log Entries

Seed ~100 audit log entries covering:
- Request lifecycle events (created, classified, assigned, resolved)
- User actions (login, claim, escalate, resolve, comment)
- Admin actions (department created, SLA updated, user invited)
- System events (circuit breaker opened/closed, SLA check fired)

This ensures the audit log page isn't empty and demonstrates the compliance story.

---

## 21. Updated Project Structure

```
hospiq/
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── .env                          # gitignored
├── .gitignore
├── nginx/
│   └── nginx.conf
├── apps/
│   ├── frontend/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── playwright.config.ts
│   │   ├── e2e/                           # Playwright tests
│   │   │   ├── fixtures/
│   │   │   │   ├── auth.ts
│   │   │   │   └── seed.ts
│   │   │   ├── guest-flow.spec.ts
│   │   │   ├── staff-flow.spec.ts
│   │   │   ├── realtime-sync.spec.ts
│   │   │   ├── escalation.spec.ts
│   │   │   ├── fault-tolerance.spec.ts
│   │   │   ├── analytics.spec.ts
│   │   │   ├── admin.spec.ts
│   │   │   └── demo-simulation.spec.ts
│   │   └── src/
│   │       ├── app/
│   │       │   ├── page.tsx                # Guest kiosk
│   │       │   ├── demo/page.tsx           # Demo landing
│   │       │   ├── dashboard/page.tsx      # Staff kanban
│   │       │   ├── manager/page.tsx        # Escalation center
│   │       │   ├── analytics/page.tsx      # Analytics + D3
│   │       │   ├── [orgSlug]/
│   │       │   │   └── room/
│   │       │   │       └── [roomNumber]/
│   │       │   │           └── page.tsx    # QR code landing → redirect
│   │       │   └── admin/
│   │       │       ├── page.tsx
│   │       │       ├── departments/page.tsx
│   │       │       ├── users/page.tsx
│   │       │       ├── rooms/page.tsx      # + QR generation
│   │       │       ├── integrations/page.tsx # Enterprise connectors
│   │       │       └── audit/page.tsx
│   │       ├── components/
│   │       │   ├── ui/                     # shadcn components
│   │       │   ├── shared/
│   │       │   │   ├── ConnectionStatus.tsx # Live/Reconnecting/Offline pill
│   │       │   │   ├── ErrorBoundary.tsx
│   │       │   │   ├── LoadingSkeleton.tsx  # Warm shimmer skeletons
│   │       │   │   ├── EmptyState.tsx       # Reusable empty state
│   │       │   │   └── Toast.tsx            # Styled toast notifications
│   │       │   ├── kiosk/
│   │       │   │   ├── VoiceRecorder.tsx
│   │       │   │   ├── WaveformVisualizer.tsx # Canvas audio waveform
│   │       │   │   ├── ProgressStepper.tsx
│   │       │   │   ├── RoomSelector.tsx
│   │       │   │   └── FeedbackPrompt.tsx
│   │       │   ├── dashboard/
│   │       │   │   ├── KanbanBoard.tsx
│   │       │   │   ├── WorkflowCard.tsx
│   │       │   │   ├── WorkflowDetail.tsx
│   │       │   │   ├── SLACountdown.tsx     # D3 radial arc
│   │       │   │   └── DashboardSkeleton.tsx
│   │       │   ├── analytics/
│   │       │   │   ├── KPICard.tsx
│   │       │   │   ├── StreamGraph.tsx      # D3
│   │       │   │   ├── DepartmentGauge.tsx  # D3
│   │       │   │   ├── ConfidenceHistogram.tsx # D3
│   │       │   │   ├── SLAComplianceArc.tsx # D3
│   │       │   │   ├── LiveFeed.tsx
│   │       │   │   ├── SystemHealth.tsx
│   │       │   │   └── AnalyticsSkeleton.tsx
│   │       │   ├── manager/
│   │       │   │   ├── EscalationCard.tsx
│   │       │   │   └── ClassificationOverride.tsx
│   │       │   └── admin/
│   │       │       └── QRCodeGenerator.tsx   # Generate + download QR
│   │       ├── hooks/
│   │       │   ├── useWebSocket.ts
│   │       │   ├── useSSE.ts
│   │       │   ├── useAnimatedNumber.ts
│   │       │   └── useConnectionStatus.ts   # Track WS/SSE health
│   │       └── lib/
│   │           ├── api.ts
│   │           ├── auth.ts                  # JWT helpers
│   │           └── d3/
│   │               ├── streamGraph.ts
│   │               ├── radialGauge.ts
│   │               ├── histogram.ts
│   │               └── slaArc.ts
│   ├── api/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── routes/
│   │       │   ├── auth.ts
│   │       │   ├── requests.ts
│   │       │   ├── workflows.ts
│   │       │   ├── analytics.ts
│   │       │   ├── admin.ts
│   │       │   ├── integrations.ts          # CRUD + test + logs
│   │       │   ├── health.ts
│   │       │   └── ws.ts
│   │       ├── services/
│   │       │   ├── ollama.ts
│   │       │   ├── whisper.ts
│   │       │   ├── sla.ts
│   │       │   └── encryption.ts
│   │       ├── integrations/
│   │       │   ├── registry.ts              # Adapter registry + dispatcher
│   │       │   ├── fieldMapper.ts           # Field mapping + transform engine
│   │       │   └── adapters/
│   │       │       ├── webhook.ts           # Generic webhook
│   │       │       ├── opera.ts             # Opera PMS
│   │       │       ├── slack.ts             # Slack messaging
│   │       │       ├── mews.ts              # Mews PMS (mocked)
│   │       │       └── jira.ts              # Jira ticketing (mocked)
│   │       ├── middleware/
│   │       │   ├── auth.ts
│   │       │   ├── rls.ts                   # Set Postgres RLS session vars
│   │       │   └── rateLimit.ts
│   │       └── lib/
│   │           ├── redis.ts
│   │           ├── circuitBreaker.ts
│   │           └── logger.ts
│   └── worker/
│       ├── Dockerfile
│       ├── package.json
│       └── src/
│           ├── index.ts
│           ├── processors/
│           │   ├── transcription.ts
│           │   ├── classification.ts
│           │   ├── notification.ts
│           │   ├── escalation.ts
│           │   └── integration.ts           # Outbound integration dispatcher
│           └── prompts/
│               └── classify.ts
├── packages/
│   └── db/
│       ├── package.json
│       ├── drizzle.config.ts
│       ├── schema/
│       │   ├── index.ts
│       │   ├── organizations.ts
│       │   ├── users.ts
│       │   ├── departments.ts
│       │   ├── rooms.ts
│       │   ├── requests.ts
│       │   ├── transcriptions.ts
│       │   ├── aiClassifications.ts
│       │   ├── workflows.ts
│       │   ├── workflowEvents.ts
│       │   ├── notifications.ts
│       │   ├── integrations.ts
│       │   ├── integrationEvents.ts
│       │   ├── fieldMappings.ts
│       │   └── auditLog.ts
│       ├── migrations/
│       ├── seed.ts                          # Comprehensive seed (20.1–20.8)
│       └── seed-data/
│           ├── organizations.ts
│           ├── departments.ts
│           ├── users.ts
│           ├── rooms.ts
│           ├── requests.ts                  # 8 demo + 50 historical
│           ├── workflows.ts
│           ├── workflowEvents.ts
│           ├── integrations.ts               # 3 demo integrations + events
│           └── auditLog.ts
├── scripts/
│   ├── setup.sh
│   ├── pull-model.sh
│   ├── simulate.ts
│   └── generate-qr.ts                      # CLI QR generation for rooms
└── docs/
    ├── plans/
    │   └── 2026-04-09-hospiq-design.md
    ├── TECH_DECISIONS.md
    └── ARCHITECTURE.md

---

## 23. Enterprise Integration System

Each organization may have their own property management system (PMS), ticketing platform, or internal tools. HospiQ supports configurable outbound integrations per org so workflows and events can be pushed to external systems automatically.

### 23.1 Integration Types

| Type | Description | Example |
|---|---|---|
| **Webhook** | POST JSON payload to a URL on workflow events | Custom internal API, Zapier, Make |
| **PMS Connector** | Pre-built adapter for hotel PMS systems | Opera PMS, Mews, Cloudbeds, Guesty |
| **Ticketing** | Push workflows as tickets to external systems | Jira, ServiceNow, Freshdesk |
| **Messaging** | Notify external channels on events | Slack, Microsoft Teams, WhatsApp Business |
| **Custom REST** | Org provides their own API spec, we map fields | Any REST API with configurable field mapping |

### 23.2 Data Model

```mermaid
erDiagram
    organizations ||--o{ integrations : "has"
    integrations ||--o{ integration_events : "logs"
    integrations ||--o{ field_mappings : "configures"

    integrations {
        uuid id PK
        uuid org_id FK
        text name
        enum type
        text provider
        jsonb config
        jsonb auth
        boolean active
        enum trigger_on
        text filter_departments
        timestamp created_at
        timestamp updated_at
    }

    integration_events {
        uuid id PK
        uuid integration_id FK
        uuid workflow_id FK
        enum status
        int http_status
        jsonb request_payload
        jsonb response_body
        int latency_ms
        text error
        timestamp created_at
    }

    field_mappings {
        uuid id PK
        uuid integration_id FK
        text source_field
        text target_field
        text transform
        timestamp created_at
    }
```

**`integrations` table details:**

```typescript
// config — varies by type
{
  // Webhook
  url: "https://hotel-api.example.com/workflows",
  method: "POST",
  headers: { "X-Hotel-ID": "mariana-001" },
  timeout_ms: 5000,

  // PMS Connector (Opera)
  pms_host: "opera.hotel-mariana.com",
  pms_version: "5.6",
  property_id: "MARIANA-NYC",

  // Ticketing (Jira)
  project_key: "MAINT",
  issue_type: "Task",
  base_url: "https://hotel-mariana.atlassian.net",

  // Messaging (Slack)
  webhook_url: "https://hooks.slack.com/services/T.../B.../xxx",
  channel: "#maintenance-alerts",
  mention_on_critical: "@here",
}

// auth — encrypted at rest (pgcrypto)
{
  type: "bearer" | "basic" | "api_key" | "oauth2",
  token: "...",           // bearer
  username: "...",        // basic
  password: "...",        // basic
  api_key: "...",         // api_key
  client_id: "...",       // oauth2
  client_secret: "...",   // oauth2
  token_url: "...",       // oauth2
  refresh_token: "...",   // oauth2
}

// trigger_on — when to fire this integration
"workflow.created" | "workflow.claimed" | "workflow.escalated" | 
"workflow.resolved" | "request.created" | "sla.breached" | "all"

// filter_departments — optional, comma-separated department IDs
// null = all departments trigger this integration
```

### 23.3 Field Mapping System

Organizations have different schemas in their external systems. The field mapping lets admins configure how HospiQ data maps to their API:

```
HospiQ Field              →  Target Field           Transform
─────────────────────────────────────────────────────────────
workflow.id               →  external_ref_id         none
workflow.priority          →  urgency_level          map: { critical: 1, high: 2, medium: 3, low: 4 }
workflow.department.name   →  department_code        uppercase
request.translated         →  description            truncate:500
request.room.number        →  location               prefix:"Room "
request.original_lang      →  guest_language         iso639_to_name
workflow.sla_deadline      →  due_date               iso8601
workflow.assigned_to.name  →  technician             none
ai_classification.summary  →  ai_notes               none
```

**Built-in transforms:**
- `none` — pass through as-is
- `uppercase` / `lowercase`
- `truncate:N` — limit string length
- `prefix:"str"` / `suffix:"str"`
- `map:{ key: value }` — value mapping
- `iso8601` — format timestamp
- `iso639_to_name` — language code to name ("zh" → "Chinese")
- `template:"Room {value}, Floor {workflow.room.floor}"` — string interpolation

### 23.4 Integration Execution Flow

```mermaid
sequenceDiagram
    participant Worker
    participant PG as PostgreSQL
    participant Redis
    participant IntWorker as Integration Worker
    participant External as External API

    Note over Worker,External: Workflow event triggers integrations

    Worker->>PG: INSERT workflow_event (e.g., 'resolved')
    Worker->>Redis: Enqueue → 'integration' queue (workflow_id, event_type)

    Redis->>IntWorker: Dequeue integration job
    IntWorker->>PG: SELECT integrations WHERE org_id = :org AND trigger_on = :event AND active = true
    IntWorker->>PG: SELECT field_mappings for each integration

    loop For each matching integration
        IntWorker->>IntWorker: Build payload using field mappings + transforms
        IntWorker->>IntWorker: Resolve auth (decrypt credentials, refresh OAuth if needed)
        IntWorker->>External: POST/PUT payload to configured URL
        alt Success (2xx)
            IntWorker->>PG: INSERT integration_event (status: 'success', http_status, latency)
        else Failure (4xx/5xx/timeout)
            IntWorker->>PG: INSERT integration_event (status: 'failed', error)
            IntWorker->>Redis: Re-enqueue with backoff (max 3 retries)
        else Auth expired (401)
            IntWorker->>IntWorker: Attempt OAuth token refresh
            IntWorker->>External: Retry with new token
        end
    end
```

### 23.5 Pre-built PMS Connectors

For the demo, we implement one real connector pattern and mock the rest:

**Opera PMS Adapter (example):**
```typescript
// apps/api/src/integrations/adapters/opera.ts
class OperaAdapter implements IntegrationAdapter {
  // Maps HospiQ workflow → Opera Work Order format
  mapPayload(workflow, mappings) {
    return {
      workOrder: {
        propertyId: this.config.property_id,
        type: "GUEST_REQUEST",
        room: workflow.request.room.number,
        department: workflow.department.slug.toUpperCase(),
        priority: this.mapPriority(workflow.priority),
        description: workflow.request.translated || workflow.request.original_text,
        dueDate: workflow.sla_deadline,
        status: this.mapStatus(workflow.status),
        aiMetadata: {
          confidence: workflow.ai_classification.confidence,
          originalLanguage: workflow.request.original_lang,
        }
      }
    };
  }
}
```

**Available adapters:**
| Adapter | Status | Notes |
|---|---|---|
| Generic Webhook | Implemented | Works with any REST API |
| Opera PMS | Implemented | Full work order sync |
| Slack | Implemented | Rich message with workflow card |
| Mews | Mocked | Documented interface, placeholder adapter |
| Jira | Mocked | Documented interface, placeholder adapter |

### 23.6 Admin UI — Integration Management

New admin page: `/admin/integrations`

```
┌─────────────────────────────────────────────────────────────┐
│  Integrations                            [+ Add Integration] │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Opera PMS              ● Active     Webhook           │  │
│  │  Triggers: workflow.created, workflow.resolved          │  │
│  │  Departments: Maintenance, Housekeeping                │  │
│  │  Last sync: 2min ago ✓  │  Success rate: 98.2%        │  │
│  │  [Edit] [Test] [Logs] [Disable]                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Slack #maintenance     ● Active     Messaging         │  │
│  │  Triggers: workflow.escalated, sla.breached            │  │
│  │  Departments: All                                      │  │
│  │  Last sync: 14min ago ✓ │  Success rate: 100%         │  │
│  │  [Edit] [Test] [Logs] [Disable]                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Jira Service Desk      ○ Disabled   Ticketing         │  │
│  │  Triggers: workflow.created                            │  │
│  │  Last sync: 3 days ago ✗ │  [Enable] [Delete]         │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  Integration Event Log                                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 09:22 ✓ Opera PMS    workflow.resolved   201  42ms  │   │
│  │ 09:22 ✓ Slack        workflow.resolved   200  380ms │   │
│  │ 09:10 ✗ Opera PMS    workflow.created    503  5001ms│   │
│  │         ↳ Retried → ✓ 201  38ms                     │   │
│  │ 09:05 ✓ Opera PMS    workflow.created    201  45ms  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**"Test" button:** Sends a mock workflow payload to the configured endpoint. Shows request/response in a modal. Validates the connection without creating real data.

**Field mapping editor:**
```
┌──────────────────────────────────────────────────────┐
│  Field Mapping — Opera PMS                            │
│                                                      │
│  HospiQ Field          →   Target Field    Transform │
│  ┌──────────────────┐     ┌────────────┐  ┌───────┐ │
│  │ workflow.id       │  →  │ ref_id     │  │ none  │ │
│  ├──────────────────┤     ├────────────┤  ├───────┤ │
│  │ workflow.priority │  →  │ urgency    │  │ map ▼ │ │
│  ├──────────────────┤     ├────────────┤  ├───────┤ │
│  │ request.room.num │  →  │ location   │  │prefix │ │
│  └──────────────────┘     └────────────┘  └───────┘ │
│                                                      │
│  [+ Add Mapping]              [Save] [Send Test]     │
└──────────────────────────────────────────────────────┘
```

### 23.7 Seed Data — Demo Integrations

```typescript
// Pre-configured for Hotel Mariana demo
const integrations = [
  {
    name: "Opera PMS",
    type: "pms",
    provider: "opera",
    trigger_on: "all",
    filter_departments: null, // all departments
    config: { pms_host: "demo.opera-pms.local", property_id: "MARIANA-NYC" },
    auth: { type: "bearer", token: "demo-token-opera" },
    active: true,
    // 15 integration_events showing successful syncs over past 7 days
  },
  {
    name: "Slack #maintenance-alerts",
    type: "messaging",
    provider: "slack",
    trigger_on: "workflow.escalated,sla.breached",
    filter_departments: null,
    config: { webhook_url: "https://hooks.slack.com/demo", channel: "#maintenance-alerts" },
    auth: { type: "api_key", api_key: "demo-slack-key" },
    active: true,
    // 3 integration_events for past escalations
  },
  {
    name: "Jira Service Desk",
    type: "ticketing",
    provider: "jira",
    trigger_on: "workflow.created",
    config: { project_key: "MAINT", base_url: "https://demo.atlassian.net" },
    auth: { type: "basic", username: "demo", password: "demo" },
    active: false, // disabled — shows the disable state in UI
  }
];
```

---

## 22. Updated Implementation Priority

**Phase 1 — Core (MVP that demos the full flow):**
1. Docker Compose with all 10 services booting
2. Drizzle schema + migrations + comprehensive seed data
3. Elysia API: request submission → Redis queue → worker → Ollama → workflow
4. WebSocket + SSE real-time updates
5. Guest kiosk (text input + progress stepper) — mobile responsive
6. Staff dashboard (kanban + claim flow)
7. Loading skeletons + error boundaries + connection status

**Phase 2 — Polish (make it impressive):**
8. Voice input (Whisper integration + waveform visualizer)
9. D3 analytics dashboard (stream graph, radial gauges, histogram, SLA arc)
10. SLA timers + auto-escalation
11. Manager escalation view with AI override
12. Animations + transitions (framer-motion) — all views
13. Circuit breaker + fault tolerance
14. QR code generation + room URL routing
15. Enterprise integration system (webhook adapter + Opera adapter + Slack adapter + field mapping engine)

**Phase 3 — Testing & Presentation:**
16. Playwright E2E tests (all 8 suites + integration admin tests)
17. Demo landing page + simulation script
18. Admin settings panel + integration management UI
19. TECH_DECISIONS.md writeup
20. Architecture diagram (polished Mermaid → SVG)
21. README with setup instructions + demo GIF (captured from Playwright)
22. Record Playwright `realtime-sync` test as the hero demo video
