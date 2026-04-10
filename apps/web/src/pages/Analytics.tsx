import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useWorkspaces } from '../api/workspaces.js';
import { useWorkspaceAnalytics } from '../api/analytics.js';
import { usePublishQueue } from '../api/publications.js';
import { BarChart } from '../components/charts/BarChart.js';
import { RecordMetricsModal } from '../components/analytics/RecordMetricsModal.js';
import { WorkspaceIconContent } from '../components/ui/WorkspaceIcon.js';
import type { TopContent, TagPerformanceItem } from '../api/analytics.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(val: string | Date | null | undefined): string {
  if (!val) return '—';
  const d = typeof val === 'string' ? new Date(val) : val;
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(navigator.language, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

function formatWeekLabel(isoDate: string): string {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  return new Intl.DateTimeFormat(navigator.language, {
    month: 'short',
    day: 'numeric',
  }).format(d);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ emoji, label, value }: { emoji: string; label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none">{emoji}</span>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        </div>
      </div>
    </div>
  );
}

type SortKey = 'views' | 'likes' | 'comments';

function TopContentTable({
  data,
  workspaceId,
}: {
  data: TopContent[];
  workspaceId: string;
}) {
  const { t } = useTranslation('analytics');
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>('views');

  const sorted = [...data].sort((a, b) => b[sortKey] - a[sortKey]);

  function SortHeader({ col, label }: { col: SortKey; label: string }) {
    return (
      <th
        className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-indigo-600"
        onClick={() => setSortKey(col)}
      >
        {label} {sortKey === col ? '▼' : ''}
      </th>
    );
  }

  const engagementRate = (row: TopContent) =>
    row.views > 0
      ? ((row.likes + row.comments) / row.views * 100).toFixed(2)
      : '0.00';

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">{t('table.top_content')}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('table.title')}
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('table.platform')}
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('table.published_date')}
              </th>
              <SortHeader col="views" label={t('table.views')} />
              <SortHeader col="likes" label={t('table.likes')} />
              <SortHeader col="comments" label={t('table.comments')} />
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('table.engagement')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((row) => (
              <tr
                key={`${row.contentId}-${row.platform}`}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() =>
                  navigate(`/workspaces/${workspaceId}/contents/${row.contentId}/brief`)
                }
              >
                <td className="px-3 py-2 text-gray-900 font-medium max-w-xs truncate">
                  {row.title}
                </td>
                <td className="px-3 py-2 text-gray-600">{row.platform}</td>
                <td className="px-3 py-2 text-gray-500">{formatDate(row.publishedAt)}</td>
                <td className="px-3 py-2 text-right text-gray-700">{row.views.toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-gray-700">{row.likes.toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-gray-700">{row.comments.toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-gray-700">{engagementRate(row)}%</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-400 text-sm">
                  {t('table.no_data')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TagTable({ data }: { data: TagPerformanceItem[] }) {
  const { t } = useTranslation('analytics');
  const sorted = [...data].sort((a, b) => b.avgViews - a.avgViews);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">{t('table.tag_performance')}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('table.tag')}
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('table.contents')}
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('table.avg_views')}
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('table.avg_likes')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((row) => (
              <tr key={row.tag} className="hover:bg-gray-50">
                <td className="px-3 py-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                    #{row.tag}
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-gray-700">{row.contentCount}</td>
                <td className="px-3 py-2 text-right text-gray-700">{row.avgViews.toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-gray-700">{row.avgLikes.toLocaleString()}</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-gray-400 text-sm">
                  {t('table.no_tags')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Analytics() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { t } = useTranslation('analytics');
  const [showRecordModal, setShowRecordModal] = useState(false);

  const { data: workspaces = [] } = useWorkspaces();
  const workspace = workspaces.find((w) => w.id === workspaceId);

  const { data: analytics, isLoading, isError } = useWorkspaceAnalytics(workspaceId);

  // Publish frequency: published pubs in current week/month for this workspace
  const now = new Date();
  const weekStart = new Date(now);
  const dayOfWeek = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  weekStart.setHours(0, 0, 0, 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const { data: queueItems = [] } = usePublishQueue({
    status: 'published',
    from: monthStart.toISOString(),
    to: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  });

  const thisWeekCount = queueItems.filter(
    (q) =>
      q.workspace.id === workspaceId &&
      q.publication.publishedAt &&
      new Date(q.publication.publishedAt) >= weekStart,
  ).length;

  const thisMonthCount = queueItems.filter(
    (q) =>
      q.workspace.id === workspaceId &&
      q.publication.publishedAt &&
      new Date(q.publication.publishedAt) >= monthStart,
  ).length;

  const publishGoal = workspace?.publishGoal;
  const weekGoal = publishGoal?.period === 'week' ? publishGoal.count : null;

  if (!workspaceId) {
    return <div className="p-6 text-gray-500">{t('workspace_not_found')}</div>;
  }

  if (isLoading) {
    return <div className="p-6 text-gray-400">{t('dashboard.loading')}</div>;
  }

  if (isError || !analytics) {
    return <div className="p-6 text-red-500">{t('dashboard.error')}</div>;
  }

  const trendData = analytics.weeklyTrend.map((w) => ({
    label: formatWeekLabel(w.weekStart),
    value: w.views,
    secondaryValue: w.published,
  }));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {workspace && (
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-xl overflow-hidden"
              style={{ backgroundColor: workspace.color + '20', color: workspace.color }}
            >
              <WorkspaceIconContent icon={workspace.icon} />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {workspace?.name ?? t('title')} — {t('title')}
            </h1>
            <p className="text-sm text-gray-500">{t('dashboard.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={() => setShowRecordModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          + {t('record.button')}
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard emoji="📤" label={t('dashboard.total_published')} value={analytics.totalPublished} />
        <StatCard emoji="👁" label={t('dashboard.total_views')} value={analytics.totalViews.toLocaleString()} />
        <StatCard emoji="❤️" label={t('dashboard.total_likes')} value={analytics.totalLikes.toLocaleString()} />
        <StatCard emoji="📊" label={t('dashboard.engagement_rate')} value={`${analytics.engagementRate.toFixed(2)}%`} />
      </div>

      {/* Trend chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">{t('trend.weekly_trend')}</h2>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block" />
              {t('trend.views')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-amber-400 inline-block" />
              {t('trend.published')}
            </span>
          </div>
        </div>
        <BarChart
          data={trendData}
          height={220}
          color="#6366f1"
          secondaryColor="#f59e0b"
          showSecondary
        />
      </div>

      {/* Publish frequency */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900 mb-3">{t('frequency.title')}</h2>
        <div className="space-y-3">
          {weekGoal !== null && (
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>{t('frequency.this_week')}: {thisWeekCount} / {weekGoal}</span>
                <span>{Math.round((thisWeekCount / weekGoal) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-indigo-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (thisWeekCount / weekGoal) * 100)}%` }}
                />
              </div>
            </div>
          )}
          <p className="text-sm text-gray-600">
            {t('frequency.this_month')}: <span className="font-semibold text-gray-900">{thisMonthCount}</span> {t('frequency.posts_published')}
          </p>
        </div>
      </div>

      {/* Top content table */}
      <TopContentTable data={analytics.topContents} workspaceId={workspaceId} />

      {/* Tag performance table */}
      <TagTable data={analytics.tagPerformance} />

      {/* Record metrics modal */}
      {showRecordModal && (
        <RecordMetricsModal
          workspaceId={workspaceId}
          onClose={() => setShowRecordModal(false)}
        />
      )}
    </div>
  );
}
