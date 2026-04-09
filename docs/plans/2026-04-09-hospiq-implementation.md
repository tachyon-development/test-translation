# HospiQ Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a real-time AI-powered hospitality workflow system where guests submit requests (voice/text), AI classifies and routes them, staff manages via live dashboard, and managers monitor analytics — all running in Docker Compose with 10 services.

**Architecture:** Bun monorepo with 3 apps (frontend/api/worker) + shared db package. Elysia API with WebSocket + SSE for real-time. BullMQ on Redis for job queues. Ollama + Whisper for AI. PostgreSQL with Drizzle ORM, RLS, and pgcrypto. Next.js + shadcn/ui + D3 frontend.

**Tech Stack:** Bun, TypeScript, Next.js 14, Elysia, Drizzle ORM, PostgreSQL 16, Redis 7, BullMQ, Ollama (llama3), Whisper.cpp, D3.js, shadcn/ui, framer-motion, Playwright, Docker Compose, nginx

**Design Doc:** `docs/plans/2026-04-09-hospiq-design.md` — all sections referenced below as "Design S.X"

---

## Phase 1 — Core (MVP that demos the full flow)

### Task 1: Project Scaffolding + Docker Compose

**Files:**
- Create: `package.json` (workspace root)
- Create: `bunfig.toml`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `.env`
- Create: `docker-compose.yml`
- Create: `docker-compose.dev.yml`
- Create: `nginx/nginx.conf`
- Create: `apps/api/package.json`
- Create: `apps/api/Dockerfile`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/index.ts`
- Create: `apps/worker/package.json`
- Create: `apps/worker/Dockerfile`
- Create: `apps/worker/tsconfig.json`
- Create: `apps/worker/src/index.ts`
- Create: `apps/frontend/package.json`
- Create: `apps/frontend/Dockerfile`
- Create: `apps/frontend/tsconfig.json`
- Create: `apps/frontend/next.config.ts`
- Create: `apps/frontend/src/app/layout.tsx`
- Create: `apps/frontend/src/app/page.tsx`
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/drizzle.config.ts`

**Step 1: Initialize git repo**

```bash
cd /Users/tobrien/development/test
git init
```

**Step 2: Create root workspace**

`package.json`:
```json
{
  "name": "hospiq",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build",
    "db:generate": "bun --filter @hospiq/db drizzle-kit generate",
    "db:migrate": "bun --filter @hospiq/db drizzle-kit migrate",
    "db:seed": "bun --filter @hospiq/db run seed",
    "db:push": "bun --filter @hospiq/db drizzle-kit push"
  }
}
```

`bunfig.toml`:
```toml
[install]
peer = false
```

`.gitignore`:
```
node_modules/
.env
dist/
.next/
*.tsbuildinfo
drizzle/meta/
```

**Step 3: Create .env.example and .env**

Copy the full env block from Design S.19. Create `.env` as a copy.

**Step 4: Create docker-compose.yml**

10 services as specified in Design S.8:
- `postgres` (postgres:16-alpine) — port 5432, volume for data, healthcheck
- `redis` (redis:7-alpine) — port 6379, healthcheck
- `ollama` (ollama/ollama) — port 11434, volume for models
- `whisper` (fedirz/faster-whisper-server) — port 8080
- `api` (build ./apps/api) — port 4000, depends on postgres + redis
- `worker` (build ./apps/worker) — deploy replicas 2, depends on postgres + redis + ollama + whisper
- `frontend` (build ./apps/frontend) — port 3000, depends on api
- `nginx` (nginx:alpine) — port 80, depends on frontend + api
- `loki` (grafana/loki:2.9.0) — port 3100
- `grafana` (grafana/grafana:latest) — port 3001, depends on loki

All services share a `hospiq` network. Pass env vars from `.env`.

**Step 5: Create nginx.conf**

`nginx/nginx.conf`:
```nginx
events {
    worker_connections 1024;
}

http {
    upstream frontend {
        server frontend:3000;
    }

    upstream api {
        server api:4000;
    }

    server {
        listen 80;

        # API routes
        location /api/ {
            proxy_pass http://api;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_read_timeout 300s;

            # SSE support
            proxy_buffering off;
            proxy_cache off;
        }

        # WebSocket
        location /ws/ {
            proxy_pass http://api;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_read_timeout 86400s;
        }

        # Frontend (default)
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        # Next.js HMR WebSocket (dev)
        location /_next/webpack-hmr {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }

        client_max_body_size 10M;
    }
}
```

**Step 6: Create API app skeleton**

`apps/api/package.json`:
```json
{
  "name": "@hospiq/api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "start": "bun src/index.ts"
  },
  "dependencies": {
    "elysia": "^1.2",
    "@elysiajs/cors": "^1.2",
    "@hospiq/db": "workspace:*",
    "bullmq": "^5.0",
    "ioredis": "^5.0",
    "jose": "^6.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.7"
  }
}
```

`apps/api/Dockerfile`:
```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lockb* ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/

RUN bun install --frozen-lockfile

COPY packages/db ./packages/db
COPY apps/api ./apps/api

WORKDIR /app/apps/api
EXPOSE 4000
CMD ["bun", "src/index.ts"]
```

`apps/api/src/index.ts`:
```typescript
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";

const app = new Elysia()
  .use(cors())
  .get("/api/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))
  .listen(4000);

console.log(`API running on port ${app.server?.port}`);
```

**Step 7: Create Worker app skeleton**

`apps/worker/package.json`:
```json
{
  "name": "@hospiq/worker",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "start": "bun src/index.ts"
  },
  "dependencies": {
    "@hospiq/db": "workspace:*",
    "bullmq": "^5.0",
    "ioredis": "^5.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.7"
  }
}
```

`apps/worker/Dockerfile`:
```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lockb* ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/db/package.json ./packages/db/

RUN bun install --frozen-lockfile

COPY packages/db ./packages/db
COPY apps/worker ./apps/worker

WORKDIR /app/apps/worker
CMD ["bun", "src/index.ts"]
```

`apps/worker/src/index.ts`:
```typescript
import { Worker } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

console.log("Worker starting...");

// Placeholder — processors added in Task 5
const worker = new Worker(
  "transcription",
  async (job) => {
    console.log(`Processing job ${job.id}: ${job.name}`);
  },
  { connection }
);

worker.on("ready", () => console.log("Worker ready"));
worker.on("failed", (job, err) => console.error(`Job ${job?.id} failed:`, err.message));
```

**Step 8: Create Frontend app skeleton**

`apps/frontend/package.json`:
```json
{
  "name": "@hospiq/frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack -p 3000",
    "build": "next build",
    "start": "next start -p 3000"
  },
  "dependencies": {
    "next": "^15.0",
    "react": "^19.0",
    "react-dom": "^19.0"
  },
  "devDependencies": {
    "@types/node": "^22",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "typescript": "^5.7",
    "tailwindcss": "^4.0",
    "@tailwindcss/postcss": "^4.0",
    "postcss": "^8.5"
  }
}
```

`apps/frontend/Dockerfile`:
```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lockb* ./
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/db/package.json ./packages/db/

RUN bun install --frozen-lockfile

COPY apps/frontend ./apps/frontend
COPY packages/db ./packages/db

WORKDIR /app/apps/frontend
RUN bun run build

EXPOSE 3000
CMD ["bun", "run", "start"]
```

`apps/frontend/next.config.ts`:
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
```

`apps/frontend/src/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HospiQ",
  description: "Real-Time AI-Powered Hospitality Workflow System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0f0f17] text-[#e8e4df] antialiased">
        {children}
      </body>
    </html>
  );
}
```

`apps/frontend/src/app/globals.css`:
```css
@import "tailwindcss";

