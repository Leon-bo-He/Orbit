import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '../../store/ui.store.js';
import { useWorkspaces } from '../../api/workspaces.js';
import { useAuthStore } from '../../store/auth.store.js';
import { useLogout } from '../../api/auth.js';
import { toast } from '../../store/toast.store.js';
import OrbitLogo from '../ui/OrbitLogo.js';
import { WorkspaceIconContent } from '../ui/WorkspaceIcon.js';

const topNavItems = [
  { path: '/',            label: 'nav.dashboard',   icon: '⊞' },
  { path: '/ideas',       label: 'nav.ideas',        icon: '○' },
  { path: '/publications',label: 'nav.publications', icon: '↑' },
] as const;

const NAV_ITEM =
  'w-full flex items-center gap-2 px-2 py-[5px] rounded-[4px] text-[13.5px] text-[var(--cf-text-sub)] hover:bg-[var(--cf-hover)] transition-colors text-left';
const NAV_ITEM_ACTIVE =
  'bg-[var(--cf-active)] text-[var(--cf-text)] font-medium';

export function Sidebar() {
  const { t } = useTranslation('common');
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const activeWorkspaceId = useUiStore((s) => s.activeWorkspaceId);
  const setActiveWorkspace = useUiStore((s) => s.setActiveWorkspace);
  const navigate = useNavigate();

  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const logoutMutation = useLogout();

  const { data: workspaces = [] } = useWorkspaces();

  const openSettings = useUiStore((s) => s.openSettings);
  const [popoutOpen, setPopoutOpen] = useState(false);
  const popoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!popoutOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (popoutRef.current && !popoutRef.current.contains(e.target as Node)) {
        setPopoutOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [popoutOpen]);

  function handleWorkspaceSelect(id: string) {
    if (id === activeWorkspaceId) {
      setActiveWorkspace(null);
    } else {
      setActiveWorkspace(id);
      void navigate(`/workspaces/${id}/board`);
    }
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
    openSettings('account');
  }

  const userInitial = user?.username ? (user.username[0]?.toUpperCase() ?? 'U') : 'U';

  if (collapsed) {
    return (
      <div className="h-full w-12 flex flex-col bg-[var(--cf-surface)] border-r border-[var(--cf-border)] items-center py-3 gap-1">
        <button
          onClick={toggle}
          className="w-8 h-8 flex items-center justify-center rounded-[4px] text-[var(--cf-text-muted)] hover:bg-[var(--cf-hover)] transition-colors text-sm"
          aria-label={t('aria.expand_sidebar')}
        >
          →
        </button>
        {topNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `w-8 h-8 flex items-center justify-center rounded-[4px] text-base transition-colors ${
                isActive
                  ? 'bg-[var(--cf-active)] text-[var(--cf-text)]'
                  : 'text-[var(--cf-text-muted)] hover:bg-[var(--cf-hover)]'
              }`
            }
          >
            {item.icon}
          </NavLink>
        ))}
        {workspaces.length > 0 && (
          <>
            <div className="w-5 border-t border-[var(--cf-border)] my-1" />
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => handleWorkspaceSelect(ws.id)}
                title={ws.name}
                className={`w-7 h-7 rounded-md text-base transition-colors flex items-center justify-center overflow-hidden ${
                  ws.id === activeWorkspaceId
                    ? 'bg-[var(--cf-active)]'
                    : 'hover:bg-[var(--cf-hover)]'
                }`}
              >
                <WorkspaceIconContent icon={ws.icon} />
              </button>
            ))}
          </>
        )}
        <div className="flex-1" />
        <button
          onClick={() => setPopoutOpen((o) => !o)}
          className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-semibold mt-1"
        >
          {userInitial}
        </button>
      </div>
    );
  }

  return (
    <div
      className="h-full w-56 flex flex-col bg-[var(--cf-surface)] border-r border-[var(--cf-border)]"
      style={{ minWidth: '14rem' }}
    >
      {/* Header: app name + collapse */}
      <div className="flex items-center justify-between px-3 h-[44px] flex-shrink-0">
        <OrbitLogo variant="icon" className="h-7 w-7" />
        <button
          onClick={toggle}
          className="w-6 h-6 flex items-center justify-center rounded-[4px] text-[var(--cf-text-muted)] hover:bg-[var(--cf-hover)] transition-colors text-sm"
          aria-label={t('aria.collapse_sidebar')}
        >
          ←
        </button>
      </div>

      {/* Scrollable nav body */}
      <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-[1px]">
        {/* Top nav */}
        {topNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `${NAV_ITEM} ${isActive ? NAV_ITEM_ACTIVE : ''}`
            }
          >
            <span className="w-4 text-center text-xs opacity-60">{item.icon}</span>
            <span>{t(item.label)}</span>
          </NavLink>
        ))}

        {/* Workspaces section */}
        {workspaces.length > 0 && (
          <div className="pt-3 pb-1">
            <p className="px-2 pb-1 text-[11px] font-medium text-[var(--cf-text-muted)] uppercase tracking-wider">
              {t('nav.workspaces')}
            </p>
            {workspaces.map((ws) => {
              const isActive = ws.id === activeWorkspaceId;
              return (
                <div key={ws.id}>
                  <button
                    onClick={() => handleWorkspaceSelect(ws.id)}
                    className={`${NAV_ITEM} ${isActive ? NAV_ITEM_ACTIVE : ''}`}
                  >
                    <span className="w-4 h-4 flex items-center justify-center text-sm leading-none overflow-hidden rounded-sm flex-shrink-0"><WorkspaceIconContent icon={ws.icon} /></span>
                    <span className="truncate">{ws.name}</span>
                    <span
                      className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: ws.color }}
                    />
                  </button>

                  {isActive && (
                    <div className="ml-4 mt-[1px] space-y-[1px]">
                      {[
                        { to: `/workspaces/${ws.id}/board`,     label: 'nav.board' },
                        { to: `/workspaces/${ws.id}/calendar`,  label: 'nav.calendar' },
                        { to: `/workspaces/${ws.id}/analytics`, label: 'nav.analytics' },
                        { to: `/workspaces/${ws.id}/archive`,   label: 'nav.archive' },
                      ].map((sub) => (
                        <NavLink
                          key={sub.to}
                          to={sub.to}
                          className={({ isActive: a }) =>
                            `${NAV_ITEM} text-[12.5px] ${a ? NAV_ITEM_ACTIVE : ''}`
                          }
                        >
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
      </nav>

      {/* Account area */}
      <div
        className="border-t border-[var(--cf-border)] px-2 py-2 relative flex-shrink-0"
        ref={popoutRef}
      >
        <button
          onClick={() => setPopoutOpen((o) => !o)}
          className={`w-full flex items-center gap-2 px-2 py-[6px] rounded-[4px] hover:bg-[var(--cf-hover)] transition-colors text-left ${
            popoutOpen ? 'bg-[var(--cf-hover)]' : ''
          }`}
        >
          <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[11px] font-semibold flex-shrink-0">
            {userInitial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-[var(--cf-text)] truncate leading-tight">
              {user?.username ?? ''}
            </p>
          </div>
        </button>

        {/* Popout */}
        {popoutOpen && (
          <div
            className="absolute bottom-full left-2 right-2 mb-1 z-50 overflow-hidden"
            style={{
              background: 'var(--cf-bg)',
              border: '1px solid var(--cf-border)',
              borderRadius: '8px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            }}
          >
            <div className="py-1">
              <div className="px-3 py-2 border-b border-[var(--cf-border)] mb-1">
                <p className="text-[12px] font-medium text-[var(--cf-text)] truncate">{user?.username}</p>
                <p className="text-[11px] text-[var(--cf-text-muted)] truncate">{user?.email}</p>
              </div>
              <button
                onClick={handleSettings}
                className="w-full flex items-center gap-2 px-3 py-[6px] text-[13px] text-[var(--cf-text-sub)] hover:bg-[var(--cf-hover)] transition-colors"
              >
                {t('nav.settings')}
              </button>
              <div className="border-t border-[var(--cf-border)] mt-1 pt-1">
                <button
                  onClick={handleSignOut}
                  disabled={logoutMutation.isPending}
                  className="w-full flex items-center gap-2 px-3 py-[6px] text-[13px] text-red-500 hover:bg-[var(--cf-hover)] transition-colors disabled:opacity-50"
                >
                  {t('auth.sign_out')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
