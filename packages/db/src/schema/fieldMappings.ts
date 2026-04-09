import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { integrations } from "./integrations";

export const fieldMappings = pgTable("field_mappings", {
  id: uuid("id").defaultRandom().primaryKey(),
  integrationId: uuid("integration_id")
    .notNull()
    .references(() => integrations.id),
  sourceField: text("source_field").notNull(),
  targetField: text("target_field").notNull(),
  transform: text("transform").default("none").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const fieldMappingsRelations = relations(fieldMappings, ({ one }) => ({
  integration: one(integrations, {
    fields: [fieldMappings.integrationId],
    references: [integrations.id],
  }),
}));
