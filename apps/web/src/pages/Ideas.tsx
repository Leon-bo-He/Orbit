import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useIdeas, type IdeaFilters } from '../api/ideas.js';
import { useWorkspaces } from '../api/workspaces.js';
import { apiFetch } from '../api/client.js';
import { queryClient } from '../api/query-client.js';
import { ApiError } from '../api/client.js';
import { IdeaCard } from '../components/ideas/IdeaCard.js';
import { IdeaFiltersBar } from '../components/ideas/IdeaFilters.js';
import { IdeaCaptureModal } from '../components/ideas/IdeaCaptureModal.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { CalendarPicker } from '../components/ui/CalendarPicker.js';
import { toast } from '../store/toast.store.js';
import type { Workspace } from '@contentflow/shared';

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

// ─── Manage Archived Ideas Modal ──────────────────────────────────────────────

function ManageArchivedIdeasModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('common');
  const { data: workspacesData } = useWorkspaces();
  const today = new Date().toISOString().slice(0, 10);

  const [workspaceId, setWorkspaceId] = useState('');
  const [timeframe, setTimeframe] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [exporting, setExporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function buildParams(): URLSearchParams {
    const params = new URLSearchParams();
    if (workspaceId && workspaceId !== 'all') params.set('workspace', workspaceId);
    const range = buildDateRange(timeframe, customFrom, customTo);
    if (range.from) params.set('from', range.from);
    if (range.to) params.set('to', range.to);
    return params;
  }

  async function handleExport() {
    if (!workspaceId) return;
    setExporting(true);
    try {
      const params = buildParams();
      const rows = await apiFetch<unknown[]>(`/api/ideas/archived/export?${params.toString()}`);
      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = `contentflow-archived-ideas-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      URL.revokeObjectURL(url);
      toast.success(t('settings.general.archived_ideas_export_success', { count: rows.length }));
    } catch (err) {
      toast.error(t('settings.general.archived_ideas_export_error', { message: err instanceof Error ? err.message : String(err) }));
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    if (!workspaceId) return;
    setDeleting(true);
    try {
      const params = buildParams();
      const result = await apiFetch<{ deleted: number }>(`/api/ideas/archived?${params.toString()}`, { method: 'DELETE' });
      toast.success(t('settings.general.archived_ideas_delete_success', { count: result.deleted }));
      void queryClient.invalidateQueries({ queryKey: ['ideas'] });
      onClose();
    } catch (err) {
      toast.error(t('settings.general.archived_ideas_delete_error', { message: err instanceof Error ? err.message : String(err) }));
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
          <h2 className="text-sm font-semibold text-gray-900">{t('settings.general.section_archived_ideas')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M2 2l10 10M12 2L2 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Workspace */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-gray-700 flex-shrink-0">{t('settings.general.archived_workspace')}</span>
            <div className="relative w-44">
              <select
                value={workspaceId}
                onChange={(e) => { setWorkspaceId(e.target.value); setConfirmDelete(false); }}
                className="appearance-none w-full bg-white text-sm text-gray-700 font-medium pl-3 pr-8 py-1.5 rounded-lg border border-gray-200 shadow-sm hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-colors cursor-pointer"
              >
                <option value="">{t('settings.general.archived_select_workspace')}</option>
                <option value="all">{t('settings.general.archived_all_workspaces')}</option>
                {workspacesData?.map((ws) => (
                  <option key={ws.id} value={ws.id}>{ws.name}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

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

          {/* Delete confirmation */}
          {confirmDelete && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 space-y-3">
              <p className="text-sm text-red-700">
                {timeframe === 'all'
                  ? t('settings.general.archived_ideas_delete_desc_all')
                  : t('settings.general.archived_ideas_delete_desc', {
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
              disabled={!workspaceId || exporting}
              className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {exporting ? t('settings.general.archived_exporting') : t('settings.general.archived_export')}
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={!workspaceId}
              className="text-sm px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              {t('settings.general.archived_delete')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Ideas Page ───────────────────────────────────────────────────────────────

export default function Ideas() {
  const { t } = useTranslation('ideas');
  const { t: tCommon } = useTranslation('common');
  const [filters, setFilters] = useState<IdeaFilters>({ status: 'active' });
  const [modalOpen, setModalOpen] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);

  const { data: ideas, isLoading, isFetching, error } = useIdeas(filters);
  const { data: workspaces } = useWorkspaces();

  // Build a workspace lookup map
  const wsMap = new Map<string, Workspace>(
    workspaces?.map((ws) => [ws.id, ws]) ?? []
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === 'KeyI') {
        e.preventDefault();
        setModalOpen(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle 401 gracefully
  if (error instanceof ApiError && error.status === 401) {
    return (
      <div className="p-6">
        <p className="text-gray-500">{t('login_required')}</p>
      </div>
    );
  }

  const isArchiveView = filters.status === 'archived';

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[22px] font-semibold text-gray-900 tracking-tight">{t('title')}</h1>
        <div className="flex items-center gap-2">
          {isArchiveView && (
            <button
              onClick={() => setShowManageModal(true)}
              className="hidden md:inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="10" cy="10" r="2.5"/>
                <path d="M10 3v1.5M10 15.5V17M3 10h1.5M15.5 10H17M5.05 5.05l1.06 1.06M13.89 13.89l1.06 1.06M14.95 5.05l-1.06 1.06M6.11 13.89l-1.06 1.06" strokeLinecap="round"/>
              </svg>
              {tCommon('action.manage')}
            </button>
          )}
          <button
            onClick={() => setModalOpen(true)}
            className="hidden md:inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 transition-colors"
          >
            <span className="text-base leading-none">+</span>
            {t('quick_capture')}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-5">
        <IdeaFiltersBar filters={filters} onChange={setFilters} />
      </div>

      {/* Initial loading state — skeletons only when there's no data at all yet */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
              <Skeleton variant="text" className="w-2/3" />
              <Skeleton variant="text" className="w-full" />
              <Skeleton variant="text" className="w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && !(error instanceof ApiError && error.status === 401) && (
        <div className="text-center py-12">
          <p className="text-red-500 text-sm">{error.message}</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && ideas?.length === 0 && (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">💡</div>
          <h3 className="text-gray-700 font-medium mb-1">{t('empty.heading')}</h3>
          <p className="text-gray-400 text-sm">{t('empty.body')}</p>
        </div>
      )}

      {/* Ideas grid — kept visible while re-fetching with a subtle opacity fade */}
      {!isLoading && ideas && ideas.length > 0 && (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 transition-opacity duration-150"
          style={{ opacity: isFetching ? 0.5 : 1 }}
        >
          {ideas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              workspaceName={
                idea.workspaceId ? wsMap.get(idea.workspaceId)?.name : undefined
              }
            />
          ))}
        </div>
      )}

      {/* Mobile FAB */}
      <button
        onClick={() => setModalOpen(true)}
        className="md:hidden fixed bottom-20 right-4 z-50 w-12 h-12 rounded-full bg-indigo-600 text-white shadow-md flex items-center justify-center text-xl hover:bg-indigo-700 transition-colors"
        aria-label={t('quick_capture')}
      >
        +
      </button>

      {/* Quick Capture Modal */}
      <IdeaCaptureModal open={modalOpen} onClose={() => setModalOpen(false)} />

      {/* Manage Archived Ideas Modal */}
      {showManageModal && (
        <ManageArchivedIdeasModal onClose={() => setShowManageModal(false)} />
      )}
    </div>
  );
}
