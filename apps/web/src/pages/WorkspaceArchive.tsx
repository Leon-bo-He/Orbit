import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Content } from '@contentflow/shared';
import { useWorkspaces } from '../api/workspaces.js';
import { useContents } from '../api/contents.js';
import { apiFetch } from '../api/client.js';
import { queryClient } from '../api/query-client.js';
import { ContentDrawer } from '../components/kanban/ContentDrawer.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { CalendarPicker } from '../components/ui/CalendarPicker.js';
import { toast } from '../store/toast.store.js';

function fmtDate(val: Date | string | null | undefined): string {
  if (!val) return '';
  const d = typeof val === 'string' ? new Date(val) : val;
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(navigator.language, {
    year: 'numeric', month: 'short', day: 'numeric',
  }).format(d);
}

function getArchivedAt(content: Content): string {
  const entry = [...(content.stageHistory ?? [])].reverse().find((e) => e.stage === 'archived');
  return entry ? fmtDate(entry.timestamp) : '';
}

function buildDateRange(tf: string, from: string, to: string): { from?: string; to?: string } {
  const now = new Date();
  const toISO = now.toISOString();
  if (tf === '30d') { const f = new Date(now); f.setDate(f.getDate() - 30); return { from: f.toISOString(), to: toISO }; }
  if (tf === '60d') { const f = new Date(now); f.setDate(f.getDate() - 60); return { from: f.toISOString(), to: toISO }; }
  if (tf === '90d') { const f = new Date(now); f.setDate(f.getDate() - 90); return { from: f.toISOString(), to: toISO }; }
  if (tf === '6m')  { const f = new Date(now); f.setMonth(f.getMonth() - 6); return { from: f.toISOString(), to: toISO }; }
  if (tf === '1y')  { const f = new Date(now); f.setFullYear(f.getFullYear() - 1); return { from: f.toISOString(), to: toISO }; }
  if (tf === 'custom') {
    const result: { from?: string; to?: string } = {};
    if (from) result.from = new Date(from).toISOString();
    if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); result.to = d.toISOString(); }
    return result;
  }
  return {};
}

// ─── Manage Archived Modal ────────────────────────────────────────────────────

