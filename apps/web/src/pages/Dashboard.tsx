import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useDashboard } from '../api/analytics.js';
import { BarChart } from '../components/charts/BarChart.js';
import type { ActivityItem } from '../api/analytics.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(val: string | Date | null | undefined): string {
  if (!val) return '';
  const d = typeof val === 'string' ? new Date(val) : val;
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(navigator.language, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  queued: 'bg-blue-100 text-blue-700',
  ready: 'bg-yellow-100 text-yellow-700',
  posting: 'bg-purple-100 text-purple-700',
  published: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  skipped: 'bg-gray-100 text-gray-400',
};

const PLATFORM_EMOJI: Record<string, string> = {
  douyin: '🎵',
  xiaohongshu: '📕',
  weixin: '📰',
  weixin_video: '📱',
  bilibili: '🎬',
  x: '🐦',
  youtube: '▶️',
  instagram: '📸',
  tiktok: '🎶',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  emoji,
  label,
  value,
}: {
  emoji: string;
  label: string;
  value: string | number;
}) {
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

function ActivityList({ items, title }: { items: ActivityItem[]; title: string }) {
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-3">{title}</h3>
        <p className="text-sm text-gray-400">No items.</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <h3 className="font-semibold text-gray-900 mb-3">{title}</h3>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.publication.id} className="flex items-center gap-2 text-sm">
            <span className="text-xs text-gray-400 w-28 flex-shrink-0">
              {formatDate(item.publication.scheduledAt ?? item.publication.publishedAt)}
            </span>
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.workspace.color }}
            />
            <span className="flex-shrink-0">
              {PLATFORM_EMOJI[item.publication.platform] ?? '📄'}
            </span>
            <Link
              to={`/workspaces/${item.workspace.id}/contents/${item.content.id}/brief`}
              className="text-gray-800 hover:text-indigo-600 truncate flex-1 min-w-0"
            >
              {item.content.title}
            </Link>
            <span
              className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                STATUS_STYLES[item.publication.status] ?? 'bg-gray-100 text-gray-600'
              }`}
            >
              {item.publication.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const { t } = useTranslation('analytics');
  const { data, isLoading, isError } = useDashboard();

  if (isLoading) {
    return (
      <div className="p-6 text-gray-400">{t('dashboard.loading')}</div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-6 text-red-500">{t('dashboard.error')}</div>
    );
  }

  const trendData = data.weeklyTrend.map((w) => ({
    label: formatWeekLabel(w.weekStart),
    value: w.views,
    secondaryValue: w.published,
  }));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('dashboard.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('dashboard.subtitle')}</p>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard emoji="📤" label={t('dashboard.total_published')} value={data.totalPublished} />
        <StatCard emoji="👁" label={t('dashboard.total_views')} value={data.totalViews.toLocaleString()} />
        <StatCard emoji="❤️" label={t('dashboard.total_likes')} value={data.totalLikes.toLocaleString()} />
        <StatCard emoji="📊" label={t('dashboard.engagement_rate')} value={`${data.engagementRate.toFixed(2)}%`} />
      </div>

      {/* Weekly trend chart */}
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

      {/* Workspace health cards */}
      {data.workspaces.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-900 mb-3">{t('dashboard.workspaces')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.workspaces.map((ws) => (
              <Link
                key={ws.id}
                to={`/workspaces/${ws.id}/board`}
                className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow flex items-start gap-3"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                  style={{ backgroundColor: ws.color + '20', color: ws.color }}
                >
                  {ws.icon}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{ws.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {ws.publishedCount} published · {ws.pendingCount} pending
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Activity lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActivityList
          items={data.upcomingPublications}
          title={t('dashboard.upcoming_publications')}
        />
        <ActivityList
          items={data.recentActivity}
          title={t('dashboard.recent_activity')}
        />
      </div>
    </div>
  );
}
