import { registerAdapter, type IntegrationAdapter } from "../registry";
import type { FieldMapping } from "../fieldMapper";

class MewsAdapter implements IntegrationAdapter {
  name = "mews";

  buildPayload(
    _workflow: any,
    _mappings: FieldMapping[],
  ): Record<string, any> {
    return { _mock: true, provider: "mews" };
  }

  async send(
    _payload: Record<string, any>,
    _config: any,
    _auth: any,
  ): Promise<{ status: number; body: any }> {
    return { status: 200, body: { mock: true, provider: "mews" } };
  }
}

registerAdapter("mews", new MewsAdapter());