function ManageArchivedModal({
  workspaceId,
  onClose,
}: {
  workspaceId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation('common');
  const today = new Date().toISOString().slice(0, 10);
  const [timeframe, setTimeframe] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [includeIdeas, setIncludeIdeas] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function buildParams(): URLSearchParams {
    const params = new URLSearchParams({ workspace: workspaceId });
    const range = buildDateRange(timeframe, customFrom, customTo);
    if (range.from) params.set('from', range.from);
    if (range.to) params.set('to', range.to);
    return params;
  }

  async function handleExport() {
    setExporting(true);
    try {
      const params = buildParams();
      if (includeIdeas) params.set('includeIdeas', 'true');
      const dateStr = new Date().toISOString().slice(0, 10);
      if (includeIdeas) {
        const result = await apiFetch<{ contents: unknown[]; ideas: unknown[] }>(`/api/contents/archived/export?${params.toString()}`);
        const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = `contentflow-archived-${dateStr}.json`; a.click();
        URL.revokeObjectURL(url);
        toast.success(t('settings.general.archived_export_success', { count: result.contents.length }));
      } else {
        const rows = await apiFetch<unknown[]>(`/api/contents/archived/export?${params.toString()}`);
        const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = `contentflow-archived-${dateStr}.json`; a.click();
        URL.revokeObjectURL(url);
        toast.success(t('settings.general.archived_export_success', { count: rows.length }));
      }
    } catch (err) {
      toast.error(t('settings.general.archived_export_error', { message: err instanceof Error ? err.message : String(err) }));
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const params = buildParams();
      if (includeIdeas) params.set('includeIdeas', 'true');
      const result = await apiFetch<{ deleted: number }>(`/api/contents/archived?${params.toString()}`, { method: 'DELETE' });
      toast.success(t('settings.general.archived_delete_success', { count: result.deleted }));
      void queryClient.invalidateQueries({ queryKey: ['contents', workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ['calendarContents', workspaceId] });
      if (includeIdeas) void queryClient.invalidateQueries({ queryKey: ['ideas'] });
      onClose();
    } catch (err) {
      toast.error(t('settings.general.archived_delete_error', { message: err instanceof Error ? err.message : String(err) }));
    } finally {
      setDeleting(false);
    }
  }

  const TIMEFRAME_OPTIONS = [
    { value: 'all', label: t('settings.general.archived_timeframe_all') },
    { value: '30d', label: t('settings.general.archived_timeframe_30') },
    { value: '60d', label: t('settings.general.archived_timeframe_60') },
    { value: '90d', label: t('settings.general.archived_timeframe_90') },
    { value: '6m',  label: t('settings.general.archived_timeframe_6m') },
    { value: '1y',  label: t('settings.general.archived_timeframe_1y') },
    { value: 'custom', label: t('settings.general.archived_timeframe_custom') },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">{t('settings.general.section_archived')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M2 2l10 10M12 2L2 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Timeframe */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-gray-700 flex-shrink-0">{t('settings.general.archived_timeframe')}</span>
            <div className="relative w-44">
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="appearance-none w-full bg-white text-sm text-gray-700 font-medium pl-3 pr-8 py-1.5 rounded-lg border border-gray-200 shadow-sm hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-colors cursor-pointer"
              >
                {TIMEFRAME_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Custom date range */}
          {timeframe === 'custom' && (
            <div className="flex items-center gap-2">
              <CalendarPicker
                value={customFrom}
                onChange={setCustomFrom}
                max={customTo || today}
                placeholder={t('settings.general.archived_custom_from')}
              />
              <span className="text-gray-400 text-sm flex-shrink-0">–</span>
              <CalendarPicker
                value={customTo}
                onChange={setCustomTo}
                min={customFrom}
                max={today}
                placeholder={t('settings.general.archived_custom_to')}
              />
            </div>
          )}

          {/* Include linked ideas */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-gray-700 flex-shrink-0">{t('settings.general.archived_include_ideas')}</span>
            <button
              onClick={() => setIncludeIdeas((v) => !v)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${includeIdeas ? 'bg-indigo-600' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${includeIdeas ? 'translate-x-4' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Delete confirmation */}
          {confirmDelete && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 space-y-3">
              <p className="text-sm text-red-700">
                {timeframe === 'all'
                  ? t('settings.general.archived_delete_desc_all')
                  : t('settings.general.archived_delete_desc', {
                      range: TIMEFRAME_OPTIONS.find((o) => o.value === timeframe)?.label ?? '',
                    })}
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-white transition-colors"
                >
                  {t('action.cancel')}
                </button>
                <button
                  onClick={() => void handleDelete()}
                  disabled={deleting}
                  className="text-sm px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {deleting ? t('settings.general.archived_deleting') : t('settings.general.archived_delete')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!confirmDelete && (
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
            <button
              onClick={() => void handleExport()}
              disabled={exporting}
              className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {exporting ? t('settings.general.archived_exporting') : t('settings.general.archived_export')}
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-sm px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
            >
              {t('settings.general.archived_delete')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Workspace Archive Page ───────────────────────────────────────────────────

export default function WorkspaceArchive() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { t } = useTranslation('contents');
  const { t: tCommon } = useTranslation('common');

  const { data: workspaces } = useWorkspaces();
  const workspace = workspaces?.find((w) => w.id === workspaceId);

  const { data: contents = [], isLoading } = useContents(workspaceId ?? '');
  const archived = contents.filter((c) => c.stage === 'archived');

  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [showManageModal, setShowManageModal] = useState(false);

  const liveSelected = selectedContent
    ? (contents.find((c) => c.id === selectedContent.id) ?? selectedContent)
    : null;

  const accentColor = workspace?.color ?? '#6366f1';

  if (!workspaceId) {
    return <div className="p-6 text-gray-500">{t('column.workspace_not_found')}</div>;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          {workspace && (
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: accentColor }} />
          )}
          <h1 className="text-[22px] font-semibold text-gray-900 tracking-tight">
            {workspace ? `${workspace.icon} ${workspace.name}` : ''} — {tCommon('nav.archive')}
          </h1>
          <span className="ml-1 text-sm text-gray-400 font-normal">{archived.length}</span>
        </div>
        <button
          onClick={() => setShowManageModal(true)}
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="10" cy="10" r="2.5"/>
            <path d="M10 3v1.5M10 15.5V17M3 10h1.5M15.5 10H17M5.05 5.05l1.06 1.06M13.89 13.89l1.06 1.06M14.95 5.05l-1.06 1.06M6.11 13.89l-1.06 1.06" strokeLinecap="round"/>
          </svg>
          {tCommon('action.manage')}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-4 px-4 py-3 bg-white rounded-lg border border-gray-100">
                <Skeleton variant="text" className="flex-1 h-4" />
                <Skeleton variant="text" className="w-20 h-4" />
                <Skeleton variant="text" className="w-24 h-4" />
              </div>
            ))}
          </div>
        ) : archived.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
            <span className="text-4xl">🗄</span>
            <p className="text-sm">{t('column.empty')}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            {/* Table header */}
            <div className="hidden md:grid grid-cols-[1fr_120px_140px_140px] gap-4 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wide">
              <span>{t('archive.col_title')}</span>
              <span>{t('archive.col_type')}</span>
              <span>{t('archive.col_published')}</span>
              <span>{t('archive.col_archived')}</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-gray-100">
              {archived.map((content) => {
                const archivedAt = getArchivedAt(content);
                const publishedAt = fmtDate(content.publishedAt);
                return (
                  <button
                    key={content.id}
                    onClick={() => setSelectedContent(content)}
                    className="w-full text-left hover:bg-gray-50 transition-colors group"
                  >
                    {/* Desktop row */}
                    <div className="hidden md:grid grid-cols-[1fr_120px_140px_140px] gap-4 px-4 py-3 items-center">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate group-hover:text-indigo-600 transition-colors">
                          {content.title}
                        </p>
                        {content.tags.length > 0 && (
                          <div className="flex gap-1 mt-0.5 flex-wrap">
                            {content.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="text-[10px] bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">
                                {tag}
                              </span>
                            ))}
                            {content.tags.length > 3 && (
                              <span className="text-[10px] text-gray-400">+{content.tags.length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <span className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5 w-fit">
                        {t(`content_types.${content.contentType}`)}
                      </span>
                      <span className={`text-xs ${publishedAt ? 'text-green-600' : 'text-gray-300'}`}>
                        {publishedAt || '—'}
                      </span>
                      <span className="text-xs text-gray-400">{archivedAt || '—'}</span>
                    </div>

                    {/* Mobile row */}
                    <div className="md:hidden flex items-start gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{content.title}</p>
                        <span className="text-[10px] bg-gray-100 text-gray-500 rounded px-1.5 py-0.5 mt-1 inline-block">
                          {t(`content_types.${content.contentType}`)}
                        </span>
                      </div>
                      <div className="flex-shrink-0 text-right space-y-0.5">
                        {publishedAt && <p className="text-[10px] text-green-600">✓ {publishedAt}</p>}
                        {archivedAt && <p className="text-[10px] text-gray-400">🗄 {archivedAt}</p>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {liveSelected && (
        <ContentDrawer
          content={liveSelected}
          workspaceId={workspaceId}
          onClose={() => setSelectedContent(null)}
        />
      )}

      {showManageModal && (
        <ManageArchivedModal
          workspaceId={workspaceId}
          onClose={() => setShowManageModal(false)}
        />
      )}
    </div>
  );
}
