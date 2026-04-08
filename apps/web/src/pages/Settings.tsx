import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Workspace } from '@contentflow/shared';
import { useWorkspaces, useUpdateWorkspace } from '../api/workspaces.js';
import { useUpdateProfile, useChangePassword, useDeleteAccount, useLogout } from '../api/auth.js';
import { apiFetch } from '../api/client.js';
import { useAuthStore } from '../store/auth.store.js';
import { useUiStore, type Theme, type CustomPlatform } from '../store/ui.store.js';
import { CreateWorkspaceModal } from '../components/workspaces/CreateWorkspaceModal.js';
import { PlatformIcon } from '../components/ui/PlatformIcon.js';
import i18n, { SUPPORTED_LOCALES, type SupportedLocale } from '../i18n/index.js';

type Section = 'general' | 'notifications' | 'workspaces' | 'platforms' | 'account';


const LOCALE_META: Record<SupportedLocale, { label: string }> = {
  'zh-CN': { label: '简体中文' },
  'zh-TW': { label: '繁體中文' },
  'en-US': { label: 'English' },
  'ja-JP': { label: '日本語' },
  'ko-KR': { label: '한국어' },
};

const EMOJI_OPTIONS = [
  '🎬', '📸', '✍️', '🎙', '📺', '🎮',
  '💄', '👗', '🍜', '✈️', '💪', '🐱',
  '🌿', '🎨', '🏋️', '📚', '🎵', '🏠',
  '💼', '🌍', '🍕', '🎯', '🚀', '💡',
];

const ROW = 'flex items-center justify-between py-3 border-b border-gray-100';
const LABEL = 'text-sm font-medium text-gray-900';

// ─── Edit Workspace Modal ─────────────────────────────────────────────────────

