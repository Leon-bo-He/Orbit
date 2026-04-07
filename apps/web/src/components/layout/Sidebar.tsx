import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WorkspaceSwitcher } from './WorkspaceSwitcher.js';
import { useUiStore } from '../../store/ui.store.js';
import { useWorkspaces } from '../../api/workspaces.js';
import { useAuthStore } from '../../store/auth.store.js';
import { useLogout } from '../../api/auth.js';
import { toast } from '../../store/toast.store.js';
import i18n, { SUPPORTED_LOCALES, type SupportedLocale } from '../../i18n/index.js';

const LOCALE_META: Record<SupportedLocale, { flag: string; label: string }> = {
  'zh-CN': { flag: '🇨🇳', label: '简体中文' },
  'zh-TW': { flag: '🇹🇼', label: '繁體中文' },
  'en-US': { flag: '🇺🇸', label: 'English' },
  'ja-JP': { flag: '🇯🇵', label: '日本語' },
  'ko-KR': { flag: '🇰🇷', label: '한국어' },
};

const topNavItems = [
  { path: '/', label: 'nav.dashboard', icon: '◻' },
  { path: '/ideas', label: 'nav.ideas', icon: '💡' },
  { path: '/publications', label: 'nav.publications', icon: '📤' },
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

  // Account popout state
  const [popoutOpen, setPopoutOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const popoutRef = useRef<HTMLDivElement>(null);

  // Close popout on outside click
  useEffect(() => {
    if (!popoutOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (popoutRef.current && !popoutRef.current.contains(e.target as Node)) {
        setPopoutOpen(false);
        setLangOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [popoutOpen]);

  function handleLocaleChange(newLocale: SupportedLocale) {
    setLocale(newLocale);
    void i18n.changeLanguage(newLocale);
    setLangOpen(false);
    setPopoutOpen(false);
  }

  function handleWorkspaceSelect(id: string) {
    setActiveWorkspace(id);
    void navigate(`/workspaces/${id}/board`);
  }

  function handleSignOut() {
    setPopoutOpen(false);
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        clearAuth();
        toast.success(t('auth.sign_out'));
        void navigate('/login', { replace: true });
      },
      onError: () => {
        clearAuth();
        void navigate('/login', { replace: true });
      },
    });
  }

  function handleSettings() {
    setPopoutOpen(false);
    void navigate('/settings');
  }

  const userInitial = user?.name ? (user.name[0]?.toUpperCase() ?? 'U') : 'U';

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

                  {isActive && (
                    <div className="ml-6 mt-0.5 space-y-0.5">
                      {[
                        { to: `/workspaces/${ws.id}/board`, icon: '📋', label: 'nav.board' },
                        { to: `/workspaces/${ws.id}/calendar`, icon: '📅', label: 'nav.calendar' },
                        { to: `/workspaces/${ws.id}/analytics`, icon: '📊', label: 'nav.analytics' },
                      ].map((sub) => (
                        <NavLink
                          key={sub.to}
                          to={sub.to}
                          className={({ isActive: a }) =>
                            `flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors ${
                              a ? 'text-indigo-600 font-medium' : 'text-gray-500 hover:text-gray-700'
                            }`
                          }
                        >
                          <span>{sub.icon}</span>
                          <span>{t(sub.label)}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Collapsed workspace dots */}
        {collapsed && workspaces.map((ws) => (
          <button
            key={ws.id}
            onClick={() => handleWorkspaceSelect(ws.id)}
            title={ws.name}
            className={`w-full flex items-center justify-center py-2 rounded-md transition-colors ${
              ws.id === activeWorkspaceId ? 'bg-indigo-50' : 'hover:bg-gray-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ws.color }} />
          </button>
        ))}
      </nav>

      {/* Account area — triggers popout */}
      <div className="border-t border-gray-200 p-2 relative" ref={popoutRef}>
        <button
          onClick={() => { setPopoutOpen((o) => !o); setLangOpen(false); }}
          className={`w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-gray-100 transition-colors text-left ${
            popoutOpen ? 'bg-gray-100' : ''
          }`}
        >
          <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
            {userInitial}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-700 truncate">{user?.name ?? ''}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email ?? ''}</p>
            </div>
          )}
          {!collapsed && (
            <span className="text-gray-400 text-xs ml-auto">{popoutOpen ? '▾' : '▴'}</span>
          )}
        </button>

        {/* Popout menu */}
        {popoutOpen && (
          <div className="absolute bottom-full left-2 right-2 mb-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
            {/* Settings */}
            <button
              onClick={handleSettings}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <span>⚙️</span>
              <span>{t('nav.settings')}</span>
            </button>

            {/* Language */}
            <div>
              <button
                onClick={() => setLangOpen((o) => !o)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span>🌐</span>
                <span>{t('action.language') || 'Language'}</span>
                <span className="ml-auto text-gray-400 text-xs">{langOpen ? '▾' : '▸'}</span>
              </button>

              {langOpen && (
                <div className="px-3 pb-1">
                  {SUPPORTED_LOCALES.map((loc) => {
                    const meta = LOCALE_META[loc];
                    return (
                      <button
                        key={loc}
                        onClick={() => handleLocaleChange(loc)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                          locale === loc
                            ? 'bg-indigo-50 text-indigo-700 font-medium'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span>{meta.flag}</span>
                        <span>{meta.label}</span>
                        {locale === loc && <span className="ml-auto text-indigo-500 text-xs">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 mt-1 pt-1">
              <button
                onClick={handleSignOut}
                disabled={logoutMutation.isPending}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <span>↩</span>
                <span>{t('auth.sign_out')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
