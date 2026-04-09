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

const adapters: Record<string, IntegrationAdapter> = {};

export function registerAdapter(
  provider: string,
  adapter: IntegrationAdapter,
): void {
  adapters[provider] = adapter;
}

export function getAdapter(
  provider: string,
): IntegrationAdapter | undefined {
  return adapters[provider];
}

export function listAdapters(): string[] {
  return Object.keys(adapters);
}

// Register all adapters on import
import "./adapters/webhook";
import "./adapters/opera";
import "./adapters/slack";
import "./adapters/mews";
import "./adapters/jira";
