import { pgTable, uuid, integer, timestamp } from 'drizzle-orm/pg-core';
import { publications } from './publications';

export const metrics = pgTable('metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  publicationId: uuid('publication_id').notNull().references(() => publications.id, { onDelete: 'cascade' }),
  views: integer('views').notNull().default(0),
  likes: integer('likes').notNull().default(0),
  comments: integer('comments').notNull().default(0),
  shares: integer('shares').notNull().default(0),
  saves: integer('saves').notNull().default(0),
  followersGained: integer('followers_gained').notNull().default(0),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type MetricsRow = typeof metrics.$inferSelect;
export type InsertMetrics = typeof metrics.$inferInsert;
