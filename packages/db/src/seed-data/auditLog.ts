import type { Database } from "../index";
import { schema } from "../index";
import { ORG_ID, USER_IDS, DEPT_IDS, requestId, workflowId } from "./ids";

function daysAgo(d: number, hourOffset = 0): Date {
  return new Date(Date.now() - (d * 24 + hourOffset) * 60 * 60 * 1000);
}

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

// Seeded pseudo-random for determinism
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

let auditCounter = 0;
function auditId(): string {
  auditCounter++;
  const padded = String(auditCounter).padStart(4, "0");
  return `00000000-0000-0000-0009-00000000${padded}`;
}

const sampleIps = [
  "192.168.1.100",
  "10.0.0.42",
  "172.16.0.15",
  "192.168.1.201",
  "10.0.0.88",
  "203.0.113.50",
  "198.51.100.23",
];

export async function seedAuditLog(db: Database) {
  // Reset counter each time seed runs
  auditCounter = 0;

  const rand = seededRandom(99);
  const entries: Array<{
    id: string;
    orgId: string;
    actorId: string | null;
    action: string;
    resourceType: string;
    resourceId: string | null;
    metadata: any;
    ipAddress: string | null;
    createdAt: Date;
  }> = [];

  function ip(): string {
    return sampleIps[Math.floor(rand() * sampleIps.length)];
  }

  // --- System events (days 7-5 ago) ---
  entries.push(
    { id: auditId(), orgId: ORG_ID, actorId: null, action: "system.startup", resourceType: "system", resourceId: null, metadata: { version: "0.1.0", environment: "demo" }, ipAddress: null, createdAt: daysAgo(7, 0) },
    { id: auditId(), orgId: ORG_ID, actorId: null, action: "system.migration", resourceType: "system", resourceId: null, metadata: { migration: "0001_initial_schema", status: "applied" }, ipAddress: null, createdAt: daysAgo(7, 0.5) },
    { id: auditId(), orgId: ORG_ID, actorId: USER_IDS[12], action: "organization.created", resourceType: "organization", resourceId: ORG_ID, metadata: { name: "Hotel Mariana" }, ipAddress: ip(), createdAt: daysAgo(7, 1) },
    { id: auditId(), orgId: ORG_ID, actorId: USER_IDS[12], action: "organization.settings_updated", resourceType: "organization", resourceId: ORG_ID, metadata: { field: "supportedLanguages", value: ["en", "es", "zh", "fr", "ja", "ko", "ar", "pt"] }, ipAddress: ip(), createdAt: daysAgo(7, 1.5) },
  );

  // Admin creates departments
  const deptNames = ["Maintenance", "Housekeeping", "Concierge", "Front Desk", "Kitchen / Room Service"];
  const deptIds = [DEPT_IDS.maintenance, DEPT_IDS.housekeeping, DEPT_IDS.concierge, DEPT_IDS.frontDesk, DEPT_IDS.kitchen];
  for (let i = 0; i < 5; i++) {
    entries.push({
      id: auditId(), orgId: ORG_ID, actorId: USER_IDS[12], action: "department.created", resourceType: "department",
      resourceId: deptIds[i], metadata: { name: deptNames[i] }, ipAddress: ip(), createdAt: daysAgo(7, 2 + i * 0.1),
    });
  }

  // Admin creates users
  const userNames = ["Demo Guest", "Anonymous Guest", "Juan Hernandez", "Pedro Santos", "Ana Garcia", "Lisa Chen", "Sophie Dubois", "James Wilson", "Yuki Tanaka", "Maria Torres", "Carlos Rivera", "Admin"];
  for (let i = 0; i < 12; i++) {
    entries.push({
      id: auditId(), orgId: ORG_ID, actorId: USER_IDS[12], action: "user.created", resourceType: "user",
      resourceId: USER_IDS[i + 1], metadata: { name: userNames[i] }, ipAddress: ip(), createdAt: daysAgo(7, 3 + i * 0.1),
    });
  }

  // Admin creates integrations
  entries.push(
    { id: auditId(), orgId: ORG_ID, actorId: USER_IDS[12], action: "integration.created", resourceType: "integration", resourceId: "00000000-0000-0000-0007-000000000001", metadata: { name: "Opera PMS", provider: "opera" }, ipAddress: ip(), createdAt: daysAgo(6, 2) },
    { id: auditId(), orgId: ORG_ID, actorId: USER_IDS[12], action: "integration.created", resourceType: "integration", resourceId: "00000000-0000-0000-0007-000000000002", metadata: { name: "Slack #maintenance-alerts", provider: "slack" }, ipAddress: ip(), createdAt: daysAgo(6, 2.5) },
    { id: auditId(), orgId: ORG_ID, actorId: USER_IDS[12], action: "integration.created", resourceType: "integration", resourceId: "00000000-0000-0000-0007-000000000003", metadata: { name: "Jira Service Desk", provider: "jira" }, ipAddress: ip(), createdAt: daysAgo(6, 3) },
    { id: auditId(), orgId: ORG_ID, actorId: USER_IDS[12], action: "integration.deactivated", resourceType: "integration", resourceId: "00000000-0000-0000-0007-000000000003", metadata: { reason: "Testing complete, will enable in production" }, ipAddress: ip(), createdAt: daysAgo(6, 4) },
  );

  // --- User login events over the past 7 days ---
  const staffUsers = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  for (let day = 6; day >= 0; day--) {
    for (const uid of staffUsers) {
      if (rand() > 0.6) continue; // not everyone logs in every day
      entries.push({
        id: auditId(), orgId: ORG_ID, actorId: USER_IDS[uid], action: "user.login", resourceType: "user",
        resourceId: USER_IDS[uid], metadata: { method: "password" }, ipAddress: ip(), createdAt: daysAgo(day, 1 + rand() * 8),
      });
    }
  }

  // --- Request lifecycle events for demo requests ---
  // Request #1 lifecycle
  entries.push(
    { id: auditId(), orgId: ORG_ID, actorId: USER_IDS[1], action: "request.created", resourceType: "request", resourceId: requestId(1), metadata: { room: "412", lang: "zh" }, ipAddress: ip(), createdAt: hoursAgo(3) },
    { id: auditId(), orgId: ORG_ID, actorId: null, action: "request.transcribed", resourceType: "request", resourceId: requestId(1), metadata: { lang: "zh", confidence: 0.95 }, ipAddress: null, createdAt: hoursAgo(2.98) },
    { id: auditId(), orgId: ORG_ID, actorId: null, action: "request.classified", resourceType: "request", resourceId: requestId(1), metadata: { department: "maintenance", priority: "high" }, ipAddress: null, createdAt: hoursAgo(2.97) },
    { id: auditId(), orgId: ORG_ID, actorId: null, action: "workflow.created", resourceType: "workflow", resourceId: workflowId(1), metadata: { requestId: requestId(1) }, ipAddress: null, createdAt: hoursAgo(2.97) },
    { id: auditId(), orgId: ORG_ID, actorId: USER_IDS[3], action: "workflow.claimed", resourceType: "workflow", resourceId: workflowId(1), metadata: { assignee: "Juan Hernandez" }, ipAddress: ip(), createdAt: hoursAgo(2.9) },
    { id: auditId(), orgId: ORG_ID, actorId: USER_IDS[3], action: "workflow.resolved", resourceType: "workflow", resourceId: workflowId(1), metadata: { resolutionMinutes: 22 }, ipAddress: ip(), createdAt: hoursAgo(2.63) },
  );

  // Request #2 lifecycle
  entries.push(
    { id: auditId(), orgId: ORG_ID, actorId: USER_IDS[1], action: "request.created", resourceType: "request", resourceId: requestId(2), metadata: { room: "305", lang: "en" }, ipAddress: ip(), createdAt: hoursAgo(2) },
    { id: auditId(), orgId: ORG_ID, actorId: null, action: "request.classified", resourceType: "request", resourceId: requestId(2), metadata: { department: "maintenance", priority: "high" }, ipAddress: null, createdAt: hoursAgo(1.98) },
    { id: auditId(), orgId: ORG_ID, actorId: null, action: "workflow.sla_breach", resourceType: "workflow", resourceId: workflowId(2), metadata: { slaMinutes: 30 }, ipAddress: null, createdAt: hoursAgo(1.5) },
    { id: auditId(), orgId: ORG_ID, actorId: null, action: "workflow.escalated", resourceType: "workflow", resourceId: workflowId(2), metadata: { to: "Maria Torres", reason: "SLA breach" }, ipAddress: null, createdAt: hoursAgo(1.4) },
  );

  // Requests #3-8 creation events
  const demoRooms = ["203", "103", "601", "302", "201", "403"];
  const demoLangs = ["es", "en", "ja", "fr", "en", "ko"];
  const demoHoursAgo = [1.5, 1, 0.5, 5, 0.75, 0.25];
  const demoGuests = [2, 1, 2, 1, 2, 1];
  for (let i = 0; i < 6; i++) {
    entries.push({
      id: auditId(), orgId: ORG_ID, actorId: USER_IDS[demoGuests[i]], action: "request.created", resourceType: "request",
      resourceId: requestId(i + 3), metadata: { room: demoRooms[i], lang: demoLangs[i] }, ipAddress: ip(), createdAt: hoursAgo(demoHoursAgo[i]),
    });
  }

  // --- Historical request audit entries (request.created + workflow.resolved) ---
  for (let i = 0; i < 50; i++) {
    const reqCreatedAt = new Date(Date.now() - ((Math.floor(i / 7) + 1) * 24 + (i % 24)) * 60 * 60 * 1000);
    entries.push(
      { id: auditId(), orgId: ORG_ID, actorId: rand() > 0.5 ? USER_IDS[1] : USER_IDS[2], action: "request.created", resourceType: "request", resourceId: requestId(i + 9), metadata: { source: "kiosk" }, ipAddress: ip(), createdAt: reqCreatedAt },
    );
  }

  // --- Admin config changes ---
  entries.push(
    { id: auditId(), orgId: ORG_ID, actorId: USER_IDS[12], action: "organization.settings_updated", resourceType: "organization", resourceId: ORG_ID, metadata: { field: "retentionDays", from: 30, to: 90 }, ipAddress: ip(), createdAt: daysAgo(4, 3) },
    { id: auditId(), orgId: ORG_ID, actorId: USER_IDS[12], action: "department.sla_updated", resourceType: "department", resourceId: DEPT_IDS.maintenance, metadata: { field: "critical", from: 20, to: 15 }, ipAddress: ip(), createdAt: daysAgo(3, 5) },
    { id: auditId(), orgId: ORG_ID, actorId: USER_IDS[10], action: "user.role_updated", resourceType: "user", resourceId: USER_IDS[11], metadata: { from: "staff", to: "manager" }, ipAddress: ip(), createdAt: daysAgo(5, 2) },
  );

  // Sort by createdAt for clean insertion
  entries.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  // Insert in batches
  const batchSize = 50;
  for (let i = 0; i < entries.length; i += batchSize) {
    await db.insert(schema.auditLog).values(entries.slice(i, i + batchSize));
  }
}
