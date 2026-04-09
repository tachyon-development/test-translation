import { pgTable, uuid, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { workflows } from "./workflows";
import { users } from "./users";
import { workflowEventTypeEnum } from "./enums";

export const workflowEvents = pgTable(
  "workflow_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflows.id),
    actorId: uuid("actor_id").references(() => users.id),
    eventType: workflowEventTypeEnum("event_type").notNull(),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("workflow_events_workflow_created_idx").on(
      table.workflowId,
      table.createdAt,
    ),
  ],
);

export const workflowEventsRelations = relations(workflowEvents, ({ one }) => ({
  workflow: one(workflows, {
    fields: [workflowEvents.workflowId],
    references: [workflows.id],
  }),
  actor: one(users, {
    fields: [workflowEvents.actorId],
    references: [users.id],
  }),
}));
