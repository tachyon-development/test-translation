import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import { users } from "./users";
import { rooms } from "./rooms";
import { requestStatusEnum } from "./enums";

export const requests = pgTable(
  "requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    guestId: uuid("guest_id").references(() => users.id),
    roomId: uuid("room_id").references(() => rooms.id),
    originalText: text("original_text"),
    originalLang: text("original_lang"),
    translated: text("translated"),
    audioUrl: text("audio_url"),
    status: requestStatusEnum("status").default("queued").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("requests_org_status_created_idx").on(
      table.orgId,
      table.status,
      table.createdAt,
    ),
  ],
);

export const requestsRelations = relations(requests, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [requests.orgId],
    references: [organizations.id],
  }),
  guest: one(users, {
    fields: [requests.guestId],
    references: [users.id],
  }),
  room: one(rooms, {
    fields: [requests.roomId],
    references: [rooms.id],
  }),
}));
