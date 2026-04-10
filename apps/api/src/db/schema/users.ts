import { pgTable, uuid, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  username: text('username').notNull(),
  avatar: text('avatar'),
  locale: text('locale').notNull().default('en-US'),
  timezone: text('timezone').notNull().default('America/Los_Angeles'),
  passwordHash: text('password_hash'),
  telegramBotToken: text('telegram_bot_token'),
  telegramChatId: text('telegram_chat_id'),
  telegramNotificationsEnabled: boolean('telegram_notifications_enabled').notNull().default(true),
  notificationLeadTime: integer('notification_lead_time').notNull().default(15),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type UserRow = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
