import { pgTable, uuid, text, timestamp, boolean, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';

export const notificationChannels = pgTable('notification_channels', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),       // 'telegram' | 'slack' | 'email' | ...
  enabled: boolean('enabled').notNull().default(true),
  config: jsonb('config').notNull().default({}),  // channel-specific config blob
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userTypeUniq: uniqueIndex('notification_channels_user_type_uniq').on(t.userId, t.type),
}));

export type NotificationChannelRow = typeof notificationChannels.$inferSelect;
export type InsertNotificationChannel = typeof notificationChannels.$inferInsert;
