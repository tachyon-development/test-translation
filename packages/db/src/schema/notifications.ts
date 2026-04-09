import { pgTable, uuid, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { requests } from "./requests";
import { users } from "./users";
import { notificationTypeEnum } from "./enums";

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  requestId: uuid("request_id").references(() => requests.id),
  userId: uuid("user_id").references(() => users.id),
  type: notificationTypeEnum("type").notNull(),
  payload: jsonb("payload"),
  delivered: boolean("delivered").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  request: one(requests, {
    fields: [notifications.requestId],
    references: [requests.id],
  }),
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));
