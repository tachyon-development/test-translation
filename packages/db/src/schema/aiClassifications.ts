import { pgTable, uuid, text, real, jsonb, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { requests } from "./requests";
import { departments } from "./departments";
import { urgencyEnum } from "./enums";

export const aiClassifications = pgTable("ai_classifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  requestId: uuid("request_id")
    .notNull()
    .references(() => requests.id),
  model: text("model").notNull(),
  aiCategory: text("ai_category").notNull(),
  matchedDepartmentId: uuid("matched_department_id").references(
    () => departments.id,
  ),
  urgency: urgencyEnum("urgency").notNull(),
  summary: text("summary").notNull(),
  confidence: real("confidence").notNull(),
  rawResponse: jsonb("raw_response"),
  processedAt: timestamp("processed_at").defaultNow().notNull(),
});

export const aiClassificationsRelations = relations(
  aiClassifications,
  ({ one }) => ({
    request: one(requests, {
      fields: [aiClassifications.requestId],
      references: [requests.id],
    }),
    matchedDepartment: one(departments, {
      fields: [aiClassifications.matchedDepartmentId],
      references: [departments.id],
    }),
  }),
);
