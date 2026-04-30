import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const rssReports = pgTable('rss_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  feedUrl: text('feed_url').notNull(),
  reportType: text('report_type').notNull(), // 'daily' | 'weekly' | 'biweekly'
  content: text('content').notNull(),
  translatedContent: text('translated_content'),
  translationLocale: text('translation_locale'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  lookupIdx: index('rss_reports_lookup_idx').on(t.userId, t.feedUrl, t.reportType, t.createdAt),
}));

export type RssReportRow = typeof rssReports.$inferSelect;