:root {
  --bg-primary: #0f0f17;
  --bg-secondary: #1a1a2e;
  --bg-elevated: #222238;
  --bg-surface: #2a2a42;
  --text-primary: #e8e4df;
  --text-secondary: #9a9486;
  --text-accent: #d4a574;
  --accent: #d4a574;
  --accent-glow: #d4a57433;
  --status-success: #7c9885;
  --status-warning: #c9a84c;
  --status-danger: #c17767;
  --status-info: #6b8cae;
  --status-pending: #8a7fb5;
  --priority-low: #5a6e5f;
  --priority-medium: #6b8cae;
  --priority-high: #c9a84c;
  --priority-critical: #c17767;
}
```

`apps/frontend/src/app/page.tsx`:
```tsx
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-4xl font-bold text-[var(--text-accent)]">HospiQ</h1>
    </main>
  );
}
```

**Step 9: Create DB package skeleton**

`packages/db/package.json`:
```json
{
  "name": "@hospiq/db",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "generate": "drizzle-kit generate",
    "migrate": "drizzle-kit migrate",
    "push": "drizzle-kit push",
    "seed": "bun src/seed.ts",
    "studio": "drizzle-kit studio"
  },
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schema/index.ts"
  },
  "dependencies": {
    "drizzle-orm": "^0.38",
    "postgres": "^3.4"
  },
  "devDependencies": {
    "drizzle-kit": "^0.30",
    "typescript": "^5.7"
  }
}
```

`packages/db/drizzle.config.ts`:
```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgres://hospiq:change_me_in_production@localhost:5432/hospiq",
  },
});
```

**Step 10: Install dependencies and verify Docker boots**

```bash
cd /Users/tobrien/development/test
bun install
docker compose up --build -d
```

Expected: All 10 containers start. `curl http://localhost/api/health` returns `{"status":"ok"}`.

**Step 11: Commit**

```bash
git add -A
git commit -m "feat: project scaffolding with Docker Compose (10 services)"
```

---

### Task 2: Drizzle Schema + Migrations

**Files:**
- Create: `packages/db/src/index.ts`
- Create: `packages/db/src/schema/index.ts`
- Create: `packages/db/src/schema/organizations.ts`
- Create: `packages/db/src/schema/users.ts`
- Create: `packages/db/src/schema/departments.ts`
- Create: `packages/db/src/schema/rooms.ts`
- Create: `packages/db/src/schema/requests.ts`
- Create: `packages/db/src/schema/transcriptions.ts`
- Create: `packages/db/src/schema/aiClassifications.ts`
- Create: `packages/db/src/schema/workflows.ts`
- Create: `packages/db/src/schema/workflowEvents.ts`
- Create: `packages/db/src/schema/notifications.ts`
- Create: `packages/db/src/schema/integrations.ts`
- Create: `packages/db/src/schema/integrationEvents.ts`
- Create: `packages/db/src/schema/fieldMappings.ts`
- Create: `packages/db/src/schema/auditLog.ts`

**Step 1: Create database connection module**

`packages/db/src/index.ts`:
```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL || "postgres://hospiq:change_me_in_production@localhost:5432/hospiq";
const client = postgres(connectionString);
export const db = drizzle(client, { schema });

export type Database = typeof db;
export { schema };
```

**Step 2: Create all schema files**

Follow Design S.4 exactly. Each table gets its own file. Use `pgTable` from drizzle-orm/pg-core. Key details:

- All tables use UUID primary keys via `uuid("id").defaultRandom().primaryKey()`
- All tables with `org_id` get a foreign key to organizations
- Enum types: `userRole` (guest/staff/manager/admin), `requestStatus` (queued/processing/classified/manual_review/completed/failed), `workflowStatus` (pending/claimed/in_progress/escalated/resolved/cancelled), `workflowEventType` (created/claimed/status_change/escalated/resolved/comment/sla_breach/reassigned), `urgency` (low/medium/high/critical), `notificationType` (assignment/escalation/resolution/sla_warning), `integrationTrigger`, `integrationStatus`, `integrationType`, `authType`
- Indexes as specified in Design S.4.2

