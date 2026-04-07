import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from './client.js';
import type { Publication } from '@contentflow/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TopContent {
  contentId: string;
  title: string;
  platform: string;
  views: number;
  likes: number;
  comments: number;
  publishedAt: string | null;
}

export interface WeeklyTrendItem {
  weekStart: string;
  views: number;
  likes: number;
  published: number;
}

export interface TagPerformanceItem {
  tag: string;
  contentCount: number;
  avgViews: number;
  avgLikes: number;
}

export interface AnalyticsSummary {
  totalContents: number;
  totalPublished: number;
  thisWeekPublished: number;
  thisMonthPublished: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  engagementRate: number;
  topContents: TopContent[];
  weeklyTrend: WeeklyTrendItem[];
  tagPerformance: TagPerformanceItem[];
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  color: string;
  icon: string;
  contentsCount: number;
  publishedCount: number;
  pendingCount: number;
}

export interface ActivityItem {
  publication: Publication;
  content: { id: string; title: string };
  workspace: { id: string; name: string; color: string; icon: string };
}

export interface DashboardData extends AnalyticsSummary {
  workspaces: WorkspaceSummary[];
  upcomingPublications: ActivityItem[];
  recentActivity: ActivityItem[];
}

export interface ContentMetricsPublication {
  publication: Publication;
  metrics: MetricsSnapshot[];
  latest: MetricsSnapshot | null;
}

export interface MetricsSnapshot {
  id: string;
  publicationId: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  followersGained: number;
  recordedAt: string;
  createdAt: string;
}

export interface ContentMetricsData {
  content: { id: string; title: string; stage: string };
  publications: ContentMetricsPublication[];
  totals: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    followersGained: number;
  };
}

export interface CreateMetricsInput {
  publicationId: string;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  followersGained?: number;
  recordedAt?: string;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** GET /api/dashboard — global dashboard for authenticated user */
export function useDashboard() {
  return useQuery<DashboardData, ApiError>({
    queryKey: ['dashboard'],
    queryFn: () => apiFetch<DashboardData>('/api/dashboard'),
  });
}

/** GET /api/metrics/dashboard?workspace= */
export function useWorkspaceAnalytics(workspaceId?: string) {
  const params = workspaceId ? `?workspace=${workspaceId}` : '';
  return useQuery<AnalyticsSummary, ApiError>({
    queryKey: ['analytics', workspaceId ?? 'global'],
    queryFn: () => apiFetch<AnalyticsSummary>(`/api/metrics/dashboard${params}`),
    enabled: workspaceId !== undefined ? Boolean(workspaceId) : true,
  });
}

/** GET /api/metrics/content/:id */
export function useContentMetrics(contentId: string) {
  return useQuery<ContentMetricsData, ApiError>({
    queryKey: ['contentMetrics', contentId],
    queryFn: () => apiFetch<ContentMetricsData>(`/api/metrics/content/${contentId}`),
    enabled: Boolean(contentId),
  });
}

/** POST /api/metrics */
export function useCreateMetrics() {
  const qc = useQueryClient();
  return useMutation<MetricsSnapshot, ApiError, CreateMetricsInput>({
    mutationFn: (body) =>
      apiFetch<MetricsSnapshot>('/api/metrics', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['analytics'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      void qc.invalidateQueries({ queryKey: ['contentMetrics'] });
    },
  });
}
