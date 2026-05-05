import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Publication } from '@orbit/shared';
import { usePlatformAccounts, type PlatformId } from '../../api/platformAccounts.js';
import { usePublishNow } from '../../api/uploadJobs.js';
import { toast } from '../../store/toast.store.js';

// Map publication.platform values (from existing schema) to platform_accounts.platform values.
// Most are identical; the Chinese-platform IDs differ historically (xiaohongshu vs rednote).
const PLATFORM_ALIAS: Record<string, PlatformId> = {
  douyin: 'douyin',
  xiaohongshu: 'rednote',
  rednote: 'rednote',
  weixin_video: 'wechat_video',
  wechat_video: 'wechat_video',
  bilibili: 'bilibili',
  tiktok: 'tiktok',
  youtube: 'youtube',
  instagram: 'instagram',
  facebook: 'facebook',
  x: 'x',
};

interface Props {
  publication: Publication;
  onClose: () => void;
  onPublished?: (jobId: string) => void;
}

export function PublishNowDialog({ publication, onClose, onPublished }: Props) {
  const { t } = useTranslation('publications');
  const { t: tpa } = useTranslation('platformAccounts');
  const aliased = PLATFORM_ALIAS[publication.platform];
  const accountsQ = usePlatformAccounts(aliased);
  const publish = usePublishNow();

  const [accountId, setAccountId] = useState<string>('');
  const [useSchedule, setUseSchedule] = useState<boolean>(Boolean(publication.scheduledAt));
  const [scheduledAt, setScheduledAt] = useState<string>(
    publication.scheduledAt ? toLocalInput(new Date(publication.scheduledAt)) : '',
  );

  useEffect(() => {
    const accs = accountsQ.data ?? [];
    if (!accountId && accs.length > 0) {
      setAccountId(accs[0]!.id);
    }
  }, [accountsQ.data, accountId]);

  const accounts = accountsQ.data ?? [];
  const supported = aliased !== undefined;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId) return;
    try {
      const body: Parameters<typeof publish.mutateAsync>[0] = {
        publicationId: publication.id,
        platformAccountId: accountId,
      };
      if (useSchedule && scheduledAt) {
        body.scheduledAt = new Date(scheduledAt).toISOString();
      }
      const result = await publish.mutateAsync(body);
      toast.success(t('publish_now.queued'));
      onPublished?.(result.jobId);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('publish_now.title')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg" aria-label="Close">✕</button>
        </div>
        <form onSubmit={(e) => void submit(e)} className="px-5 py-4 space-y-4">
          {!supported ? (
            <p className="text-sm text-amber-600">
              {t('publish_now.unsupported_platform', { platform: publication.platform })}
            </p>
          ) : accounts.length === 0 ? (
            <div className="rounded-lg bg-gray-50 dark:bg-gray-900 px-3 py-3 text-sm text-gray-600 dark:text-gray-400">
              {t('publish_now.no_accounts', { platform: tpa(`platforms.${aliased}`) })}
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  {t('publish_now.account')}
                </label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.displayName || a.accountName} ({a.cookieStatus})
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={useSchedule}
                  onChange={(e) => setUseSchedule(e.target.checked)}
                />
                {t('publish_now.schedule_label')}
              </label>
              {useSchedule && (
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                />
              )}
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {t('publish_now.cancel')}
            </button>
            <button
              type="submit"
              disabled={!supported || accounts.length === 0 || !accountId || publish.isPending}
              className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {publish.isPending ? t('publish_now.submitting') : t('publish_now.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
