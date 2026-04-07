import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Platform, ContentType } from '@contentflow/shared';
import { useCreateContent } from '../../api/contents.js';

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

interface CreateContentModalProps {
  workspaceId: string;
  onClose: () => void;
}

export function CreateContentModal({ workspaceId, onClose }: CreateContentModalProps) {
  const { t } = useTranslation('contents');
  const createContent = useCreateContent();

  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState<ContentType>('video_short');
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [error, setError] = useState('');

  function togglePlatform(p: Platform) {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError(t('create.title_placeholder'));
      return;
    }
    await createContent.mutateAsync({
      workspaceId,
      title: title.trim(),
      contentType,
      targetPlatforms: platforms,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{t('create.title')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="px-5 py-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('create.title_label')} <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(''); }}
              placeholder={t('create.title_placeholder')}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
            />
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
          </div>

          {/* Content type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('create.content_type_label')}
            </label>
            <select
              value={contentType}
              onChange={(e) => setContentType(e.target.value as ContentType)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
            >
              {ALL_CONTENT_TYPES.map((ct) => (
                <option key={ct} value={ct}>{t(`content_types.${ct}`)}</option>
              ))}
            </select>
          </div>

          {/* Platforms */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('create.platforms_label')}
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_PLATFORMS.map((p) => {
                const active = platforms.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
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

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              {t('create.cancel')}
            </button>
            <button
              type="submit"
              disabled={createContent.isPending}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {createContent.isPending ? '...' : t('create.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
