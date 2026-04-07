import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users';
import { workspaces } from './workspaces';
import { contents } from './contents';

export const ideas = pgTable('ideas', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  note: text('note'),
  tags: jsonb('tags').notNull().default([]),
  priority: text('priority').notNull().default('medium'),
  attachments: jsonb('attachments').notNull().default([]),
  status: text('status').notNull().default('active'),
  convertedTo: uuid('converted_to').references(() => contents.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type IdeaRow = typeof ideas.$inferSelect;
export type InsertIdea = typeof ideas.$inferInsert;
