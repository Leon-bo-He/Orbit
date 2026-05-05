import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreatePlatformAccount, type PlatformId } from '../../api/platformAccounts.js';
import { CookieInstructionsTable } from './CookieInstructionsTable.js';
import { toast } from '../../store/toast.store.js';

const PLATFORMS: PlatformId[] = [
  'douyin', 'rednote', 'wechat_video', 'bilibili',
  'tiktok', 'youtube', 'instagram', 'facebook', 'x',
];

interface Props {
  initialPlatform?: PlatformId;
  onClose: () => void;
  onCreated?: (id: string) => void;
}

export function AddAccountModal({ initialPlatform, onClose, onCreated }: Props) {
  const { t } = useTranslation('platformAccounts');
  const [platform, setPlatform] = useState<PlatformId>(initialPlatform ?? 'douyin');
  const [accountName, setAccountName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [cookies, setCookies] = useState('');
  const [error, setError] = useState('');
  const create = useCreatePlatformAccount();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!accountName.trim()) {
      setError(t('add.account_name_required'));
      return;
    }
    if (!cookies.trim()) {
      setError(t('add.cookies_required'));
      return;
    }
    try {
      const result = await create.mutateAsync({
        platform,
        accountName: accountName.trim(),
        displayName: displayName.trim() || null,
        cookies,
      });
      if (result.missingDomains.length > 0) {
        toast.info(t('add.warn_missing_domains', { domains: result.missingDomains.join(', ') }));
      } else {
        toast.success(t('add.created'));
      }
      onCreated?.(result.account.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('add.title')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg" aria-label="Close">✕</button>
        </div>

        <form onSubmit={(e) => void submit(e)} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                {t('add.platform')}
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as PlatformId)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>{t(`platforms.${p}`)}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  {t('add.account_name')}
                </label>
                <input
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder={t('add.account_name_placeholder')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  {t('add.display_name')}
                </label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t('add.display_name_placeholder')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                />
              </div>
            </div>

            <details className="rounded-lg border border-gray-200 dark:border-gray-700">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                {t('add.show_instructions')}
              </summary>
              <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700">
                <CookieInstructionsTable platform={platform} />
              </div>
            </details>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                {t('add.cookies')}
              </label>
              <textarea
                value={cookies}
                onChange={(e) => setCookies(e.target.value)}
                rows={8}
                spellCheck={false}
                placeholder={t('add.cookies_placeholder')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-xs font-mono"
              />
              <p className="text-[11px] text-gray-500 mt-1">{t('add.cookies_hint')}</p>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}
          </div>

          <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {t('action.cancel')}
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {create.isPending ? t('action.saving') : t('action.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
