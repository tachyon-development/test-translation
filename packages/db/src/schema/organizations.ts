import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { departments } from "./departments";
import { rooms } from "./rooms";
import { requests } from "./requests";
import { workflows } from "./workflows";
import { auditLog } from "./auditLog";
import { integrations } from "./integrations";

export type OrganizationSettings = {
  timezone: string;
  defaultLanguage: string;
  supportedLanguages: string[];
  retentionDays: number;
  theme?: string;
};

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  settings: jsonb("settings").$type<OrganizationSettings>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  departments: many(departments),
  rooms: many(rooms),
  requests: many(requests),
  workflows: many(workflows),
  auditLog: many(auditLog),
  integrations: many(integrations),
}));