`packages/db/src/schema/organizations.ts`:
```typescript
import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  settings: jsonb("settings").$type<{
    timezone: string;
    defaultLanguage: string;
    supportedLanguages: string[];
    retentionDays: number;
    theme?: { primaryColor: string; logo: string };
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

`packages/db/src/schema/users.ts`:
```typescript
import { pgTable, uuid, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { departments } from "./departments";

export const userRoleEnum = pgEnum("user_role", ["guest", "staff", "manager", "admin"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => organizations.id).notNull(),
  name: text("name").notNull(),
  role: userRoleEnum("role").notNull(),
  departmentId: uuid("department_id").references(() => departments.id),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

`packages/db/src/schema/departments.ts`:
```typescript
import { pgTable, uuid, text, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const departments = pgTable("departments", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => organizations.id).notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  slaConfig: jsonb("sla_config").$type<{ low: number; medium: number; high: number; critical: number }>().notNull(),
  escalationTo: uuid("escalation_to"), // FK to users, set after users table exists
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

`packages/db/src/schema/rooms.ts`:
```typescript
import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const rooms = pgTable("rooms", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => organizations.id).notNull(),
  number: text("number").notNull(),
  floor: integer("floor").notNull(),
  zone: text("zone"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

`packages/db/src/schema/requests.ts`:
```typescript
import { pgTable, uuid, text, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";
import { rooms } from "./rooms";

export const requestStatusEnum = pgEnum("request_status", [
  "queued", "processing", "classified", "manual_review", "completed", "failed"
]);

export const requests = pgTable("requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => organizations.id).notNull(),
  guestId: uuid("guest_id").references(() => users.id),
  roomId: uuid("room_id").references(() => rooms.id),
  originalText: text("original_text"),
  originalLang: text("original_lang"),
  translated: text("translated"),
  audioUrl: text("audio_url"),
  status: requestStatusEnum("status").default("queued").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("requests_org_status_created_idx").on(table.orgId, table.status, table.createdAt),
]);
```

`packages/db/src/schema/transcriptions.ts`:
```typescript
import { pgTable, uuid, text, real, integer, timestamp } from "drizzle-orm/pg-core";
import { requests } from "./requests";

export const transcriptions = pgTable("transcriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  requestId: uuid("request_id").references(() => requests.id).notNull(),
  audioUrl: text("audio_url"),
  sourceLang: text("source_lang"),
  transcript: text("transcript"),
  confidence: real("confidence"),
  durationMs: integer("duration_ms"),
  processedAt: timestamp("processed_at").defaultNow().notNull(),
});
```

`packages/db/src/schema/aiClassifications.ts`:
```typescript
import { pgTable, uuid, text, real, jsonb, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { requests } from "./requests";
import { departments } from "./departments";

export const urgencyEnum = pgEnum("urgency", ["low", "medium", "high", "critical"]);

export const aiClassifications = pgTable("ai_classifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  requestId: uuid("request_id").references(() => requests.id).notNull(),
  model: text("model"),
  aiCategory: text("ai_category"),
  matchedDepartmentId: uuid("matched_department_id").references(() => departments.id),
  urgency: urgencyEnum("urgency"),
  summary: text("summary"),
  confidence: real("confidence"),
  rawResponse: jsonb("raw_response"),
  processedAt: timestamp("processed_at").defaultNow().notNull(),
});
```

`packages/db/src/schema/workflows.ts`:
```typescript
import { pgTable, uuid, timestamp, boolean, text, pgEnum, index } from "drizzle-orm/pg-core";
import { requests } from "./requests";
import { organizations } from "./organizations";
import { departments } from "./departments";
import { users } from "./users";
import { urgencyEnum } from "./aiClassifications";

export const workflowStatusEnum = pgEnum("workflow_status", [
  "pending", "claimed", "in_progress", "escalated", "resolved", "cancelled"
]);

export const workflows = pgTable("workflows", {
  id: uuid("id").defaultRandom().primaryKey(),
  requestId: uuid("request_id").references(() => requests.id).notNull(),
  orgId: uuid("org_id").references(() => organizations.id).notNull(),
  departmentId: uuid("department_id").references(() => departments.id),
  assignedTo: uuid("assigned_to").references(() => users.id),
  priority: urgencyEnum("priority").default("medium").notNull(),
  slaDeadline: timestamp("sla_deadline"),
  escalated: boolean("escalated").default(false).notNull(),
  escalatedTo: uuid("escalated_to").references(() => users.id),
  escalatedAt: timestamp("escalated_at"),
  resolvedAt: timestamp("resolved_at"),
  resolutionNote: text("resolution_note"),
  status: workflowStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("workflows_org_dept_status_idx").on(table.orgId, table.departmentId, table.status),
  index("workflows_sla_deadline_idx").on(table.slaDeadline),
]);
```

`packages/db/src/schema/workflowEvents.ts`:
```typescript
import { pgTable, uuid, jsonb, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { workflows } from "./workflows";
import { users } from "./users";

export const workflowEventTypeEnum = pgEnum("workflow_event_type", [
  "created", "claimed", "status_change", "escalated", "resolved", "comment", "sla_breach", "reassigned"
]);

export const workflowEvents = pgTable("workflow_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  workflowId: uuid("workflow_id").references(() => workflows.id).notNull(),
  actorId: uuid("actor_id").references(() => users.id),
  eventType: workflowEventTypeEnum("event_type").notNull(),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("workflow_events_workflow_created_idx").on(table.workflowId, table.createdAt),
]);
```

`packages/db/src/schema/notifications.ts`:
```typescript
import { pgTable, uuid, jsonb, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { requests } from "./requests";
import { users } from "./users";

export const notificationTypeEnum = pgEnum("notification_type", [
  "assignment", "escalation", "resolution", "sla_warning"
]);

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  requestId: uuid("request_id").references(() => requests.id),
  userId: uuid("user_id").references(() => users.id),
  type: notificationTypeEnum("type").notNull(),
  payload: jsonb("payload"),
  delivered: boolean("delivered").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

`packages/db/src/schema/integrations.ts`:
```typescript
import { pgTable, uuid, text, jsonb, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const integrationTypeEnum = pgEnum("integration_type", [
  "webhook", "pms", "ticketing", "messaging", "custom_rest"
]);

export const integrationTriggerEnum = pgEnum("integration_trigger", [
  "workflow.created", "workflow.claimed", "workflow.escalated",
  "workflow.resolved", "request.created", "sla.breached", "all"
]);

export const integrations = pgTable("integrations", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => organizations.id).notNull(),
  name: text("name").notNull(),
  type: integrationTypeEnum("type").notNull(),
  provider: text("provider"),
  config: jsonb("config").notNull(),
  auth: jsonb("auth"),
  active: boolean("active").default(true).notNull(),
  triggerOn: integrationTriggerEnum("trigger_on").default("all").notNull(),
  filterDepartments: text("filter_departments"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

`packages/db/src/schema/integrationEvents.ts`:
```typescript
import { pgTable, uuid, integer, jsonb, timestamp, text, pgEnum } from "drizzle-orm/pg-core";
import { integrations } from "./integrations";
import { workflows } from "./workflows";

export const integrationEventStatusEnum = pgEnum("integration_event_status", [
  "success", "failed", "pending"
]);

export const integrationEvents = pgTable("integration_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  integrationId: uuid("integration_id").references(() => integrations.id).notNull(),
  workflowId: uuid("workflow_id").references(() => workflows.id),
  status: integrationEventStatusEnum("status").notNull(),
  httpStatus: integer("http_status"),
  requestPayload: jsonb("request_payload"),
  responseBody: jsonb("response_body"),
  latencyMs: integer("latency_ms"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

`packages/db/src/schema/fieldMappings.ts`:
```typescript
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { integrations } from "./integrations";

export const fieldMappings = pgTable("field_mappings", {
  id: uuid("id").defaultRandom().primaryKey(),
  integrationId: uuid("integration_id").references(() => integrations.id).notNull(),
  sourceField: text("source_field").notNull(),
  targetField: text("target_field").notNull(),
  transform: text("transform").default("none").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

`packages/db/src/schema/auditLog.ts`:
```typescript
import { pgTable, uuid, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";

export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => organizations.id).notNull(),
  actorId: uuid("actor_id").references(() => users.id),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: uuid("resource_id"),
  metadata: jsonb("metadata"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("audit_log_org_created_idx").on(table.orgId, table.createdAt),
]);
```

`packages/db/src/schema/index.ts`:
```typescript
export * from "./organizations";
export * from "./users";
export * from "./departments";
export * from "./rooms";
export * from "./requests";
export * from "./transcriptions";
export * from "./aiClassifications";
export * from "./workflows";
export * from "./workflowEvents";
export * from "./notifications";
export * from "./integrations";
export * from "./integrationEvents";
export * from "./fieldMappings";
export * from "./auditLog";
```

**Step 3: Generate and run migrations**

```bash
cd /Users/tobrien/development/test
bun run db:push
```

Expected: All tables created in PostgreSQL.

**Step 4: Verify by connecting to psql**

```bash
docker exec -it hospiq-postgres-1 psql -U hospiq -d hospiq -c "\dt"
```

Expected: 14 tables listed.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: Drizzle schema for all 14 tables with indexes"
```

---

### Task 3: Comprehensive Seed Data

**Files:**
- Create: `packages/db/src/seed.ts`
- Create: `packages/db/src/seed-data/organizations.ts`
- Create: `packages/db/src/seed-data/departments.ts`
- Create: `packages/db/src/seed-data/users.ts`
- Create: `packages/db/src/seed-data/rooms.ts`
- Create: `packages/db/src/seed-data/requests.ts`
- Create: `packages/db/src/seed-data/workflows.ts`
- Create: `packages/db/src/seed-data/workflowEvents.ts`
- Create: `packages/db/src/seed-data/integrations.ts`
- Create: `packages/db/src/seed-data/auditLog.ts`

**Step 1: Create seed data modules**

Follow Design S.20 exactly:
- 1 organization ("Hotel Mariana")
- 5 departments with SLA configs (Design S.20.2)
- 12 users with roles (Design S.20.3), password hash `demo2026` using Bun's `Bun.password.hash`
- 33 rooms across 6 floors (Design S.20.4)
- 8 pre-loaded requests in all states (Design S.20.5)
- Workflow events for requests #1 and #2 (Design S.20.6)
- 50 historical requests for analytics (Design S.20.7)
- 3 integrations (Opera, Slack, Jira) (Design S.23.7)
- ~100 audit log entries (Design S.20.8)

Each seed-data file exports an array or function that returns insertable data. Use deterministic UUIDs (e.g., `const ORG_ID = "00000000-0000-0000-0000-000000000001"`) so foreign keys can reference them.

**Step 2: Create main seed runner**

`packages/db/src/seed.ts`:
```typescript
import { db } from "./index";
import * as schema from "./schema";
import { seedOrganizations } from "./seed-data/organizations";
import { seedDepartments } from "./seed-data/departments";
import { seedUsers } from "./seed-data/users";
import { seedRooms } from "./seed-data/rooms";
import { seedRequests } from "./seed-data/requests";
import { seedWorkflows } from "./seed-data/workflows";
import { seedWorkflowEvents } from "./seed-data/workflowEvents";
import { seedIntegrations } from "./seed-data/integrations";
import { seedAuditLog } from "./seed-data/auditLog";

async function seed() {
  console.log("Seeding database...");

  // Clear in reverse dependency order
  await db.delete(schema.auditLog);
  await db.delete(schema.integrationEvents);
  await db.delete(schema.fieldMappings);
  await db.delete(schema.integrations);
  await db.delete(schema.notifications);
  await db.delete(schema.workflowEvents);
  await db.delete(schema.workflows);
  await db.delete(schema.aiClassifications);
  await db.delete(schema.transcriptions);
  await db.delete(schema.requests);
  await db.delete(schema.rooms);
  await db.delete(schema.users);
  await db.delete(schema.departments);
  await db.delete(schema.organizations);

  await seedOrganizations(db);
  await seedDepartments(db);
  await seedUsers(db);
  await seedRooms(db);
  const { requestIds } = await seedRequests(db);
  await seedWorkflows(db, requestIds);
  await seedWorkflowEvents(db);
  await seedIntegrations(db);
  await seedAuditLog(db);

  console.log("Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
```

**Step 3: Run the seed**

```bash
DATABASE_URL=postgres://hospiq:change_me_in_production@localhost:5432/hospiq bun run db:seed
```

Expected: "Seed complete!" with all data inserted.

**Step 4: Verify seed data**

```bash
docker exec -it hospiq-postgres-1 psql -U hospiq -d hospiq -c "SELECT count(*) FROM users; SELECT count(*) FROM requests; SELECT count(*) FROM workflows;"
```

Expected: 12 users, 58 requests (8 demo + 50 historical), matching workflow count.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: comprehensive seed data (Hotel Mariana demo)"
```

---

### Task 4: Auth System (JWT)

**Files:**
- Create: `apps/api/src/lib/auth.ts`
- Create: `apps/api/src/middleware/auth.ts`
- Create: `apps/api/src/routes/auth.ts`

**Step 1: Create JWT utilities**

`apps/api/src/lib/auth.ts`:
```typescript
import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-me");

export interface JWTPayload {
  sub: string; // user_id
  orgId: string;
  role: "guest" | "staff" | "manager" | "admin";
  departmentId?: string;
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(process.env.JWT_EXPIRY || "1h")
    .setIssuedAt()
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, secret);
  return payload as unknown as JWTPayload;
}
```

**Step 2: Create auth middleware**

`apps/api/src/middleware/auth.ts`:
```typescript
import { Elysia } from "elysia";
import { verifyToken, type JWTPayload } from "../lib/auth";

export const authMiddleware = new Elysia({ name: "auth" })
  .derive(async ({ headers }) => {
    const authHeader = headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return { user: null as JWTPayload | null };
    }
    try {
      const token = authHeader.slice(7);
      const user = await verifyToken(token);
      return { user };
    } catch {
      return { user: null as JWTPayload | null };
    }
  });

export const requireAuth = new Elysia({ name: "requireAuth" })
  .use(authMiddleware)
  .onBeforeHandle(({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
  });

export const requireRole = (...roles: string[]) =>
  new Elysia({ name: `requireRole:${roles.join(",")}` })
    .use(requireAuth)
    .onBeforeHandle(({ user, set }) => {
      if (!user || !roles.includes(user.role)) {
        set.status = 403;
        return { error: "Forbidden" };
      }
    });
```

**Step 3: Create auth routes**

`apps/api/src/routes/auth.ts`:
```typescript
import { Elysia, t } from "elysia";
import { db } from "@hospiq/db";
import { users } from "@hospiq/db/schema";
import { eq, and } from "drizzle-orm";
import { signToken } from "../lib/auth";

export const authRoutes = new Elysia({ prefix: "/api/auth" })
  .post("/login", async ({ body, set }) => {
    const { email, password } = body;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      set.status = 401;
      return { error: "Invalid credentials" };
    }

    const valid = await Bun.password.verify(password, user.passwordHash);
    if (!valid) {
      set.status = 401;
      return { error: "Invalid credentials" };
    }

    const token = await signToken({
      sub: user.id,
      orgId: user.orgId,
      role: user.role,
      departmentId: user.departmentId ?? undefined,
    });

    return { token, user: { id: user.id, name: user.name, role: user.role, email: user.email } };
  }, {
    body: t.Object({
      email: t.String(),
      password: t.String(),
    }),
  });
```

**Step 4: Wire auth routes into main app**

Update `apps/api/src/index.ts` to `.use(authRoutes)`.

**Step 5: Test login manually**

```bash
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hotel-mariana.com","password":"demo2026"}'
```

Expected: `{ "token": "eyJ...", "user": { ... } }`

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: JWT auth system with login endpoint"
```

---

### Task 5: Request Submission + Worker Pipeline

**Files:**
- Create: `apps/api/src/lib/redis.ts`
- Create: `apps/api/src/lib/queue.ts`
- Create: `apps/api/src/routes/requests.ts`
- Modify: `apps/api/src/index.ts` — add routes
- Create: `apps/worker/src/processors/transcription.ts`
- Create: `apps/worker/src/processors/classification.ts`
- Create: `apps/worker/src/processors/notification.ts`
- Create: `apps/worker/src/processors/escalation.ts`
- Create: `apps/worker/src/prompts/classify.ts`
- Modify: `apps/worker/src/index.ts` — register processors

**Step 1: Create Redis + queue utilities**

`apps/api/src/lib/redis.ts`:
```typescript
import IORedis from "ioredis";

export const redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const redisSub = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});
```

`apps/api/src/lib/queue.ts`:
```typescript
import { Queue } from "bullmq";
import { redis } from "./redis";

export const transcriptionQueue = new Queue("transcription", { connection: redis });
export const classificationQueue = new Queue("classification", { connection: redis });
export const notificationQueue = new Queue("notification", { connection: redis });
export const escalationQueue = new Queue("escalation-check", { connection: redis });
export const integrationQueue = new Queue("integration", { connection: redis });
```

**Step 2: Create request submission routes**

`apps/api/src/routes/requests.ts`:
```typescript
import { Elysia, t } from "elysia";
import { db } from "@hospiq/db";
import { requests } from "@hospiq/db/schema";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";
import { classificationQueue, transcriptionQueue } from "../lib/queue";
import { redis } from "../lib/redis";

export const requestRoutes = new Elysia({ prefix: "/api/requests" })
  // Text request (no auth required for guests)
  .post("/", async ({ body, set }) => {
    const { text, room_number, lang, org_id } = body;

    // Look up room
    const [room] = await db.query.rooms.findMany({
      where: (r, { eq, and }) => and(eq(r.number, room_number), eq(r.orgId, org_id)),
      limit: 1,
    });

    const [request] = await db.insert(requests).values({
      orgId: org_id,
      roomId: room?.id,
      originalText: text,
      originalLang: lang || "en",
      status: "queued",
    }).returning();

    // Skip transcription, go straight to classification
    await classificationQueue.add("classify", {
      requestId: request.id,
      text,
      orgId: org_id,
    }, {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
    });

    return { request_id: request.id };
  }, {
    body: t.Object({
      text: t.String(),
      room_number: t.String(),
      lang: t.Optional(t.String()),
      org_id: t.String(),
    }),
  })

  // Voice request
  .post("/voice", async ({ body, set }) => {
    const { audio, room_number, org_id } = body;

    // Save audio to a temporary location (in production: S3)
    const audioBuffer = await audio.arrayBuffer();
    const audioPath = `/tmp/audio-${Date.now()}.webm`;
    await Bun.write(audioPath, audioBuffer);

    const [room] = await db.query.rooms.findMany({
      where: (r, { eq, and }) => and(eq(r.number, room_number), eq(r.orgId, org_id)),
      limit: 1,
    });

    const [request] = await db.insert(requests).values({
      orgId: org_id,
      roomId: room?.id,
      audioUrl: audioPath,
      status: "queued",
    }).returning();

    // Enqueue transcription first
    await transcriptionQueue.add("transcribe", {
      requestId: request.id,
      audioPath,
      orgId: org_id,
    }, {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
    });

    return { request_id: request.id };
  }, {
    body: t.Object({
      audio: t.File(),
      room_number: t.String(),
      org_id: t.String(),
    }),
  })

  // Status polling fallback
  .get("/:id/status", async ({ params }) => {
    const [request] = await db.query.requests.findMany({
      where: (r, { eq }) => eq(r.id, params.id),
      limit: 1,
    });

    if (!request) return { error: "Not found" };
    return { status: request.status, translated: request.translated };
  })

  // SSE stream for guest
  .get("/:id/stream", async ({ params, set }) => {
    set.headers["content-type"] = "text/event-stream";
    set.headers["cache-control"] = "no-cache";
    set.headers["connection"] = "keep-alive";

    const requestId = params.id;
    const channel = `request:${requestId}:status`;

    return new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const sub = redis.duplicate();

        sub.subscribe(channel);
        sub.on("message", (_ch: string, message: string) => {
          controller.enqueue(encoder.encode(`data: ${message}\n\n`));
        });

        // Send initial heartbeat
        controller.enqueue(encoder.encode(`data: {"type":"connected"}\n\n`));

        // Cleanup on close
        const interval = setInterval(() => {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        }, 15000);

        // Store cleanup refs
        (controller as any)._cleanup = () => {
          clearInterval(interval);
          sub.unsubscribe(channel);
          sub.disconnect();
        };
      },
      cancel(controller) {
        (controller as any)?._cleanup?.();
      },
    });
  });
```

**Step 3: Create worker processors**

`apps/worker/src/prompts/classify.ts`:
```typescript
export function buildClassifyPrompt(text: string, departments: string[]): string {
  return `You are a hotel request classifier. Analyze the guest request and respond with ONLY valid JSON.

Available departments: ${departments.join(", ")}

Guest request: "${text}"

Respond with this exact JSON structure:
{
  "translated": "<English translation if not already English, otherwise same text>",
  "department": "<one of the available departments>",
  "urgency": "<low|medium|high|critical>",
  "summary": "<brief English summary, max 100 chars>"
}

Rules:
- "critical" = safety hazard, flood, fire, medical
- "high" = broken essential (AC, plumbing, lock)
- "medium" = comfort/convenience (towels, amenities)
- "low" = information request, nice-to-have`;
}
```

`apps/worker/src/processors/classification.ts`:
```typescript
import { Job } from "bullmq";
import { db } from "@hospiq/db";
import { requests, aiClassifications, workflows, workflowEvents, departments } from "@hospiq/db/schema";
import { eq, and } from "drizzle-orm";
import IORedis from "ioredis";
import { Queue } from "bullmq";
import { buildClassifyPrompt } from "../prompts/classify";

const redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

const escalationQueue = new Queue("escalation-check", { connection: redis.duplicate() });

const OLLAMA_URL = process.env.OLLAMA_URL || "http://ollama:11434";

export async function processClassification(job: Job) {
  const { requestId, text, orgId } = job.data;

  // Update request status
  await db.update(requests).set({ status: "processing" }).where(eq(requests.id, requestId));
  await redis.publish(`request:${requestId}:status`, JSON.stringify({ type: "processing", step: "classifying" }));

  // Get available departments
  const depts = await db.select().from(departments).where(eq(departments.orgId, orgId));
  const deptNames = depts.map((d) => d.slug);

  // Call Ollama
  const prompt = buildClassifyPrompt(text, deptNames);
  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.OLLAMA_MODEL || "llama3", prompt, stream: false }),
  });

  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status}`);
  }

  const result = await response.json();
  const parsed = JSON.parse(result.response);

  // Find matching department
  const matchedDept = depts.find((d) => d.slug === parsed.department) || depts[0];

  // Save classification
  await db.insert(aiClassifications).values({
    requestId,
    model: process.env.OLLAMA_MODEL || "llama3",
    aiCategory: parsed.department,
    matchedDepartmentId: matchedDept.id,
    urgency: parsed.urgency,
    summary: parsed.summary,
    confidence: 0.9, // Ollama doesn't provide confidence, use default
    rawResponse: result,
  });

  // Update request
  await db.update(requests).set({
    status: "classified",
    translated: parsed.translated,
  }).where(eq(requests.id, requestId));

  await redis.publish(`request:${requestId}:status`, JSON.stringify({
    type: "classified",
    department: matchedDept.name,
    urgency: parsed.urgency,
    summary: parsed.summary,
  }));

  // Create workflow
  const slaMinutes = matchedDept.slaConfig?.[parsed.urgency as keyof typeof matchedDept.slaConfig] || 60;
  const slaDeadline = new Date(Date.now() + slaMinutes * 60 * 1000);

  const [workflow] = await db.insert(workflows).values({
    requestId,
    orgId,
    departmentId: matchedDept.id,
    priority: parsed.urgency,
    slaDeadline,
    status: "pending",
  }).returning();

  await db.insert(workflowEvents).values({
    workflowId: workflow.id,
    eventType: "created",
    payload: { summary: parsed.summary, department: matchedDept.name },
  });

  // Publish for staff dashboard
  await redis.publish(`org:${orgId}:workflows`, JSON.stringify({
    type: "workflow_created",
    workflow: { ...workflow, department: matchedDept, summary: parsed.summary },
  }));
  await redis.publish(`org:${orgId}:dept:${matchedDept.id}`, JSON.stringify({
    type: "workflow_created",
    workflow: { ...workflow, department: matchedDept, summary: parsed.summary },
  }));

  await redis.publish(`request:${requestId}:status`, JSON.stringify({
    type: "routed",
    department: matchedDept.name,
    priority: parsed.urgency,
    slaDeadline: slaDeadline.toISOString(),
  }));

  // Schedule SLA escalation check
  await escalationQueue.add("check", {
    workflowId: workflow.id,
    orgId,
  }, {
    delay: slaMinutes * 60 * 1000,
    attempts: 1,
  });

  return { workflowId: workflow.id };
}
```