function EditWorkspaceModal({ workspace, onClose }: { workspace: Workspace; onClose: () => void }) {
  const { t } = useTranslation('workspaces');
  const updateWorkspace = useUpdateWorkspace();
  const [name, setName] = useState(workspace.name);
  const [icon, setIcon] = useState(workspace.icon);
  const [about, setAbout] = useState((workspace as Workspace & { about?: string }).about ?? '');
  const [goalCount, setGoalCount] = useState(workspace.publishGoal?.count ?? 3);
  const [goalPeriod, setGoalPeriod] = useState<'day' | 'week' | 'month'>(workspace.publishGoal?.period ?? 'week');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await updateWorkspace.mutateAsync({
      id: workspace.id,
      data: {
        name: name.trim(),
        icon,
        about: about.trim() || undefined,
        publishGoal: { count: goalCount, period: goalPeriod },
      },
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('edit_title')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
            {/* Preview */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <span
                className="w-10 h-10 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
                style={{ backgroundColor: workspace.color + '33' }}
              >
                {icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {name || <span className="text-gray-400 font-normal">{t('name_placeholder')}</span>}
                </p>
                {about && <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{about}</p>}
              </div>
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: workspace.color }} />
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('name')}</label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            {/* Icon — emoji only */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('icon_label')}</label>
              <div className="grid grid-cols-8 gap-1">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setIcon(emoji)}
                    className={`text-xl rounded-lg py-1.5 transition-colors ${
                      icon === emoji
                        ? 'bg-indigo-100 dark:bg-indigo-900 ring-2 ring-indigo-400'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* About */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('about_label')}</label>
              <textarea
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                placeholder={t('about_placeholder')}
                rows={2}
                maxLength={500}
                className="w-full text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
              />
            </div>

            {/* Publish target */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('publish_goal')}</label>
              <div className="flex items-center gap-2">
                <select
                  value={goalPeriod}
                  onChange={(e) => setGoalPeriod(e.target.value as 'day' | 'week' | 'month')}
                  className="text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="day">{t('publish_period.day')}</option>
                  <option value="week">{t('publish_period.week')}</option>
                  <option value="month">{t('publish_period.month')}</option>
                </select>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={goalCount}
                  onChange={(e) => setGoalCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200 text-center"
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('publish_goal_unit')}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900">
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={updateWorkspace.isPending}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {updateWorkspace.isPending ? '…' : t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── General Panel ────────────────────────────────────────────────────────────

function GeneralPanel() {
  const { t } = useTranslation('common');
  const locale = useUiStore((s) => s.locale);
  const setLocale = useUiStore((s) => s.setLocale);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await apiFetch<Blob>('/api/export', { headers: { Accept: 'application/json' } });
      const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contentflow-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const THEME_OPTIONS: { value: Theme; label: string }[] = [
    { value: 'system', label: t('settings.general.theme_system') },
    { value: 'light',  label: t('settings.general.theme_light')  },
    { value: 'dark',   label: t('settings.general.theme_dark')   },
  ];

  function handleLocale(l: SupportedLocale) {
    setLocale(l);
    void i18n.changeLanguage(l);
  }

  return (
    <div>
      <div className={ROW}>
        <span className={LABEL}>{t('settings.general.language')}</span>
        <select
          value={locale}
          onChange={(e) => handleLocale(e.target.value as SupportedLocale)}
          className="text-sm border border-gray-200 rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200 bg-white"
        >
          {SUPPORTED_LOCALES.map((l) => (
            <option key={l} value={l}>{LOCALE_META[l].label}</option>
          ))}
        </select>
      </div>

      <div className={ROW}>
        <span className={LABEL}>{t('settings.general.timezone')}</span>
        <span className="text-sm text-gray-500">{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
      </div>

      <div className={ROW}>
        <span className={LABEL}>{t('settings.general.appearance')}</span>
        <div className="flex rounded-md border border-gray-200 overflow-hidden text-sm flex-shrink-0">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={`px-2.5 py-1.5 transition-colors text-xs sm:text-sm ${
                theme === opt.value
                  ? 'bg-indigo-600 text-white font-medium'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className={ROW} style={{ borderBottom: 'none' }}>
        <span className={LABEL}>{t('settings.general.export_data')}</span>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="text-xs px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0 disabled:opacity-50"
        >
          {exporting ? t('settings.general.exporting') : t('settings.general.export_data')}
        </button>
      </div>
    </div>
  );
}

// ─── Notifications Panel ──────────────────────────────────────────────────────

function NotificationsPanel() {
  const { t } = useTranslation('common');
  const [enabled, setEnabled] = useState(
    typeof Notification !== 'undefined' && Notification.permission === 'granted'
  );
  const [leadTime, setLeadTime] = useState(15);

  async function handleToggle() {
    if (!enabled) {
      const perm = await Notification.requestPermission();
      setEnabled(perm === 'granted');
    } else {
      setEnabled(false);
    }
  }

  return (
    <div>
      <div className={ROW}>
        <div>
          <p className={LABEL}>{t('settings.notifications.publish_reminders')}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t('settings.notifications.publish_reminders_desc')}</p>
        </div>
        <button
          onClick={() => void handleToggle()}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ml-4 ${enabled ? 'bg-indigo-600' : 'bg-gray-200'}`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-1'}`} />
        </button>
      </div>

      {enabled && (
        <div className={ROW}>
          <span className={LABEL}>{t('settings.notifications.lead_time')}</span>
          <select
            value={leadTime}
            onChange={(e) => setLeadTime(Number(e.target.value))}
            className="text-sm border border-gray-200 rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200 bg-white"
          >
            {[5, 10, 15, 30, 60].map((m) => (
              <option key={m} value={m}>{m} {t('settings.notifications.lead_time_unit')}</option>
            ))}
          </select>
        </div>
      )}

      {typeof Notification !== 'undefined' && Notification.permission === 'denied' && (
        <p className="text-xs text-red-500 pt-3">{t('settings.notifications.blocked')}</p>
      )}
    </div>
  );
}

// ─── Workspaces Panel ─────────────────────────────────────────────────────────

