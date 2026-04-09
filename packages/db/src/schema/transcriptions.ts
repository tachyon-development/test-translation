import { pgTable, uuid, text, real, integer, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { requests } from "./requests";

export const transcriptions = pgTable("transcriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  requestId: uuid("request_id")
    .notNull()
    .references(() => requests.id),
  audioUrl: text("audio_url").notNull(),
  sourceLang: text("source_lang").notNull(),
  transcript: text("transcript").notNull(),
  confidence: real("confidence").notNull(),
  durationMs: integer("duration_ms"),
  processedAt: timestamp("processed_at").defaultNow().notNull(),
});

export const transcriptionsRelations = relations(transcriptions, ({ one }) => ({
  request: one(requests, {
    fields: [transcriptions.requestId],
    references: [requests.id],
  }),
}));
