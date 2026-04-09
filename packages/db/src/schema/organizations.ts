import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

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
