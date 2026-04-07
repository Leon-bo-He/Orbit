import { useEffect, useRef, useState } from 'react';
import type { Content, Stage, Platform, ContentType } from '@contentflow/shared';
import { STAGE_ORDER } from '@contentflow/shared';
import { useTranslation } from 'react-i18next';
import { useUpdateContent } from '../../api/contents.js';

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

const ALL_PLATFORMS: Platform[] = [
  'douyin', 'xiaohongshu', 'weixin', 'weixin_video',
  'bilibili', 'x', 'youtube', 'instagram',
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
  const updateContent = useUpdateContent();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(content.title);
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    setTitle(content.title);
    setEditingTitle(false);
  }, [content.id, content.title]);

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

  function togglePlatform(platform: Platform) {
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
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-700">{t('drawer.title_label')}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
            aria-label={t('drawer.close')}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* Title */}
          <div>
            {editingTitle ? (
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={(e) => { if (e.key === 'Enter') handleTitleBlur(); }}
                className="w-full text-sm font-medium border border-indigo-300 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-200"
              />
            ) : (
              <p
                onClick={() => setEditingTitle(true)}
                className="text-sm font-medium text-gray-900 cursor-pointer hover:bg-gray-50 rounded px-2 py-1 -mx-2"
                title="Click to edit"
              >
                {content.title}
              </p>
            )}
          </div>

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
              {ALL_PLATFORMS.map((p) => {
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
                    <span>{PLATFORM_EMOJI[p]}</span>
                    <span>{t(`platforms.${p}`)}</span>
                  </button>
                );
              })}
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
                placeholder={t('drawer.add_tag')}
                className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-300"
              />
              <button
                onClick={handleAddTag}
                className="text-xs bg-indigo-500 text-white px-2 py-1 rounded hover:bg-indigo-600"
              >
                +
              </button>
            </div>
          </div>

          {/* Scheduled At */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              {t('drawer.scheduled_label')}
            </label>
            <input
              type="datetime-local"
              defaultValue={toDatetimeLocal(content.scheduledAt)}
              onBlur={(e) => {
                if (!e.target.value) {
                  immediateUpdate({ scheduledAt: null });
                } else {
                  immediateUpdate({ scheduledAt: new Date(e.target.value).toISOString() });
                }
              }}
              className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200"
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
        </div>
      </div>
    </>
  );
}

export function ContentDrawer({ content, workspaceId, onClose }: ContentDrawerProps) {
  if (!content) return null;
  return <DrawerBody content={content} workspaceId={workspaceId} onClose={onClose} />;
}
