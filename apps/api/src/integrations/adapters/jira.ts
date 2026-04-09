import { registerAdapter, type IntegrationAdapter } from "../registry";
import type { FieldMapping } from "../fieldMapper";

class JiraAdapter implements IntegrationAdapter {
  name = "jira";

  buildPayload(
    _workflow: any,
    _mappings: FieldMapping[],
  ): Record<string, any> {
    return { _mock: true, provider: "jira" };
  }

  async send(
    _payload: Record<string, any>,
    _config: any,
    _auth: any,
  ): Promise<{ status: number; body: any }> {
    return { status: 200, body: { mock: true, provider: "jira" } };
  }
}

registerAdapter("jira", new JiraAdapter());
