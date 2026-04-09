import {
  pgTable,
  uuid,
  text,
  boolean,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import {
  integrationTypeEnum,
  integrationTriggerEnum,
} from "./enums";

export const integrations = pgTable("integrations", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  type: integrationTypeEnum("type").notNull(),
  provider: text("provider"),
  config: jsonb("config").notNull(),
  auth: jsonb("auth"),
  active: boolean("active").default(true).notNull(),
  triggerOn: integrationTriggerEnum("trigger_on").default("all").notNull(),
  filterDepartments: text("filter_departments"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const integrationsRelations = relations(integrations, ({ one }) => ({
  organization: one(organizations, {
    fields: [integrations.orgId],
    references: [organizations.id],
  }),
}));