`apps/worker/src/processors/transcription.ts`:
```typescript
import { Job } from "bullmq";
import { db } from "@hospiq/db";
import { requests, transcriptions } from "@hospiq/db/schema";
import { eq } from "drizzle-orm";
import { Queue } from "bullmq";
import IORedis from "ioredis";

const redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});
const classificationQueue = new Queue("classification", { connection: redis.duplicate() });

const WHISPER_URL = process.env.WHISPER_URL || "http://whisper:8080";

export async function processTranscription(job: Job) {
  const { requestId, audioPath, orgId } = job.data;

  await redis.publish(`request:${requestId}:status`, JSON.stringify({ type: "processing", step: "transcribing" }));

  // Send to Whisper
  const audioFile = Bun.file(audioPath);
  const formData = new FormData();
  formData.append("file", audioFile);
  formData.append("response_format", "json");

  const response = await fetch(`${WHISPER_URL}/v1/audio/transcriptions`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Whisper returned ${response.status}`);
  }

  const result = await response.json();
  const transcript = result.text;
  const lang = result.language || "unknown";

  // Save transcription
  await db.insert(transcriptions).values({
    requestId,
    audioUrl: audioPath,
    sourceLang: lang,
    transcript,
    confidence: result.confidence || 0.9,
  });

  // Update request
  await db.update(requests).set({
    originalText: transcript,
    originalLang: lang,
  }).where(eq(requests.id, requestId));

  await redis.publish(`request:${requestId}:status`, JSON.stringify({
    type: "transcribed",
    text: transcript,
    lang,
  }));

  // Chain to classification
  await classificationQueue.add("classify", {
    requestId,
    text: transcript,
    orgId,
  }, {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
  });
}
```

`apps/worker/src/processors/escalation.ts`:
```typescript
import { Job } from "bullmq";
import { db } from "@hospiq/db";
import { workflows, workflowEvents, departments } from "@hospiq/db/schema";
import { eq } from "drizzle-orm";
import IORedis from "ioredis";

const redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export async function processEscalation(job: Job) {
  const { workflowId, orgId } = job.data;

  const [workflow] = await db.select().from(workflows).where(eq(workflows.id, workflowId));

  if (!workflow || workflow.status === "resolved" || workflow.status === "cancelled") {
    return; // No-op if already resolved
  }

  // Still pending or claimed — escalate
  const [dept] = await db.select().from(departments).where(eq(departments.id, workflow.departmentId!));

  await db.update(workflows).set({
    status: "escalated",
    escalated: true,
    escalatedTo: dept?.escalationTo,
    escalatedAt: new Date(),
  }).where(eq(workflows.id, workflowId));

  await db.insert(workflowEvents).values({
    workflowId,
    eventType: "sla_breach",
    payload: { previousStatus: workflow.status },
  });

  await db.insert(workflowEvents).values({
    workflowId,
    eventType: "escalated",
    payload: { escalatedTo: dept?.escalationTo },
  });

  // Notify
  await redis.publish(`org:${orgId}:workflows`, JSON.stringify({
    type: "workflow_escalated",
    workflowId,
  }));
}
```

`apps/worker/src/processors/notification.ts`:
```typescript
import { Job } from "bullmq";
import IORedis from "ioredis";

const redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export async function processNotification(job: Job) {
  const { channel, message } = job.data;
  await redis.publish(channel, JSON.stringify(message));
}
```

**Step 4: Update worker index to register all processors**

`apps/worker/src/index.ts`:
```typescript
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { processTranscription } from "./processors/transcription";
import { processClassification } from "./processors/classification";
import { processEscalation } from "./processors/escalation";
import { processNotification } from "./processors/notification";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

