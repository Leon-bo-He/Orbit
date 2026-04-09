import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreatePublication } from '../../api/publications.js';
import { useCustomPlatforms } from '../../api/custom-platforms.js';
import { DateTimePicker } from '../ui/DateTimePicker.js';
import { PlatformIcon } from '../ui/PlatformIcon.js';
import { useUiStore } from '../../store/ui.store.js';

const BUILTIN_PLATFORMS = [
  'douyin', 'xiaohongshu', 'weixin', 'weixin_video',
  'bilibili', 'x', 'youtube', 'instagram', 'tiktok',
];

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface AddPlatformModalProps {
  contentId: string;
  existingPlatforms: string[];
  onClose: () => void;
}

export function AddPlatformModal({ contentId, existingPlatforms, onClose }: AddPlatformModalProps) {
  const { t } = useTranslation('publications');
  const { t: tc } = useTranslation('contents');
  const createPublication = useCreatePublication(contentId);
  const { data: customPlatforms = [] } = useCustomPlatforms();
  const { disabledBuiltinPlatforms, openSettings } = useUiStore();

  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState(toDatetimeLocal(new Date()));
  const [useSchedule, setUseSchedule] = useState(false);
  const [error, setError] = useState('');

  const enabledBuiltins = BUILTIN_PLATFORMS.filter((p) => !disabledBuiltinPlatforms.includes(p));
  const allPlatforms: { id: string; label: string }[] = [
    ...enabledBuiltins.map((id) => ({ id, label: tc(`platforms.${id}`) })),
    ...customPlatforms.map((cp) => ({ id: cp.id, label: cp.name })),
  ];
  const availablePlatforms = allPlatforms.filter((p) => !existingPlatforms.includes(p.id));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPlatform) {
      setError(t('add.select_platform'));
      return;
    }
    await createPublication.mutateAsync({
      platform: selectedPlatform as Parameters<typeof createPublication.mutateAsync>[0]['platform'],
      scheduledAt: useSchedule && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{t('add.title')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="px-5 py-4 space-y-4">
          {/* Platform grid */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('add.select_platform')}
            </label>
            {availablePlatforms.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-gray-400 mb-2">{t('add.all_added')}</p>
                <button
                  type="button"
                  onClick={() => openSettings('platforms')}
                  className="text-xs text-indigo-600 hover:text-indigo-700 underline"
                >
                  {t('add.manage_settings')}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {availablePlatforms.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setSelectedPlatform(p.id); setError(''); }}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-xs transition-colors ${
                      selectedPlatform === p.id
                        ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <PlatformIcon platform={p.id} className="w-6 h-6" />
                    <span className="leading-tight text-center">{p.label}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => openSettings('platforms')}
                  className="flex flex-col items-center gap-1 p-3 rounded-lg border border-dashed border-gray-200 text-xs text-gray-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors"
                >
                  <span className="text-lg">+</span>
                  <span className="leading-tight text-center">{t('add.add_custom')}</span>
                </button>
              </div>
            )}
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
          </div>

          {/* Optional schedule */}
          <div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={useSchedule}
                onChange={(e) => setUseSchedule(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600"
              />
              {t('add.set_schedule')}
            </label>
            {useSchedule && (
              <div className="mt-2">
                <DateTimePicker
                  value={scheduledAt ? new Date(scheduledAt).toISOString() : ''}
                  onChange={(iso) => setScheduledAt(iso ?? '')}
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              {t('add.cancel')}
            </button>
            <button
              type="submit"
              disabled={createPublication.isPending || availablePlatforms.length === 0}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {createPublication.isPending ? '...' : t('add.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
