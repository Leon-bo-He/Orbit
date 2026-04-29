import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const aiConfigs = pgTable('ai_configs', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  baseUrl: text('base_url').notNull(),
  apiKey: text('api_key').notNull(),
  model: text('model').notNull().default('gpt-4o-mini'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type AiConfigRow = typeof aiConfigs.$inferSelect;
