import type { Database } from "../index";
import { schema } from "../index";
import { ORG_ID, INTEGRATION_IDS, workflowId } from "./ids";

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

function daysAgo(d: number, hourOffset = 0): Date {
  return new Date(Date.now() - (d * 24 + hourOffset) * 60 * 60 * 1000);
}

export async function seedIntegrations(db: Database) {
  // Integration definitions
  await db.insert(schema.integrations).values([
    {
      id: INTEGRATION_IDS.opera,
      orgId: ORG_ID,
      name: "Opera PMS",
      type: "pms",
      provider: "opera",
      config: {
        baseUrl: "https://opera.hotel-mariana.com/api/v1",
        propertyId: "HM-001",
        syncInterval: 300,
      },
      auth: {
        type: "oauth2",
        clientId: "hospiq-opera-client",
        tokenUrl: "https://opera.hotel-mariana.com/oauth/token",
      },
      active: true,
      triggerOn: "all",
      filterDepartments: null,
    },
    {
      id: INTEGRATION_IDS.slack,
      orgId: ORG_ID,
      name: "Slack #maintenance-alerts",
      type: "messaging",
      provider: "slack",
      config: {
        webhookUrl: "https://hooks.slack.com/services/T00000/B00000/XXXX",
        channel: "#maintenance-alerts",
        mentionOnEscalation: true,
      },
      auth: {
        type: "webhook",
        token: "xoxb-placeholder-token",
      },
      active: true,
      triggerOn: "workflow.escalated",
      filterDepartments: null,
    },
    {
      id: INTEGRATION_IDS.jira,
      orgId: ORG_ID,
      name: "Jira Service Desk",
      type: "ticketing",
      provider: "jira",
      config: {
        baseUrl: "https://hotel-mariana.atlassian.net",
        projectKey: "HM",
        issueType: "Service Request",
      },
      auth: {
        type: "api_key",
        email: "integrations@hotel-mariana.com",
        apiKey: "placeholder-jira-key",
      },
      active: false,
      triggerOn: "workflow.created",
      filterDepartments: null,
    },
  ]);

  // Integration events -- 15 for Opera, 3 for Slack
  const integrationEvents = [];
  let evtCounter = 0;

  function intEvtId(): string {
    evtCounter++;
    const padded = String(evtCounter).padStart(4, "0");
    return `00000000-0000-0000-0008-00000000${padded}`;
  }

  // Opera events: one per historical workflow (first 15)
  for (let i = 0; i < 15; i++) {
    const wfId = workflowId(i + 9);
    integrationEvents.push({
      id: intEvtId(),
      integrationId: INTEGRATION_IDS.opera,
      workflowId: wfId,
      status: "success" as const,
      httpStatus: 200,
      requestPayload: { action: "sync_request", workflowId: wfId },
      responseBody: { ok: true, pmsTicketId: `PMS-${1000 + i}` },
      latencyMs: 120 + (i * 15) % 200,
      error: null,
      createdAt: daysAgo(Math.floor(i / 3), i * 2),
    });
  }

  // Slack events: escalation notification for workflow #2, plus 2 related alerts
  integrationEvents.push(
    {
      id: intEvtId(),
      integrationId: INTEGRATION_IDS.slack,
      workflowId: workflowId(2),
      status: "success" as const,
      httpStatus: 200,
      requestPayload: { channel: "#maintenance-alerts", text: "Escalation: Bathroom drain clog in Room 305 -- SLA breached" },
      responseBody: { ok: true, ts: "1712700000.000100" },
      latencyMs: 85,
      error: null,
      createdAt: hoursAgo(1.5),
    },
    {
      id: intEvtId(),
      integrationId: INTEGRATION_IDS.slack,
      workflowId: workflowId(5),
      status: "success" as const,
      httpStatus: 200,
      requestPayload: { channel: "#maintenance-alerts", text: "CRITICAL: AC broken in Presidential Suite 601" },
      responseBody: { ok: true, ts: "1712700000.000200" },
      latencyMs: 92,
      error: null,
      createdAt: hoursAgo(0.4),
    },
    {
      id: intEvtId(),
      integrationId: INTEGRATION_IDS.slack,
      workflowId: workflowId(1),
      status: "success" as const,
      httpStatus: 200,
      requestPayload: { channel: "#maintenance-alerts", text: "Resolved: Faucet leak in Room 412 fixed by Juan" },
      responseBody: { ok: true, ts: "1712700000.000300" },
      latencyMs: 78,
      error: null,
      createdAt: hoursAgo(2.5),
    },
  );

  await db.insert(schema.integrationEvents).values(integrationEvents);
}
