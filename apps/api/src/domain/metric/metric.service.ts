import type { metrics } from '../../db/schema/metrics.js';
import type { publications } from '../../db/schema/publications.js';
import type { contents } from '../../db/schema/contents.js';
import { ForbiddenError } from '../errors.js';

export type Metric = typeof metrics.$inferSelect;

export interface IMetricRepository {
  verifyPublicationOwnership(publicationId: string, userId: string): Promise<boolean>;
  getUserWorkspaceIds(userId: string): Promise<string[]>;
  create(data: {
    publicationId: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    followersGained: number;
    recordedAt: Date;
  }): Promise<Metric>;
  getWorkspaceTotals(workspaceIds: string[]): Promise<{
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
  }>;
  getContentStats(workspaceIds: string[]): Promise<{ total: number; totalPublished: number }>;
  getPublishedCounts(workspaceIds: string[]): Promise<Array<{ publishedAt: Date | null }>>;
  getTopContents(workspaceIds: string[]): Promise<Array<{
    contentId: string;
    title: string;
    platform: string;
    views: number;
    likes: number;
    comments: number;
    publishedAt: Date | null;
  }>>;
  getWeeklyTrend(workspaceIds: string[], since: Date, now: Date): Promise<Array<{
    weekStart: string;
    views: number;
    likes: number;
    published: number;
  }>>;
  getTagPerformance(workspaceIds: string[]): Promise<Array<{
    tag: string;
    contentCount: number;
    avgViews: number;
    avgLikes: number;
  }>>;
  getContentPublications(contentId: string, userId: string): Promise<{
    content: { id: string; title: string; stage: string } | null;
    publications: Array<{
      publication: typeof publications.$inferSelect;
      metrics: Metric[];
    }>;
  }>;
  getWorkspaceStatsByIds(workspaceIds: string[]): Promise<Map<string, {
    contentsCount: number;
    publishedCount: number;
    pendingCount: number;
  }>>;
  getUpcomingPublications(workspaceIds: string[], from: Date, limit: number): Promise<Array<{
    publication: typeof publications.$inferSelect;
    content: { id: string; title: string };
    workspace: { id: string; name: string; color: string; icon: string };
  }>>;
  getRecentActivity(workspaceIds: string[], limit: number): Promise<Array<{
    publication: typeof publications.$inferSelect;
    content: { id: string; title: string };
    workspace: { id: string; name: string; color: string; icon: string };
  }>>;
}

export function calcEngagementRate(
  totalViews: number,
  totalLikes: number,
  totalComments: number,
  totalShares: number,
): number {
  return totalViews > 0
    ? Math.round(((totalLikes + totalComments + totalShares) / totalViews) * 100 * 100) / 100
    : 0;
}

export class MetricService {
  constructor(private repo: IMetricRepository) {}

  async record(userId: string, data: {
    publicationId: string;
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    saves?: number;
    followersGained?: number;
    recordedAt?: Date;
  }) {
    const owned = await this.repo.verifyPublicationOwnership(data.publicationId, userId);
    if (!owned) throw new ForbiddenError();
    return this.repo.create({
      publicationId: data.publicationId,
      views: data.views ?? 0,
      likes: data.likes ?? 0,
      comments: data.comments ?? 0,
      shares: data.shares ?? 0,
      saves: data.saves ?? 0,
      followersGained: data.followersGained ?? 0,
      recordedAt: data.recordedAt ?? new Date(),
    });
  }

  async getDashboard(userId: string, workspaceId?: string) {
    let workspaceIds: string[];
    if (workspaceId) {
      workspaceIds = [workspaceId];
    } else {
      workspaceIds = await this.repo.getUserWorkspaceIds(userId);
    }
    if (workspaceIds.length === 0) return buildEmptyMetricsDashboard();

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [contentStats, publishedPubs, totals, topContents, weeklyTrend, tagPerformance] =
      await Promise.all([
        this.repo.getContentStats(workspaceIds),
        this.repo.getPublishedCounts(workspaceIds),
        this.repo.getWorkspaceTotals(workspaceIds),
        this.repo.getTopContents(workspaceIds),
        this.repo.getWeeklyTrend(workspaceIds, new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000), now),
        this.repo.getTagPerformance(workspaceIds),
      ]);

    return {
      totalContents: contentStats.total,
      totalPublished: contentStats.totalPublished,
      thisWeekPublished: publishedPubs.filter((p) => p.publishedAt && p.publishedAt >= sevenDaysAgo).length,
      thisMonthPublished: publishedPubs.filter((p) => p.publishedAt && p.publishedAt >= thirtyDaysAgo).length,
      ...totals,
      engagementRate: calcEngagementRate(totals.totalViews, totals.totalLikes, totals.totalComments, totals.totalShares),
      topContents,
      weeklyTrend,
      tagPerformance,
    };
  }

  async getFullDashboard(userId: string) {
    const workspaceIds = await this.repo.getUserWorkspaceIds(userId);
    if (workspaceIds.length === 0) return null;

    const now = new Date();
    const since = new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000);

    const [contentStats, publishedPubs, totals, topContents, weeklyTrend, tagPerformance, wsStats, upcoming, recent] =
      await Promise.all([
        this.repo.getContentStats(workspaceIds),
        this.repo.getPublishedCounts(workspaceIds),
        this.repo.getWorkspaceTotals(workspaceIds),
        this.repo.getTopContents(workspaceIds),
        this.repo.getWeeklyTrend(workspaceIds, since, now),
        this.repo.getTagPerformance(workspaceIds),
        this.repo.getWorkspaceStatsByIds(workspaceIds),
        this.repo.getUpcomingPublications(workspaceIds, now, 5),
        this.repo.getRecentActivity(workspaceIds, 10),
      ]);

    return { workspaceIds, contentStats, publishedPubs, totals, topContents, weeklyTrend, tagPerformance, wsStats, upcoming, recent, now };
  }

  async getContentMetrics(contentId: string, userId: string) {
    const result = await this.repo.getContentPublications(contentId, userId);
    if (!result.content) throw new ForbiddenError();

    const allMetrics = result.publications.flatMap((r) => r.metrics);
    const totals = {
      views: allMetrics.reduce((s, m) => s + m.views, 0),
      likes: allMetrics.reduce((s, m) => s + m.likes, 0),
      comments: allMetrics.reduce((s, m) => s + m.comments, 0),
      shares: allMetrics.reduce((s, m) => s + m.shares, 0),
      saves: allMetrics.reduce((s, m) => s + m.saves, 0),
      followersGained: allMetrics.reduce((s, m) => s + m.followersGained, 0),
    };

    return { content: result.content, publications: result.publications, totals };
  }
}

function buildEmptyMetricsDashboard() {
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
  };
}
