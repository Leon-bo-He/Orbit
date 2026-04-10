import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useDashboard } from '../api/analytics.js';
import { useUiStore } from '../store/ui.store.js';
import { BarChart } from '../components/charts/BarChart.js';
import { SkeletonCard } from '../components/ui/Skeleton.js';
import { PlatformIcon } from '../components/ui/PlatformIcon.js';
import { WorkspaceIconContent } from '../components/ui/WorkspaceIcon.js';
import type { ActivityItem, TopContent, TagPerformanceItem } from '../api/analytics.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(val: string | Date | null | undefined, locale: string): string {
  if (!val) return '';
  const d = typeof val === 'string' ? new Date(val) : val;
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(d);
}

function formatWeekLabel(isoDate: string, locale: string): string {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(d);
}

function formatShortDate(val: string | null | undefined, locale: string): string {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(d);
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

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: 'indigo' | 'green' | 'amber' | 'blue' | 'rose' | 'purple';
}) {
  const bar: Record<string, string> = {
    indigo: 'bg-indigo-500',
    green:  'bg-emerald-500',
    amber:  'bg-amber-400',
    blue:   'bg-blue-500',
    rose:   'bg-rose-500',
    purple: 'bg-purple-500',
  };
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 flex flex-col gap-1">
      {accent && <div className={`w-6 h-1 rounded-full mb-1 ${bar[accent]}`} />}
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 leading-tight">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold text-gray-700 mb-3">{children}</h2>;
}

// ─── Top Content Table ────────────────────────────────────────────────────────

