import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const rssFeeds = pgTable('rss_feeds', {
  url: text('url').primaryKey(),
  lastFetchedAt: timestamp('last_fetched_at', { withTimezone: true }).notNull().defaultNow(),
});

export type RssFeedRow = typeof rssFeeds.$inferSelect;