console.log("Worker starting...");

const transcriptionWorker = new Worker("transcription", processTranscription, {
  connection: connection.duplicate(),
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || "5"),
});

const classificationWorker = new Worker("classification", processClassification, {
  connection: connection.duplicate(),
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || "5"),
});

const escalationWorker = new Worker("escalation-check", processEscalation, {
  connection: connection.duplicate(),
  concurrency: 2,
});

const notificationWorker = new Worker("notification", processNotification, {
  connection: connection.duplicate(),
  concurrency: 10,
});

const workers = [transcriptionWorker, classificationWorker, escalationWorker, notificationWorker];

for (const w of workers) {
  w.on("ready", () => console.log(`${w.name} worker ready`));
  w.on("failed", (job, err) => console.error(`${w.name} job ${job?.id} failed:`, err.message));
  w.on("completed", (job) => console.log(`${w.name} job ${job.id} completed`));
}

process.on("SIGTERM", async () => {
  console.log("Shutting down workers...");
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
});
```

**Step 5: Test the full pipeline**

```bash
# Submit a text request
curl -X POST http://localhost/api/requests \
  -H "Content-Type: application/json" \
  -d '{"text":"My faucet is leaking badly","room_number":"412","org_id":"<ORG_ID>"}'
```

Expected: Returns `{ "request_id": "..." }`. Worker logs show classification job processing. Ollama translates and classifies. Workflow created in DB.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: request submission pipeline (text + voice → classify → workflow)"
```

---

### Task 6: Workflow Management Routes

**Files:**
- Create: `apps/api/src/routes/workflows.ts`
- Modify: `apps/api/src/index.ts` — add routes

**Step 1: Create workflow CRUD routes**

`apps/api/src/routes/workflows.ts` — implements all routes from Design S.6.3:
- `GET /api/workflows` — list with filters (dept, status, priority), requires auth
- `GET /api/workflows/:id` — detail with events timeline
- `POST /api/workflows/:id/claim` — staff claims task, publishes update
- `PATCH /api/workflows/:id/status` — update status (in_progress, resolved)
- `POST /api/workflows/:id/escalate` — manual escalation
- `POST /api/workflows/:id/comment` — add note as workflow_event
- `PATCH /api/workflows/:id/classify` — manager override classification

Each mutation publishes to Redis pub/sub channels for real-time updates.

**Step 2: Wire into main app and test**

```bash
# Login as staff
TOKEN=$(curl -s http://localhost/api/auth/login -H "Content-Type: application/json" -d '{"email":"juan@hotel-mariana.com","password":"demo2026"}' | jq -r .token)

# List workflows
curl http://localhost/api/workflows -H "Authorization: Bearer $TOKEN"

# Claim one
curl -X POST http://localhost/api/workflows/<ID>/claim -H "Authorization: Bearer $TOKEN"
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: workflow management routes (list, claim, resolve, escalate)"
```

---

### Task 7: WebSocket for Staff Dashboard

**Files:**
- Create: `apps/api/src/routes/ws.ts`
- Modify: `apps/api/src/index.ts` — add WS route

**Step 1: Create WebSocket handler**

`apps/api/src/routes/ws.ts`:
```typescript
import { Elysia } from "elysia";
import { verifyToken } from "../lib/auth";
import { redisSub } from "../lib/redis";
import { db } from "@hospiq/db";
import { workflows, departments, requests, aiClassifications } from "@hospiq/db/schema";
import { eq, and, inArray } from "drizzle-orm";

export const wsRoutes = new Elysia()
  .ws("/ws/dashboard", {
    async open(ws) {
      const url = new URL(ws.data.request.url);
      const token = url.searchParams.get("token");

      if (!token) {
        ws.close(4001, "Missing token");
        return;
      }

      try {
        const user = await verifyToken(token);
        (ws.data as any).user = user;

        // Subscribe to org-level and dept-level channels
        const channels = [`org:${user.orgId}:workflows`];
        if (user.departmentId) {
          channels.push(`org:${user.orgId}:dept:${user.departmentId}`);
        }

        // Use a dedicated subscriber per connection
        const sub = redisSub.duplicate();
        (ws.data as any).sub = sub;

        for (const ch of channels) {
          await sub.subscribe(ch);
        }

        sub.on("message", (_channel: string, message: string) => {
          ws.send(message);
        });

        // Send current snapshot
        const activeWorkflows = await db.query.workflows.findMany({
          where: (w, { eq, and, notInArray }) =>
            and(
              eq(w.orgId, user.orgId),
              notInArray(w.status, ["resolved", "cancelled"])
            ),
          with: {
            department: true,
            request: true,
          },
        });

        ws.send(JSON.stringify({ type: "snapshot", workflows: activeWorkflows }));
      } catch {
        ws.close(4001, "Invalid token");
      }
    },
    message(ws, message) {
      // Handle ping/pong
      try {
        const data = JSON.parse(String(message));
        if (data.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch {}
    },
    close(ws) {
      const sub = (ws.data as any).sub;
      if (sub) {
        sub.unsubscribe();
        sub.disconnect();
      }
    },
  });
```

**Step 2: Wire into main app and test with wscat**

```bash
# Install wscat if needed: bun add -g wscat
TOKEN=$(curl -s http://localhost/api/auth/login -H "Content-Type: application/json" -d '{"email":"juan@hotel-mariana.com","password":"demo2026"}' | jq -r .token)
wscat -c "ws://localhost/ws/dashboard?token=$TOKEN"
```

Expected: Receives snapshot of active workflows. New requests trigger live updates.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: WebSocket for staff real-time dashboard updates"
```

---

### Task 8: Analytics + Health + Admin Routes

**Files:**
- Create: `apps/api/src/routes/analytics.ts`
- Create: `apps/api/src/routes/health.ts`
- Create: `apps/api/src/routes/admin.ts`
- Modify: `apps/api/src/index.ts` — add all routes

**Step 1: Create analytics routes (Design S.6.4)**

KPI queries: active count, avg response time, resolution rate, SLA miss %. Cache in Redis with 10s TTL.

**Step 2: Create health routes (Design S.6.7)**

Check Ollama, Whisper, Postgres, Redis connectivity.

**Step 3: Create admin routes (Design S.6.5)**

CRUD for departments, rooms, users. Paginated audit log. All require admin role.

**Step 4: Wire all routes and test**

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: analytics, health check, and admin routes"
```

---

### Task 9: Frontend — shadcn/ui Setup + Design System

**Files:**
- Create: `apps/frontend/src/components/ui/` (shadcn components)
- Create: `apps/frontend/src/lib/utils.ts`
- Create: `apps/frontend/tailwind.config.ts`
- Create: `apps/frontend/src/app/fonts.ts`
- Modify: `apps/frontend/src/app/layout.tsx`

**Step 1: Initialize shadcn/ui**

```bash
cd apps/frontend
bunx shadcn@latest init
```

Configure with the HospiQ color palette from Design S.7.1. Add components: button, card, input, select, badge, dialog, toast, skeleton, tabs, table, dropdown-menu.

**Step 2: Set up typography**

Import Cormorant Garamond (display), DM Sans (body), JetBrains Mono (mono) from Google Fonts via `next/font`.

**Step 3: Create shared components**

