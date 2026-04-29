import { and, desc, eq, gte } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { rssReports } from '../../../db/schema/rss-reports.js';
import type { RssReportRow } from '../../../db/schema/rss-reports.js';

export class RssReportsRepository {
  async findRecent(userId: string, feedUrl: string, reportType: string, since: Date): Promise<RssReportRow | null> {
    const [row] = await db.select().from(rssReports)
      .where(and(
        eq(rssReports.userId, userId),
        eq(rssReports.feedUrl, feedUrl),
        eq(rssReports.reportType, reportType),
        gte(rssReports.createdAt, since),
      ))
      .orderBy(desc(rssReports.createdAt))
      .limit(1);
    return row ?? null;
  }

  async insert(userId: string, feedUrl: string, reportType: string, content: string): Promise<RssReportRow> {
    const [row] = await db.insert(rssReports)
      .values({ userId, feedUrl, reportType, content })
      .returning();
    return row!;
  }
}
