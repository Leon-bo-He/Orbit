import { pgTable, uuid, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const rssArticles = pgTable('rss_articles', {
  id: uuid('id').primaryKey().defaultRandom(),
  feedUrl: text('feed_url').notNull(),
  link: text('link').notNull(),
  title: text('title').notNull(),
  pubDate: text('pub_date').notNull().default(''),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  feedLinkUniq: uniqueIndex('rss_articles_feed_link_uniq').on(t.feedUrl, t.link),
}));

export type RssArticleRow = typeof rssArticles.$inferSelect;
