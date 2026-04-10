import { eq, and, inArray, sum, count, gte, lte, desc, sql } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { metrics } from '../../../db/schema/metrics.js';
import { publications } from '../../../db/schema/publications.js';
import { contents } from '../../../db/schema/contents.js';
import { workspaces } from '../../../db/schema/workspaces.js';
import type { IMetricRepository } from '../../../domain/metric/metric.service.js';

export class MetricRepository implements IMetricRepository {
  async verifyPublicationOwnership(publicationId: string, userId: string) {
    const [row] = await db.select({ id: publications.id })
      .from(publications)
      .innerJoin(contents, eq(publications.contentId, contents.id))
      .innerJoin(workspaces, eq(contents.workspaceId, workspaces.id))
      .where(and(eq(publications.id, publicationId), eq(workspaces.userId, userId)));
    return Boolean(row);
  }

  async getUserWorkspaceIds(userId: string) {
    const rows = await db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.userId, userId));
    return rows.map((r) => r.id);
  }

  async create(data: {
    publicationId: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    followersGained: number;
    recordedAt: Date;
  }) {
    const [row] = await db.insert(metrics).values(data).returning();
    return row!;
  }

  async getWorkspaceTotals(workspaceIds: string[]) {
    const [row] = await db.select({
      totalViews: sum(metrics.views),
      totalLikes: sum(metrics.likes),
      totalComments: sum(metrics.comments),
      totalShares: sum(metrics.shares),
    }).from(metrics)
      .innerJoin(publications, eq(metrics.publicationId, publications.id))
      .innerJoin(contents, eq(publications.contentId, contents.id))
      .where(inArray(contents.workspaceId, workspaceIds));

    return {
      totalViews: Number(row?.totalViews ?? 0),
      totalLikes: Number(row?.totalLikes ?? 0),
      totalComments: Number(row?.totalComments ?? 0),
      totalShares: Number(row?.totalShares ?? 0),
    };
  }

  async getContentStats(workspaceIds: string[]) {
    const [row] = await db.select({
      total: count(contents.id),
      totalPublished: sql<number>`count(case when ${contents.stage} = 'published' then 1 end)`,
    }).from(contents).where(inArray(contents.workspaceId, workspaceIds));

    return {
      total: Number(row?.total ?? 0),
      totalPublished: Number(row?.totalPublished ?? 0),
    };
  }

  async getPublishedCounts(workspaceIds: string[]) {
    return db.select({ publishedAt: publications.publishedAt })
      .from(publications)
      .innerJoin(contents, eq(publications.contentId, contents.id))
      .where(and(inArray(contents.workspaceId, workspaceIds), eq(publications.status, 'published')));
  }

  async getTopContents(workspaceIds: string[]) {
    const rows = await db.select({
      contentId: contents.id,
      title: contents.title,
      platform: publications.platform,
      views: sum(metrics.views),
      likes: sum(metrics.likes),
      comments: sum(metrics.comments),
      publishedAt: publications.publishedAt,
    }).from(metrics)
      .innerJoin(publications, eq(metrics.publicationId, publications.id))
      .innerJoin(contents, eq(publications.contentId, contents.id))
      .where(inArray(contents.workspaceId, workspaceIds))
      .groupBy(contents.id, contents.title, publications.platform, publications.publishedAt)
      .orderBy(sql`sum(${metrics.views}) desc`)
      .limit(10);

    return rows.map((r) => ({
      contentId: r.contentId,
      title: r.title,
      platform: r.platform,
      views: Number(r.views ?? 0),
      likes: Number(r.likes ?? 0),
      comments: Number(r.comments ?? 0),
      publishedAt: r.publishedAt,
    }));
  }

  async getWeeklyTrend(workspaceIds: string[], since: Date, now: Date) {
    const weeklyMetrics = await db.select({
      week: sql<string>`date_trunc('week', ${metrics.recordedAt})`,
      views: sum(metrics.views),
      likes: sum(metrics.likes),
    }).from(metrics)
      .innerJoin(publications, eq(metrics.publicationId, publications.id))
      .innerJoin(contents, eq(publications.contentId, contents.id))
      .where(and(inArray(contents.workspaceId, workspaceIds), gte(metrics.recordedAt, since)))
      .groupBy(sql`date_trunc('week', ${metrics.recordedAt})`)
      .orderBy(sql`date_trunc('week', ${metrics.recordedAt})`);

    const weeklyPublished = await db.select({
      week: sql<string>`date_trunc('week', ${publications.publishedAt})`,
      published: count(publications.id),
    }).from(publications)
      .innerJoin(contents, eq(publications.contentId, contents.id))
      .where(and(
        inArray(contents.workspaceId, workspaceIds),
        eq(publications.status, 'published'),
        gte(publications.publishedAt, since),
      ))
      .groupBy(sql`date_trunc('week', ${publications.publishedAt})`)
      .orderBy(sql`date_trunc('week', ${publications.publishedAt})`);

    const trendMap = new Map<string, { views: number; likes: number; published: number }>();
    for (let i = 7; i >= 0; i--) {
      const weekDate = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const day = weekDate.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const monday = new Date(weekDate.getTime() + diff * 24 * 60 * 60 * 1000);
      monday.setHours(0, 0, 0, 0);
      trendMap.set(monday.toISOString().split('T')[0]!, { views: 0, likes: 0, published: 0 });
    }

    for (const row of weeklyMetrics) {
      const key = new Date(row.week).toISOString().split('T')[0]!;
      const existing = trendMap.get(key);
      if (existing) {
        existing.views = Number(row.views ?? 0);
        existing.likes = Number(row.likes ?? 0);
      }
    }
    for (const row of weeklyPublished) {
      if (!row.week) continue;
      const key = new Date(row.week).toISOString().split('T')[0]!;
      const existing = trendMap.get(key);
      if (existing) existing.published = Number(row.published ?? 0);
    }

    return Array.from(trendMap.entries()).map(([weekStart, data]) => ({ weekStart, ...data }));
  }

  async getTagPerformance(workspaceIds: string[]) {
    const allContents = await db.select({ tags: contents.tags, contentId: contents.id })
      .from(contents).where(inArray(contents.workspaceId, workspaceIds));

    const metricsByContent = await db.select({
      contentId: contents.id,
      totalViews: sum(metrics.views),
      totalLikes: sum(metrics.likes),
    }).from(metrics)
      .innerJoin(publications, eq(metrics.publicationId, publications.id))
      .innerJoin(contents, eq(publications.contentId, contents.id))
      .where(inArray(contents.workspaceId, workspaceIds))
      .groupBy(contents.id);

    const metricsMap = new Map<string, { views: number; likes: number }>(
      metricsByContent.map((r: typeof metricsByContent[0]) => [
        r.contentId,
        { views: Number(r.totalViews ?? 0), likes: Number(r.totalLikes ?? 0) },
      ]),
    );

    const tagMap = new Map<string, { contentCount: number; totalViews: number; totalLikes: number }>();
    for (const c of allContents) {
      const tags = (c.tags as string[]) ?? [];
      const m = metricsMap.get(c.contentId) ?? { views: 0, likes: 0 };
      for (const tag of tags) {
        const existing = tagMap.get(tag) ?? { contentCount: 0, totalViews: 0, totalLikes: 0 };
        existing.contentCount += 1;
        existing.totalViews += m.views;
        existing.totalLikes += m.likes;
        tagMap.set(tag, existing);
      }
    }

    return Array.from(tagMap.entries())
      .map(([tag, data]) => ({
        tag,
        contentCount: data.contentCount,
        avgViews: data.contentCount > 0 ? Math.round(data.totalViews / data.contentCount) : 0,
        avgLikes: data.contentCount > 0 ? Math.round(data.totalLikes / data.contentCount) : 0,
      }))
      .sort((a, b) => b.avgViews - a.avgViews);
  }

  async getContentPublications(contentId: string, userId: string) {
    const [contentRow] = await db
      .select({ id: contents.id, title: contents.title, stage: contents.stage })
      .from(contents)
      .innerJoin(workspaces, eq(contents.workspaceId, workspaces.id))
      .where(and(eq(contents.id, contentId), eq(workspaces.userId, userId)));

    if (!contentRow) return { content: null, publications: [] };

    const pubRows = await db.select().from(publications)
      .where(eq(publications.contentId, contentId))
      .orderBy(publications.createdAt);

    const pubsWithMetrics = await Promise.all(pubRows.map(async (pub: typeof pubRows[0]) => {
      const metricRows = await db.select().from(metrics)
        .where(eq(metrics.publicationId, pub.id))
        .orderBy(metrics.recordedAt);
      return { publication: pub, metrics: metricRows };
    }));

    return { content: contentRow, publications: pubsWithMetrics };
  }

  async getWorkspaceStatsByIds(workspaceIds: string[]) {
    const rows = await db.select({
      workspaceId: contents.workspaceId,
      total: count(contents.id),
      publishedCount: sql<number>`count(case when ${contents.stage} = 'published' then 1 end)`,
      pendingCount: sql<number>`count(case when ${contents.stage} not in ('published', 'reviewed') then 1 end)`,
    }).from(contents)
      .where(inArray(contents.workspaceId, workspaceIds))
      .groupBy(contents.workspaceId);

    return new Map<string, { contentsCount: number; publishedCount: number; pendingCount: number }>(
      rows.map((r: typeof rows[0]) => [
        r.workspaceId,
        {
          contentsCount: Number(r.total),
          publishedCount: Number(r.publishedCount),
          pendingCount: Number(r.pendingCount),
        },
      ]),
    );
  }

  async getUpcomingPublications(workspaceIds: string[], from: Date, limit: number) {
    const rows = await db.select({
      publication: publications,
      contentId: contents.id,
      contentTitle: contents.title,
      workspaceId: workspaces.id,
      workspaceName: workspaces.name,
      workspaceColor: workspaces.color,
      workspaceIcon: workspaces.icon,
    }).from(publications)
      .innerJoin(contents, eq(publications.contentId, contents.id))
      .innerJoin(workspaces, eq(contents.workspaceId, workspaces.id))
      .where(and(
        inArray(contents.workspaceId, workspaceIds),
        inArray(publications.status, ['queued', 'ready', 'draft']),
        gte(publications.scheduledAt, from),
      ))
      .orderBy(publications.scheduledAt)
      .limit(limit);

    return rows.map((r: typeof rows[0]) => ({
      publication: r.publication,
      content: { id: r.contentId, title: r.contentTitle },
      workspace: { id: r.workspaceId, name: r.workspaceName, color: r.workspaceColor, icon: r.workspaceIcon },
    }));
  }

  async getRecentActivity(workspaceIds: string[], limit: number) {
    const rows = await db.select({
      publication: publications,
      contentId: contents.id,
      contentTitle: contents.title,
      workspaceId: workspaces.id,
      workspaceName: workspaces.name,
      workspaceColor: workspaces.color,
      workspaceIcon: workspaces.icon,
    }).from(publications)
      .innerJoin(contents, eq(publications.contentId, contents.id))
      .innerJoin(workspaces, eq(contents.workspaceId, workspaces.id))
      .where(and(inArray(contents.workspaceId, workspaceIds), eq(publications.status, 'published')))
      .orderBy(desc(publications.publishedAt))
      .limit(limit);

    return rows.map((r: typeof rows[0]) => ({
      publication: r.publication,
      content: { id: r.contentId, title: r.contentTitle },
      workspace: { id: r.workspaceId, name: r.workspaceName, color: r.workspaceColor, icon: r.workspaceIcon },
    }));
  }
}
