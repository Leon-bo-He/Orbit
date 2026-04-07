import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { contents } from './contents';

export const publications = pgTable('publications', {
  id: uuid('id').primaryKey().defaultRandom(),
  contentId: uuid('content_id').notNull().references(() => contents.id, { onDelete: 'cascade' }),
  platform: text('platform').notNull(),
  platformTitle: text('platform_title'),
  platformCopy: text('platform_copy'),
  platformTags: jsonb('platform_tags').notNull().default([]),
  coverUrl: text('cover_url'),
  platformSettings: jsonb('platform_settings').notNull().default({}),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  status: text('status').notNull().default('draft'),
  platformPostId: text('platform_post_id'),
  platformUrl: text('platform_url'),
  failureReason: text('failure_reason'),
  publishLog: jsonb('publish_log').notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type PublicationRow = typeof publications.$inferSelect;
export type InsertPublication = typeof publications.$inferInsert;
