import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { integrations } from "./integrations";
import { workflows } from "./workflows";
import { integrationEventStatusEnum } from "./enums";

export const integrationEvents = pgTable("integration_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  integrationId: uuid("integration_id")
    .notNull()
    .references(() => integrations.id),
  workflowId: uuid("workflow_id").references(() => workflows.id),
  status: integrationEventStatusEnum("status").notNull(),
  httpStatus: integer("http_status"),
  requestPayload: jsonb("request_payload"),
  responseBody: jsonb("response_body"),
  latencyMs: integer("latency_ms"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const integrationEventsRelations = relations(
  integrationEvents,
  ({ one }) => ({
    integration: one(integrations, {
      fields: [integrationEvents.integrationId],
      references: [integrations.id],
    }),
    workflow: one(workflows, {
      fields: [integrationEvents.workflowId],
      references: [workflows.id],
    }),
  }),
);
