import { pgTable, text, uuid, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const customPlatforms = pgTable('custom_platforms', {
  id: text('id').primaryKey(), // e.g. "custom_1712345678"
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  icon: text('icon').notNull().default('📌'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type CustomPlatformRow = typeof customPlatforms.$inferSelect;
export type InsertCustomPlatform = typeof customPlatforms.$inferInsert;
