import type { FastifyPluginAsync } from 'fastify';
import { eq, inArray, sum, count, sql, and, gte, desc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { metrics } from '../db/schema/metrics.js';
import { publications } from '../db/schema/publications.js';
import { contents } from '../db/schema/contents.js';
import { workspaces } from '../db/schema/workspaces.js';

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/dashboard', { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = req.user as { sub: string };

    // All workspaces for this user
    const userWorkspaces = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.userId, user.sub))
      .orderBy(workspaces.createdAt);

    const workspaceIds = userWorkspaces.map((w) => w.id);

    if (workspaceIds.length === 0) {
      return reply.send(buildEmptyDashboard([]));
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const eightWeeksAgo = new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000);

    // Content stats per workspace
    const contentStatsByWs = await db
      .select({
        workspaceId: contents.workspaceId,
        total: count(contents.id),
        publishedCount: sql<number>`count(case when ${contents.stage} = 'published' then 1 end)`,
        pendingCount: sql<number>`count(case when ${contents.stage} not in ('published', 'reviewed') then 1 end)`,
      })
      .from(contents)
      .where(inArray(contents.workspaceId, workspaceIds))
      .groupBy(contents.workspaceId);

    const wsStatsMap = new Map(
      contentStatsByWs.map((r) => [
        r.workspaceId,
        {
          contentsCount: Number(r.total),
          publishedCount: Number(r.publishedCount),
          pendingCount: Number(r.pendingCount),
        },
      ]),
    );

    const workspacesData = userWorkspaces.map((w) => ({
      id: w.id,
      name: w.name,
      color: w.color,
      icon: w.icon,
      contentsCount: wsStatsMap.get(w.id)?.contentsCount ?? 0,
      publishedCount: wsStatsMap.get(w.id)?.publishedCount ?? 0,
      pendingCount: wsStatsMap.get(w.id)?.pendingCount ?? 0,
    }));

    // Global content totals
    const globalContentStats = await db
      .select({
        total: count(contents.id),
        totalPublished: sql<number>`count(case when ${contents.stage} = 'published' then 1 end)`,
      })
      .from(contents)
      .where(inArray(contents.workspaceId, workspaceIds));

    // Published publications for week/month counts
    const publishedPubs = await db
      .select({ publishedAt: publications.publishedAt })
      .from(publications)
      .innerJoin(contents, eq(publications.contentId, contents.id))
      .where(
        and(
          inArray(contents.workspaceId, workspaceIds),
          eq(publications.status, 'published'),
        ),
      );

    const thisWeekPublished = publishedPubs.filter(
      (p) => p.publishedAt && p.publishedAt >= sevenDaysAgo,
    ).length;
    const thisMonthPublished = publishedPubs.filter(
      (p) => p.publishedAt && p.publishedAt >= thirtyDaysAgo,
    ).length;

    // Metrics totals
    const metricTotals = await db
      .select({
        totalViews: sum(metrics.views),
        totalLikes: sum(metrics.likes),
        totalComments: sum(metrics.comments),
        totalShares: sum(metrics.shares),
      })
      .from(metrics)
      .innerJoin(publications, eq(metrics.publicationId, publications.id))
      .innerJoin(contents, eq(publications.contentId, contents.id))
      .where(inArray(contents.workspaceId, workspaceIds));

    const totalViews = Number(metricTotals[0]?.totalViews ?? 0);
    const totalLikes = Number(metricTotals[0]?.totalLikes ?? 0);
    const totalComments = Number(metricTotals[0]?.totalComments ?? 0);
    const totalShares = Number(metricTotals[0]?.totalShares ?? 0);
    const engagementRate =
      totalViews > 0
        ? Math.round(((totalLikes + totalComments + totalShares) / totalViews) * 100 * 100) / 100
        : 0;

    // Top 10 contents by views
    const topContentsRaw = await db
      .select({
        contentId: contents.id,
        title: contents.title,
        platform: publications.platform,
        views: sum(metrics.views),
        likes: sum(metrics.likes),
        comments: sum(metrics.comments),
        publishedAt: publications.publishedAt,
      })
      .from(metrics)
      .innerJoin(publications, eq(metrics.publicationId, publications.id))
      .innerJoin(contents, eq(publications.contentId, contents.id))
      .where(inArray(contents.workspaceId, workspaceIds))
      .groupBy(contents.id, contents.title, publications.platform, publications.publishedAt)
      .orderBy(sql`sum(${metrics.views}) desc`)
      .limit(10);

    const topContents = topContentsRaw.map((r) => ({
      contentId: r.contentId,
      title: r.title,
      platform: r.platform,
      views: Number(r.views ?? 0),
      likes: Number(r.likes ?? 0),
      comments: Number(r.comments ?? 0),
      publishedAt: r.publishedAt,
    }));

    // Weekly trend — last 8 weeks
    const weeklyMetrics = await db
      .select({
        week: sql<string>`date_trunc('week', ${metrics.recordedAt})`,
        views: sum(metrics.views),
        likes: sum(metrics.likes),
      })
      .from(metrics)
      .innerJoin(publications, eq(metrics.publicationId, publications.id))
      .innerJoin(contents, eq(publications.contentId, contents.id))
      .where(
        and(
          inArray(contents.workspaceId, workspaceIds),
          gte(metrics.recordedAt, eightWeeksAgo),
        ),
      )
      .groupBy(sql`date_trunc('week', ${metrics.recordedAt})`)
      .orderBy(sql`date_trunc('week', ${metrics.recordedAt})`);

    const weeklyPublished = await db
      .select({
        week: sql<string>`date_trunc('week', ${publications.publishedAt})`,
        published: count(publications.id),
      })
      .from(publications)
      .innerJoin(contents, eq(publications.contentId, contents.id))
      .where(
        and(
          inArray(contents.workspaceId, workspaceIds),
          eq(publications.status, 'published'),
          gte(publications.publishedAt, eightWeeksAgo),
        ),
      )
      .groupBy(sql`date_trunc('week', ${publications.publishedAt})`)
      .orderBy(sql`date_trunc('week', ${publications.publishedAt})`);

    const weeklyTrendMap = new Map<string, { views: number; likes: number; published: number }>();
    for (let i = 7; i >= 0; i--) {
      const weekDate = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const day = weekDate.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const monday = new Date(weekDate.getTime() + diff * 24 * 60 * 60 * 1000);
      monday.setHours(0, 0, 0, 0);
      const key = monday.toISOString().split('T')[0]!;
      weeklyTrendMap.set(key, { views: 0, likes: 0, published: 0 });
    }

    for (const row of weeklyMetrics) {
      const key = new Date(row.week).toISOString().split('T')[0]!;
      const existing = weeklyTrendMap.get(key);
      if (existing) {
        existing.views = Number(row.views ?? 0);
        existing.likes = Number(row.likes ?? 0);
      }
    }
    for (const row of weeklyPublished) {
      if (!row.week) continue;
      const key = new Date(row.week).toISOString().split('T')[0]!;
      const existing = weeklyTrendMap.get(key);
      if (existing) {
        existing.published = Number(row.published ?? 0);
      }
    }

    const weeklyTrend = Array.from(weeklyTrendMap.entries()).map(([weekStart, data]) => ({
      weekStart,
      ...data,
    }));

    // Tag performance
    const allContentsWithTags = await db
      .select({ tags: contents.tags, contentId: contents.id })
      .from(contents)
      .where(inArray(contents.workspaceId, workspaceIds));

    const allMetricsByContent = await db
      .select({
        contentId: contents.id,
        totalViews: sum(metrics.views),
        totalLikes: sum(metrics.likes),
      })
      .from(metrics)
      .innerJoin(publications, eq(metrics.publicationId, publications.id))
      .innerJoin(contents, eq(publications.contentId, contents.id))
      .where(inArray(contents.workspaceId, workspaceIds))
      .groupBy(contents.id);

    const metricsMap = new Map(
      allMetricsByContent.map((r) => [
        r.contentId,
        { views: Number(r.totalViews ?? 0), likes: Number(r.totalLikes ?? 0) },
      ]),
    );

    const tagMap = new Map<string, { contentCount: number; totalViews: number; totalLikes: number }>();
    for (const c of allContentsWithTags) {
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

    const tagPerformance = Array.from(tagMap.entries())
      .map(([tag, data]) => ({
        tag,
        contentCount: data.contentCount,
        avgViews: data.contentCount > 0 ? Math.round(data.totalViews / data.contentCount) : 0,
        avgLikes: data.contentCount > 0 ? Math.round(data.totalLikes / data.contentCount) : 0,
      }))
      .sort((a, b) => b.avgViews - a.avgViews);

    // Upcoming publications (next 5 scheduled)
    const upcomingRaw = await db
      .select({
        publication: publications,
        contentId: contents.id,
        contentTitle: contents.title,
        workspaceId: workspaces.id,
        workspaceName: workspaces.name,
        workspaceColor: workspaces.color,
        workspaceIcon: workspaces.icon,
      })
      .from(publications)
      .innerJoin(contents, eq(publications.contentId, contents.id))
      .innerJoin(workspaces, eq(contents.workspaceId, workspaces.id))
      .where(
        and(
          inArray(contents.workspaceId, workspaceIds),
          inArray(publications.status, ['queued', 'ready', 'draft']),
          gte(publications.scheduledAt, now),
        ),
      )
      .orderBy(publications.scheduledAt)
      .limit(5);

    const upcomingPublications = upcomingRaw.map((r) => ({
      publication: r.publication,
      content: { id: r.contentId, title: r.contentTitle },
      workspace: { id: r.workspaceId, name: r.workspaceName, color: r.workspaceColor, icon: r.workspaceIcon },
    }));

    // Recent activity (last 10 published)
    const recentRaw = await db
      .select({
        publication: publications,
        contentId: contents.id,
        contentTitle: contents.title,
        workspaceId: workspaces.id,
        workspaceName: workspaces.name,
        workspaceColor: workspaces.color,
        workspaceIcon: workspaces.icon,
      })
      .from(publications)
      .innerJoin(contents, eq(publications.contentId, contents.id))
      .innerJoin(workspaces, eq(contents.workspaceId, workspaces.id))
      .where(
        and(
          inArray(contents.workspaceId, workspaceIds),
          eq(publications.status, 'published'),
        ),
      )
      .orderBy(desc(publications.publishedAt))
      .limit(10);

    const recentActivity = recentRaw.map((r) => ({
      publication: r.publication,
      content: { id: r.contentId, title: r.contentTitle },
      workspace: { id: r.workspaceId, name: r.workspaceName, color: r.workspaceColor, icon: r.workspaceIcon },
    }));

    return reply.send({
      totalContents: Number(globalContentStats[0]?.total ?? 0),
      totalPublished: Number(globalContentStats[0]?.totalPublished ?? 0),
      thisWeekPublished,
      thisMonthPublished,
      totalViews,
      totalLikes,
      totalComments,
      engagementRate,
      topContents,
      weeklyTrend,
      tagPerformance,
      workspaces: workspacesData,
      upcomingPublications,
      recentActivity,
    });
  });
};

function buildEmptyDashboard(wsList: typeof workspaces.$inferSelect[]) {
  return {
    totalContents: 0,
    totalPublished: 0,
    thisWeekPublished: 0,
    thisMonthPublished: 0,
    totalViews: 0,
    totalLikes: 0,
    totalComments: 0,
    engagementRate: 0,
    topContents: [],
    weeklyTrend: [],
    tagPerformance: [],
    workspaces: wsList.map((w) => ({
      id: w.id,
      name: w.name,
      color: w.color,
      icon: w.icon,
      contentsCount: 0,
      publishedCount: 0,
      pendingCount: 0,
    })),
    upcomingPublications: [],
    recentActivity: [],
  };
}
