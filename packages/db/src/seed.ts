import { db, schema } from "./index";
import { seedOrganizations } from "./seed-data/organizations";
import { seedDepartments } from "./seed-data/departments";
import { seedUsers } from "./seed-data/users";
import { seedRooms } from "./seed-data/rooms";
import { seedRequests } from "./seed-data/requests";
import { seedWorkflows } from "./seed-data/workflows";
import { seedWorkflowEvents } from "./seed-data/workflowEvents";
import { seedIntegrations } from "./seed-data/integrations";
import { seedAuditLog } from "./seed-data/auditLog";

async function clearTables() {
  console.log("Clearing existing data...");
  // Delete in reverse dependency order
  await db.delete(schema.auditLog);
  await db.delete(schema.integrationEvents);
  await db.delete(schema.integrations);
  await db.delete(schema.workflowEvents);
  await db.delete(schema.workflows);
  await db.delete(schema.aiClassifications);
  await db.delete(schema.transcriptions);
  await db.delete(schema.notifications);
  await db.delete(schema.fieldMappings);
  await db.delete(schema.requests);
  await db.delete(schema.rooms);
  await db.delete(schema.users);
  await db.delete(schema.departments);
  await db.delete(schema.organizations);
}

async function seed() {
  console.log("🌱 Seeding Hotel Mariana demo data...\n");

  await clearTables();

  console.log("  → Organizations");
  await seedOrganizations(db);

  console.log("  → Departments");
  await seedDepartments(db);

  console.log("  → Users (hashing passwords...)");
  await seedUsers(db);

  console.log("  → Rooms");
  await seedRooms(db);

  console.log("  → Requests (8 demo + 50 historical)");
  await seedRequests(db);

  console.log("  → Workflows (8 demo + 50 historical)");
  await seedWorkflows(db);

  console.log("  → Workflow Events");
  await seedWorkflowEvents(db);

  console.log("  → Integrations + Events");
  await seedIntegrations(db);

  console.log("  → Audit Log");
  await seedAuditLog(db);

  console.log("\n✅ Seed complete!");
  console.log("   1 organization, 5 departments, 12 users, 33 rooms");
  console.log("   58 requests, 58 workflows, ~180 workflow events");
  console.log("   3 integrations, 18 integration events, ~100 audit log entries");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  });
