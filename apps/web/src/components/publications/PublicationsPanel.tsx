import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Publication } from '@contentflow/shared';
import { usePublications, useUpdatePublication, useDeletePublication, useCreatePublication } from '../../api/publications.js';
import { PlatformConfigForm } from './PlatformConfigForm.js';
import { AddPlatformModal } from './AddPlatformModal.js';
import { MarkPublishedModal } from './MarkPublishedModal.js';
import { PlatformIcon } from '../ui/PlatformIcon.js';
import { DateTimePicker } from '../ui/DateTimePicker.js';
import { TimePicker } from '../ui/TimePicker.js';
import { useUiStore, type PlatformBundle, type PlatformBundleItem } from '../../store/ui.store.js';

const BUILTIN_PLATFORMS = [
  'douyin', 'xiaohongshu', 'weixin', 'weixin_video',
  'bilibili', 'x', 'youtube', 'instagram', 'tiktok',
];

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  queued: 'bg-blue-100 text-blue-700',
  ready: 'bg-yellow-100 text-yellow-700',
  posting: 'bg-purple-100 text-purple-700',
  published: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  skipped: 'bg-gray-100 text-gray-400 line-through',
};

function formatScheduled(val: Date | string | null | undefined, locale: string): string {
  if (!val) return '—';
  const d = typeof val === 'string' ? new Date(val) : val;
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

// ─── Bundle Modal ─────────────────────────────────────────────────────────────

type BundleView = 'list' | 'create' | 'apply';

interface BundleModalProps {
  contentId: string;
  existingPlatforms: string[];
  currentPubs: Publication[];
  onClose: () => void;
}

function BundleModal({ contentId, existingPlatforms, currentPubs, onClose }: BundleModalProps) {
  const { t } = useTranslation('publications');
  const { t: tc } = useTranslation('contents');
  const { platformBundles, savePlatformBundle, removePlatformBundle, customPlatforms, disabledBuiltinPlatforms } = useUiStore();
  const createPublication = useCreatePublication(contentId);

  const [view, setView] = useState<BundleView>('list');
  const [deleteConfirmBundle, setDeleteConfirmBundle] = useState<PlatformBundle | null>(null);
  const [applyTarget, setApplyTarget] = useState<PlatformBundle | null>(null);
  const [applyDateIso, setApplyDateIso] = useState(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString();
  });
  const [applyTimes, setApplyTimes] = useState<Record<string, string>>({});
  const [applying, setApplying] = useState(false);

  // Create form state
  const [bundleName, setBundleName] = useState('');
  const [bundleItems, setBundleItems] = useState<PlatformBundleItem[]>([]);

  const enabledBuiltins = BUILTIN_PLATFORMS.filter((p) => !disabledBuiltinPlatforms.includes(p));
  const allPlatforms: { id: string; label: string }[] = [
    ...enabledBuiltins.map((id) => ({ id, label: tc(`platforms.${id}`) })),
    ...customPlatforms.map((cp) => ({ id: cp.id, label: cp.name })),
  ];

  function addItemToBundleForm(platformId: string) {
    if (bundleItems.some((i) => i.platform === platformId)) return;
    setBundleItems([...bundleItems, { platform: platformId, time: '' }]);
  }

  function removeItemFromBundleForm(platformId: string) {
    setBundleItems(bundleItems.filter((i) => i.platform !== platformId));
  }

  function updateItemTime(platformId: string, time: string) {
    setBundleItems(bundleItems.map((i) => i.platform === platformId ? { ...i, time } : i));
  }

  function handleSaveBundle() {
    if (!bundleName.trim() || bundleItems.length === 0) return;
    savePlatformBundle({ name: bundleName.trim(), items: bundleItems });
    setBundleName('');
    setBundleItems([]);
    setView('list');
  }

  function handleSaveCurrentAsBundle() {
    const items: PlatformBundleItem[] = currentPubs
      .filter((p) => p.status !== 'skipped')
      .map((p) => {
        let time = '';
        if (p.scheduledAt) {
          const d = new Date(p.scheduledAt as unknown as string);
          time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        }
        return { platform: p.platform, time };
      });
    if (items.length === 0) return;
    const name = `Bundle ${new Date().toLocaleDateString()}`;
    savePlatformBundle({ name, items });
  }

  async function handleApplyBundle() {
    if (!applyTarget) return;
    setApplying(true);
    const baseDate = new Date(applyDateIso);
    try {
      for (const item of applyTarget.items) {
        if (existingPlatforms.includes(item.platform)) continue;
        let scheduledAt: string | undefined;
        const timeStr = applyTimes[item.platform] ?? item.time;
        if (timeStr) {
          const [h, m] = timeStr.split(':').map(Number);
          const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), h ?? 0, m ?? 0, 0, 0);
          scheduledAt = d.toISOString();
        }
        await createPublication.mutateAsync({
          platform: item.platform,
          ...(scheduledAt ? { scheduledAt } : {}),
        });
      }
    } finally {
      setApplying(false);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            {view !== 'list' && (
              <button
                type="button"
                onClick={() => setView('list')}
                className="text-gray-400 hover:text-gray-600 text-sm mr-1"
              >
                ←
              </button>
            )}
            <h2 className="text-base font-semibold text-gray-900">
              {view === 'apply' && applyTarget ? applyTarget.name : t('bundle.title')}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* ── List view ── */}
          {view === 'list' && (
            <div className="p-4 space-y-2">
              {platformBundles.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500 font-medium">{t('bundle.empty')}</p>
                  <p className="text-xs text-gray-400 mt-1">{t('bundle.empty_hint')}</p>
                </div>
              ) : (
                platformBundles.map((bundle) => (
                  <div key={bundle.id} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-gray-800">{bundle.name}</p>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setApplyTarget(bundle);
                            setApplyTimes(Object.fromEntries(bundle.items.map((i) => [i.platform, i.time])));
                            setView('apply');
                          }}
                          className="text-xs px-2.5 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                        >
                          {t('bundle.apply')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmBundle(bundle)}
                          className="text-gray-300 hover:text-red-400 text-base leading-none transition-colors"
                          title={t('bundle.delete')}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {bundle.items.map((item) => (
                        <div key={item.platform} className="flex items-center gap-1 text-xs bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5">
                          <PlatformIcon platform={item.platform} className="w-3.5 h-3.5" />
                          <span className="text-gray-600">{item.time || t('bundle.no_time')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Create view ── */}
          {view === 'create' && (
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('bundle.title')}</label>
                <input
                  autoFocus
                  value={bundleName}
                  onChange={(e) => setBundleName(e.target.value)}
                  placeholder={t('bundle.name_placeholder')}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>

              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">{t('add.select_platform')}</p>
                <div className="grid grid-cols-4 gap-1.5 mb-3">
                  {allPlatforms.map((p) => {
                    const selected = bundleItems.some((i) => i.platform === p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selected ? removeItemFromBundleForm(p.id) : addItemToBundleForm(p.id)}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-colors ${
                          selected
                            ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <PlatformIcon platform={p.id} className="w-5 h-5" />
                        <span className="leading-tight text-center truncate w-full">{p.label}</span>
                      </button>
                    );
                  })}
                </div>

                {bundleItems.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-gray-500">{t('bundle.time_label')}</p>
                    {bundleItems.map((item) => {
                      const platform = allPlatforms.find((p) => p.id === item.platform);
                      return (
                        <div key={item.platform} className="flex items-center gap-2">
                          <PlatformIcon platform={item.platform} className="w-4 h-4 flex-shrink-0" />
                          <span className="text-xs text-gray-600 flex-1 truncate">{platform?.label}</span>
                          <TimePicker
                            value={item.time}
                            onChange={(time) => updateItemTime(item.platform, time)}
                            className="w-28"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Apply view ── */}
          {view === 'apply' && applyTarget && (
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('bundle.apply_date')}</label>
                <DateTimePicker
                  value={applyDateIso}
                  onChange={(iso) => { if (iso) { const d = new Date(iso); d.setHours(0, 0, 0, 0); setApplyDateIso(d.toISOString()); } }}
                  dateOnly
                  compact
                />
              </div>

              <div className="space-y-1.5">
                {applyTarget.items.map((item) => {
                  const alreadyAdded = existingPlatforms.includes(item.platform);
                  return (
                    <div key={item.platform} className={`flex items-center gap-2 p-2 rounded-lg ${alreadyAdded ? 'opacity-40' : 'bg-gray-50'}`}>
                      <PlatformIcon platform={item.platform} className="w-4 h-4 flex-shrink-0" />
                      <span className="text-xs text-gray-700 flex-1">{t(`platforms.${item.platform}`)}</span>
                      {alreadyAdded ? (
                        <span className="text-xs text-gray-400 italic">{t('bundle.skipped')}</span>
                      ) : (
                        <TimePicker
                          value={applyTimes[item.platform] ?? ''}
                          onChange={(time) => setApplyTimes((prev) => ({ ...prev, [item.platform]: time }))}
                          className="w-28"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex-shrink-0 flex items-center justify-between gap-2">
          {view === 'list' && (
            <>
              <button
                type="button"
                onClick={handleSaveCurrentAsBundle}
                disabled={currentPubs.filter((p) => p.status !== 'skipped').length === 0}
                className="text-xs text-gray-500 hover:text-indigo-600 disabled:opacity-30 transition-colors"
              >
                {t('bundle.save_current')}
              </button>
              <button
                type="button"
                onClick={() => setView('create')}
                className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                + {t('bundle.new')}
              </button>
            </>
          )}

          {view === 'create' && (
            <>
              <button type="button" onClick={() => setView('list')} className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5">
                {t('bundle.cancel')}
              </button>
              <button
                type="button"
                onClick={handleSaveBundle}
                disabled={!bundleName.trim() || bundleItems.length === 0}
                className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40"
              >
                {t('bundle.save')}
              </button>
            </>
          )}

          {view === 'apply' && (
            <>
              <button type="button" onClick={() => setView('list')} className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5">
                {t('bundle.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void handleApplyBundle()}
                disabled={applying}
                className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {applying ? t('bundle.applying') : t('bundle.apply_confirm')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Delete bundle confirmation */}
      {deleteConfirmBundle && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-xl p-5 w-72">
            <p className="text-sm font-semibold text-gray-900 mb-1">{t('bundle.delete_confirm_title')}</p>
            <p className="text-xs text-gray-500 mb-4">
              {t('bundle.delete_confirm_desc', { name: deleteConfirmBundle.name })}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmBundle(null)}
                className="text-xs text-gray-500 px-3 py-1.5 rounded hover:bg-gray-100"
              >
                {t('bundle.cancel')}
              </button>
              <button
                type="button"
                onClick={() => { removePlatformBundle(deleteConfirmBundle.id); setDeleteConfirmBundle(null); }}
                className="text-xs bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700"
              >
                {t('bundle.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface PublicationsPanelProps {
  contentId: string;
}

export function PublicationsPanel({ contentId }: PublicationsPanelProps) {
  const { t } = useTranslation('publications');
  const locale = useUiStore((s) => s.locale);
  const platformBundles = useUiStore((s) => s.platformBundles);
  const { data: pubs, isLoading, error } = usePublications(contentId);
  const updatePublication = useUpdatePublication();
  const deletePublication = useDeletePublication();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBundleModal, setShowBundleModal] = useState(false);
  const [markPublishedPub, setMarkPublishedPub] = useState<Publication | null>(null);
  const [removeConfirmPub, setRemoveConfirmPub] = useState<Publication | null>(null);

  if (isLoading) {
    return <p className="text-sm text-gray-400 py-4 text-center">{t('loading')}</p>;
  }

  if (error) {
    return <p className="text-sm text-red-500 py-4 text-center">{t('error')}</p>;
  }

  const pubList = pubs ?? [];
  const existingPlatforms = pubList.map((p) => p.platform);

  async function handleRemove(pub: Publication) {
    await deletePublication.mutateAsync({ id: pub.id, contentId });
    setRemoveConfirmPub(null);
  }

  async function handleCancel(pub: Publication) {
    await updatePublication.mutateAsync({
      id: pub.id,
      contentId,
      data: { status: 'draft' },
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
      {/* Panel header */}
      <div className="flex items-center justify-end pb-1">
        <button
          type="button"
          onClick={() => setShowBundleModal(true)}
          className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
            platformBundles.length > 0
              ? 'border-indigo-300 text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
              : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-500'
          }`}
        >
          {t('bundle.button')}{platformBundles.length > 0 && ` (${platformBundles.length})`}
        </button>
      </div>

      {pubList.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">{t('no_publications')}</p>
      ) : (
        <div className="space-y-2">
          {pubList.map((pub) => (
            <div key={pub.id} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Row */}
              <div className="flex items-center gap-2 px-3 py-2">
                <PlatformIcon platform={pub.platform} className="w-5 h-5 flex-shrink-0" />
                <span className="flex-1 text-sm font-medium text-gray-700 capitalize">
                  {t(`platforms.${pub.platform}`)}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[pub.status] ?? 'bg-gray-100 text-gray-600'}`}
                >
                  {t(`status.${pub.status}`)}
                </span>
                <span className="text-xs text-gray-400">{formatScheduled(pub.scheduledAt, locale)}</span>

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
                    <>
                      <button
                        type="button"
                        onClick={() => setMarkPublishedPub(pub)}
                        className="text-xs text-green-600 hover:text-green-800 px-1.5 py-0.5 rounded hover:bg-green-50"
                      >
                        {t('action.mark_published')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCancel(pub)}
                        className="text-xs text-gray-400 hover:text-red-500 px-1.5 py-0.5 rounded hover:bg-red-50"
                      >
                        {t('action.cancel')}
                      </button>
                    </>
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
                      onClick={() => setRemoveConfirmPub(pub)}
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

      {showBundleModal && (
        <BundleModal
          contentId={contentId}
          existingPlatforms={existingPlatforms}
          currentPubs={pubList}
          onClose={() => setShowBundleModal(false)}
        />
      )}

      {markPublishedPub && (
        <MarkPublishedModal
          publication={markPublishedPub}
          onClose={() => setMarkPublishedPub(null)}
        />
      )}

      {/* Remove publication confirmation */}
      {removeConfirmPub && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-5 w-72">
            <p className="text-sm font-semibold text-gray-900 mb-1">{t('remove_confirm_title')}</p>
            <p className="text-xs text-gray-500 mb-4">
              {t('remove_confirm_desc', { platform: t(`platforms.${removeConfirmPub.platform}`) })}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRemoveConfirmPub(null)}
                className="text-xs text-gray-500 px-3 py-1.5 rounded hover:bg-gray-100"
              >
                {t('bundle.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void handleRemove(removeConfirmPub)}
                className="text-xs bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700"
              >
                {t('action.remove')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