function WorkspacesPanel() {
  const { t } = useTranslation('workspaces');
  const { t: tc } = useTranslation('common');
  const { data: workspaces = [], isLoading } = useWorkspaces();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Workspace | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{workspaces.length} {workspaces.length !== 1 ? tc('nav.workspaces').toLowerCase() : tc('nav.workspaces').toLowerCase()}</p>
        <button
          onClick={() => setShowCreate(true)}
          className="text-sm px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 transition-colors"
        >
          + {t('new_workspace')}
        </button>
      </div>

      {isLoading && <p className="text-sm text-gray-400">{tc('status.loading')}</p>}

      {!isLoading && workspaces.length === 0 && (
        <div className="text-center py-10 border border-dashed border-gray-200 rounded-lg">
          <p className="text-gray-400 text-sm">{t('no_workspaces')}</p>
        </div>
      )}

      <div className="space-y-1.5">
        {workspaces.map((ws) => (
          <div key={ws.id}
            className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg hover:border-gray-200 transition-colors"
          >
            <div className="w-8 h-8 rounded-md flex items-center justify-center text-base flex-shrink-0"
              style={{ backgroundColor: ws.color + '18' }}>
              {ws.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{ws.name}</p>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {t(`content_types.${ws.contentType}`)}
                {ws.publishGoal ? ` · ${ws.publishGoal.count}/${t(`publish_period.${ws.publishGoal.period}`)}` : ''}
              </p>
            </div>
            <button onClick={() => setEditing(ws)}
              className="text-xs text-gray-500 hover:text-indigo-600 px-2 py-1 rounded hover:bg-gray-100 transition-colors flex-shrink-0">
              {tc('action.edit')}
            </button>
          </div>
        ))}
      </div>

      {showCreate && <CreateWorkspaceModal onClose={() => setShowCreate(false)} />}
      {editing && <EditWorkspaceModal workspace={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

// ─── Editable Field ───────────────────────────────────────────────────────────

function EditableField({
  label, value, type = 'text', onSave, saving,
}: {
  label: string; value: string; type?: string;
  onSave: (val: string) => Promise<void>; saving: boolean;
}) {
  const { t } = useTranslation('common');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setDraft(value); setError(''); setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  async function handleSave() {
    if (draft.trim() === value) { setEditing(false); return; }
    setError('');
    try {
      await onSave(draft.trim());
      setEditing(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('error.failed_to_save'));
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') void handleSave();
    if (e.key === 'Escape') setEditing(false);
  }

  return (
    <div className="flex items-center justify-between py-3 px-4 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
      <span className="text-sm font-medium text-gray-900 dark:text-white">{label}</span>
      {editing ? (
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <input ref={inputRef} type={type} value={draft}
            onChange={(e) => setDraft(e.target.value)} onKeyDown={handleKey}
            className="text-sm border border-gray-200 rounded-md px-2 py-1 w-44 outline-none focus:ring-2 focus:ring-indigo-200" />
          <button onClick={() => void handleSave()} disabled={saving || !draft.trim()}
            className="text-xs px-2 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50">
            {saving ? '…' : t('action.save')}
          </button>
          <button onClick={() => setEditing(false)} className="text-xs text-gray-500 hover:text-gray-700">
            {t('action.cancel')}
          </button>
          {error && <span className="text-xs text-red-500 w-full text-right">{error}</span>}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{value}</span>
          <button onClick={startEdit}
            className="text-xs text-gray-400 hover:text-indigo-600 px-1.5 py-0.5 rounded hover:bg-gray-100 transition-colors">
            {t('action.edit')}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Change Password Modal ────────────────────────────────────────────────────

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('common');
  const changePassword = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (next !== confirm) { setError(t('settings.account.passwords_mismatch')); return; }
    if (next.length < 8) { setError(t('settings.account.password_too_short')); return; }
    try {
      await changePassword.mutateAsync({ currentPassword: current, newPassword: next });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error.failed'));
    }
  }

  const fields = [
    { label: t('settings.account.current_password'),  value: current,  set: setCurrent  },
    { label: t('settings.account.new_password'),       value: next,     set: setNext     },
    { label: t('settings.account.confirm_new_password'), value: confirm, set: setConfirm },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg border border-gray-200 shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">{t('settings.account.change_password')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="px-5 py-4 space-y-3">
          {fields.map(({ label, value, set }) => (
            <div key={label}>
              <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
              <input type="password" value={value} onChange={(e) => set(e.target.value)} required
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200" />
            </div>
          ))}
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">
              {t('action.cancel')}
            </button>
            <button type="submit" disabled={changePassword.isPending}
              className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50">
              {changePassword.isPending ? '…' : t('settings.account.update_password')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Account Modal ─────────────────────────────────────────────────────

function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('common');
  const deleteAccount = useDeleteAccount();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await deleteAccount.mutateAsync({ password });
      clearAuth();
      void navigate('/login', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error.failed'));
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg border border-gray-200 shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">{t('settings.account.delete_account')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
        </div>
        <form onSubmit={(e) => void handleDelete(e)} className="px-5 py-4 space-y-4">
          <p className="text-sm text-gray-600">{t('settings.account.delete_warning')}</p>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {t('settings.account.confirm_password_label')}
            </label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-red-200" />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">
              {t('action.cancel')}
            </button>
            <button type="submit" disabled={deleteAccount.isPending || !password}
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50">
              {deleteAccount.isPending ? '…' : t('settings.account.delete_my_account')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Account Panel ────────────────────────────────────────────────────────────

function AccountPanel() {
  const { t } = useTranslation('common');
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const updateProfile = useUpdateProfile();
  const logoutMutation = useLogout();
  const navigate = useNavigate();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const initial = user?.name ? (user.name[0]?.toUpperCase() ?? 'U') : 'U';

  function handleSignOut() {
    logoutMutation.mutate(undefined, {
      onSuccess: () => { clearAuth(); void navigate('/login', { replace: true }); },
      onError:   () => { clearAuth(); void navigate('/login', { replace: true }); },
    });
  }

  async function saveName(name: string) { updateUser(await updateProfile.mutateAsync({ name })); }
  async function saveEmail(email: string) { updateUser(await updateProfile.mutateAsync({ email })); }

  return (
    <div className="space-y-5">
      {/* Profile card */}
      <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
        <div className="w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center text-2xl font-semibold flex-shrink-0">
          {initial}
        </div>
        <div className="min-w-0">
          <p className="text-base font-semibold text-gray-900 dark:text-white truncate">{user?.name}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
        </div>
      </div>

      {/* Profile fields */}
      <div className="rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('settings.account.profile')}</p>
        </div>
        <EditableField label={t('settings.account.name')}  value={user?.name ?? ''}  onSave={saveName}  saving={updateProfile.isPending} />
        <EditableField label={t('settings.account.email')} value={user?.email ?? ''} onSave={saveEmail} saving={updateProfile.isPending} type="email" />
      </div>

      {/* Security */}
      <div className="rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('settings.account.security')}</p>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{t('settings.account.password')}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t('settings.account.password_desc')}</p>
          </div>
          <button
            onClick={() => setShowChangePassword(true)}
            className="text-xs px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
          >
            {t('settings.account.change_password')}
          </button>
        </div>
      </div>

      {/* Sign out — mobile only (desktop uses sidebar account menu) */}
      <div className="md:hidden rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{t('auth.sign_out')}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t('settings.account.sign_out_desc')}</p>
          </div>
          <button
            onClick={handleSignOut}
            disabled={logoutMutation.isPending}
            className="text-xs px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex-shrink-0 disabled:opacity-50"
          >
            {t('auth.sign_out')}
          </button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="rounded-xl border border-red-100 dark:border-red-900/40 overflow-hidden">
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/40">
          <p className="text-xs font-medium text-red-500 uppercase tracking-wide">{t('settings.account.danger_zone')}</p>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{t('settings.account.delete_account')}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t('settings.account.delete_desc')}</p>
          </div>
          <button
            onClick={() => setShowDeleteAccount(true)}
            className="text-xs px-3 py-1.5 rounded-md border border-red-200 text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
          >
            {t('settings.account.delete_account')}
          </button>
        </div>
      </div>

      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
      {showDeleteAccount  && <DeleteAccountModal  onClose={() => setShowDeleteAccount(false)} />}
    </div>
  );
}

// ─── Platforms Panel ─────────────────────────────────────────────────────────

const BUILTIN_PLATFORMS = [
  { id: 'douyin',       label: 'Douyin'       },
  { id: 'xiaohongshu',  label: 'RedNote'      },
  { id: 'weixin',       label: 'WeChat OA'    },
  { id: 'weixin_video', label: 'WeChat Video' },
  { id: 'bilibili',     label: 'Bilibili'     },
  { id: 'x',            label: 'X (Twitter)'  },
  { id: 'youtube',      label: 'YouTube'      },
  { id: 'instagram',    label: 'Instagram'    },
  { id: 'tiktok',       label: 'TikTok'       },
];

function PlatformsPanel() {
  const { t } = useTranslation('contents');
  const { t: tc } = useTranslation('common');
  const {
    customPlatforms, addCustomPlatform, removeCustomPlatform,
    disabledBuiltinPlatforms, toggleBuiltinPlatform,
  } = useUiStore();

  const [adding, setAdding] = useState(false);
  const [icon, setIcon] = useState(''); // data URL (SVG) or emoji
  const [name, setName] = useState('');

  function handleSvgUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === 'string') setIcon(result);
    };
    reader.readAsDataURL(file);
    // reset input so re-selecting same file still fires onChange
    e.target.value = '';
  }

  function handleAdd() {
    const n = name.trim();
    if (!n) return;
    addCustomPlatform(n, icon || '📌');
    setIcon('');
    setName('');
    setAdding(false);
  }

  return (
    <div className="space-y-6">
      {/* Built-in platforms */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
          {tc('settings.platforms.builtin_title')}
        </p>
        <div className="space-y-1">
          {BUILTIN_PLATFORMS.map((p) => {
            const enabled = !disabledBuiltinPlatforms.includes(p.id);
            return (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <PlatformIcon platform={p.id} className="w-6 h-6" />
                  <span className="text-sm text-gray-800">{t(`platforms.${p.id}`)}</span>
                </div>
                <button
                  onClick={() => toggleBuiltinPlatform(p.id)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${enabled ? 'bg-indigo-600' : 'bg-gray-200'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-1'}`} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom platforms */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
          {tc('settings.platforms.custom_title')}
        </p>
        {customPlatforms.length === 0 && !adding && (
          <p className="text-sm text-gray-400 mb-3">{t('drawer.no_custom_platforms')}</p>
        )}
        <div className="space-y-1">
          {customPlatforms.map((cp: CustomPlatform) => (
            <div key={cp.id} className="flex items-center justify-between py-2 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <PlatformIcon platform={cp.id} className="w-6 h-6" />
                <span className="text-sm text-gray-800">{cp.name}</span>
              </div>
              <button
                onClick={() => removeCustomPlatform(cp.id)}
                className="text-xs text-gray-400 hover:text-red-500 px-2 py-0.5 rounded hover:bg-red-50 transition-colors"
              >
                {tc('action.remove')}
              </button>
            </div>
          ))}
        </div>

        {adding ? (
          <div className="mt-3 p-3 border border-indigo-200 rounded-lg bg-indigo-50 space-y-3">
            {/* Icon upload */}
            <div className="flex items-center gap-3">
              <label className="flex flex-col items-center justify-center w-12 h-12 rounded-lg border-2 border-dashed border-indigo-300 bg-white cursor-pointer hover:border-indigo-500 transition-colors overflow-hidden flex-shrink-0">
                {icon ? (
                  icon.startsWith('data:') ? (
                    <img src={icon} alt="icon preview" className="w-full h-full object-contain p-1" />
                  ) : (
                    <span className="text-2xl">{icon}</span>
                  )
                ) : (
                  <span className="text-gray-400 text-xs text-center leading-tight px-1">SVG</span>
                )}
                <input
                  type="file"
                  accept=".svg,image/svg+xml"
                  className="hidden"
                  onChange={handleSvgUpload}
                />
              </label>
              <div className="flex-1">
                <p className="text-xs text-gray-600 mb-1">{tc('settings.platforms.upload_icon_hint')} <span className="text-gray-400">{tc('settings.platforms.upload_icon_sub')}</span></p>
                {icon && (
                  <button onClick={() => setIcon('')} className="text-xs text-red-400 hover:text-red-600">
                    {tc('settings.platforms.remove_icon')}
                  </button>
                )}
              </div>
            </div>
            {/* Name + actions */}
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAdding(false); setIcon(''); } }}
                placeholder={t('drawer.custom_platform_name')}
                className="flex-1 text-sm bg-white border border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <button onClick={handleAdd} disabled={!name.trim()} className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-40">
                {tc('action.add')}
              </button>
              <button onClick={() => { setAdding(false); setIcon(''); setName(''); }} className="text-xs text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="mt-3 w-full py-2 text-sm text-indigo-600 border border-dashed border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors"
          >
            + {tc('settings.platforms.add_custom')}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Settings Modal ───────────────────────────────────────────────────────────

export function SettingsModal({ onClose, initialSection }: { onClose: () => void; initialSection?: string }) {
  const { t } = useTranslation('common');
  const [section, setSection] = useState<Section>((initialSection as Section) ?? 'account');

  const NAV_ITEMS: { id: Section; label: string }[] = [
    { id: 'account',       label: t('settings.sections.account')       },
    { id: 'general',       label: t('settings.sections.general')       },
    { id: 'notifications', label: t('settings.sections.notifications') },
    { id: 'workspaces',    label: t('settings.sections.workspaces')    },
    { id: 'platforms',     label: t('settings.sections.platforms')     },
  ];

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 md:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 w-full md:max-w-2xl flex flex-col md:flex-row overflow-hidden rounded-t-2xl md:rounded-xl border border-gray-200 dark:border-gray-700 h-[88vh] md:h-[520px]"
        style={{ boxShadow: '0 16px 48px rgba(0,0,0,0.16)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile: horizontal tab bar */}
        <div className="flex md:hidden flex-col flex-shrink-0">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              {NAV_ITEMS.find((n) => n.id === section)?.label}
            </h2>
            <button onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs"
              aria-label={t('aria.close')}>
              ✕
            </button>
          </div>
          <div className="flex gap-1 px-3 pb-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {NAV_ITEMS.map((item) => (
              <button key={item.id} onClick={() => setSection(item.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  section === item.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}>
                {item.label}
              </button>
            ))}
          </div>
          <div className="border-b border-gray-100 dark:border-gray-700" />
        </div>

        {/* Desktop: vertical sidebar */}
        <div className="hidden md:flex w-44 flex-shrink-0 bg-gray-50 dark:bg-gray-900 border-r border-gray-100 dark:border-gray-700 flex-col pt-4 pb-3">
          <button onClick={onClose}
            className="mx-3 mb-3 w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-600 text-xs transition-colors"
            aria-label={t('aria.close')}>
            ✕
          </button>
          <nav className="flex-1 px-2 space-y-[1px]">
            {NAV_ITEMS.map((item) => (
              <button key={item.id} onClick={() => setSection(item.id)}
                className={`w-full text-left px-3 py-[6px] rounded-md text-[13px] transition-colors ${
                  section === item.id
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}>
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content panel */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-800">
          <div className="hidden md:block px-6 pt-5 pb-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              {NAV_ITEMS.find((n) => n.id === section)?.label}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {section === 'general'       && <GeneralPanel />}
            {section === 'notifications' && <NotificationsPanel />}
            {section === 'workspaces'    && <WorkspacesPanel />}
            {section === 'platforms'     && <PlatformsPanel />}
            {section === 'account'       && <AccountPanel />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
