import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Publication, Platform } from '@contentflow/shared';
import { usePublications, useUpdatePublication } from '../../api/publications.js';
import { PlatformConfigForm } from './PlatformConfigForm.js';
import { AddPlatformModal } from './AddPlatformModal.js';
import { MarkPublishedModal } from './MarkPublishedModal.js';

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

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  queued: 'bg-blue-100 text-blue-700',
  ready: 'bg-yellow-100 text-yellow-700',
  posting: 'bg-purple-100 text-purple-700',
  published: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  skipped: 'bg-gray-100 text-gray-400 line-through',
};

function formatScheduled(val: Date | string | null | undefined): string {
  if (!val) return '—';
  const d = typeof val === 'string' ? new Date(val) : val;
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

interface PublicationsPanelProps {
  contentId: string;
}

export function PublicationsPanel({ contentId }: PublicationsPanelProps) {
  const { t } = useTranslation('publications');
  const { data: pubs, isLoading, error } = usePublications(contentId);
  const updatePublication = useUpdatePublication();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [markPublishedPub, setMarkPublishedPub] = useState<Publication | null>(null);

  if (isLoading) {
    return <p className="text-sm text-gray-400 py-4 text-center">{t('loading')}</p>;
  }

  if (error) {
    return <p className="text-sm text-red-500 py-4 text-center">{t('error')}</p>;
  }

  const pubList = pubs ?? [];
  const existingPlatforms = pubList.map((p) => p.platform as Platform);

  async function handleRemove(pub: Publication) {
    if (!window.confirm(t('remove_confirm'))) return;
    await updatePublication.mutateAsync({
      id: pub.id,
      contentId,
      data: { status: 'skipped' },
    });
  }

  async function handleRetry(pub: Publication) {
    await updatePublication.mutateAsync({
      id: pub.id,
      contentId,
      data: { status: 'queued' },
    });
  }

  return (
    <div className="space-y-2">
      {pubList.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">{t('no_publications')}</p>
      ) : (
        <div className="space-y-2">
          {pubList.map((pub) => (
            <div key={pub.id} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Row */}
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="text-lg">{PLATFORM_EMOJI[pub.platform] ?? '📱'}</span>
                <span className="flex-1 text-sm font-medium text-gray-700 capitalize">
                  {t(`platforms.${pub.platform}`)}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[pub.status] ?? 'bg-gray-100 text-gray-600'}`}
                >
                  {t(`status.${pub.status}`)}
                </span>
                <span className="text-xs text-gray-400">{formatScheduled(pub.scheduledAt)}</span>

                {/* Actions */}
                <div className="flex items-center gap-1 ml-1">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expandedId === pub.id ? null : pub.id)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 px-1.5 py-0.5 rounded hover:bg-indigo-50"
                  >
                    {t('action.configure')}
                  </button>

                  {(pub.status === 'ready' || pub.status === 'queued') && (
                    <button
                      type="button"
                      onClick={() => setMarkPublishedPub(pub)}
                      className="text-xs text-green-600 hover:text-green-800 px-1.5 py-0.5 rounded hover:bg-green-50"
                    >
                      {t('action.mark_published')}
                    </button>
                  )}

                  {pub.status === 'failed' && (
                    <button
                      type="button"
                      onClick={() => void handleRetry(pub)}
                      className="text-xs text-orange-600 hover:text-orange-800 px-1.5 py-0.5 rounded hover:bg-orange-50"
                    >
                      {t('action.retry')}
                    </button>
                  )}

                  {pub.status === 'draft' && (
                    <button
                      type="button"
                      onClick={() => void handleRemove(pub)}
                      className="text-xs text-red-400 hover:text-red-600 px-1.5 py-0.5 rounded hover:bg-red-50"
                    >
                      {t('action.remove')}
                    </button>
                  )}

                  {pub.platformUrl && (
                    <a
                      href={pub.platformUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:text-blue-700 px-1.5 py-0.5 rounded hover:bg-blue-50"
                    >
                      {t('action.view')}
                    </a>
                  )}
                </div>
              </div>

              {/* Expanded config form */}
              {expandedId === pub.id && (
                <div className="px-3 pb-3">
                  <PlatformConfigForm
                    publication={pub}
                    onClose={() => setExpandedId(null)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add platform button */}
      <button
        type="button"
        onClick={() => setShowAddModal(true)}
        className="w-full mt-2 py-2 text-sm text-indigo-600 border border-dashed border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors"
      >
        + {t('add_platform')}
      </button>

      {/* Modals */}
      {showAddModal && (
        <AddPlatformModal
          contentId={contentId}
          existingPlatforms={existingPlatforms}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {markPublishedPub && (
        <MarkPublishedModal
          publication={markPublishedPub}
          onClose={() => setMarkPublishedPub(null)}
        />
      )}
    </div>
  );
}
