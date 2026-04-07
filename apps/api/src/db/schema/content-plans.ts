import { pgTable, uuid, timestamp, jsonb, text } from 'drizzle-orm/pg-core';
import { contents } from './contents';

export const contentPlans = pgTable('content_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  contentId: uuid('content_id').notNull().unique().references(() => contents.id, { onDelete: 'cascade' }),
  formatConfig: jsonb('format_config').notNull().default({}),
  audience: jsonb('audience'),
  audienceTemplateId: uuid('audience_template_id'),
  goals: jsonb('goals').notNull().default([]),
  goalDescription: text('goal_description'),
  kpiTargets: jsonb('kpi_targets').notNull().default({}),
  hooks: jsonb('hooks'),
  titleCandidates: jsonb('title_candidates').notNull().default([]),
  outline: jsonb('outline').notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ContentPlanRow = typeof contentPlans.$inferSelect;
export type InsertContentPlan = typeof contentPlans.$inferInsert;
