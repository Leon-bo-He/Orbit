import type { FastifyInstance } from 'fastify';
import { calcEngagementRate } from '../../../domain/metric/metric.service.js';
import type { MetricService } from '../../../domain/metric/metric.service.js';
import type { WorkspaceService } from '../../../domain/workspace/workspace.service.js';
import type { Workspace } from '../../../domain/workspace/workspace.service.js';

export function dashboardRoutes(app: FastifyInstance, metricSvc: MetricService, workspaceSvc: WorkspaceService) {
  app.get('/api/dashboard', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };

    const workspaceList = await workspaceSvc.list(sub);
    if (workspaceList.length === 0) {
      return reply.send(buildEmptyDashboard(workspaceList));
    }

    const data = await metricSvc.getFullDashboard(sub);
    if (!data) return reply.send(buildEmptyDashboard(workspaceList));

    const { contentStats, publishedPubs, totals, topContents, weeklyTrend, tagPerformance, wsStats, upcoming, recent, now } = data;

    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const workspacesData = workspaceList.map((w) => ({
      id: w.id,
      name: w.name,
      color: w.color,
      icon: w.icon,
      contentsCount: wsStats.get(w.id)?.contentsCount ?? 0,
      publishedCount: wsStats.get(w.id)?.publishedCount ?? 0,
      pendingCount: wsStats.get(w.id)?.pendingCount ?? 0,
    }));

    return reply.send({
      totalContents: contentStats.total,
      totalPublished: contentStats.totalPublished,
      thisWeekPublished: publishedPubs.filter((p) => p.publishedAt && p.publishedAt >= sevenDaysAgo).length,
      thisMonthPublished: publishedPubs.filter((p) => p.publishedAt && p.publishedAt >= thirtyDaysAgo).length,
      ...totals,
      engagementRate: calcEngagementRate(totals.totalViews, totals.totalLikes, totals.totalComments, totals.totalShares),
      topContents,
      weeklyTrend,
      tagPerformance,
      workspaces: workspacesData,
      upcomingPublications: upcoming,
      recentActivity: recent,
    });
  });
}

function buildEmptyDashboard(wsList: Workspace[]) {
  return {
    totalContents: 0,
    totalPublished: 0,
    thisWeekPublished: 0,
    thisMonthPublished: 0,
    totalViews: 0,
    totalLikes: 0,
    totalComments: 0,
    totalShares: 0,
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
