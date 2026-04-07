import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { contents } from './contents';

export const contentReferences = pgTable('content_references', {
  id: uuid('id').primaryKey().defaultRandom(),
  contentId: uuid('content_id').notNull().references(() => contents.id, { onDelete: 'cascade' }),
  authorName: text('author_name').notNull(),
  contentTitle: text('content_title').notNull(),
  platform: text('platform').notNull(),
  url: text('url').notNull(),
  metricsSnapshot: jsonb('metrics_snapshot').notNull().default({}),
  takeaway: text('takeaway').notNull(),
  attachments: jsonb('attachments').notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ContentReferenceRow = typeof contentReferences.$inferSelect;
export type InsertContentReference = typeof contentReferences.$inferInsert;
