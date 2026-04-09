import type { Database } from "../index";
import { schema } from "../index";
import { USER_IDS, workflowId } from "./ids";
import { historicalMeta } from "./requests";

let eventCounter = 0;

function eventId(): string {
  eventCounter++;
  const padded = String(eventCounter).padStart(4, "0");
  return `00000000-0000-0000-0006-00000000${padded}`;
}

function minutesAfter(base: Date, m: number): Date {
  return new Date(base.getTime() + m * 60 * 1000);
}

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

// Staff assigned by department for historical
const deptStaff: Record<string, string[]> = {
  maintenance: [USER_IDS[3], USER_IDS[4]],
  housekeeping: [USER_IDS[5], USER_IDS[6]],
  concierge: [USER_IDS[7]],
  frontDesk: [USER_IDS[8]],
  kitchen: [USER_IDS[9]],
};

export async function seedWorkflowEvents(db: Database) {
  // Reset counter each time seed runs
  eventCounter = 0;

  const events: Array<{
    id: string;
    workflowId: string;
    actorId: string | null;
    eventType: "created" | "claimed" | "status_change" | "escalated" | "resolved" | "comment" | "sla_breach" | "reassigned";
    payload: any;
    createdAt: Date;
  }> = [];

  // --- Request #1 (resolved -- full lifecycle) ---
  const wf1Created = hoursAgo(3);
  events.push(
    { id: eventId(), workflowId: workflowId(1), actorId: null, eventType: "created", payload: { source: "system", note: "Request created via guest kiosk" }, createdAt: wf1Created },
    { id: eventId(), workflowId: workflowId(1), actorId: null, eventType: "status_change", payload: { from: null, to: "transcription.complete", note: "Audio transcribed, zh detected" }, createdAt: minutesAfter(wf1Created, 1) },
    { id: eventId(), workflowId: workflowId(1), actorId: null, eventType: "status_change", payload: { from: null, to: "classification.complete", department: "maintenance", priority: "high" }, createdAt: minutesAfter(wf1Created, 2) },
    { id: eventId(), workflowId: workflowId(1), actorId: null, eventType: "created", payload: { note: "Workflow created and assigned to maintenance" }, createdAt: minutesAfter(wf1Created, 2) },
    { id: eventId(), workflowId: workflowId(1), actorId: USER_IDS[3], eventType: "claimed", payload: { note: "Juan claimed the request" }, createdAt: minutesAfter(wf1Created, 5) },
    { id: eventId(), workflowId: workflowId(1), actorId: USER_IDS[3], eventType: "status_change", payload: { from: "claimed", to: "in_progress" }, createdAt: minutesAfter(wf1Created, 6) },
    { id: eventId(), workflowId: workflowId(1), actorId: USER_IDS[3], eventType: "resolved", payload: { note: "Replaced washer on faucet, leak stopped", resolutionMinutes: 22 }, createdAt: minutesAfter(wf1Created, 22) },
  );

  // --- Request #2 (escalated) ---
  const wf2Created = hoursAgo(2);
  events.push(
    { id: eventId(), workflowId: workflowId(2), actorId: null, eventType: "created", payload: { source: "system" }, createdAt: wf2Created },
    { id: eventId(), workflowId: workflowId(2), actorId: null, eventType: "status_change", payload: { to: "classification.complete", department: "maintenance", priority: "high" }, createdAt: minutesAfter(wf2Created, 1) },
    { id: eventId(), workflowId: workflowId(2), actorId: null, eventType: "created", payload: { note: "Workflow created" }, createdAt: minutesAfter(wf2Created, 1) },
    { id: eventId(), workflowId: workflowId(2), actorId: null, eventType: "sla_breach", payload: { slaMinutes: 30, elapsedMinutes: 31 }, createdAt: minutesAfter(wf2Created, 31) },
    { id: eventId(), workflowId: workflowId(2), actorId: null, eventType: "escalated", payload: { to: USER_IDS[10], reason: "SLA breach - no staff claimed" }, createdAt: minutesAfter(wf2Created, 35) },
    { id: eventId(), workflowId: workflowId(2), actorId: USER_IDS[10], eventType: "comment", payload: { text: "All maintenance staff occupied with critical AC issue in Presidential Wing. Contacting external vendor." }, createdAt: minutesAfter(wf2Created, 40) },
  );

  // --- Request #3 (claimed by Ana) ---
  const wf3Created = hoursAgo(1.5);
  events.push(
    { id: eventId(), workflowId: workflowId(3), actorId: null, eventType: "created", payload: { source: "system" }, createdAt: wf3Created },
    { id: eventId(), workflowId: workflowId(3), actorId: USER_IDS[5], eventType: "claimed", payload: { note: "Ana claimed the request" }, createdAt: minutesAfter(wf3Created, 3) },
  );

  // --- Request #4 (in_progress, James) ---
  const wf4Created = hoursAgo(1);
  events.push(
    { id: eventId(), workflowId: workflowId(4), actorId: null, eventType: "created", payload: { source: "system" }, createdAt: wf4Created },
    { id: eventId(), workflowId: workflowId(4), actorId: USER_IDS[8], eventType: "claimed", payload: { note: "James claimed the request" }, createdAt: minutesAfter(wf4Created, 2) },
    { id: eventId(), workflowId: workflowId(4), actorId: USER_IDS[8], eventType: "status_change", payload: { from: "claimed", to: "in_progress" }, createdAt: minutesAfter(wf4Created, 3) },
  );

  // --- Request #5 (pending, just classified) ---
  const wf5Created = hoursAgo(0.5);
  events.push(
    { id: eventId(), workflowId: workflowId(5), actorId: null, eventType: "created", payload: { source: "system" }, createdAt: wf5Created },
  );

  // --- Request #6 (resolved, Sophie) ---
  const wf6Created = hoursAgo(5);
  events.push(
    { id: eventId(), workflowId: workflowId(6), actorId: null, eventType: "created", payload: { source: "system" }, createdAt: wf6Created },
    { id: eventId(), workflowId: workflowId(6), actorId: USER_IDS[7], eventType: "claimed", payload: { note: "Sophie claimed the request" }, createdAt: minutesAfter(wf6Created, 1) },
    { id: eventId(), workflowId: workflowId(6), actorId: USER_IDS[7], eventType: "resolved", payload: { note: "Recommended La Terrazza, made reservation", resolutionMinutes: 8 }, createdAt: minutesAfter(wf6Created, 8) },
  );

  // --- Request #7 (claimed by Lisa) ---
  const wf7Created = hoursAgo(0.75);
  events.push(
    { id: eventId(), workflowId: workflowId(7), actorId: null, eventType: "created", payload: { source: "system" }, createdAt: wf7Created },
    { id: eventId(), workflowId: workflowId(7), actorId: USER_IDS[6], eventType: "claimed", payload: { note: "Lisa claimed the request" }, createdAt: minutesAfter(wf7Created, 2) },
  );

  // --- Request #8 (pending, still processing) ---
  const wf8Created = hoursAgo(0.25);
  events.push(
    { id: eventId(), workflowId: workflowId(8), actorId: null, eventType: "created", payload: { source: "system" }, createdAt: wf8Created },
  );

  // --- Historical workflow events (created + claimed + resolved for each) ---
  for (let i = 0; i < 50; i++) {
    const meta = historicalMeta[i];
    const wfId = workflowId(i + 9);
    const staff = deptStaff[meta.deptKey];
    const assignee = staff[i % staff.length];
    const claimMinutes = 2 + (i % 5);

    events.push(
      { id: eventId(), workflowId: wfId, actorId: null, eventType: "created", payload: { source: "system" }, createdAt: meta.createdAt },
      { id: eventId(), workflowId: wfId, actorId: assignee, eventType: "claimed", payload: {}, createdAt: minutesAfter(meta.createdAt, claimMinutes) },
      { id: eventId(), workflowId: wfId, actorId: assignee, eventType: "resolved", payload: { resolutionMinutes: meta.resolutionMinutes }, createdAt: minutesAfter(meta.createdAt, meta.resolutionMinutes) },
    );
  }

  // Insert in batches to avoid hitting parameter limits
  const batchSize = 50;
  for (let i = 0; i < events.length; i += batchSize) {
    await db.insert(schema.workflowEvents).values(events.slice(i, i + batchSize));
  }
}
