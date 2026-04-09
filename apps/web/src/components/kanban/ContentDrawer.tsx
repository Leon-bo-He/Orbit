import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Content, Stage, Platform, ContentType, StageHistoryEntry } from '@contentflow/shared';
import { STAGE_ORDER } from '@contentflow/shared';
import { useTranslation } from 'react-i18next';
import { useUpdateContent, useDeleteContent } from '../../api/contents.js';
import { useCustomPlatforms } from '../../api/custom-platforms.js';
import { PublicationsPanel } from '../publications/PublicationsPanel.js';
import { DateTimePicker } from '../ui/DateTimePicker.js';
import { PlatformIcon } from '../ui/PlatformIcon.js';
import { useUiStore } from '../../store/ui.store.js';

const BUILT_IN_PLATFORMS: Platform[] = [
  'douyin', 'xiaohongshu', 'weixin', 'weixin_video',
  'bilibili', 'x', 'youtube', 'instagram', 'tiktok',
];

const ALL_CONTENT_TYPES: ContentType[] = [
  'video_short', 'video_long', 'image_text', 'article', 'podcast', 'live',
];

function toDatetimeLocal(val: Date | string | null): string {
  if (!val) return '';
  const d = typeof val === 'string' ? new Date(val) : val;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type DrawerTab = 'details' | 'publish' | 'timeline';

function TimelineTab({
  history,
  t,
  onUpdate,
}: {
  history: StageHistoryEntry[];
  t: (k: string) => string;
  onUpdate: (newHistory: StageHistoryEntry[]) => void;
}) {
  const { t: tc } = useTranslation('common');
  const [errors, setErrors] = useState<Record<number, boolean>>({});
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null);

  if (history.length === 0) {
    return <p className="text-xs text-gray-400 text-center py-8">{t('column.empty')}</p>;
  }

  const ascending = [...history].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  function handlePickerChange(ascIdx: number, iso: string | null) {
    if (!iso) return;
    const newTime = new Date(iso).getTime();
    const prev = ascIdx > 0 ? new Date(ascending[ascIdx - 1].timestamp).getTime() : -Infinity;
    const next = ascIdx < ascending.length - 1 ? new Date(ascending[ascIdx + 1].timestamp).getTime() : Infinity;
    if (newTime <= prev || newTime >= next) {
      setErrors((e) => ({ ...e, [ascIdx]: true }));
      return;
    }
    setErrors((e) => { const n = { ...e }; delete n[ascIdx]; return n; });
    onUpdate(ascending.map((entry, i) => i === ascIdx ? { ...entry, timestamp: iso } : entry));
  }

  function handleDelete(ascIdx: number) {
    const next = ascending.filter((_, i) => i !== ascIdx);
    setErrors((e) => { const n = { ...e }; delete n[ascIdx]; return n; });
    setConfirmDeleteIdx(null);
    onUpdate(next);
  }

  return (
    <div className="relative">
      <div className="absolute left-[7px] top-0 bottom-0 w-px bg-gray-200" />
      <ul className="space-y-4 pl-6">
        {[...ascending].reverse().map((entry, descIdx) => {
          const ascIdx = ascending.length - 1 - descIdx;
          const hasError = errors[ascIdx];
          return (
            <li key={entry.timestamp} className="relative group/node">
              <span className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-indigo-100 border-2 border-indigo-400 flex-shrink-0" />
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-800">{t(`stages.${entry.stage}`)}</p>
                  <DateTimePicker
                    value={entry.timestamp}
                    onChange={(iso) => handlePickerChange(ascIdx, iso)}
                    triggerClassName={`text-xs mt-0.5 transition-colors cursor-pointer text-left ${
                      hasError ? 'text-red-500' : 'text-gray-400 hover:text-indigo-500'
                    }`}
                  />
                  {hasError && (
                    <p className="text-[10px] text-red-500 mt-0.5">{t('drawer.timeline_order_error')}</p>
                  )}
                </div>
                {confirmDeleteIdx === ascIdx ? (
                  <div className="flex items-center gap-1 mt-0.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleDelete(ascIdx)}
                      className="text-[10px] text-red-400 hover:text-red-600 font-medium transition-colors"
                    >
                      {tc('action.delete')}
                    </button>
                    <span className="text-gray-200 text-[10px]">·</span>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteIdx(null)}
                      className="text-[10px] text-gray-300 hover:text-gray-500 transition-colors"
                    >
                      {tc('action.cancel')}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteIdx(ascIdx)}
                    className="opacity-0 group-hover/node:opacity-100 mt-0.5 flex-shrink-0 text-gray-300 hover:text-red-400 transition-all text-sm leading-none"
                  >
                    ×
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface ContentDrawerProps {
  content: Content | null;
  workspaceId: string;
  onClose: () => void;
}

interface DrawerBodyProps {
  content: Content;
  workspaceId: string;
  onClose: () => void;
}

function DrawerBody({ content, workspaceId, onClose }: DrawerBodyProps) {
  const { t } = useTranslation('contents');
  const { t: tPub } = useTranslation('publications');
  const navigate = useNavigate();
  const updateContent = useUpdateContent();
  const deleteContent = useDeleteContent();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { openSettings, disabledBuiltinPlatforms } = useUiStore();
  const { data: customPlatforms = [] } = useCustomPlatforms();

  const [activeTab, setActiveTab] = useState<DrawerTab>('details');
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(content.title);
  const [scheduledAt, setScheduledAt] = useState(content.scheduledAt ? new Date(content.scheduledAt).toISOString() : '');
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    setTitle(content.title);
    setEditingTitle(false);
  }, [content.id, content.title]);

  useEffect(() => {
    setScheduledAt(content.scheduledAt ? new Date(content.scheduledAt).toISOString() : '');
  }, [content.id, content.scheduledAt]);

  function debouncedUpdate(data: Record<string, unknown>) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateContent.mutate({ id: content.id, workspaceId, data });
    }, 500);
  }

  function immediateUpdate(data: Record<string, unknown>) {
    updateContent.mutate({ id: content.id, workspaceId, data });
  }

  function handleTitleBlur() {
    setEditingTitle(false);
    if (title !== content.title) {
      debouncedUpdate({ title });
    }
  }

  function togglePlatform(platform: string) {
    const next = content.targetPlatforms.includes(platform)
      ? content.targetPlatforms.filter((p) => p !== platform)
      : [...content.targetPlatforms, platform];
    immediateUpdate({ targetPlatforms: next });
  }


  function handleAddTag() {
    const tag = newTag.trim();
    if (!tag || content.tags.includes(tag)) { setNewTag(''); return; }
    immediateUpdate({ tags: [...content.tags, tag] });
    setNewTag('');
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
      <div className="w-full max-w-lg max-h-[85vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 flex-shrink-0">
          {editingTitle ? (
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => { if (e.key === 'Enter') handleTitleBlur(); }}
              className="flex-1 text-sm font-semibold border border-indigo-300 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-200"
            />
          ) : (
            <h2
              onClick={() => setEditingTitle(true)}
              className="flex-1 text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-50 rounded px-2 py-1 -mx-2 truncate"
              title={t('drawer.title_label')}
            >
              {content.title}
            </h2>
          )}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => {
                onClose();
                navigate(`/workspaces/${workspaceId}/contents/${content.id}/brief`);
              }}
              className="text-xs px-2 py-1 rounded border transition-colors"
              style={{
                background: 'var(--cf-hover)',
                color: 'var(--cf-text)',
                borderColor: 'var(--cf-border)',
              }}
            >
              {t('drawer.open_brief')}
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              aria-label={t('drawer.close')}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 flex-shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              activeTab === 'details'
                ? 'border-b-2 border-indigo-500 text-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t('drawer.tab_details')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('publish')}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              activeTab === 'publish'
                ? 'border-b-2 border-indigo-500 text-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tPub('title')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              activeTab === 'timeline'
                ? 'border-b-2 border-indigo-500 text-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t('drawer.tab_timeline')}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {activeTab === 'publish' ? (
            <PublicationsPanel contentId={content.id} />
          ) : activeTab === 'timeline' ? (
            <TimelineTab
              history={content.stageHistory ?? []}
              t={t}
              onUpdate={(newHistory) =>
                updateContent.mutate({ id: content.id, workspaceId, data: { stageHistory: newHistory } })
              }
            />
          ) : (
            <div className="space-y-5">
              {/* Stage */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {t('drawer.stage_label')}
                </label>
                <select
                  value={content.stage}
                  onChange={(e) => immediateUpdate({ stage: e.target.value as Stage })}
                  className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  {STAGE_ORDER.map((s) => (
                    <option key={s} value={s}>{t(`stages.${s}`)}</option>
                  ))}
                </select>
              </div>

              {/* Content Type */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {t('drawer.content_type_label')}
                </label>
                <select
                  value={content.contentType}
                  onChange={(e) => immediateUpdate({ contentType: e.target.value as ContentType })}
                  className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  {ALL_CONTENT_TYPES.map((ct) => (
                    <option key={ct} value={ct}>{t(`content_types.${ct}`)}</option>
                  ))}
                </select>
              </div>

              {/* Target Platforms */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  {t('drawer.platforms_label')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {BUILT_IN_PLATFORMS.filter((p) => !disabledBuiltinPlatforms.includes(p)).map((p) => {
                    const active = content.targetPlatforms.includes(p);
                    return (
                      <button
                        key={p}
                        onClick={() => togglePlatform(p)}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors ${
                          active
                            ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        <PlatformIcon platform={p} className="w-5 h-5" />
                        <span>{t(`platforms.${p}`)}</span>
                      </button>
                    );
                  })}
                  {customPlatforms.map((cp) => {
                    const active = content.targetPlatforms.includes(cp.id);
                    return (
                      <button
                        key={cp.id}
                        onClick={() => togglePlatform(cp.id)}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors ${
                          active
                            ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        <PlatformIcon platform={cp.id} className="w-5 h-5" />
                        <span>{cp.name}</span>
                      </button>
                    );
                  })}
                  <button
                    onClick={() => openSettings('platforms')}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors"
                  >
                    + {t('drawer.manage_platforms')}
                  </button>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  {t('drawer.tags_label')}
                </label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {content.tags.map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-600 rounded-full px-2 py-0.5"
                    >
                      {tag}
                      <button
                        onClick={() => immediateUpdate({ tags: content.tags.filter((tg) => tg !== tag) })}
                        className="text-indigo-400 hover:text-indigo-700 leading-none"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-1">
                  <input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                    onBlur={handleAddTag}
                    placeholder={t('drawer.add_tag')}
                    className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-300"
                  />
                </div>
              </div>

              {/* Scheduled At */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {t('drawer.scheduled_label')}
                </label>
                <DateTimePicker
                  value={scheduledAt}
                  onChange={(iso) => {
                    setScheduledAt(iso ?? '');
                    immediateUpdate({ scheduledAt: iso ?? null });
                  }}
                  compact
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {t('drawer.notes_label')}
                </label>
                <textarea
                  defaultValue={content.notes ?? ''}
                  onChange={(e) => debouncedUpdate({ notes: e.target.value })}
                  rows={4}
                  className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
                />
              </div>

              {/* Archive / Unarchive */}
              <div className="pt-2 border-t border-gray-100 space-y-2">
                {content.stage === 'archived' ? (
                  <button
                    onClick={() => {
                      const prevStage = [...(content.stageHistory ?? [])]
                        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                        .find((e) => e.stage !== 'archived')?.stage ?? 'planned';
                      immediateUpdate({ stage: prevStage as Stage });
                    }}
                    className="w-full text-xs py-1.5 rounded border border-gray-300 text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    🗄 {t('drawer.unarchive')}
                  </button>
                ) : (
                  <button
                    onClick={() => immediateUpdate({ stage: 'archived' })}
                    className="w-full text-xs py-1.5 rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                  >
                    🗄 {t('drawer.archive')}
                  </button>
                )}
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full text-xs py-1.5 rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                >
                  🗑 {t('drawer.delete')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <>
          <div className="fixed inset-0 bg-black/50" style={{ zIndex: 60 }} onClick={() => setShowDeleteConfirm(false)} />
          <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none" style={{ zIndex: 60 }}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 pointer-events-auto">
              <h3 className="text-base font-semibold text-gray-900 mb-2">{t('drawer.delete_confirm_title')}</h3>
              <p className="text-sm text-gray-500 mb-6">{t('drawer.delete_confirm_body')}</p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {t('create.cancel')}
                </button>
                <button
                  disabled={deleteContent.isPending}
                  onClick={() => {
                    deleteContent.mutate({ id: content.id, workspaceId }, {
                      onSuccess: () => onClose(),
                    });
                  }}
                  className="text-sm px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors font-medium"
                >
                  {deleteContent.isPending ? '…' : t('drawer.delete_confirm_button')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export function ContentDrawer({ content, workspaceId, onClose }: ContentDrawerProps) {
  if (!content) return null;
  return <DrawerBody content={content} workspaceId={workspaceId} onClose={onClose} />;
}
