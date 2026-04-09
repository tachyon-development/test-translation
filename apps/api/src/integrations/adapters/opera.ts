import { registerAdapter, type IntegrationAdapter } from "../registry";
import type { FieldMapping } from "../fieldMapper";

const PRIORITY_MAP: Record<string, number> = {
  critical: 1,
  high: 2,
  medium: 3,
  low: 4,
};

const STATUS_MAP: Record<string, string> = {
  pending: "OPEN",
  claimed: "IN_PROGRESS",
  in_progress: "IN_PROGRESS",
  escalated: "ESCALATED",
  resolved: "COMPLETED",
  cancelled: "CANCELLED",
};

class OperaAdapter implements IntegrationAdapter {
  name = "opera";

  private mapPriority(priority: string): number {
    return PRIORITY_MAP[priority] ?? 3;
  }

  private mapStatus(status: string): string {
    return STATUS_MAP[status] ?? "OPEN";
  }

  buildPayload(
    workflow: any,
    _mappings: FieldMapping[],
  ): Record<string, any> {
    return {
      workOrder: {
        propertyId: workflow._config?.property_id,
        type: "GUEST_REQUEST",
        room: workflow.request?.room?.number,
        department: workflow.department?.slug?.toUpperCase(),
        priority: this.mapPriority(workflow.priority),
        description:
          workflow.request?.translated || workflow.request?.originalText,
        dueDate: workflow.slaDeadline,
        status: this.mapStatus(workflow.status),
      },
    };
  }

  async send(
    payload: Record<string, any>,
    config: any,
    auth: any,
  ): Promise<{ status: number; body: any }> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-app-key": auth?.app_key || "",
      ...config.headers,
    };

    if (auth?.type === "bearer") {
      headers["Authorization"] = `Bearer ${auth.token}`;
    }
    if (auth?.type === "oauth") {
      headers["Authorization"] = `Bearer ${auth.access_token}`;
    }

    const res = await fetch(config.url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(config.timeout_ms || 10000),
    });

    return {
      status: res.status,
      body: await res.json().catch(() => null),
    };
  }
}

registerAdapter("opera", new OperaAdapter());
