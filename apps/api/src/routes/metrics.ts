import type { FastifyPluginAsync } from 'fastify';
import { eq, and, inArray, sum, count, gte, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { metrics } from '../db/schema/metrics.js';
import { publications } from '../db/schema/publications.js';
import { contents } from '../db/schema/contents.js';
import { workspaces } from '../db/schema/workspaces.js';
import { createMetricsSchema } from '@contentflow/shared';

/** Verify that a publication belongs to the authenticated user */
async function verifyPublicationOwnership(
  publicationId: string,
  userId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: publications.id })
    .from(publications)
    .innerJoin(contents, eq(publications.contentId, contents.id))
    .innerJoin(workspaces, eq(contents.workspaceId, workspaces.id))
    .where(and(eq(publications.id, publicationId), eq(workspaces.userId, userId)));
  return Boolean(row);
}

/** Fetch IDs of all workspaces belonging to a user */
async function getUserWorkspaceIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.userId, userId));
  return rows.map((r) => r.id);
}

export const metricsRoutes: FastifyPluginAsync = async (app) => {
  // ------------------------------------------------------------------ //
  // POST /api/metrics — record a manual metric snapshot                 //
  // ------------------------------------------------------------------ //
  app.post('/api/metrics', { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = req.user as { sub: string };
    const body = createMetricsSchema.parse(req.body);

    const owned = await verifyPublicationOwnership(body.publicationId, user.sub);
    if (!owned) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const [row] = await db
      .insert(metrics)
      .values({
        publicationId: body.publicationId,
        views: body.views ?? 0,
        likes: body.likes ?? 0,
        comments: body.comments ?? 0,
        shares: body.shares ?? 0,
        saves: body.saves ?? 0,
        followersGained: body.followersGained ?? 0,
        recordedAt: body.recordedAt ?? new Date(),
      })
      .returning();

    return reply.code(201).send(row);
  });

  // ------------------------------------------------------------------ //
  // GET /api/metrics/dashboard?workspace=  — analytics aggregations    //
  // ------------------------------------------------------------------ //
  app.get('/api/metrics/dashboard', { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = req.user as { sub: string };
    const query = req.query as { workspace?: string };

    // Determine workspace filter
    let workspaceIds: string[];
    if (query.workspace) {
      // Verify ownership
      const [ws] = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(and(eq(workspaces.id, query.workspace), eq(workspaces.userId, user.sub)));
      if (!ws) return reply.code(403).send({ error: 'Forbidden' });
      workspaceIds = [query.workspace];
    } else {
      workspaceIds = await getUserWorkspaceIds(user.sub);
    }

    if (workspaceIds.length === 0) {
      return reply.send(buildEmptyDashboard());
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Total contents and published counts
    const contentStats = await db
      .select({
        total: count(contents.id),
        totalPublished: sql<number>`count(case when ${contents.stage} = 'published' then 1 end)`,
      })
      .from(contents)
      .where(inArray(contents.workspaceId, workspaceIds));

    // Weekly / monthly published counts via publications table
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

    // Aggregate metrics totals
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
    const eightWeeksAgo = new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000);

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

    // Build 8-week trend map
    const weeklyTrendMap = new Map<string, { views: number; likes: number; published: number }>();
    for (let i = 7; i >= 0; i--) {
      const weekDate = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      // Find Monday of that week
      const day = weekDate.getDay();
      const diff = (day === 0 ? -6 : 1 - day);
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

    return reply.send({
      totalContents: Number(contentStats[0]?.total ?? 0),
      totalPublished: Number(contentStats[0]?.totalPublished ?? 0),
      thisWeekPublished,
      thisMonthPublished,
      totalViews,
      totalLikes,
      totalComments,
      engagementRate,
      topContents,
      weeklyTrend,
      tagPerformance,
    });
  });

  // ------------------------------------------------------------------ //
  // GET /api/metrics/content/:id                                        //
  // ------------------------------------------------------------------ //
  app.get('/api/metrics/content/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = req.user as { sub: string };
    const { id: contentId } = req.params as { id: string };

    // Verify ownership
    const [contentRow] = await db
      .select({ id: contents.id, title: contents.title, stage: contents.stage })
      .from(contents)
      .innerJoin(workspaces, eq(contents.workspaceId, workspaces.id))
      .where(and(eq(contents.id, contentId), eq(workspaces.userId, user.sub)));

    if (!contentRow) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const pubRows = await db
      .select()
      .from(publications)
      .where(eq(publications.contentId, contentId))
      .orderBy(publications.createdAt);

    const result = await Promise.all(
      pubRows.map(async (pub) => {
        const metricRows = await db
          .select()
          .from(metrics)
          .where(eq(metrics.publicationId, pub.id))
          .orderBy(metrics.recordedAt);
        const latest = metricRows.length > 0 ? metricRows[metricRows.length - 1]! : null;
        return { publication: pub, metrics: metricRows, latest };
      }),
    );

    const allMetrics = result.flatMap((r) => r.metrics);
    const totals = {
      views: allMetrics.reduce((s, m) => s + m.views, 0),
      likes: allMetrics.reduce((s, m) => s + m.likes, 0),
      comments: allMetrics.reduce((s, m) => s + m.comments, 0),
      shares: allMetrics.reduce((s, m) => s + m.shares, 0),
      saves: allMetrics.reduce((s, m) => s + m.saves, 0),
      followersGained: allMetrics.reduce((s, m) => s + m.followersGained, 0),
    };

    return reply.send({
      content: { id: contentRow.id, title: contentRow.title, stage: contentRow.stage },
      publications: result,
      totals,
    });
  });
};

function buildEmptyDashboard() {
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
  };
}