- `ConnectionStatus.tsx` — Live/Reconnecting/Offline pill (Design S.17.4)
- `LoadingSkeleton.tsx` — Warm shimmer skeletons (Design S.17.3)
- `EmptyState.tsx` — Reusable empty state with icon + message + action
- `ErrorBoundary.tsx` — Route-level error boundary

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: shadcn/ui + design system + shared components"
```

---

### Task 10: Guest Kiosk View

**Files:**
- Create: `apps/frontend/src/lib/api.ts`
- Create: `apps/frontend/src/hooks/useSSE.ts`
- Create: `apps/frontend/src/components/kiosk/RoomSelector.tsx`
- Create: `apps/frontend/src/components/kiosk/ProgressStepper.tsx`
- Create: `apps/frontend/src/components/kiosk/FeedbackPrompt.tsx`
- Modify: `apps/frontend/src/app/page.tsx`

**Step 1: Create API client**

`apps/frontend/src/lib/api.ts` — fetch wrapper with base URL, auth headers, error handling.

**Step 2: Create useSSE hook**

`apps/frontend/src/hooks/useSSE.ts` — connects to `/api/requests/:id/stream`, parses events, auto-reconnects, exposes `{ status, lastEvent, connected }`.

**Step 3: Build kiosk components**

Follow Design S.7.2 wireframe exactly:
- Room selector (input/dropdown)
- Text input area
- Submit button
- Progress stepper with 6 steps: Received, Transcribing, Understanding, Routing, Assigned, Resolved
- Each step animates based on SSE events
- Feedback prompt at resolution

**Step 4: Build the kiosk page**

`apps/frontend/src/app/page.tsx` — full-screen centered layout. Room selector, text input, submit. On submit: creates request via API, opens SSE, shows progress stepper.

Support `?room=412` URL param for QR code pre-fill.

**Step 5: Test manually**

Open `http://localhost` in browser. Select room, type request, submit. Watch stepper progress.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: guest kiosk with text input + real-time progress stepper"
```

---

### Task 11: Staff Dashboard (Kanban)

**Files:**
- Create: `apps/frontend/src/hooks/useWebSocket.ts`
- Create: `apps/frontend/src/hooks/useConnectionStatus.ts`
- Create: `apps/frontend/src/lib/auth.ts` (client-side)
- Create: `apps/frontend/src/components/dashboard/KanbanBoard.tsx`
- Create: `apps/frontend/src/components/dashboard/WorkflowCard.tsx`
- Create: `apps/frontend/src/components/dashboard/WorkflowDetail.tsx`
- Create: `apps/frontend/src/components/dashboard/SLACountdown.tsx`
- Create: `apps/frontend/src/components/dashboard/DashboardSkeleton.tsx`
- Create: `apps/frontend/src/app/dashboard/page.tsx`

**Step 1: Create useWebSocket hook**

Connects to `/ws/dashboard?token=<JWT>`. Handles snapshot, workflow_created, workflow_updated, workflow_escalated events. Auto-reconnects with backoff.

**Step 2: Build SLA Countdown component**

SVG radial arc. Full circle depletes clockwise. Color: sage → yellow → coral based on time remaining. Uses `requestAnimationFrame` for smooth updates.

**Step 3: Build WorkflowCard**

Card per Design S.7.3:
- Left border color = priority
- Room number, summary, SLA countdown
- Confidence score (muted)
- Click → opens detail panel

**Step 4: Build KanbanBoard**

4 columns: Pending, Claimed, In Progress, Escalated. Cards grouped by status. Filters for department and priority.

**Step 5: Build WorkflowDetail slide-out panel**

Right-side panel (400px). Shows full request details, timeline of events, action buttons (Claim, Resolve, Escalate, Comment).

**Step 6: Build dashboard page**

Sidebar (departments, queue count, SLA %) + main kanban area. Login redirect if no token.

**Step 7: Test end-to-end**

Open kiosk + dashboard side by side. Submit request on kiosk. Watch card appear on dashboard in real-time.

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: staff dashboard with real-time kanban board"
```

---

### Task 12: Loading Skeletons + Error Boundaries + Connection Status

**Files:**
- Modify: `apps/frontend/src/app/dashboard/page.tsx` — add skeleton
- Modify: `apps/frontend/src/app/page.tsx` — add error handling
- Add connection status pill to all real-time views

**Step 1: Add dashboard skeleton**

Follow Design S.17.3 — sidebar skeleton + card grid skeleton with warm gold shimmer.

**Step 2: Add error boundaries**

Wrap each route in ErrorBoundary. Toast for transient errors (API failures). Inline retry for persistent errors.

**Step 3: Add connection status**

Top-right pill on dashboard and kiosk: green "Live", yellow pulsing "Reconnecting", red "Offline" with retry countdown.

**Step 4: Add empty states**

Per Design S.17.2 — "All clear" for empty dashboard, etc.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: loading skeletons, error boundaries, connection status"
```

---

## Phase 2 — Polish (make it impressive)

### Task 13: Voice Input (Whisper Integration)

**Files:**
- Create: `apps/frontend/src/components/kiosk/VoiceRecorder.tsx`
- Create: `apps/frontend/src/components/kiosk/WaveformVisualizer.tsx`
- Modify: `apps/frontend/src/app/page.tsx` — add mic button

**Step 1: Build VoiceRecorder**

Hold-to-record microphone button with Web Audio API. Captures audio as WebM. Pulsing warm glow while recording.

**Step 2: Build WaveformVisualizer**

Canvas-based real-time audio waveform using AnalyserNode. Shows levels during recording.

**Step 3: Wire voice recording to API**

On release: POST audio to `/api/requests/voice`. SSE progress shows "Transcribing" step.

**Step 4: Test with actual speech**

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: voice input with waveform visualizer"
```

---

### Task 14: D3 Analytics Dashboard

**Files:**
- Create: `apps/frontend/src/lib/d3/streamGraph.ts`
- Create: `apps/frontend/src/lib/d3/radialGauge.ts`
- Create: `apps/frontend/src/lib/d3/histogram.ts`
- Create: `apps/frontend/src/lib/d3/slaArc.ts`
- Create: `apps/frontend/src/components/analytics/KPICard.tsx`
- Create: `apps/frontend/src/components/analytics/StreamGraph.tsx`
- Create: `apps/frontend/src/components/analytics/DepartmentGauge.tsx`
- Create: `apps/frontend/src/components/analytics/ConfidenceHistogram.tsx`
- Create: `apps/frontend/src/components/analytics/SLAComplianceArc.tsx`
- Create: `apps/frontend/src/components/analytics/LiveFeed.tsx`
- Create: `apps/frontend/src/components/analytics/SystemHealth.tsx`
- Create: `apps/frontend/src/components/analytics/AnalyticsSkeleton.tsx`
- Create: `apps/frontend/src/app/analytics/page.tsx`

**Step 1: Build D3 visualization modules**

Follow Design S.7.4 exactly:
- Stream graph: `d3.stack()` + `d3.curveBasis`, layers per department, smooth transitions
- Radial gauge: one ring per department, fill = active/capacity, color transitions
- Confidence histogram: bars with 0.7 threshold line, trend overlay
- SLA compliance arc: radial arc, percentage center, color by threshold

**Step 2: Build KPI cards**

4 cards with animated counters (framer-motion `useSpring`). Delta indicators stagger in. Design S.7.4 layout.

**Step 3: Build LiveFeed**

Scrolling event timeline. New events push in from top with animation.

**Step 4: Build SystemHealth**

Health bar showing service status dots. Polls `/api/health/services` every 30s.

**Step 5: Assemble analytics page**

Full layout per Design S.7.4 wireframe: KPIs top row, 2x2 chart grid, live feed right, health bar bottom.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: D3 analytics dashboard with 4 custom visualizations"
```

---

### Task 15: SLA Timers + Auto-Escalation

Already implemented in worker (Task 5 escalation processor). This task wires the UI:

**Files:**
- Modify: `apps/frontend/src/components/dashboard/WorkflowCard.tsx` — escalation visual
- Modify: `apps/frontend/src/components/dashboard/SLACountdown.tsx` — color transitions

**Step 1:** SLA countdown transitions sage → yellow at 50% → coral at 0%. Pulse animation when breached.

**Step 2:** Escalated cards show red border, shake animation, escalation badge.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: SLA timer UI with color transitions and escalation alerts"
```

