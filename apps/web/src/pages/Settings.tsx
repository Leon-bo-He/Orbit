import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Workspace } from '@orbit/shared';
import { useWorkspaces, useUpdateWorkspace, useUploadWorkspaceIcon } from '../api/workspaces.js';
import { useCustomPlatforms, useCreateCustomPlatform, useDeleteCustomPlatform } from '../api/custom-platforms.js';
import type { CustomPlatform } from '../api/custom-platforms.js';
import { useUpdateProfile, useChangePassword, useDeleteAccount, useLogout } from '../api/auth.js';
import { apiFetch } from '../api/client.js';
import { queryClient } from '../api/query-client.js';
import { useAuthStore } from '../store/auth.store.js';
import { useUiStore, type Theme } from '../store/ui.store.js';
import { CreateWorkspaceModal } from '../components/workspaces/CreateWorkspaceModal.js';
import { ColorPicker } from '../components/ui/ColorPicker.js';
import { WorkspaceIconContent, isIconUrl } from '../components/ui/WorkspaceIcon.js';
import { PlatformIcon } from '../components/ui/PlatformIcon.js';
import { CalendarPicker } from '../components/ui/CalendarPicker.js';
import i18n, { SUPPORTED_LOCALES, type SupportedLocale } from '../i18n/index.js';
import { toast } from '../store/toast.store.js';

type Section = 'account' | 'appearance' | 'workspaces' | 'platforms' | 'notifications' | 'data';


const LOCALE_META: Record<SupportedLocale, { label: string }> = {
  'zh-CN': { label: '简体中文' },
  'zh-TW': { label: '繁體中文' },
  'en-US': { label: 'English' },
  'ja-JP': { label: '日本語' },
  'ko-KR': { label: '한국어' },
};

const EMOJI_OPTIONS = [
  '🎬', '📸', '✍️', '🎙', '📺', '🎮',
  '💄', '👗', '🍜', '✈️', '💪', '🐱',
  '🌿', '🎨', '📚', '🎵', '🏠',
  '💼', '🍕', '🎯', '🚀', '💡',
];

const ROW = 'flex items-center justify-between py-3 border-b border-gray-100';
const LABEL = 'text-sm font-medium text-gray-900';

// ─── Edit Workspace Modal ─────────────────────────────────────────────────────

