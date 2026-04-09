import { registerAdapter, type IntegrationAdapter } from "../registry";
import { applyMappings, type FieldMapping } from "../fieldMapper";

class WebhookAdapter implements IntegrationAdapter {
  name = "webhook";

  buildPayload(
    workflow: any,
    mappings: FieldMapping[],
  ): Record<string, any> {
    if (mappings.length > 0) {
      return applyMappings(workflow, mappings);
    }
    // Default: send full workflow data
    return { event: "workflow.update", data: workflow };
  }

  async send(
    payload: Record<string, any>,
    config: any,
    auth: any,
  ): Promise<{ status: number; body: any }> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...config.headers,
    };

    if (auth?.type === "bearer") {
      headers["Authorization"] = `Bearer ${auth.token}`;
    }
    if (auth?.type === "api_key") {
      headers["X-API-Key"] = auth.api_key;
    }

    const res = await fetch(config.url, {
      method: config.method || "POST",
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

registerAdapter("webhook", new WebhookAdapter());