---

### Task 16: Manager Escalation View

**Files:**
- Create: `apps/frontend/src/components/manager/EscalationCard.tsx`
- Create: `apps/frontend/src/components/manager/ClassificationOverride.tsx`
- Create: `apps/frontend/src/app/manager/page.tsx`

**Step 1:** Build escalation center per Design S.7.5. Compact KPIs + escalated workflow list.

**Step 2:** Override dept dropdown, reassign, resolve, add note actions.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: manager escalation view with AI classification override"
```

---

### Task 17: Animations + Transitions (framer-motion)

**Files:**
- Install: `framer-motion`
- Modify: all component files to add motion

**Step 1:** Spring-based animations per Design S.7.1 Motion Philosophy:
- Staggered card entrances (50ms delay)
- Fluid number counters on KPI cards
- New card slides up + warm glow pulse
- Escalation: shake + red pulse
- Resolution: compress + slide to resolved with green shimmer
- FLIP animations for kanban column transitions

**Step 2:** Background particles on kiosk (warm gold, low opacity, slow drift).

**Step 3:** Glass morphism on modals (backdrop-blur with warm tint).

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: framer-motion animations across all views"
```

---

### Task 18: Circuit Breaker + Fault Tolerance

**Files:**
- Create: `apps/api/src/lib/circuitBreaker.ts`
- Modify: `apps/worker/src/processors/classification.ts` — add circuit breaker
- Modify: `apps/worker/src/processors/transcription.ts` — add circuit breaker

**Step 1: Implement circuit breaker**

3 states: CLOSED → OPEN (after N failures) → HALF-OPEN (after timeout). Per Design S.11 and S.3.3.

When OPEN: classification jobs go to `manual_review` with "AI unavailable" badge. Whisper jobs queue in DLQ.

**Step 2: Add manual classification UI**

Staff sees "Needs Manual Classification" badge. Can manually assign department + priority.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: circuit breaker for AI services + manual review fallback"
```

---

### Task 19: QR Code System

**Files:**
- Create: `apps/frontend/src/components/admin/QRCodeGenerator.tsx`
- Create: `apps/frontend/src/app/[orgSlug]/room/[roomNumber]/page.tsx`
- Create: `scripts/generate-qr.ts`
- Modify: `apps/frontend/src/app/admin/rooms/page.tsx` — add QR button

**Step 1:** QR code route: `/:orgSlug/room/:roomNumber` → redirects to `/?room=412&org=hotel-mariana` (Design S.15).

**Step 2:** QR generation in admin: SVG via `qrcode` npm package. Download as PNG. Batch download as ZIP.

**Step 3:** CLI script for batch QR generation.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: QR code system for room URLs"
```

---

### Task 20: Enterprise Integration System

**Files:**
- Create: `apps/api/src/integrations/registry.ts`
- Create: `apps/api/src/integrations/fieldMapper.ts`
- Create: `apps/api/src/integrations/adapters/webhook.ts`
- Create: `apps/api/src/integrations/adapters/opera.ts`
- Create: `apps/api/src/integrations/adapters/slack.ts`
- Create: `apps/api/src/integrations/adapters/mews.ts`
- Create: `apps/api/src/integrations/adapters/jira.ts`
- Create: `apps/api/src/routes/integrations.ts`
- Create: `apps/worker/src/processors/integration.ts`

**Step 1:** Build adapter registry + field mapping engine (Design S.23.3-23.4).

**Step 2:** Implement webhook, Opera PMS, and Slack adapters (Design S.23.5).

**Step 3:** Implement integration CRUD routes (Design S.6.6).

**Step 4:** Integration worker processor — dispatches to matching adapters on workflow events.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: enterprise integration system with webhook, Opera, Slack adapters"
```

---

## Phase 3 — Testing & Presentation

### Task 21: Playwright E2E Tests

**Files:**
- Create: `apps/frontend/playwright.config.ts`
- Create: `apps/frontend/e2e/fixtures/auth.ts`
- Create: `apps/frontend/e2e/fixtures/seed.ts`
- Create: `apps/frontend/e2e/guest-flow.spec.ts`
- Create: `apps/frontend/e2e/staff-flow.spec.ts`
- Create: `apps/frontend/e2e/realtime-sync.spec.ts`
- Create: `apps/frontend/e2e/escalation.spec.ts`
- Create: `apps/frontend/e2e/fault-tolerance.spec.ts`
- Create: `apps/frontend/e2e/analytics.spec.ts`
- Create: `apps/frontend/e2e/admin.spec.ts`
- Create: `apps/frontend/e2e/demo-simulation.spec.ts`

**Step 1:** Set up Playwright config per Design S.14.3.

**Step 2:** Build auth fixture — login helper per role.

**Step 3:** Implement all 8 test suites per Design S.14.2. The killer test: `realtime-sync.spec.ts` with two browser contexts.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: Playwright E2E tests (8 suites)"
```

---

### Task 22: Demo Landing + Simulation

**Files:**
- Create: `apps/frontend/src/app/demo/page.tsx`
- Create: `scripts/simulate.ts`

**Step 1:** Demo page per Design S.7.7 — 4 role buttons, simulation trigger.

**Step 2:** Simulation script — fires 1 request every 5s in random languages/categories (Design S.12.3).

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: demo landing page + simulation script"
```

---

### Task 23: Admin Settings + Integration Management UI

**Files:**
- Create: `apps/frontend/src/app/admin/page.tsx`
- Create: `apps/frontend/src/app/admin/departments/page.tsx`
- Create: `apps/frontend/src/app/admin/users/page.tsx`
- Create: `apps/frontend/src/app/admin/rooms/page.tsx`
- Create: `apps/frontend/src/app/admin/integrations/page.tsx`
- Create: `apps/frontend/src/app/admin/audit/page.tsx`

**Step 1:** Tab layout per Design S.7.6. Standard CRUD with shadcn/ui tables and forms.

**Step 2:** Integration management UI per Design S.23.6 — list, edit, test, logs, field mapping editor.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: admin settings + integration management UI"
```

---

### Task 24: Documentation + Setup Script

**Files:**
- Create: `README.md`
- Create: `docs/TECH_DECISIONS.md`
- Create: `docs/ARCHITECTURE.md`
- Create: `scripts/setup.sh`

**Step 1:** Setup script: docker compose up + pull llama3 model + run migrations + seed.

**Step 2:** README: overview, architecture diagram, setup instructions, demo guide, screenshots.

**Step 3:** TECH_DECISIONS.md — copy justifications from Design S.9.

**Step 4: Commit**

```bash
git add -A
git commit -m "docs: README, architecture docs, setup script"
```

---

### Task 25: Mobile Responsive Polish

**Files:**
- Modify: kiosk components for 375px mobile
- Modify: dashboard for mobile stack view

**Step 1:** Guest kiosk responsive per Design S.18.1 — horizontal dots on mobile, vertical on desktop. Smaller mic button. `prefers-reduced-motion` support.

**Step 2:** Staff dashboard on mobile: kanban → stacked list. Slide-out → full-screen modal. Bottom sheet actions.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: mobile responsive design for kiosk + dashboard"
```

---

## Summary

| Phase | Tasks | What it delivers |
|-------|-------|-----------------|
| Phase 1 | Tasks 1-12 | Full working pipeline: submit request → AI classify → staff dashboard → resolve, all real-time |
| Phase 2 | Tasks 13-20 | Voice input, D3 charts, animations, fault tolerance, QR codes, enterprise integrations |
| Phase 3 | Tasks 21-25 | E2E tests, demo page, admin UI, docs, mobile polish |

**Critical path:** Tasks 1 → 2 → 3 → 4 → 5 → 6 → 7 (backend pipeline must work before frontend). Tasks 9-12 can partially overlap with 5-8 (frontend scaffolding while backend is being built).