function EditWorkspaceModal({ workspace, onClose }: { workspace: Workspace; onClose: () => void }) {
  const { t } = useTranslation('workspaces');
  const updateWorkspace = useUpdateWorkspace();
  const uploadIcon = useUploadWorkspaceIcon();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(workspace.name);
  const [icon, setIcon] = useState(workspace.icon);
  // Pre-populate the custom field only when the saved icon is not a preset and not a URL
  const [customEmoji, setCustomEmoji] = useState(
    !isIconUrl(workspace.icon) && !EMOJI_OPTIONS.includes(workspace.icon) ? workspace.icon : '',
  );
  const [color, setColor] = useState(workspace.color);
  const [about, setAbout] = useState((workspace as Workspace & { about?: string }).about ?? '');
  const [goalCount, setGoalCount] = useState(workspace.publishGoal?.count ?? 3);
  const [goalPeriod, setGoalPeriod] = useState<'day' | 'week' | 'month'>(workspace.publishGoal?.period ?? 'week');

  function selectPreset(emoji: string) {
    setIcon(emoji);
    setCustomEmoji('');
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await uploadIcon.mutateAsync(file);
    setIcon(result.url);
    setCustomEmoji('');
    e.target.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await updateWorkspace.mutateAsync({
      id: workspace.id,
      data: {
        name: name.trim(),
        icon,
        color,
        about: about.trim() || undefined,
        publishGoal: { count: goalCount, period: goalPeriod },
      },
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('edit_title')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
            {/* Preview */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <span
                className="w-10 h-10 rounded-full flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden"
                style={{ backgroundColor: color + '33' }}
              >
                <WorkspaceIconContent icon={icon} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {name || <span className="text-gray-400 font-normal">{t('name_placeholder')}</span>}
                </p>
                {about && <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{about}</p>}
              </div>
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('name')}</label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            {/* Icon — preset grid + custom emoji input + image upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('icon_label')}</label>
              <div className="grid grid-cols-8 gap-1">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => selectPreset(emoji)}
                    className={`text-xl rounded-lg py-1.5 transition-colors ${
                      icon === emoji && !customEmoji
                        ? 'bg-indigo-100 dark:bg-indigo-900 ring-2 ring-indigo-400'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
                {/* Custom emoji — one grid cell */}
                <input
                  type="text"
                  value={customEmoji}
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    setCustomEmoji(e.target.value);
                    setIcon(val || EMOJI_OPTIONS[0]!);
                  }}
                  maxLength={10}
                  className={`text-xl text-center border rounded-lg py-1.5 outline-none focus:ring-2 focus:ring-indigo-200 dark:bg-gray-700 dark:text-white transition-colors min-w-0 ${
                    customEmoji
                      ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30'
                      : 'border-gray-200 dark:border-gray-600'
                  }`}
                />
                {/* Upload image — one grid cell */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={(e) => void handleFileChange(e)}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadIcon.isPending}
                  title={isIconUrl(icon) ? t('icon_change_image') : t('icon_upload_image')}
                  className={`flex items-center justify-center rounded-lg py-1.5 border transition-colors min-w-0 ${
                    isIconUrl(icon)
                      ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {uploadIcon.isPending ? (
                    <span className="text-xs">…</span>
                  ) : isIconUrl(icon) ? (
                    <img src={icon} alt="" className="w-4 h-4 rounded-full object-cover" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Color */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('color_label')}</label>
              <ColorPicker value={color} onChange={setColor} />
            </div>

            {/* About */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('about_label')}</label>
              <textarea
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                placeholder={t('about_placeholder')}
                rows={2}
                maxLength={500}
                className="w-full text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
              />
            </div>

            {/* Publish target */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('publish_goal')}</label>
              <div className="flex items-center gap-2">
                <select
                  value={goalPeriod}
                  onChange={(e) => setGoalPeriod(e.target.value as 'day' | 'week' | 'month')}
                  className="text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="day">{t('publish_period.day')}</option>
                  <option value="week">{t('publish_period.week')}</option>
                  <option value="month">{t('publish_period.month')}</option>
                </select>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={goalCount}
                  onChange={(e) => setGoalCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200 text-center"
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('publish_goal_unit')}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900">
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={updateWorkspace.isPending}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {updateWorkspace.isPending ? '…' : t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── General Panel ────────────────────────────────────────────────────────────

function getArchivedDateRange(tf: string, from: string, to: string): { from?: string; to?: string } {
  const now = new Date();
  const toISO = now.toISOString();
  if (tf === 'all') return {};
  if (tf === '30d') { const f = new Date(now); f.setDate(f.getDate() - 30); return { from: f.toISOString(), to: toISO }; }
  if (tf === '60d') { const f = new Date(now); f.setDate(f.getDate() - 60); return { from: f.toISOString(), to: toISO }; }
  if (tf === '90d') { const f = new Date(now); f.setDate(f.getDate() - 90); return { from: f.toISOString(), to: toISO }; }
  if (tf === '6m') { const f = new Date(now); f.setMonth(f.getMonth() - 6); return { from: f.toISOString(), to: toISO }; }
  if (tf === '1y') { const f = new Date(now); f.setFullYear(f.getFullYear() - 1); return { from: f.toISOString(), to: toISO }; }
  if (tf === 'custom') {
    const result: { from?: string; to?: string } = {};
    if (from) result.from = new Date(from).toISOString();
    if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); result.to = d.toISOString(); }
    return result;
  }
  return {};
}

function getArchivedRangeLabel(tf: string, from: string, to: string): string {
  const now = new Date();
  const fmt = (d: Date) => d.toLocaleDateString();
  if (tf === '30d') { const f = new Date(now); f.setDate(f.getDate() - 30); return `${fmt(f)} – ${fmt(now)}`; }
  if (tf === '60d') { const f = new Date(now); f.setDate(f.getDate() - 60); return `${fmt(f)} – ${fmt(now)}`; }
  if (tf === '90d') { const f = new Date(now); f.setDate(f.getDate() - 90); return `${fmt(f)} – ${fmt(now)}`; }
  if (tf === '6m') { const f = new Date(now); f.setMonth(f.getMonth() - 6); return `${fmt(f)} – ${fmt(now)}`; }
  if (tf === '1y') { const f = new Date(now); f.setFullYear(f.getFullYear() - 1); return `${fmt(f)} – ${fmt(now)}`; }
  if (tf === 'custom') {
    const parts: string[] = [];
    if (from) parts.push(fmt(new Date(from)));
    if (to) parts.push(fmt(new Date(to)));
    return parts.join(' – ');
  }
  return '';
}

// ─── Appearance Panel ─────────────────────────────────────────────────────────

function AppearancePanel() {
  const { t } = useTranslation('common');
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  const THEME_OPTIONS: { value: Theme; label: string }[] = [
    { value: 'system', label: t('settings.general.theme_system') },
    { value: 'light',  label: t('settings.general.theme_light')  },
    { value: 'dark',   label: t('settings.general.theme_dark')   },
  ];

  return (
    <div>
      <div className="rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className={ROW + ' px-4 border-b-0'}>
          <span className={LABEL}>{t('settings.general.appearance')}</span>
          <div className="flex rounded-md border border-gray-200 dark:border-gray-600 overflow-hidden text-sm flex-shrink-0">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={`px-2.5 py-1.5 transition-colors text-xs sm:text-sm ${
                  theme === opt.value
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Data Panel ───────────────────────────────────────────────────────────────

function DataPanel() {
  const { t } = useTranslation('common');
  const { data: workspacesData } = useWorkspaces();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [archivedWorkspaceId, setArchivedWorkspaceId] = useState<string>('');
  const [archivedTimeframe, setArchivedTimeframe] = useState<string>('all');
  const [customFromDate, setCustomFromDate] = useState<string>('');
  const [customToDate, setCustomToDate] = useState<string>('');
  const [includeIdeas, setIncludeIdeas] = useState(false);
  const [exportingArchived, setExportingArchived] = useState(false);
  const [deletingArchived, setDeletingArchived] = useState(false);
  const [showArchivedDeleteConfirm, setShowArchivedDeleteConfirm] = useState(false);
  const [archivedIdeasWorkspaceId, setArchivedIdeasWorkspaceId] = useState<string>('');
  const [archivedIdeasTimeframe, setArchivedIdeasTimeframe] = useState<string>('all');
  const [customIdeasFromDate, setCustomIdeasFromDate] = useState<string>('');
  const [customIdeasToDate, setCustomIdeasToDate] = useState<string>('');
  const [exportingArchivedIdeas, setExportingArchivedIdeas] = useState(false);
  const [deletingArchivedIdeas, setDeletingArchivedIdeas] = useState(false);
  const [showArchivedIdeasDeleteConfirm, setShowArchivedIdeasDeleteConfirm] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await apiFetch<Blob>('/api/export', { headers: { Accept: 'application/json' } });
      const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orbit-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  function buildArchivedParams(workspaceId: string, tf: string, from: string, to: string): URLSearchParams {
    const params = new URLSearchParams();
    // 'all' means no workspace filter (server queries across all user workspaces)
    if (workspaceId && workspaceId !== 'all') params.set('workspace', workspaceId);
    const range = getArchivedDateRange(tf, from, to);
    if (range.from) params.set('from', range.from);
    if (range.to) params.set('to', range.to);
    return params;
  }

  function downloadJson(data: unknown, filename: string) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleExportArchived() {
    if (!archivedWorkspaceId) return; // '' = nothing selected
    setExportingArchived(true);
    try {
      const params = buildArchivedParams(archivedWorkspaceId, archivedTimeframe, customFromDate, customToDate);
      if (includeIdeas) params.set('includeIdeas', 'true');
      const dateStr = new Date().toISOString().slice(0, 10);
      if (includeIdeas) {
        const result = await apiFetch<{ contents: unknown[]; ideas: unknown[] }>(`/api/contents/archived/export?${params.toString()}`);
        downloadJson(result, `orbit-archived-${dateStr}.json`);
        toast.success(t('settings.general.archived_export_success', { count: result.contents.length }));
      } else {
        const rows = await apiFetch<unknown[]>(`/api/contents/archived/export?${params.toString()}`);
        downloadJson(rows, `orbit-archived-${dateStr}.json`);
        toast.success(t('settings.general.archived_export_success', { count: rows.length }));
      }
    } catch (err) {
      toast.error(t('settings.general.archived_export_error', { message: err instanceof Error ? err.message : String(err) }));
    } finally {
      setExportingArchived(false);
    }
  }

  async function handleDeleteArchived() {
    if (!archivedWorkspaceId) return; // '' = nothing selected
    setDeletingArchived(true);
    try {
      const params = buildArchivedParams(archivedWorkspaceId, archivedTimeframe, customFromDate, customToDate);
      if (includeIdeas) params.set('includeIdeas', 'true');
      const result = await apiFetch<{ deleted: number }>(`/api/contents/archived?${params.toString()}`, { method: 'DELETE' });
      toast.success(t('settings.general.archived_delete_success', { count: result.deleted }));
      setShowArchivedDeleteConfirm(false);
      // Invalidate all content caches (specific workspace or all)
      void queryClient.invalidateQueries({ queryKey: ['contents'] });
      void queryClient.invalidateQueries({ queryKey: ['calendarContents'] });
      if (includeIdeas) void queryClient.invalidateQueries({ queryKey: ['ideas'] });
    } catch (err) {
      toast.error(t('settings.general.archived_delete_error', { message: err instanceof Error ? err.message : String(err) }));
    } finally {
      setDeletingArchived(false);
    }
  }

  async function handleExportArchivedIdeas() {
    if (!archivedIdeasWorkspaceId) return;
    setExportingArchivedIdeas(true);
    try {
      const params = buildArchivedParams(archivedIdeasWorkspaceId, archivedIdeasTimeframe, customIdeasFromDate, customIdeasToDate);
      const rows = await apiFetch<unknown[]>(`/api/ideas/archived/export?${params.toString()}`);
      downloadJson(rows, `orbit-archived-ideas-${new Date().toISOString().slice(0, 10)}.json`);
      toast.success(t('settings.general.archived_ideas_export_success', { count: rows.length }));
    } catch (err) {
      toast.error(t('settings.general.archived_ideas_export_error', { message: err instanceof Error ? err.message : String(err) }));
    } finally {
      setExportingArchivedIdeas(false);
    }
  }

  async function handleDeleteArchivedIdeas() {
    if (!archivedIdeasWorkspaceId) return;
    setDeletingArchivedIdeas(true);
    try {
      const params = buildArchivedParams(archivedIdeasWorkspaceId, archivedIdeasTimeframe, customIdeasFromDate, customIdeasToDate);
      const result = await apiFetch<{ deleted: number }>(`/api/ideas/archived?${params.toString()}`, { method: 'DELETE' });
      toast.success(t('settings.general.archived_ideas_delete_success', { count: result.deleted }));
      setShowArchivedIdeasDeleteConfirm(false);
      void queryClient.invalidateQueries({ queryKey: ['ideas'] });
    } catch (err) {
      toast.error(t('settings.general.archived_ideas_delete_error', { message: err instanceof Error ? err.message : String(err) }));
    } finally {
      setDeletingArchivedIdeas(false);
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as unknown;
      const result = await apiFetch<{ ok: boolean; imported: { workspaces: number; contents: number; ideas: number } }>(
        '/api/import',
        { method: 'POST', body: JSON.stringify(data) }
      );
      toast.success(t('settings.general.import_success', {
        workspaces: result.imported.workspaces,
        contents: result.imported.contents,
        ideas: result.imported.ideas,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(t('settings.general.import_error', { message: msg }));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">

      {/* Data */}
      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{t('settings.general.section_data')}</p>
        <div className="rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
          <div className={ROW + ' px-4'}>
            <div>
              <span className={LABEL}>{t('settings.general.export_data')}</span>
              <p className="text-xs text-gray-400 mt-0.5">{t('settings.general.export_data_desc')}</p>
            </div>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="text-sm px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0 disabled:opacity-50"
            >
              {exporting ? t('settings.general.exporting') : t('settings.general.export_data')}
            </button>
          </div>
          <div className={ROW + ' px-4 border-b-0'}>
            <div>
              <span className={LABEL}>{t('settings.general.import_data')}</span>
              <p className="text-xs text-gray-400 mt-0.5">{t('settings.general.import_data_desc')}</p>
            </div>
            <button
              onClick={() => importInputRef.current?.click()}
              disabled={importing}
              className="text-sm px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0 disabled:opacity-50"
            >
              {importing ? t('settings.general.importing') : t('settings.general.import_data')}
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => void handleImportFile(e)}
            />
          </div>
        </div>
      </div>

      {/* Archived Contents */}
      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{t('settings.general.section_archived')}</p>
        <div className="rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
          <div className={ROW + ' px-4'}>
            <span className={LABEL}>{t('settings.general.archived_workspace')}</span>
            <div className="relative flex-shrink-0">
              <select
                value={archivedWorkspaceId}
                onChange={(e) => setArchivedWorkspaceId(e.target.value)}
                className="appearance-none text-sm text-gray-700 bg-white border border-gray-200 rounded-md pl-6 pr-8 py-1.5 text-center outline-none focus:ring-2 focus:ring-indigo-200 cursor-pointer"
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
          <div className={ROW + ' px-4'}>
            <span className={LABEL}>{t('settings.general.archived_timeframe')}</span>
            <div className="relative flex-shrink-0">
              <select
                value={archivedTimeframe}
                onChange={(e) => setArchivedTimeframe(e.target.value)}
                className="appearance-none text-sm text-gray-700 bg-white border border-gray-200 rounded-md pl-6 pr-8 py-1.5 text-center outline-none focus:ring-2 focus:ring-indigo-200 cursor-pointer"
              >
                <option value="all">{t('settings.general.archived_timeframe_all')}</option>
                <option value="30d">{t('settings.general.archived_timeframe_30')}</option>
                <option value="60d">{t('settings.general.archived_timeframe_60')}</option>
                <option value="90d">{t('settings.general.archived_timeframe_90')}</option>
                <option value="6m">{t('settings.general.archived_timeframe_6m')}</option>
                <option value="1y">{t('settings.general.archived_timeframe_1y')}</option>
                <option value="custom">{t('settings.general.archived_timeframe_custom')}</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
          {archivedTimeframe === 'custom' && (
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <CalendarPicker
                value={customFromDate}
                onChange={setCustomFromDate}
                max={customToDate || new Date().toISOString().slice(0, 10)}
                placeholder={t('settings.general.archived_custom_from')}
              />
              <span className="text-gray-400 text-sm flex-shrink-0">–</span>
              <CalendarPicker
                value={customToDate}
                onChange={setCustomToDate}
                min={customFromDate}
                max={new Date().toISOString().slice(0, 10)}
                placeholder={t('settings.general.archived_custom_to')}
              />
            </div>
          )}
          <div className={ROW + ' px-4'}>
            <span className={LABEL}>{t('settings.general.archived_include_ideas')}</span>
            <button
              onClick={() => setIncludeIdeas((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 flex-shrink-0 ${includeIdeas ? 'bg-indigo-600' : 'bg-gray-200'}`}
            >
              <span className={`inline-block transform rounded-full bg-white shadow-sm transition-transform duration-200 ${includeIdeas ? 'translate-x-6' : 'translate-x-1'}`}
                style={{ width: '18px', height: '18px' }} />
            </button>
          </div>
          <div className={ROW + ' px-4 border-b-0'}>
            <p className="text-xs text-gray-400 max-w-[180px]">{t('settings.general.archived_actions_desc')}</p>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => void handleExportArchived()}
                disabled={!archivedWorkspaceId || exportingArchived}
                className="text-xs px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {exportingArchived ? t('settings.general.archived_exporting') : t('settings.general.archived_export')}
              </button>
              <button
                onClick={() => setShowArchivedDeleteConfirm(true)}
                disabled={!archivedWorkspaceId || deletingArchived}
                className="text-xs px-3 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {t('settings.general.archived_delete')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Archived Ideas */}
      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{t('settings.general.section_archived_ideas')}</p>
        <div className="rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
          <div className={ROW + ' px-4'}>
            <span className={LABEL}>{t('settings.general.archived_workspace')}</span>
            <div className="relative flex-shrink-0">
              <select
                value={archivedIdeasWorkspaceId}
                onChange={(e) => setArchivedIdeasWorkspaceId(e.target.value)}
                className="appearance-none text-sm text-gray-700 bg-white border border-gray-200 rounded-md pl-6 pr-8 py-1.5 text-center outline-none focus:ring-2 focus:ring-indigo-200 cursor-pointer"
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
          <div className={ROW + ' px-4'}>
            <span className={LABEL}>{t('settings.general.archived_timeframe')}</span>
            <div className="relative flex-shrink-0">
              <select
                value={archivedIdeasTimeframe}
                onChange={(e) => setArchivedIdeasTimeframe(e.target.value)}
                className="appearance-none text-sm text-gray-700 bg-white border border-gray-200 rounded-md pl-6 pr-8 py-1.5 text-center outline-none focus:ring-2 focus:ring-indigo-200 cursor-pointer"
              >
                <option value="all">{t('settings.general.archived_timeframe_all')}</option>
                <option value="30d">{t('settings.general.archived_timeframe_30')}</option>
                <option value="60d">{t('settings.general.archived_timeframe_60')}</option>
                <option value="90d">{t('settings.general.archived_timeframe_90')}</option>
                <option value="6m">{t('settings.general.archived_timeframe_6m')}</option>
                <option value="1y">{t('settings.general.archived_timeframe_1y')}</option>
                <option value="custom">{t('settings.general.archived_timeframe_custom')}</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
          {archivedIdeasTimeframe === 'custom' && (
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <CalendarPicker
                value={customIdeasFromDate}
                onChange={setCustomIdeasFromDate}
                max={customIdeasToDate || new Date().toISOString().slice(0, 10)}
                placeholder={t('settings.general.archived_custom_from')}
              />
              <span className="text-gray-400 text-sm flex-shrink-0">–</span>
              <CalendarPicker
                value={customIdeasToDate}
                onChange={setCustomIdeasToDate}
                min={customIdeasFromDate}
                max={new Date().toISOString().slice(0, 10)}
                placeholder={t('settings.general.archived_custom_to')}
              />
            </div>
          )}
          <div className={ROW + ' px-4 border-b-0'}>
            <p className="text-xs text-gray-400 max-w-[180px]">{t('settings.general.archived_ideas_actions_desc')}</p>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => void handleExportArchivedIdeas()}
                disabled={!archivedIdeasWorkspaceId || exportingArchivedIdeas}
                className="text-xs px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {exportingArchivedIdeas ? t('settings.general.archived_exporting') : t('settings.general.archived_export')}
              </button>
              <button
                onClick={() => setShowArchivedIdeasDeleteConfirm(true)}
                disabled={!archivedIdeasWorkspaceId || deletingArchivedIdeas}
                className="text-xs px-3 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {t('settings.general.archived_delete')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showArchivedDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">{t('settings.general.archived_delete_title')}</h3>
            <p className="text-sm text-gray-600">
              {archivedTimeframe === 'all'
                ? t('settings.general.archived_delete_desc_all')
                : t('settings.general.archived_delete_desc', { range: getArchivedRangeLabel(archivedTimeframe, customFromDate, customToDate) })}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowArchivedDeleteConfirm(false)}
                className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                {t('action.cancel')}
              </button>
              <button
                onClick={() => void handleDeleteArchived()}
                disabled={deletingArchived}
                className="text-sm px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deletingArchived ? t('settings.general.archived_deleting') : t('settings.general.archived_delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showArchivedIdeasDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">{t('settings.general.archived_ideas_delete_title')}</h3>
            <p className="text-sm text-gray-600">
              {archivedIdeasTimeframe === 'all'
                ? t('settings.general.archived_ideas_delete_desc_all')
                : t('settings.general.archived_ideas_delete_desc', { range: getArchivedRangeLabel(archivedIdeasTimeframe, customIdeasFromDate, customIdeasToDate) })}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowArchivedIdeasDeleteConfirm(false)}
                className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                {t('action.cancel')}
              </button>
              <button
                onClick={() => void handleDeleteArchivedIdeas()}
                disabled={deletingArchivedIdeas}
                className="text-sm px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deletingArchivedIdeas ? t('settings.general.archived_deleting') : t('settings.general.archived_delete')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Notifications Panel ──────────────────────────────────────────────────────

function NotificationsPanel() {
  const { t } = useTranslation('common');
  const [enabled, setEnabled] = useState(
    typeof Notification !== 'undefined' && Notification.permission === 'granted'
  );
  const [leadTime, setLeadTime] = useState(15);

  async function handleToggle() {
    if (!enabled) {
      const perm = await Notification.requestPermission();
      setEnabled(perm === 'granted');
    } else {
      setEnabled(false);
    }
  }

  return (
    <div>
      <div className={ROW}>
        <div>
          <p className={LABEL}>{t('settings.notifications.publish_reminders')}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t('settings.notifications.publish_reminders_desc')}</p>
        </div>
        <button
          onClick={() => void handleToggle()}
          role="switch"
          aria-checked={enabled}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 flex-shrink-0 ml-4 ${enabled ? 'bg-indigo-600' : 'bg-gray-200'}`}
        >
          <span className={`inline-block transform rounded-full bg-white shadow-sm transition-transform duration-200 ${enabled ? 'translate-x-6' : 'translate-x-1'}`}
            style={{ width: '18px', height: '18px' }} />
        </button>
      </div>

      {enabled && (
        <div className={ROW}>
          <span className={LABEL}>{t('settings.notifications.lead_time')}</span>
          <select
            value={leadTime}
            onChange={(e) => setLeadTime(Number(e.target.value))}
            className="text-sm border border-gray-200 rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200 bg-white"
          >
            {[5, 10, 15, 30, 60].map((m) => (
              <option key={m} value={m}>{m} {t('settings.notifications.lead_time_unit')}</option>
            ))}
          </select>
        </div>
      )}

      {typeof Notification !== 'undefined' && Notification.permission === 'denied' && (
        <p className="text-xs text-red-500 pt-3">{t('settings.notifications.blocked')}</p>
      )}
    </div>
  );
}

// ─── Workspaces Panel ─────────────────────────────────────────────────────────

function WorkspacesPanel() {
  const { t } = useTranslation('workspaces');
  const { t: tc } = useTranslation('common');
  const { data: workspaces = [], isLoading } = useWorkspaces();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Workspace | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{workspaces.length} {workspaces.length !== 1 ? tc('nav.workspaces').toLowerCase() : tc('nav.workspaces').toLowerCase()}</p>
        <button
          onClick={() => setShowCreate(true)}
          className="text-xs px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 transition-colors"
        >
          + {t('new_workspace')}
        </button>
      </div>

      {isLoading && <p className="text-sm text-gray-400">{tc('status.loading')}</p>}

      {!isLoading && workspaces.length === 0 && (
        <div className="text-center py-10 border border-dashed border-gray-200 rounded-lg">
          <p className="text-gray-400 text-sm">{t('no_workspaces')}</p>
        </div>
      )}

      <div className="space-y-1.5">
        {workspaces.map((ws) => (
          <div key={ws.id}
            className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg hover:border-gray-200 transition-colors"
          >
            <div className="w-8 h-8 rounded-md flex items-center justify-center text-base flex-shrink-0 overflow-hidden"
              style={{ backgroundColor: ws.color + '18' }}>
              <WorkspaceIconContent icon={ws.icon} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{ws.name}</p>
              </div>
              {ws.publishGoal && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {t('publish_goal_summary', {
                    count: (ws.publishGoal as { count: number; period: string }).count,
                    unit: t('publish_goal_unit'),
                    period: t(`publish_period.${(ws.publishGoal as { count: number; period: string }).period}`),
                  })}
                </p>
              )}
            </div>
            <button onClick={() => setEditing(ws)}
              className="text-xs px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0">
              {tc('action.edit')}
            </button>
          </div>
        ))}
      </div>

      {showCreate && <CreateWorkspaceModal onClose={() => setShowCreate(false)} />}
      {editing && <EditWorkspaceModal workspace={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

// ─── Editable Field ───────────────────────────────────────────────────────────

function EditableField({
  label, value, type = 'text', onSave, saving,
}: {
  label: string; value: string; type?: string;
  onSave: (val: string) => Promise<void>; saving: boolean;
}) {
  const { t } = useTranslation('common');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setDraft(value); setError(''); setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  async function handleSave() {
    if (draft.trim() === value) { setEditing(false); return; }
    setError('');
    try {
      await onSave(draft.trim());
      setEditing(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('error.failed_to_save'));
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') void handleSave();
    if (e.key === 'Escape') setEditing(false);
  }

  return (
    <div className="flex items-center justify-between py-3 px-4 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
      <span className="text-sm font-medium text-gray-900 dark:text-white">{label}</span>
      {editing ? (
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <input ref={inputRef} type={type} value={draft}
            onChange={(e) => setDraft(e.target.value)} onKeyDown={handleKey}
            className="text-sm border border-gray-200 rounded-md px-2 py-1 w-44 outline-none focus:ring-2 focus:ring-indigo-200" />
          <button onClick={() => void handleSave()} disabled={saving || !draft.trim()}
            className="text-xs px-2 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50">
            {saving ? '…' : t('action.save')}
          </button>
          <button onClick={() => setEditing(false)} className="text-xs text-gray-500 hover:text-gray-700">
            {t('action.cancel')}
          </button>
          {error && <span className="text-xs text-red-500 w-full text-right">{error}</span>}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{value}</span>
          <button onClick={startEdit}
            className="text-xs text-gray-400 hover:text-indigo-600 px-1.5 py-0.5 rounded hover:bg-gray-100 transition-colors">
            {t('action.edit')}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Change Password Modal ────────────────────────────────────────────────────

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('common');
  const changePassword = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (next !== confirm) { setError(t('settings.account.passwords_mismatch')); return; }
    if (next.length < 8) { setError(t('settings.account.password_too_short')); return; }
    try {
      await changePassword.mutateAsync({ currentPassword: current, newPassword: next });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error.failed'));
    }
  }

  const fields = [
    { label: t('settings.account.current_password'),  value: current,  set: setCurrent  },
    { label: t('settings.account.new_password'),       value: next,     set: setNext     },
    { label: t('settings.account.confirm_new_password'), value: confirm, set: setConfirm },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg border border-gray-200 shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">{t('settings.account.change_password')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="px-5 py-4 space-y-3">
          {fields.map(({ label, value, set }) => (
            <div key={label}>
              <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
              <input type="password" value={value} onChange={(e) => set(e.target.value)} required
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200" />
            </div>
          ))}
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">
              {t('action.cancel')}
            </button>
            <button type="submit" disabled={changePassword.isPending}
              className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50">
              {changePassword.isPending ? '…' : t('settings.account.update_password')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Account Modal ─────────────────────────────────────────────────────

function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('common');
  const deleteAccount = useDeleteAccount();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await deleteAccount.mutateAsync({ password });
      clearAuth();
      void navigate('/login', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error.failed'));
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg border border-gray-200 shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">{t('settings.account.delete_account')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
        </div>
        <form onSubmit={(e) => void handleDelete(e)} className="px-5 py-4 space-y-4">
          <p className="text-sm text-gray-600">{t('settings.account.delete_warning')}</p>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {t('settings.account.confirm_password_label')}
            </label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-red-200" />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">
              {t('action.cancel')}
            </button>
            <button type="submit" disabled={deleteAccount.isPending || !password}
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50">
              {deleteAccount.isPending ? '…' : t('settings.account.delete_my_account')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Account Panel ────────────────────────────────────────────────────────────

function AccountPanel() {
  const { t } = useTranslation('common');
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const updateProfile = useUpdateProfile();
  const logoutMutation = useLogout();
  const navigate = useNavigate();
  const locale = useUiStore((s) => s.locale);
  const setLocale = useUiStore((s) => s.setLocale);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const initial = user?.username ? (user.username[0]?.toUpperCase() ?? 'U') : 'U';

  // Sync browser timezone to DB once on mount
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    updateProfile.mutate({ timezone: tz });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSignOut() {
    logoutMutation.mutate(undefined, {
      onSuccess: () => { clearAuth(); void navigate('/login', { replace: true }); },
      onError:   () => { clearAuth(); void navigate('/login', { replace: true }); },
    });
  }

  function handleLocale(l: SupportedLocale) {
    setLocale(l);
    void i18n.changeLanguage(l);
    updateProfile.mutate({ locale: l });
  }

  async function saveName(username: string) { updateUser(await updateProfile.mutateAsync({ username })); }
  async function saveEmail(email: string) { updateUser(await updateProfile.mutateAsync({ email })); }

  return (
    <div className="space-y-5">
      {/* Profile card */}
      <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
        <div className="w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center text-2xl font-semibold flex-shrink-0">
          {initial}
        </div>
        <div className="min-w-0">
          <p className="text-base font-semibold text-gray-900 dark:text-white truncate">{user?.username}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
        </div>
      </div>

      {/* Profile fields */}
      <div className="rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('settings.account.profile')}</p>
        </div>
        <EditableField label={t('settings.account.name')}  value={user?.username ?? ''}  onSave={saveName}  saving={updateProfile.isPending} />
        <EditableField label={t('settings.account.email')} value={user?.email ?? ''} onSave={saveEmail} saving={updateProfile.isPending} type="email" />
      </div>

      {/* Preferences */}
      <div className="rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('settings.account.section_preferences')}</p>
        </div>
        <div className={ROW + ' px-4'}>
          <span className={LABEL}>{t('settings.general.language')}</span>
          <div className="relative flex-shrink-0">
            <select
              value={locale}
              onChange={(e) => handleLocale(e.target.value as SupportedLocale)}
              className="appearance-none text-sm text-gray-700 dark:text-white bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md pl-3 pr-8 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200 cursor-pointer"
            >
              {SUPPORTED_LOCALES.map((l) => (
                <option key={l} value={l}>{LOCALE_META[l].label}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
        <div className={ROW + ' px-4 border-b-0'}>
          <span className={LABEL}>{t('settings.general.timezone')}</span>
          <span className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
        </div>
      </div>

      {/* Security */}
      <div className="rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('settings.account.security')}</p>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{t('settings.account.password')}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t('settings.account.password_desc')}</p>
          </div>
          <button
            onClick={() => setShowChangePassword(true)}
            className="text-sm px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
          >
            {t('settings.account.change_password')}
          </button>
        </div>
      </div>

      {/* Sign out — mobile only (desktop uses sidebar account menu) */}
      <div className="md:hidden rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{t('auth.sign_out')}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t('settings.account.sign_out_desc')}</p>
          </div>
          <button
            onClick={handleSignOut}
            disabled={logoutMutation.isPending}
            className="text-sm px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex-shrink-0 disabled:opacity-50"
          >
            {t('auth.sign_out')}
          </button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="rounded-xl border border-red-100 dark:border-red-900/40 overflow-hidden">
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/40">
          <p className="text-xs font-medium text-red-500 uppercase tracking-wide">{t('settings.account.danger_zone')}</p>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{t('settings.account.delete_account')}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t('settings.account.delete_desc')}</p>
          </div>
          <button
            onClick={() => setShowDeleteAccount(true)}
            className="text-sm px-3 py-1.5 rounded-md border border-red-200 text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
          >
            {t('settings.account.delete_account')}
          </button>
        </div>
      </div>

      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
      {showDeleteAccount  && <DeleteAccountModal  onClose={() => setShowDeleteAccount(false)} />}
    </div>
  );
}

// ─── Platforms Panel ─────────────────────────────────────────────────────────

const BUILTIN_PLATFORMS = [
  { id: 'douyin',       label: 'Douyin'       },
  { id: 'xiaohongshu',  label: 'RedNote'      },
  { id: 'weixin',       label: 'WeChat OA'    },
  { id: 'weixin_video', label: 'WeChat Video' },
  { id: 'bilibili',     label: 'Bilibili'     },
  { id: 'x',            label: 'X (Twitter)'  },
  { id: 'youtube',      label: 'YouTube'      },
  { id: 'instagram',    label: 'Instagram'    },
  { id: 'tiktok',       label: 'TikTok'       },
];

function PlatformsPanel() {
  const { t } = useTranslation('contents');
  const { t: tc } = useTranslation('common');
  const { disabledBuiltinPlatforms, toggleBuiltinPlatform, disabledCustomPlatforms, toggleCustomPlatform } = useUiStore();
  const { data: customPlatforms = [] } = useCustomPlatforms();
  const createCustomPlatform = useCreateCustomPlatform();
  const deleteCustomPlatform = useDeleteCustomPlatform();

  const [adding, setAdding] = useState(false);
  const [icon, setIcon] = useState(''); // data URL (SVG) or emoji
  const [name, setName] = useState('');

  function handleSvgUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === 'string') setIcon(result);
    };
    reader.readAsDataURL(file);
    // reset input so re-selecting same file still fires onChange
    e.target.value = '';
  }

  function handleAdd() {
    const n = name.trim();
    if (!n) return;
    createCustomPlatform.mutate({ name: n, icon: icon || '📌' }, {
      onSuccess: () => { setIcon(''); setName(''); setAdding(false); },
    });
  }

  return (
    <div className="space-y-6">
      {/* Built-in platforms */}
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          {tc('settings.platforms.builtin_title')}
        </p>
        <div className="divide-y divide-gray-100 dark:divide-gray-700 rounded-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
          {BUILTIN_PLATFORMS.map((p) => {
            const enabled = !disabledBuiltinPlatforms.includes(p.id);
            return (
              <div key={p.id} className="flex items-center justify-between px-3 py-2.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                <div className="flex items-center gap-2.5">
                  <PlatformIcon platform={p.id} className="w-5 h-5 flex-shrink-0" />
                  <span className={`text-sm font-medium transition-colors ${enabled ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>{t(`platforms.${p.id}`)}</span>
                </div>
                <button
                  onClick={() => toggleBuiltinPlatform(p.id)}
                  role="switch"
                  aria-checked={enabled}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 flex-shrink-0 ${enabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'}`}
                >
                  <span className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${enabled ? 'translate-x-6' : 'translate-x-1'}`}
                    style={{ width: '18px', height: '18px' }} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom platforms */}
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          {tc('settings.platforms.custom_title')}
        </p>
        {customPlatforms.length === 0 && !adding && (
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-3">{t('drawer.no_custom_platforms')}</p>
        )}
        {customPlatforms.length > 0 && (
          <div className="divide-y divide-gray-100 dark:divide-gray-700 rounded-lg border border-gray-100 dark:border-gray-700 overflow-hidden mb-3">
            {customPlatforms.map((cp: CustomPlatform) => {
              const enabled = !disabledCustomPlatforms.includes(cp.id);
              return (
              <div key={cp.id} className="flex items-center justify-between px-3 py-2.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                <div className="flex items-center gap-2.5">
                  <PlatformIcon platform={cp.id} className="w-5 h-5 flex-shrink-0" />
                  <span className={`text-sm font-medium transition-colors ${enabled ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>{cp.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleCustomPlatform(cp.id)}
                    role="switch"
                    aria-checked={enabled}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 flex-shrink-0 ${enabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'}`}
                  >
                    <span className={`inline-block rounded-full bg-white shadow-sm transition-transform duration-200 ${enabled ? 'translate-x-6' : 'translate-x-1'}`}
                      style={{ width: '18px', height: '18px' }} />
                  </button>
                  <button
                    onClick={() => deleteCustomPlatform.mutate(cp.id)}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                    title={tc('action.remove')}
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9a1 1 0 001 1h6a1 1 0 001-1l1-9" />
                    </svg>
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        )}

        {adding ? (
          <div className="p-4 border border-indigo-200 dark:border-indigo-800 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 space-y-3">
            {/* Icon upload */}
            <div className="flex items-center gap-3">
              <label className="flex flex-col items-center justify-center w-14 h-14 rounded-xl border-2 border-dashed border-indigo-300 dark:border-indigo-700 bg-white dark:bg-gray-800 cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors overflow-hidden flex-shrink-0">
                {icon ? (
                  icon.startsWith('data:') ? (
                    <img src={icon} alt="icon preview" className="w-full h-full object-contain p-1.5" />
                  ) : (
                    <span className="text-2xl">{icon}</span>
                  )
                ) : (
                  <span className="text-indigo-400 dark:text-indigo-500 text-xs font-medium text-center leading-tight px-1">SVG</span>
                )}
                <input
                  type="file"
                  accept=".svg,image/svg+xml"
                  className="hidden"
                  onChange={handleSvgUpload}
                />
              </label>
              <div className="flex-1">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1.5">{tc('settings.platforms.upload_icon_hint')} <span className="text-gray-400 dark:text-gray-500">{tc('settings.platforms.upload_icon_sub')}</span></p>
                {icon && (
                  <button onClick={() => setIcon('')} className="text-xs font-medium text-red-400 hover:text-red-600 transition-colors">
                    {tc('settings.platforms.remove_icon')}
                  </button>
                )}
              </div>
            </div>
            {/* Name + actions */}
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAdding(false); setIcon(''); } }}
                placeholder={t('drawer.custom_platform_name')}
                className="flex-1 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-700 dark:text-gray-100 dark:placeholder-gray-500"
              />
              <button onClick={handleAdd} disabled={!name.trim() || createCustomPlatform.isPending} className="px-3 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {tc('action.add')}
              </button>
              <button onClick={() => { setAdding(false); setIcon(''); setName(''); }} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full py-2.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 border border-dashed border-indigo-300 dark:border-indigo-700 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors"
          >
            + {tc('settings.platforms.add_custom')}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Settings Modal ───────────────────────────────────────────────────────────

const NAV_ICONS: Record<Section, React.ReactNode> = {
  account: (
    <svg className="w-[15px] h-[15px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="10" cy="7.5" r="3"/>
      <path d="M3.5 17c0-3 2.9-5.5 6.5-5.5s6.5 2.5 6.5 5.5" strokeLinecap="round"/>
    </svg>
  ),
  appearance: (
    <svg className="w-[15px] h-[15px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="10" cy="10" r="7"/>
      <path d="M10 3v14M3 10h14" strokeLinecap="round" strokeOpacity="0.3"/>
      <path d="M10 3a7 7 0 010 14" fill="currentColor" stroke="none" opacity="0.15"/>
      <circle cx="10" cy="10" r="7"/>
      <path d="M10 3v14" strokeLinecap="round"/>
    </svg>
  ),
  workspaces: (
    <svg className="w-[15px] h-[15px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="2" y="3" width="7" height="6" rx="1.5"/>
      <rect x="11" y="3" width="7" height="6" rx="1.5"/>
      <rect x="2" y="11" width="7" height="6" rx="1.5"/>
      <rect x="11" y="11" width="7" height="6" rx="1.5"/>
    </svg>
  ),
  platforms: (
    <svg className="w-[15px] h-[15px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="15" cy="5" r="2"/>
      <circle cx="5" cy="10" r="2"/>
      <circle cx="15" cy="15" r="2"/>
      <path d="M7 9l6-3M7 11l6 3" strokeLinecap="round"/>
    </svg>
  ),
  notifications: (
    <svg className="w-[15px] h-[15px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M10 2.5A5 5 0 005 7.5V12l-1.5 2h13L15 12V7.5A5 5 0 0010 2.5z" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8.5 14.5a1.5 1.5 0 003 0" strokeLinecap="round"/>
    </svg>
  ),
  data: (
    <svg className="w-[15px] h-[15px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <ellipse cx="10" cy="5" rx="7" ry="2.5"/>
      <path d="M3 5v4c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5V5" strokeLinecap="round"/>
      <path d="M3 9v4c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5V9" strokeLinecap="round"/>
    </svg>
  ),
};

export function SettingsModal({ onClose, initialSection }: { onClose: () => void; initialSection?: string }) {
  const { t } = useTranslation('common');
  const [section, setSection] = useState<Section>((initialSection as Section) ?? 'account');

  const NAV_ITEMS: { id: Section; label: string }[] = [
    { id: 'account',       label: t('settings.sections.account')       },
    { id: 'appearance',    label: t('settings.sections.appearance')    },
    { id: 'workspaces',    label: t('settings.sections.workspaces')    },
    { id: 'platforms',     label: t('settings.sections.platforms')     },
    { id: 'notifications', label: t('settings.sections.notifications') },
    { id: 'data',          label: t('settings.sections.data')          },
  ];

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 md:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 w-full md:max-w-3xl flex flex-col md:flex-row overflow-hidden rounded-t-2xl md:rounded-2xl border border-gray-200 dark:border-gray-700 h-[88vh] md:h-[600px]"
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile: horizontal tab bar */}
        <div className="flex md:hidden flex-col flex-shrink-0">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              {NAV_ITEMS.find((n) => n.id === section)?.label}
            </h2>
            <button onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label={t('aria.close')}>
              <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M2 2l10 10M12 2L2 12"/>
              </svg>
            </button>
          </div>
          <div className="flex gap-1 px-3 pb-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {NAV_ITEMS.map((item) => (
              <button key={item.id} onClick={() => setSection(item.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  section === item.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}>
                {item.label}
              </button>
            ))}
          </div>
          <div className="border-b border-gray-100 dark:border-gray-700" />
        </div>

        {/* Desktop: vertical sidebar */}
        <div className="hidden md:flex w-52 flex-shrink-0 bg-gray-50 dark:bg-gray-900 border-r border-gray-100 dark:border-gray-700 flex-col">
          {/* Sidebar header */}
          <div className="flex items-center gap-2 px-4 py-[14px] border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
            <button onClick={onClose}
              className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-600 transition-colors flex-shrink-0"
              aria-label={t('aria.close')}>
              <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M2 2l10 10M12 2L2 12"/>
              </svg>
            </button>
            <span className="text-[13px] font-semibold text-gray-700 dark:text-gray-200 tracking-wide">
              {t('nav.settings')}
            </span>
          </div>
          {/* Nav items */}
          <nav className="flex-1 px-2 py-3 space-y-0.5">
            {NAV_ITEMS.map((item) => (
              <button key={item.id} onClick={() => setSection(item.id)}
                className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all ${
                  section === item.id
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-200'
                }`}>
                <span className={`flex-shrink-0 transition-colors ${section === item.id ? 'text-indigo-600 dark:text-indigo-400' : ''}`}>
                  {NAV_ICONS[item.id]}
                </span>
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content panel */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-800">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <h2 className="hidden md:block text-base font-semibold text-gray-900 dark:text-white mb-5">
              {NAV_ITEMS.find((n) => n.id === section)?.label}
            </h2>
            {section === 'account'       && <AccountPanel />}
            {section === 'appearance'    && <AppearancePanel />}
            {section === 'workspaces'    && <WorkspacesPanel />}
            {section === 'platforms'     && <PlatformsPanel />}
            {section === 'notifications' && <NotificationsPanel />}
            {section === 'data'          && <DataPanel />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
