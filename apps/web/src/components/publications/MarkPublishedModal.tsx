import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Publication } from '@contentflow/shared';
import { useMarkPublished } from '../../api/publications.js';
import { DateTimePicker } from '../ui/DateTimePicker.js';

interface MarkPublishedModalProps {
  publication: Publication;
  onClose: () => void;
}

export function MarkPublishedModal({ publication, onClose }: MarkPublishedModalProps) {
  const { t } = useTranslation('publications');
  const markPublished = useMarkPublished();

  const [platformUrl, setPlatformUrl] = useState('');
  const [platformPostId, setPlatformPostId] = useState('');
  const [publishedAt, setPublishedAt] = useState(() => new Date().toISOString());
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!platformUrl.trim()) {
      setError(t('mark.url_required'));
      return;
    }
    const data: { platformUrl: string; platformPostId?: string; publishedAt?: string } = {
      platformUrl: platformUrl.trim(),
      publishedAt: new Date(publishedAt).toISOString(),
    };
    if (platformPostId.trim()) {
      data.platformPostId = platformPostId.trim();
    }
    await markPublished.mutateAsync({
      id: publication.id,
      contentId: publication.contentId,
      data,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{t('mark.title')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('mark.platform_url')} <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              type="url"
              value={platformUrl}
              onChange={(e) => { setPlatformUrl(e.target.value); setError(''); }}
              placeholder="https://"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
            />
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('mark.platform_post_id')}
            </label>
            <input
              value={platformPostId}
              onChange={(e) => setPlatformPostId(e.target.value)}
              placeholder={t('mark.optional')}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('mark.published_at')}
            </label>
            <DateTimePicker
              value={publishedAt}
              onChange={(iso) => { if (iso) setPublishedAt(iso); }}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              {t('mark.cancel')}
            </button>
            <button
              type="submit"
              disabled={markPublished.isPending}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {markPublished.isPending ? '...' : t('mark.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
