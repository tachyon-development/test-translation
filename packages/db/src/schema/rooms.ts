import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";

export const rooms = pgTable("rooms", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  number: text("number").notNull(),
  floor: integer("floor"),
  zone: text("zone"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const roomsRelations = relations(rooms, ({ one }) => ({
  organization: one(organizations, {
    fields: [rooms.orgId],
    references: [organizations.id],
  }),
}));
