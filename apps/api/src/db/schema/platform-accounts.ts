import { pgTable, uuid, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';

export const platformAccounts = pgTable(
  'platform_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    platform: text('platform').notNull(),
    accountName: text('account_name').notNull(),
    displayName: text('display_name'),
    storageStateEnc: text('storage_state_enc').notNull(),
    cookieStatus: text('cookie_status').notNull().default('unknown'),
    cookieCheckedAt: timestamp('cookie_checked_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userPlatformAccountUniq: uniqueIndex('platform_accounts_user_platform_account_uniq').on(
      t.userId,
      t.platform,
      t.accountName,
    ),
  }),
);

export type PlatformAccountRow = typeof platformAccounts.$inferSelect;
export type InsertPlatformAccount = typeof platformAccounts.$inferInsert;

export type PlatformId =
  | 'douyin'
  | 'rednote'
  | 'wechat_video'
  | 'bilibili'
  | 'tiktok'
  | 'youtube'
  | 'instagram'
  | 'facebook'
  | 'x';

export type CookieStatus = 'valid' | 'invalid' | 'unknown' | 'checking';
