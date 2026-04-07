import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Publication } from '@contentflow/shared';
import { usePublishQueue, useUpdatePublication, useMarkPublished } from '../api/publications.js';
import { MarkPublishedModal } from '../components/publications/MarkPublishedModal.js';

// ─── Date helpers ────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function formatTime(val: Date | string | null | undefined): string {
  if (!val) return '';
  const d = typeof val === 'string' ? new Date(val) : val;
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(navigator.language, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function formatDateHeader(dateStr: string, todayStr: string, tomorrowStr: string, t: (k: string) => string): string {
  if (dateStr === todayStr) return t('queue_page.today');
  if (dateStr === tomorrowStr) return t('queue_page.tomorrow');
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat(navigator.language, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  queued: 'bg-blue-100 text-blue-700',
  ready: 'bg-yellow-100 text-yellow-700',
  posting: 'bg-purple-100 text-purple-700',
  published: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  skipped: 'bg-gray-100 text-gray-400 line-through',
};

const PLATFORM_EMOJI: Record<string, string> = {
  douyin: '🎵',
  xiaohongshu: '📕',
  weixin: '📰',
  weixin_video: '📱',
  bilibili: '🎬',
  x: '🐦',
  youtube: '▶️',
  instagram: '📷',
};

// ─── Filters ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'queued', label: 'Queued' },
  { value: 'ready', label: 'Ready' },
  { value: 'posting', label: 'Posting' },
  { value: 'published', label: 'Published' },
  { value: 'failed', label: 'Failed' },
];

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Publications() {
  const { t } = useTranslation('publications');
  const updatePublication = useUpdatePublication();
  const markPublishedMutation = useMarkPublished();

  const today = new Date();
  const [statusFilter, setStatusFilter] = useState('queued,ready');
  const [fromDate, setFromDate] = useState(isoDate(today));
  const [toDate, setToDate] = useState(isoDate(addDays(today, 14)));
  const [markPub, setMarkPub] = useState<Publication | null>(null);

  const queueFilters: { status?: string; from?: string; to?: string } = {
    from: fromDate,
    to: toDate,
  };
  if (statusFilter) queueFilters.status = statusFilter;

  const { data: queueItems = [], isLoading, error, refetch } = usePublishQueue(queueFilters);

  // Group by date
  const grouped: Record<string, typeof queueItems> = {};
  for (const item of queueItems) {
    const pub = item.publication;
    const ds = pub.scheduledAt ? isoDate(new Date(pub.scheduledAt as unknown as string)) : 'unscheduled';
    if (!grouped[ds]) grouped[ds] = [];
    grouped[ds].push(item);
  }
  const sortedDates = Object.keys(grouped).sort();

  const todayStr = isoDate(today);
  const tomorrowStr = isoDate(addDays(today, 1));

  async function handleRetry(pub: Publication, contentId: string) {
    await updatePublication.mutateAsync({
      id: pub.id,
      contentId,
      data: { status: 'queued' },
    });
  }

  void markPublishedMutation; // used via setMarkPub

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 py-5 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h1 className="text-[22px] font-semibold text-gray-900 tracking-tight">{t('queue_page.title')}</h1>
          <button
            type="button"
            onClick={() => void refetch()}
            className="text-xs px-3 py-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
          >
            ↻ Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('queue_page.filter_status')}</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.value ? t(`status.${opt.value}`) : t('queue_page.all_statuses')}
                </option>
              ))}
              <option value="queued,ready">Queued + Ready</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('queue_page.filter_from')}</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="text-sm border border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('queue_page.filter_to')}</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="text-sm border border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-8 py-5">
        {isLoading && (
          <p className="text-sm text-gray-400 text-center py-10">Loading…</p>
        )}
        {error && (
          <p className="text-sm text-red-500 text-center py-10">{String(error)}</p>
        )}
        {!isLoading && !error && sortedDates.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-400 text-sm">{t('queue_page.empty')}</p>
          </div>
        )}

        {sortedDates.map((dateStr) => (
          <div key={dateStr} className="mb-6">
            {/* Date header */}
            <h2 className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wide">
              {formatDateHeader(dateStr, todayStr, tomorrowStr, t)}
            </h2>

            <div className="space-y-2">
              {grouped[dateStr]!.map(({ publication: pub, content, workspace }) => (
                <div
                  key={pub.id}
                  className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-lg hover:border-gray-200 transition-colors"
                >
                  {/* Time */}
                  <span className="text-xs font-medium text-gray-400 w-12 flex-shrink-0 text-right">
                    {formatTime(pub.scheduledAt)}
                  </span>

                  {/* Workspace dot */}
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: workspace.color }}
                    title={workspace.name}
                  />

                  {/* Platform emoji */}
                  <span className="text-base flex-shrink-0">{PLATFORM_EMOJI[pub.platform] ?? '📱'}</span>

                  {/* Content title */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{content.title}</p>
                    <p className="text-xs text-gray-400">{workspace.name} · {t(`platforms.${pub.platform}`)}</p>
                  </div>

                  {/* Status badge */}
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_STYLES[pub.status] ?? ''}`}
                  >
                    {t(`status.${pub.status}`)}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {(pub.status === 'queued' || pub.status === 'ready') && (
                      <button
                        type="button"
                        onClick={() => setMarkPub(pub)}
                        className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded hover:bg-green-100 transition-colors"
                      >
                        {t('queue_page.btn_mark_published')}
                      </button>
                    )}
                    {pub.status === 'published' && pub.platformUrl && (
                      <a
                        href={pub.platformUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded hover:bg-blue-100 transition-colors"
                      >
                        {t('queue_page.btn_view')}
                      </a>
                    )}
                    {pub.status === 'failed' && (
                      <button
                        type="button"
                        onClick={() => void handleRetry(pub, content.id)}
                        className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2 py-1 rounded hover:bg-orange-100 transition-colors"
                      >
                        {t('queue_page.btn_retry')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Mark Published Modal */}
      {markPub && (
        <MarkPublishedModal
          publication={markPub}
          onClose={() => setMarkPub(null)}
        />
      )}
    </div>
  );
}
