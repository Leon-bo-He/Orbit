import { and, eq, gte, isNull, lt, or, sql } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { rssFeeds } from '../../../db/schema/rss-feeds.js';
import { rssArticles } from '../../../db/schema/rss-articles.js';
import { rssReports } from '../../../db/schema/rss-reports.js';
import type { RssFeedRow } from '../../../db/schema/rss-feeds.js';
import type { RssArticleRow } from '../../../db/schema/rss-articles.js';

export class RssCacheRepository {
  findFeed(url: string): Promise<RssFeedRow | undefined> {
    return db.select().from(rssFeeds).where(eq(rssFeeds.url, url)).then((r) => r[0]);
  }

  async upsertFeed(url: string): Promise<void> {
    await db.insert(rssFeeds)
      .values({ url, lastFetchedAt: new Date() })
      .onConflictDoUpdate({ target: rssFeeds.url, set: { lastFetchedAt: new Date() } });
  }

  async insertArticles(feedUrl: string, articles: { link: string; title: string; pubDate: string }[]): Promise<void> {
    if (articles.length === 0) return;
    await db.insert(rssArticles)
      .values(articles.map((a) => {
        const parsed = a.pubDate ? new Date(a.pubDate) : null;
        const pubDateTs = parsed && !isNaN(parsed.getTime()) ? parsed : null;
        return { feedUrl, link: a.link, title: a.title, pubDate: a.pubDate, pubDateTs };
      }))
      .onConflictDoNothing();
  }

  findArticles(feedUrl: string, offset: number, limit: number): Promise<RssArticleRow[]> {
    return db.select().from(rssArticles)
      .where(eq(rssArticles.feedUrl, feedUrl))
      .orderBy(sql`${rssArticles.pubDateTs} DESC NULLS LAST, ${rssArticles.firstSeenAt} DESC, ${rssArticles.id} ASC`)
      .offset(offset)
      .limit(limit);
  }

  async countArticles(feedUrl: string): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(rssArticles)
      .where(eq(rssArticles.feedUrl, feedUrl));
    return row?.count ?? 0;
  }

  async deleteFeed(url: string): Promise<void> {
    await db.delete(rssArticles).where(eq(rssArticles.feedUrl, url));
    await db.delete(rssReports).where(eq(rssReports.feedUrl, url));
    await db.delete(rssFeeds).where(eq(rssFeeds.url, url));
  }

  findArticlesByDateRange(feedUrl: string, since: Date): Promise<RssArticleRow[]> {
    return db.select().from(rssArticles)
      .where(and(
        eq(rssArticles.feedUrl, feedUrl),
        or(
          gte(rssArticles.pubDateTs, since),
          and(isNull(rssArticles.pubDateTs), gte(rssArticles.firstSeenAt, since)),
        ),
      ))
      .orderBy(sql`${rssArticles.pubDateTs} DESC NULLS LAST, ${rssArticles.firstSeenAt} DESC`)
      .limit(100);
  }

  async deleteExpiredArticles(feedUrl: string, before: Date): Promise<void> {
    await db.delete(rssArticles).where(
      and(
        eq(rssArticles.feedUrl, feedUrl),
        or(
          lt(rssArticles.pubDateTs, before),
          and(isNull(rssArticles.pubDateTs), lt(rssArticles.firstSeenAt, before)),
        ),
      ),
    );
  }
}
