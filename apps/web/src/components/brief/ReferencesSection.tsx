import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ContentReference, CreateContentReferenceInput } from '@contentflow/shared';

interface ReferencesSectionProps {
  contentId: string;
  references: ContentReference[];
  onAdd: (input: CreateContentReferenceInput) => void;
  onDelete: (refId: string) => void;
}

const PLATFORM_OPTIONS = [
  { value: 'douyin', label: '🎵 Douyin', emoji: '🎵' },
  { value: 'xiaohongshu', label: '📕 Xiaohongshu', emoji: '📕' },
  { value: 'weixin', label: '📰 WeChat OA', emoji: '📰' },
  { value: 'weixin_video', label: '📱 WeChat Video', emoji: '📱' },
  { value: 'bilibili', label: '🎬 Bilibili', emoji: '🎬' },
  { value: 'x', label: '🐦 X', emoji: '🐦' },
  { value: 'youtube', label: '▶️ YouTube', emoji: '▶️' },
  { value: 'instagram', label: '📷 Instagram', emoji: '📷' },
];

function getPlatformEmoji(platform: string): string {
  return PLATFORM_OPTIONS.find((p) => p.value === platform)?.emoji ?? '🌐';
}

const EMPTY_FORM: CreateContentReferenceInput & {
  views: string;
  likes: string;
  comments: string;
} = {
  authorName: '',
  contentTitle: '',
  platform: 'douyin',
  url: '',
  takeaway: '',
  views: '',
  likes: '',
  comments: '',
};

export function ReferencesSection({ references, onAdd, onDelete }: ReferencesSectionProps) {
  const { t } = useTranslation('contents');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  function handleAdd() {
    if (!form.authorName.trim() || !form.contentTitle.trim()) return;
    const metrics: { views?: number; likes?: number; comments?: number } = {};
    if (form.views !== '') metrics.views = Number(form.views);
    if (form.likes !== '') metrics.likes = Number(form.likes);
    if (form.comments !== '') metrics.comments = Number(form.comments);
    onAdd({
      authorName: form.authorName.trim(),
      contentTitle: form.contentTitle.trim(),
      platform: form.platform,
      url: form.url.trim(),
      takeaway: form.takeaway.trim(),
      metricsSnapshot: metrics,
    });
    setForm({ ...EMPTY_FORM });
    setShowModal(false);
  }

  return (
    <div className="space-y-3">
      {/* Reference cards */}
      {references.map((ref) => (
        <div key={ref.id} className="border border-gray-200 rounded p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                <span>{getPlatformEmoji(ref.platform)}</span>
                <span className="truncate">{ref.contentTitle}</span>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">@{ref.authorName}</div>
            </div>
            <button
              onClick={() => onDelete(ref.id)}
              className="text-gray-300 hover:text-red-400 text-sm flex-shrink-0"
            >✕</button>
          </div>

          {ref.url && (
            <a
              href={ref.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-500 hover:underline block truncate"
            >
              {ref.url}
            </a>
          )}

          {/* Metrics */}
          {(ref.metricsSnapshot.views !== undefined ||
            ref.metricsSnapshot.likes !== undefined ||
            ref.metricsSnapshot.comments !== undefined) && (
            <div className="flex gap-3 text-xs text-gray-500">
              {ref.metricsSnapshot.views !== undefined && (
                <span>👁 {ref.metricsSnapshot.views.toLocaleString()}</span>
              )}
              {ref.metricsSnapshot.likes !== undefined && (
                <span>❤️ {ref.metricsSnapshot.likes.toLocaleString()}</span>
              )}
              {ref.metricsSnapshot.comments !== undefined && (
                <span>💬 {ref.metricsSnapshot.comments.toLocaleString()}</span>
              )}
            </div>
          )}

          {ref.takeaway && (
            <p className="text-xs text-gray-600 border-l-2 border-indigo-200 pl-2">{ref.takeaway}</p>
          )}
        </div>
      ))}

      <button
        onClick={() => setShowModal(true)}
        className="text-xs text-indigo-600 border border-dashed border-indigo-300 rounded px-3 py-1.5 hover:bg-indigo-50 w-full"
      >
        + {t('brief.references.add_reference')}
      </button>

      {/* Add reference modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96 max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              {t('brief.references.add_reference_modal_title')}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {t('brief.references.author_name_label')}
                </label>
                <input
                  autoFocus
                  type="text"
                  value={form.authorName}
                  onChange={(e) => setForm((f) => ({ ...f, authorName: e.target.value }))}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {t('brief.references.content_title_label')}
                </label>
                <input
                  type="text"
                  value={form.contentTitle}
                  onChange={(e) => setForm((f) => ({ ...f, contentTitle: e.target.value }))}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {t('brief.references.platform_label')}
                </label>
                <select
                  value={form.platform}
                  onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  {PLATFORM_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  URL
                </label>
                <input
                  type="url"
                  value={form.url}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-2">
                {(['views', 'likes', 'comments'] as const).map((key) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      {t(`brief.references.${key}_label`)}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form[key]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {t('brief.references.takeaway_label')}
                </label>
                <textarea
                  value={form.takeaway}
                  onChange={(e) => setForm((f) => ({ ...f, takeaway: e.target.value }))}
                  rows={3}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => { setShowModal(false); setForm({ ...EMPTY_FORM }); }}
                className="text-xs text-gray-500 px-3 py-1.5 rounded hover:bg-gray-100"
              >
                {t('create.cancel')}
              </button>
              <button
                onClick={handleAdd}
                disabled={!form.authorName.trim() || !form.contentTitle.trim()}
                className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                {t('brief.references.add_reference_confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
