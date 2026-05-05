import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  usePlatformAccounts,
  useDeletePlatformAccount,
  useRecheckPlatformAccount,
  useReplaceCookies,
  useRenamePlatformAccount,
  type PlatformAccount,
  type CookieStatus,
} from '../../api/platformAccounts.js';
import { AddAccountModal } from './AddAccountModal.js';
import { toast } from '../../store/toast.store.js';

const STATUS_BADGE: Record<CookieStatus, string> = {
  valid:    'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  invalid:  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  unknown:  'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  checking: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

export function PlatformAccountsPanel() {
  const { t } = useTranslation('platformAccounts');
  const { data: accounts = [], isLoading } = usePlatformAccounts();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('panel.subtitle')}</p>
        <button
          onClick={() => setShowAdd(true)}
          className="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
        >
          {t('panel.add')}
        </button>
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-400">{t('panel.loading')}</div>
      ) : accounts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 px-4 py-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{t('panel.empty')}</p>
          <button
            onClick={() => setShowAdd(true)}
            className="text-xs text-indigo-600 hover:text-indigo-700 underline"
          >
            {t('panel.add_first')}
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {accounts.map((acc) => (
            <AccountRow key={acc.id} account={acc} />
          ))}
        </ul>
      )}

      {showAdd && <AddAccountModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function AccountRow({ account }: { account: PlatformAccount }) {
  const { t } = useTranslation('platformAccounts');
  const recheck = useRecheckPlatformAccount();
  const replace = useReplaceCookies();
  const rename = useRenamePlatformAccount();
  const remove = useDeletePlatformAccount();
  const [pasting, setPasting] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(account.displayName ?? account.accountName);
  const [cookies, setCookies] = useState('');

  async function handleRecheck() {
    try {
      const r = await recheck.mutateAsync(account.id);
      if (r.valid) toast.success(t('row.recheck_valid'));
      else toast.error(t('row.recheck_invalid', { reason: r.reason ?? '' }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleReplace() {
    try {
      const r = await replace.mutateAsync({ id: account.id, cookies });
      toast.success(
        r.missingDomains.length
          ? t('row.replaced_warn', { domains: r.missingDomains.join(', ') })
          : t('row.replaced'),
      );
      setPasting(false);
      setCookies('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleRename() {
    try {
      await rename.mutateAsync({ id: account.id, displayName: draftName.trim() || null });
      setRenaming(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDelete() {
    if (!window.confirm(t('row.delete_confirm', { name: account.accountName }))) return;
    try {
      await remove.mutateAsync(account.id);
      toast.success(t('row.deleted'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <li className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          {renaming ? (
            <div className="flex items-center gap-2">
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              />
              <button onClick={() => void handleRename()} className="text-xs text-indigo-600 hover:underline">{t('action.save')}</button>
              <button onClick={() => setRenaming(false)} className="text-xs text-gray-500 hover:underline">{t('action.cancel')}</button>
            </div>
          ) : (
            <button onClick={() => setRenaming(true)} className="text-left">
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {account.displayName || account.accountName}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {t(`platforms.${account.platform}`)} · {account.accountName}
              </div>
            </button>
          )}
        </div>
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[account.cookieStatus]}`}>
          {t(`status.${account.cookieStatus}`)}
        </span>
        <div className="flex items-center gap-1.5 text-xs">
          <button
            onClick={() => void handleRecheck()}
            disabled={recheck.isPending}
            className="px-2 py-1 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {recheck.isPending ? t('row.rechecking') : t('row.recheck')}
          </button>
          <button
            onClick={() => setPasting((v) => !v)}
            className="px-2 py-1 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {t('row.replace')}
          </button>
          <button
            onClick={() => void handleDelete()}
            className="px-2 py-1 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
          >
            {t('row.delete')}
          </button>
        </div>
      </div>

      {pasting && (
        <div className="mt-3 space-y-2">
          <textarea
            value={cookies}
            onChange={(e) => setCookies(e.target.value)}
            rows={5}
            spellCheck={false}
            placeholder={t('add.cookies_placeholder')}
            className="w-full px-3 py-2 text-xs font-mono border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setPasting(false); setCookies(''); }}
              className="px-3 py-1 text-xs rounded text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {t('action.cancel')}
            </button>
            <button
              onClick={() => void handleReplace()}
              disabled={replace.isPending || !cookies.trim()}
              className="px-3 py-1 text-xs rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {replace.isPending ? t('action.saving') : t('action.save')}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
