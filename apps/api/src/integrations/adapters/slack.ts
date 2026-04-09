import { registerAdapter, type IntegrationAdapter } from "../registry";
import type { FieldMapping } from "../fieldMapper";

class SlackAdapter implements IntegrationAdapter {
  name = "slack";

  buildPayload(
    workflow: any,
    _mappings: FieldMapping[],
  ): Record<string, any> {
    const room = workflow.request?.room?.number ?? "N/A";
    const dept = workflow.department?.name ?? "Unassigned";
    const priority = workflow.priority ?? "medium";
    const description =
      workflow.request?.translated || workflow.request?.originalText || "";
    const status = (workflow.status ?? "pending").toUpperCase();

    return {
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `🏨 ${status}: Room ${room}`,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Department:*\n${dept}`,
            },
            {
              type: "mrkdwn",
              text: `*Priority:*\n${priority}`,
            },
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: description,
          },
        },
      ],
    };
  }

  async send(
    payload: Record<string, any>,
    config: any,
    auth: any,
  ): Promise<{ status: number; body: any }> {
    const url = config.webhook_url || config.url;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (auth?.type === "bearer") {
      headers["Authorization"] = `Bearer ${auth.token}`;
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(config.timeout_ms || 5000),
    });

    return {
      status: res.status,
      body: await res.json().catch(() => null),
    };
  }
}

registerAdapter("slack", new SlackAdapter());
