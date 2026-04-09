import type { Database } from "../index";
import { schema } from "../index";
import { ORG_ID, DEPT_IDS, USER_IDS, requestId, workflowId } from "./ids";
import { historicalMeta } from "./requests";

export const WORKFLOW_IDS = {
  demo: Array.from({ length: 8 }, (_, i) => workflowId(i + 1)),
  historical: Array.from({ length: 50 }, (_, i) => workflowId(i + 9)),
};

const deptIdMap: Record<string, string> = {
  maintenance: DEPT_IDS.maintenance,
  housekeeping: DEPT_IDS.housekeeping,
  concierge: DEPT_IDS.concierge,
  frontDesk: DEPT_IDS.frontDesk,
  kitchen: DEPT_IDS.kitchen,
};

// Staff assigned by department for historical
const deptStaff: Record<string, string[]> = {
  maintenance: [USER_IDS[3], USER_IDS[4]],
  housekeeping: [USER_IDS[5], USER_IDS[6]],
  concierge: [USER_IDS[7]],
  frontDesk: [USER_IDS[8]],
  kitchen: [USER_IDS[9]],
};

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

function minutesAfter(base: Date, m: number): Date {
  return new Date(base.getTime() + m * 60 * 1000);
}

export async function seedWorkflows(db: Database) {
  // Demo workflows matching demo requests
  const demoWorkflows = [
    {
      // Request #1: resolved, assigned to Juan, resolvedAt 22min after
      id: workflowId(1),
      requestId: requestId(1),
      orgId: ORG_ID,
      departmentId: DEPT_IDS.maintenance,
      assignedTo: USER_IDS[3], // Juan
      priority: "high" as const,
      slaDeadline: minutesAfter(hoursAgo(3), 30),
      escalated: false,
      escalatedTo: null,
      escalatedAt: null,
      resolvedAt: minutesAfter(hoursAgo(3), 22),
      resolutionNote: "Replaced washer on faucet, leak stopped",
      status: "resolved" as const,
      createdAt: hoursAgo(3),
    },
    {
      // Request #2: escalated, SLA breached
      id: workflowId(2),
      requestId: requestId(2),
      orgId: ORG_ID,
      departmentId: DEPT_IDS.maintenance,
      assignedTo: null,
      priority: "high" as const,
      slaDeadline: minutesAfter(hoursAgo(2), 30),
      escalated: true,
      escalatedTo: USER_IDS[10], // Maria
      escalatedAt: minutesAfter(hoursAgo(2), 35),
      resolvedAt: null,
      resolutionNote: null,
      status: "escalated" as const,
      createdAt: hoursAgo(2),
    },
    {
      // Request #3: claimed by Ana
      id: workflowId(3),
      requestId: requestId(3),
      orgId: ORG_ID,
      departmentId: DEPT_IDS.housekeeping,
      assignedTo: USER_IDS[5], // Ana
      priority: "medium" as const,
      slaDeadline: minutesAfter(hoursAgo(1.5), 45),
      escalated: false,
      escalatedTo: null,
      escalatedAt: null,
      resolvedAt: null,
      resolutionNote: null,
      status: "claimed" as const,
      createdAt: hoursAgo(1.5),
    },
    {
      // Request #4: in_progress, assigned to James
      id: workflowId(4),
      requestId: requestId(4),
      orgId: ORG_ID,
      departmentId: DEPT_IDS.frontDesk,
      assignedTo: USER_IDS[8], // James
      priority: "low" as const,
      slaDeadline: minutesAfter(hoursAgo(1), 30),
      escalated: false,
      escalatedTo: null,
      escalatedAt: null,
      resolvedAt: null,
      resolutionNote: null,
      status: "in_progress" as const,
      createdAt: hoursAgo(1),
    },
    {
      // Request #5: pending (just classified)
      id: workflowId(5),
      requestId: requestId(5),
      orgId: ORG_ID,
      departmentId: DEPT_IDS.maintenance,
      assignedTo: null,
      priority: "critical" as const,
      slaDeadline: minutesAfter(hoursAgo(0.5), 15),
      escalated: false,
      escalatedTo: null,
      escalatedAt: null,
      resolvedAt: null,
      resolutionNote: null,
      status: "pending" as const,
      createdAt: hoursAgo(0.5),
    },
    {
      // Request #6: resolved, assigned to Sophie, resolvedAt 8min after
      id: workflowId(6),
      requestId: requestId(6),
      orgId: ORG_ID,
      departmentId: DEPT_IDS.concierge,
      assignedTo: USER_IDS[7], // Sophie
      priority: "low" as const,
      slaDeadline: minutesAfter(hoursAgo(5), 60),
      escalated: false,
      escalatedTo: null,
      escalatedAt: null,
      resolvedAt: minutesAfter(hoursAgo(5), 8),
      resolutionNote: "Recommended La Terrazza restaurant, made reservation for 8pm",
      status: "resolved" as const,
      createdAt: hoursAgo(5),
    },
    {
      // Request #7: claimed by Lisa
      id: workflowId(7),
      requestId: requestId(7),
      orgId: ORG_ID,
      departmentId: DEPT_IDS.housekeeping,
      assignedTo: USER_IDS[6], // Lisa
      priority: "high" as const,
      slaDeadline: minutesAfter(hoursAgo(0.75), 20),
      escalated: false,
      escalatedTo: null,
      escalatedAt: null,
      resolvedAt: null,
      resolutionNote: null,
      status: "claimed" as const,
      createdAt: hoursAgo(0.75),
    },
    {
      // Request #8: pending (still processing)
      id: workflowId(8),
      requestId: requestId(8),
      orgId: ORG_ID,
      departmentId: DEPT_IDS.kitchen,
      assignedTo: null,
      priority: "low" as const,
      slaDeadline: minutesAfter(hoursAgo(0.25), 45),
      escalated: false,
      escalatedTo: null,
      escalatedAt: null,
      resolvedAt: null,
      resolutionNote: null,
      status: "pending" as const,
      createdAt: hoursAgo(0.25),
    },
  ];

  await db.insert(schema.workflows).values(demoWorkflows);

  // Historical workflows (all resolved)
  const historicalWorkflows = historicalMeta.map((meta, i) => {
    const staff = deptStaff[meta.deptKey];
    const assignee = staff[i % staff.length];
    const resolvedAt = minutesAfter(meta.createdAt, meta.resolutionMinutes);

    return {
      id: workflowId(i + 9),
      requestId: meta.id,
      orgId: ORG_ID,
      departmentId: deptIdMap[meta.deptKey],
      assignedTo: assignee,
      priority: meta.priority as "low" | "medium" | "high" | "critical",
      slaDeadline: minutesAfter(meta.createdAt, 60),
      escalated: false,
      escalatedTo: null,
      escalatedAt: null,
      resolvedAt,
      resolutionNote: "Resolved",
      status: "resolved" as const,
      createdAt: meta.createdAt,
    };
  });

  await db.insert(schema.workflows).values(historicalWorkflows);
}
