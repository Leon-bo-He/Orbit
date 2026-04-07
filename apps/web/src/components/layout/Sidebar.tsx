import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WorkspaceSwitcher } from './WorkspaceSwitcher.js';
import { useUiStore } from '../../store/ui.store.js';
import { useWorkspaces } from '../../api/workspaces.js';
import { useAuthStore } from '../../store/auth.store.js';
import { useLogout } from '../../api/auth.js';
import { toast } from '../../store/toast.store.js';
import i18n, { SUPPORTED_LOCALES, type SupportedLocale } from '../../i18n/index.js';

const LOCALE_META: Record<SupportedLocale, { flag: string; code: string }> = {
  'zh-CN': { flag: '🇨🇳', code: 'CN' },
  'en-US': { flag: '🇺🇸', code: 'EN' },
  'ja-JP': { flag: '🇯🇵', code: 'JA' },
  'ko-KR': { flag: '🇰🇷', code: 'KR' },
  'zh-TW': { flag: '🇹🇼', code: 'TW' },
};

const topNavItems = [
  { path: '/', label: 'nav.dashboard', icon: '◻' },
  { path: '/ideas', label: 'nav.ideas', icon: '💡' },
  { path: '/publications', label: 'nav.publications', icon: '📤' },
] as const;

const bottomNavItems = [
  { path: '/settings', label: 'nav.settings', icon: '⚙' },
] as const;

export function Sidebar() {
  const { t } = useTranslation('common');
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const activeWorkspaceId = useUiStore((s) => s.activeWorkspaceId);
  const setActiveWorkspace = useUiStore((s) => s.setActiveWorkspace);
  const locale = useUiStore((s) => s.locale);
  const setLocale = useUiStore((s) => s.setLocale);
  const navigate = useNavigate();

  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const logoutMutation = useLogout();

  const { data: workspaces = [] } = useWorkspaces();

  function handleLocaleChange(newLocale: SupportedLocale) {
    setLocale(newLocale);
    void i18n.changeLanguage(newLocale);
  }

  function handleWorkspaceSelect(id: string) {
    setActiveWorkspace(id);
    void navigate(`/workspaces/${id}/board`);
  }

  function handleSignOut() {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        clearAuth();
        toast.success(t('auth.sign_out'));
        void navigate('/login', { replace: true });
      },
      onError: () => {
        // Clear client-side auth even if server call fails
        clearAuth();
        void navigate('/login', { replace: true });
      },
    });
  }

  return (
    <div className="h-full flex flex-col bg-surface-raised border-r border-gray-200">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-gray-200 flex-shrink-0">
        {!collapsed && <span className="font-semibold text-indigo-600">ContentFlow</span>}
        <button
          onClick={toggle}
          className="ml-auto text-gray-400 hover:text-gray-600"
          aria-label="Toggle sidebar"
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

      {/* Workspace switcher */}
      {!collapsed && <WorkspaceSwitcher />}

      {/* Main nav */}
      <nav className="flex-1 py-2 space-y-0.5 px-2 overflow-y-auto">
        {topNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            <span>{item.icon}</span>
            {!collapsed && <span>{t(item.label)}</span>}
          </NavLink>
        ))}

        {/* Workspaces section */}
        {!collapsed && workspaces.length > 0 && (
          <div className="pt-3">
            <p className="px-2 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wide">
              {t('nav.workspaces')}
            </p>
            {workspaces.map((ws) => {
              const isActive = ws.id === activeWorkspaceId;
              return (
                <div key={ws.id}>
                  <button
                    onClick={() => handleWorkspaceSelect(ws.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: ws.color }}
                    />
                    <span className="truncate">{ws.icon} {ws.name}</span>
                  </button>

                  {/* Sub-nav for active workspace */}
                  {isActive && (
                    <div className="ml-6 mt-0.5 space-y-0.5">
                      <NavLink
                        to={`/workspaces/${ws.id}/board`}
                        className={({ isActive: a }) =>
                          `flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors ${
                            a ? 'text-indigo-600 font-medium' : 'text-gray-500 hover:text-gray-700'
                          }`
                        }
                      >
                        <span>📋</span>
                        <span>{t('nav.board')}</span>
                      </NavLink>
                      <NavLink
                        to={`/workspaces/${ws.id}/calendar`}
                        className={({ isActive: a }) =>
                          `flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors ${
                            a ? 'text-indigo-600 font-medium' : 'text-gray-500 hover:text-gray-700'
                          }`
                        }
                      >
                        <span>📅</span>
                        <span>{t('nav.calendar')}</span>
                      </NavLink>
                      <NavLink
                        to={`/workspaces/${ws.id}/analytics`}
                        className={({ isActive: a }) =>
                          `flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors ${
                            a ? 'text-indigo-600 font-medium' : 'text-gray-500 hover:text-gray-700'
                          }`
                        }
                      >
                        <span>📊</span>
                        <span>{t('nav.analytics')}</span>
                      </NavLink>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Collapsed workspace icons */}
        {collapsed && workspaces.map((ws) => (
          <button
            key={ws.id}
            onClick={() => handleWorkspaceSelect(ws.id)}
            title={ws.name}
            className={`w-full flex items-center justify-center py-2 rounded-md transition-colors ${
              ws.id === activeWorkspaceId ? 'bg-indigo-50' : 'hover:bg-gray-100'
            }`}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: ws.color }}
            />
          </button>
        ))}
      </nav>

      {/* Bottom nav */}
      <div className="py-2 px-2 border-t border-gray-100 space-y-0.5">
        {bottomNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            <span>{item.icon}</span>
            {!collapsed && <span>{t(item.label)}</span>}
          </NavLink>
        ))}

        {/* Locale switcher */}
        {!collapsed && (
          <div className="pt-2">
            <p className="px-2 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wide">Language</p>
            <div className="flex flex-wrap gap-1 px-1">
              {SUPPORTED_LOCALES.map((loc) => {
                const meta = LOCALE_META[loc];
                return (
                  <button
                    key={loc}
                    onClick={() => handleLocaleChange(loc)}
                    title={loc}
                    className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs transition-colors ${
                      locale === loc
                        ? 'bg-indigo-100 text-indigo-700 font-medium'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    <span>{meta.flag}</span>
                    <span>{meta.code}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* User info + sign out */}
        <div className="pt-2 px-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
              {user?.name ? user.name[0]?.toUpperCase() ?? 'U' : 'U'}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700 truncate">{user?.name ?? ''}</p>
                <p className="text-xs text-gray-400 truncate">{user?.email ?? ''}</p>
              </div>
            )}
          </div>
          <button
            onClick={handleSignOut}
            disabled={logoutMutation.isPending}
            className={`mt-2 w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50 ${collapsed ? 'justify-center' : ''}`}
            title={t('auth.sign_out')}
          >
            <span>↩</span>
            {!collapsed && <span>{t('auth.sign_out')}</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