function TopContentTable({ items, locale }: { items: TopContent[]; locale: string }) {
  const { t } = useTranslation('analytics');
  if (items.length === 0) {
    return <p className="text-sm text-gray-400 py-6 text-center">{t('table.no_data')}</p>;
  }
  const maxViews = Math.max(...items.map((i) => i.views), 1);
  return (
    <div className="overflow-hidden">
      <ul className="space-y-2">
        {items.map((item, idx) => (
          <li key={item.contentId} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
            <span className="text-xs font-semibold text-gray-400 w-4 text-center flex-shrink-0">
              {idx + 1}
            </span>
            <PlatformIcon platform={item.platform} className="w-5 h-5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{item.title}</p>
              <div className="mt-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-400"
                  style={{ width: `${(item.views / maxViews) * 100}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0 text-xs text-gray-500">
              <span className="flex items-center gap-1 min-w-[56px] justify-end">
                <span className="text-gray-400">👁</span> {item.views.toLocaleString()}
              </span>
              <span className="flex items-center gap-1 min-w-[44px] justify-end">
                <span className="text-gray-400">♥</span> {item.likes.toLocaleString()}
              </span>
              <span className="text-gray-400 hidden sm:block">{formatShortDate(item.publishedAt, locale)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Tag Performance ──────────────────────────────────────────────────────────

function TagPerformance({ items }: { items: TagPerformanceItem[] }) {
  const { t } = useTranslation('analytics');
  if (items.length === 0) {
    return <p className="text-sm text-gray-400 py-6 text-center">{t('table.no_tags')}</p>;
  }
  const maxViews = Math.max(...items.map((i) => i.avgViews), 1);
  return (
    <ul className="space-y-2">
      {items.slice(0, 8).map((item) => (
        <li key={item.tag} className="flex items-center gap-3">
          <span className="text-xs bg-indigo-50 text-indigo-600 rounded-full px-2 py-0.5 font-medium flex-shrink-0 min-w-[60px] text-center truncate max-w-[80px]">
            #{item.tag}
          </span>
          <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-300"
              style={{ width: `${(item.avgViews / maxViews) * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 w-16 text-right flex-shrink-0">
            {Math.round(item.avgViews).toLocaleString()} {t('frequency.avg')}
          </span>
          <span className="text-xs text-gray-400 w-10 text-right flex-shrink-0">
            {item.contentCount}✦
          </span>
        </li>
      ))}
    </ul>
  );
}

// ─── Activity List ────────────────────────────────────────────────────────────

function ActivityList({ items, title, locale }: { items: ActivityItem[]; title: string; locale: string }) {
  const { t } = useTranslation('common');
  const { t: tPub } = useTranslation('publications');
  return (
    <div className="rounded-xl border border-gray-100 bg-white">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 px-4 py-6 text-center">{t('status.empty')}</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {items.map((item) => (
            <li key={item.publication.id} className="flex items-center gap-2.5 px-4 py-2.5 text-sm">
              <span className="text-xs text-gray-400 w-24 flex-shrink-0 leading-tight">
                {formatDate(item.publication.scheduledAt ?? item.publication.publishedAt, locale)}
              </span>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.workspace.color }} />
              <PlatformIcon platform={item.publication.platform} className="w-4 h-4 flex-shrink-0" />
              <Link
                to={`/workspaces/${item.workspace.id}/contents/${item.content.id}/brief`}
                className="text-gray-700 hover:text-indigo-600 truncate flex-1 min-w-0"
              >
                {item.content.title}
              </Link>
              <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${STATUS_STYLES[item.publication.status] ?? ''}`}>
                {tPub(`status.${item.publication.status}`)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Publish Cadence mini-bar ────────────────────────────────────────────────

function CadenceBar({ week, month }: { week: number; month: number }) {
  const { t } = useTranslation('analytics');
  const daily = month > 0 ? (month / 30).toFixed(1) : '0';
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 flex flex-col gap-3">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{t('frequency.title')}</p>
      <div className="flex items-end gap-6">
        <div>
          <p className="text-2xl font-semibold text-gray-900">{week}</p>
          <p className="text-xs text-gray-400 mt-0.5">{t('frequency.this_week')}</p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-gray-900">{month}</p>
          <p className="text-xs text-gray-400 mt-0.5">{t('frequency.this_month')}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-lg font-semibold text-indigo-600">{daily}</p>
          <p className="text-xs text-gray-400 mt-0.5">{t('frequency.avg_per_day')}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { t } = useTranslation('analytics');
  const { data, isLoading, isError } = useDashboard();
  const setActiveWorkspace = useUiStore((s) => s.setActiveWorkspace);
  const locale = useUiStore((s) => s.locale);

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
    label: formatWeekLabel(w.weekStart, locale),
    value: w.views,
    secondaryValue: w.published,
  }));

  const totalComments = data.totalComments ?? 0;
  const totalContents = data.totalContents ?? 0;
  const publishRate = totalContents > 0
    ? Math.round((data.totalPublished / totalContents) * 100)
    : 0;

  return (
    <div className="p-8 space-y-8 max-w-5xl mx-auto">
      {/* Page header */}
      <div>
        <h1 className="text-[22px] font-semibold text-gray-900 tracking-tight">{t('dashboard.title')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{t('dashboard.subtitle')}</p>
      </div>

      {/* KPI row — 6 cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label={t('dashboard.total_contents')}
          value={totalContents}
          sub={`${publishRate}% ${t('dashboard.published_rate')}`}
          accent="indigo"
        />
        <StatCard
          label={t('dashboard.total_published')}
          value={data.totalPublished}
          accent="green"
        />
        <StatCard
          label={t('frequency.this_month')}
          value={data.thisMonthPublished}
          sub={t('frequency.posts_published')}
          accent="blue"
        />
        <StatCard
          label={t('dashboard.total_views')}
          value={data.totalViews.toLocaleString()}
          accent="purple"
        />
        <StatCard
          label={t('dashboard.total_likes')}
          value={data.totalLikes.toLocaleString()}
          accent="rose"
        />
        <StatCard
          label={t('dashboard.engagement_rate')}
          value={`${data.engagementRate.toFixed(1)}%`}
          sub={totalComments > 0 ? `${totalComments.toLocaleString()} ${t('dashboard.comments')}` : undefined}
          accent="amber"
        />
      </div>

      {/* Publish cadence */}
      <CadenceBar week={data.thisWeekPublished} month={data.thisMonthPublished} />

      {/* Weekly trend */}
      <div className="rounded-xl border border-gray-100 bg-white p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">{t('trend.weekly_trend')}</h2>
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
        <BarChart data={trendData} height={180} color="#6366f1" secondaryColor="#f59e0b" showSecondary />
      </div>

      {/* Top content + tag performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <SectionTitle>{t('table.top_content')}</SectionTitle>
          <TopContentTable items={data.topContents} locale={locale} />
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <SectionTitle>{t('table.tag_performance')}</SectionTitle>
          <TagPerformance items={data.tagPerformance} />
        </div>
      </div>

      {/* Workspace health */}
      {data.workspaces.length > 0 && (
        <div>
          <SectionTitle>{t('dashboard.workspaces')}</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.workspaces.map((ws) => {
              const total = ws.publishedCount + ws.pendingCount;
              const pct = total > 0 ? Math.round((ws.publishedCount / total) * 100) : 0;
              return (
                <Link
                  key={ws.id}
                  to={`/workspaces/${ws.id}/board`}
                  onClick={() => setActiveWorkspace(ws.id)}
                  className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 hover:border-gray-200 transition-colors"
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0 overflow-hidden"
                    style={{ backgroundColor: ws.color + '22' }}
                  >
                    <WorkspaceIconContent icon={ws.icon} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{ws.name}</p>
                    <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: ws.color }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {t('dashboard.published_pending', { published: ws.publishedCount, pending: ws.pendingCount })}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ActivityList items={data.upcomingPublications} title={t('dashboard.upcoming_publications')} locale={locale} />
        <ActivityList items={data.recentActivity}       title={t('dashboard.recent_activity')} locale={locale} />
      </div>
    </div>
  );
}
