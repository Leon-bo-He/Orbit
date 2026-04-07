import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';

export const contents = pgTable('contents', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  ideaId: uuid('idea_id'),
  title: text('title').notNull(),
  description: text('description'),
  contentType: text('content_type').notNull(),
  stage: text('stage').notNull().default('planned'),
  tags: jsonb('tags').notNull().default([]),
  targetPlatforms: jsonb('target_platforms').notNull().default([]),
  locale: text('locale').notNull().default('zh-CN'),
  localeVariants: jsonb('locale_variants').notNull().default([]),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  notes: text('notes'),
  reviewNotes: text('review_notes'),
  attachments: jsonb('attachments').notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ContentRow = typeof contents.$inferSelect;
export type InsertContent = typeof contents.$inferInsert;
