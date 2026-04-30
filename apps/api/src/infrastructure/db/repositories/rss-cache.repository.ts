import { and, eq, gte, isNull, lt, or, sql } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { rssFeeds } from '../../../db/schema/rss-feeds.js';
import { rssArticles } from '../../../db/schema/rss-articles.js';
import { rssReports } from '../../../db/schema/rss-reports.js';
import type { RssFeedRow } from '../../../db/schema/rss-feeds.js';
import type { RssArticleRow } from '../../../db/schema/rss-articles.js';

// db.execute() returns raw PostgreSQL column names (snake_case), not the ORM's camelCase aliases.
// The pg driver may return timestamp columns as strings or Date objects depending on type parsers,
// so toDate() normalises to Date | null regardless.
type RawArticleRow = Record<string, unknown>;

function toDate(v: unknown): Date | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v as string);
  return isNaN(d.getTime()) ? null : d;
}

function mapRawRow(r: RawArticleRow): RssArticleRow {
  return {
    id: r['id'] as string,
    feedUrl: r['feed_url'] as string,
    link: r['link'] as string,
    title: r['title'] as string,
    pubDate: (r['pub_date'] as string) ?? '',
    pubDateTs: toDate(r['pub_date_ts']),
    firstSeenAt: toDate(r['first_seen_at']) ?? new Date(),
  };
}

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

  async findArticles(feedUrl: string, offset: number, limit: number): Promise<RssArticleRow[]> {
    // DISTINCT ON (title) keeps one row per unique title (most recent by date).
    // The outer query re-sorts the deduplicated set for consistent pagination.
    const result = await db.execute<RawArticleRow>(sql`
      SELECT * FROM (
        SELECT DISTINCT ON (title) *
        FROM rss_articles
        WHERE feed_url = ${feedUrl}
        ORDER BY title, COALESCE(pub_date_ts, first_seen_at) DESC NULLS LAST, id ASC
      ) deduped
      ORDER BY COALESCE(pub_date_ts, first_seen_at) DESC NULLS LAST, id ASC
      OFFSET ${offset}
      LIMIT ${limit}
    `);
    return result.rows.map(mapRawRow);
  }

  async countArticles(feedUrl: string): Promise<number> {
    const result = await db.execute<{ count: number }>(sql`
      SELECT COUNT(*) AS count FROM (
        SELECT DISTINCT ON (title) id
        FROM rss_articles
        WHERE feed_url = ${feedUrl}
        ORDER BY title, COALESCE(pub_date_ts, first_seen_at) DESC NULLS LAST
      ) deduped
    `);
    return Number(result.rows[0]?.count ?? 0);
  }

  async deleteFeed(url: string, userId: string): Promise<void> {
    await db.delete(rssArticles).where(eq(rssArticles.feedUrl, url));
    await db.delete(rssReports).where(and(eq(rssReports.feedUrl, url), eq(rssReports.userId, userId)));
    await db.delete(rssFeeds).where(eq(rssFeeds.url, url));
  }

  async findArticlesByDateRange(feedUrl: string, since: Date): Promise<RssArticleRow[]> {
    const result = await db.execute<RawArticleRow>(sql`
      SELECT * FROM (
        SELECT DISTINCT ON (title) *
        FROM rss_articles
        WHERE feed_url = ${feedUrl}
          AND (pub_date_ts >= ${since} OR first_seen_at >= ${since})
        ORDER BY title, COALESCE(pub_date_ts, first_seen_at) DESC NULLS LAST, id ASC
      ) deduped
      ORDER BY COALESCE(pub_date_ts, first_seen_at) DESC NULLS LAST
      LIMIT 100
    `);
    return result.rows.map(mapRawRow);
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
