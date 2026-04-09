import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Publication } from '@contentflow/shared';
import { usePublishQueue, useUpdatePublication, useMarkPublished } from '../api/publications.js';
import { MarkPublishedModal } from '../components/publications/MarkPublishedModal.js';
import { PlatformIcon } from '../components/ui/PlatformIcon.js';
import { DateTimePicker } from '../components/ui/DateTimePicker.js';
import { useUiStore } from '../store/ui.store.js';

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

function formatTime(val: Date | string | null | undefined, locale: string): string {
  if (!val) return '';
  const d = typeof val === 'string' ? new Date(val) : val;
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function formatDateHeader(dateStr: string, todayStr: string, tomorrowStr: string, t: (k: string) => string, locale: string): string {
  if (dateStr === todayStr) return t('queue_page.today');
  if (dateStr === tomorrowStr) return t('queue_page.tomorrow');
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat(locale, {
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

// ─── Filters ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'queued,ready', label: 'Queued + Ready' },
  { value: 'published', label: 'Published' },
  { value: 'failed', label: 'Failed' },
];

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Publications() {
  const { t } = useTranslation('publications');
  const locale = useUiStore((s) => s.locale);
  const updatePublication = useUpdatePublication();
  const markPublishedMutation = useMarkPublished();

  const today = new Date();
  const [statusFilter, setStatusFilter] = useState('queued,ready');
  const [fromIso, setFromIso] = useState(() => { const d = new Date(today); d.setHours(0, 0, 0, 0); return d.toISOString(); });
  const [toIso, setToIso] = useState(() => { const d = addDays(today, 14); d.setHours(23, 59, 59, 999); return d.toISOString(); });
  const [markPub, setMarkPub] = useState<Publication | null>(null);

  const queueFilters: { status?: string; from?: string; to?: string } = {
    from: isoDate(new Date(fromIso)),
    to: isoDate(new Date(toIso)),
  };
  if (statusFilter) queueFilters.status = statusFilter;

  const { data: queueItems = [], isLoading, isFetching, error } = usePublishQueue(queueFilters);

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
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold text-gray-900 tracking-tight">{t('queue_page.title')}</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end mb-6">
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('queue_page.filter_status')}</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200 bg-white"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.value === '' && t('queue_page.all_statuses')}
                {opt.value === 'queued,ready' && t('queue_page.queued_and_ready')}
                {opt.value === 'published' && t('status.published')}
                {opt.value === 'failed' && t('status.failed')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('queue_page.filter_from')}</label>
          <DateTimePicker
            value={fromIso}
            onChange={(iso) => { if (iso) { const d = new Date(iso); d.setHours(0, 0, 0, 0); setFromIso(d.toISOString()); } }}
            compact
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('queue_page.filter_to')}</label>
          <DateTimePicker
            value={toIso}
            onChange={(iso) => { if (iso) { const d = new Date(iso); d.setHours(23, 59, 59, 999); setToIso(d.toISOString()); } }}
            compact
          />
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      )}

      {/* Refetch indicator */}
      {!isLoading && isFetching && (
        <div className="flex justify-center mb-2">
          <div className="w-4 h-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-center py-12">
          <p className="text-red-500 text-sm">{t('error')}</p>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && sortedDates.length === 0 && (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-gray-500 font-medium mb-1">{t('queue_page.empty')}</p>
        </div>
      )}

      {/* Date groups */}
      {!isLoading && !error && (
        <div className={`space-y-6 transition-opacity duration-150 ${isFetching ? 'opacity-50' : 'opacity-100'}`}>
          {sortedDates.map((dateStr) => (
            <div key={dateStr}>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {formatDateHeader(dateStr, todayStr, tomorrowStr, t, locale)}
              </h2>
              <div className="space-y-2">
                {grouped[dateStr]!.map(({ publication: pub, content, workspace }) => (
                  <div
                    key={pub.id}
                    className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-gray-200 transition-colors"
                  >
                    {/* Time */}
                    <span className="text-xs font-medium text-gray-400 w-12 flex-shrink-0 text-right tabular-nums">
                      {formatTime(pub.scheduledAt, locale)}
                    </span>

                    {/* Workspace colour dot */}
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: workspace.color }}
                      title={workspace.name}
                    />

                    {/* Platform icon */}
                    <PlatformIcon platform={pub.platform} className="w-5 h-5 flex-shrink-0" />

                    {/* Content info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{content.title}</p>
                      <p className="text-xs text-gray-400 truncate">{workspace.name} · {t(`platforms.${pub.platform}`)}</p>
                    </div>

                    {/* Status badge */}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_STYLES[pub.status] ?? ''}`}>
                      {t(`status.${pub.status}`)}
                    </span>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {(pub.status === 'queued' || pub.status === 'ready') && (
                        <button
                          type="button"
                          onClick={() => setMarkPub(pub)}
                          className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded-md hover:bg-green-100 transition-colors"
                        >
                          {t('queue_page.btn_mark_published')}
                        </button>
                      )}
                      {pub.status === 'published' && pub.platformUrl && (
                        <a
                          href={pub.platformUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-md hover:bg-blue-100 transition-colors"
                        >
                          {t('queue_page.btn_view')}
                        </a>
                      )}
                      {pub.status === 'failed' && (
                        <button
                          type="button"
                          onClick={() => void handleRetry(pub, content.id)}
                          className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2 py-1 rounded-md hover:bg-orange-100 transition-colors"
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
      )}

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
