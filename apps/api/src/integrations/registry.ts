/**
 * Adapter Registry + Dispatcher
 *
 * Central registry for all integration adapters. Adapters register
 * themselves on import via registerAdapter().
 */
import type { FieldMapping } from "./fieldMapper";

export interface IntegrationAdapter {
  name: string;
  buildPayload(
    workflow: any,
    mappings: FieldMapping[],
  ): Record<string, any>;
  send(
    payload: Record<string, any>,
    config: any,
    auth: any,
  ): Promise<{ status: number; body: any }>;
}

const adapters = new Map<string, IntegrationAdapter>();

export function registerAdapter(
  provider: string,
  adapter: IntegrationAdapter,
): void {
  adapters.set(provider, adapter);
}

export function getAdapter(
  provider: string,
): IntegrationAdapter | undefined {
  ensureLoaded();
  return adapters.get(provider);
}

export function listAdapters(): string[] {
  ensureLoaded();
  return Array.from(adapters.keys());
}

let loaded = false;
function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  // Lazy-load adapters to avoid circular init
  require("./adapters/webhook");
  require("./adapters/opera");
  require("./adapters/slack");
  require("./adapters/mews");
  require("./adapters/jira");
}
