import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ContentType } from '@contentflow/shared';
import { useCreateContent } from '../../api/contents.js';
import { useCustomPlatforms } from '../../api/custom-platforms.js';
import { PlatformIcon } from '../ui/PlatformIcon.js';
import { useUiStore } from '../../store/ui.store.js';

const BUILT_IN_PLATFORMS = [
  'douyin', 'xiaohongshu', 'weixin', 'weixin_video',
  'bilibili', 'x', 'youtube', 'instagram', 'tiktok',
] as const;

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
  const { openSettings, disabledBuiltinPlatforms } = useUiStore();
  const { data: customPlatforms = [] } = useCustomPlatforms();

  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState<ContentType>('video_short');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [error, setError] = useState('');

  function togglePlatform(p: string) {
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
              {BUILT_IN_PLATFORMS.filter((p) => !disabledBuiltinPlatforms.includes(p)).map((p) => {
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
                    <PlatformIcon platform={p} className="w-5 h-5" />
                    <span>{t(`platforms.${p}`)}</span>
                  </button>
                );
              })}
              {customPlatforms.map((cp) => {
                const active = platforms.includes(cp.id);
                return (
                  <button
                    key={cp.id}
                    type="button"
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
                type="button"
                onClick={() => openSettings('platforms')}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors"
              >
                + {t('drawer.manage_platforms')}
              </button>
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
