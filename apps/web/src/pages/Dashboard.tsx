import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useDashboard } from '../api/analytics.js';
import { BarChart } from '../components/charts/BarChart.js';
import { SkeletonCard } from '../components/ui/Skeleton.js';
import type { ActivityItem } from '../api/analytics.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(val: string | Date | null | undefined): string {
  if (!val) return '';
  const d = typeof val === 'string' ? new Date(val) : val;
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(navigator.language, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(d);
}

function formatWeekLabel(isoDate: string): string {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  return new Intl.DateTimeFormat(navigator.language, { month: 'short', day: 'numeric' }).format(d);
}

const STATUS_STYLES: Record<string, string> = {
  draft:     'bg-gray-100 text-gray-500',
  queued:    'bg-blue-50 text-blue-600',
  ready:     'bg-yellow-50 text-yellow-700',
  posting:   'bg-purple-50 text-purple-600',
  published: 'bg-green-50 text-green-700',
  failed:    'bg-red-50 text-red-600',
  skipped:   'bg-gray-100 text-gray-400',
};

const PLATFORM_EMOJI: Record<string, string> = {
  douyin: '🎵', xiaohongshu: '📕', weixin: '📰', weixin_video: '📱',
  bilibili: '🎬', x: '🐦', youtube: '▶️', instagram: '📸', tiktok: '🎶',
};

// ─── Components ──────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function ActivityList({ items, title }: { items: ActivityItem[]; title: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-medium text-gray-900">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 px-4 py-6 text-center">No items.</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {items.map((item) => (
            <li key={item.publication.id} className="flex items-center gap-2.5 px-4 py-2.5 text-sm">
              <span className="text-xs text-gray-400 w-28 flex-shrink-0">
                {formatDate(item.publication.scheduledAt ?? item.publication.publishedAt)}
              </span>
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.workspace.color }}
              />
              <span className="text-xs flex-shrink-0">{PLATFORM_EMOJI[item.publication.platform] ?? '📄'}</span>
              <Link
                to={`/workspaces/${item.workspace.id}/contents/${item.content.id}/brief`}
                className="text-gray-700 hover:text-indigo-600 truncate flex-1 min-w-0"
              >
                {item.content.title}
              </Link>
              <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${STATUS_STYLES[item.publication.status] ?? ''}`}>
                {item.publication.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { t } = useTranslation('analytics');
  const { data, isLoading, isError } = useDashboard();

  if (isLoading) {
    return (
      <div className="p-8 space-y-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <SkeletonCard className="h-56" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SkeletonCard /><SkeletonCard />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return <div className="p-8 text-red-500 text-sm">{t('dashboard.error')}</div>;
  }

  const trendData = data.weeklyTrend.map((w) => ({
    label: formatWeekLabel(w.weekStart),
    value: w.views,
    secondaryValue: w.published,
  }));

  return (
    <div className="p-8 space-y-8 max-w-5xl mx-auto">
      {/* Page header */}
      <div>
        <h1 className="text-[22px] font-semibold text-gray-900 tracking-tight">{t('dashboard.title')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{t('dashboard.subtitle')}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label={t('dashboard.total_published')}   value={data.totalPublished} />
        <StatCard label={t('dashboard.total_views')}       value={data.totalViews.toLocaleString()} />
        <StatCard label={t('dashboard.total_likes')}       value={data.totalLikes.toLocaleString()} />
        <StatCard label={t('dashboard.engagement_rate')}   value={`${data.engagementRate.toFixed(2)}%`} />
      </div>

      {/* Weekly trend */}
      <div className="rounded-lg border border-gray-100 bg-white p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-900">{t('trend.weekly_trend')}</h2>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" />
              {t('trend.views')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-1 bg-amber-400 inline-block" />
              {t('trend.published')}
            </span>
          </div>
        </div>
        <BarChart data={trendData} height={200} color="#6366f1" secondaryColor="#f59e0b" showSecondary />
      </div>

      {/* Workspace cards */}
      {data.workspaces.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-900 mb-3">{t('dashboard.workspaces')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.workspaces.map((ws) => (
              <Link
                key={ws.id}
                to={`/workspaces/${ws.id}/board`}
                className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white p-3 hover:border-gray-200 transition-colors"
              >
                <div
                  className="w-8 h-8 rounded-md flex items-center justify-center text-base flex-shrink-0"
                  style={{ backgroundColor: ws.color + '18' }}
                >
                  {ws.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{ws.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {ws.publishedCount} published · {ws.pendingCount} pending
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ActivityList items={data.upcomingPublications} title={t('dashboard.upcoming_publications')} />
        <ActivityList items={data.recentActivity}       title={t('dashboard.recent_activity')} />
      </div>
    </div>
  );
}
