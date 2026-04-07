import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';

export const planTemplates = pgTable('plan_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  audience: jsonb('audience'),
  goals: jsonb('goals').notNull().default([]),
  goalDescription: text('goal_description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type PlanTemplateRow = typeof planTemplates.$inferSelect;
export type InsertPlanTemplate = typeof planTemplates.$inferInsert;
