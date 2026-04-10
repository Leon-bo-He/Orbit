import { useState, useEffect, useRef } from 'react';
import { NavLink, useMatch, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '../../store/ui.store.js';
import { useWorkspaces } from '../../api/workspaces.js';
import { WorkspaceIconContent } from '../ui/WorkspaceIcon.js';

const TAB_CLASS = (isActive: boolean) =>
  `flex flex-col items-center gap-0.5 text-[10px] px-3 py-2 transition-colors flex-1 ${
    isActive ? 'text-indigo-600' : 'text-[var(--cf-text-muted)]'
  }`;

const SUB_TAB_CLASS = (isActive: boolean) =>
  `flex items-center justify-center gap-1 flex-1 h-full text-[10px] transition-colors ${
    isActive ? 'text-indigo-600' : 'text-[var(--cf-text-muted)]'
  }`;

export function MobileBottomNav() {
  const { t } = useTranslation('common');
  const activeWorkspaceId = useUiStore((s) => s.activeWorkspaceId);
  const setActiveWorkspace = useUiStore((s) => s.setActiveWorkspace);
  const openSettings = useUiStore((s) => s.openSettings);
  const navigate = useNavigate();
  const { data: workspaces = [] } = useWorkspaces();
  const [wsPickerOpen, setWsPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const onWorkspace = useMatch('/workspaces/:workspaceId/*');
  const wsId = onWorkspace?.params.workspaceId ?? activeWorkspaceId;
  const currentWs = workspaces.find((w) => w.id === wsId);
  const boardPath = activeWorkspaceId ? `/workspaces/${activeWorkspaceId}/board` : '/';

  useEffect(() => {
    if (!wsPickerOpen) return;
    function onDown(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setWsPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [wsPickerOpen]);

  function handleWorkspaceSwitch(id: string) {
    setActiveWorkspace(id);
    void navigate(`/workspaces/${id}/board`);
    setWsPickerOpen(false);
  }

  return (
    <div style={{ background: 'var(--cf-bg)' }}>
      {/* Workspace context bar — only when inside a workspace route */}
      {onWorkspace && wsId && (
        <div ref={pickerRef} className="relative border-t border-[var(--cf-border)]">
          {/* Workspace picker */}
          {wsPickerOpen && workspaces.length > 0 && (
            <div
              className="absolute bottom-full left-0 right-0 border-t border-[var(--cf-border)]"
              style={{
                background: 'var(--cf-bg)',
                boxShadow: '0 -4px 16px rgba(0,0,0,0.08)',
                maxHeight: '200px',
                overflowY: 'auto',
              }}
            >
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => handleWorkspaceSwitch(ws.id)}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors ${
                    ws.id === wsId
                      ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'text-[var(--cf-text-sub)] hover:bg-[var(--cf-hover)]'
                  }`}
                >
                  <span className="w-4 h-4 flex items-center justify-center overflow-hidden rounded-sm flex-shrink-0"><WorkspaceIconContent icon={ws.icon} /></span>
                  <span className="flex-1 truncate">{ws.name}</span>
                  {ws.id === wsId && <span className="text-indigo-400 text-[10px]">✓</span>}
                </button>
              ))}
            </div>
          )}

          {/* Context bar: workspace switcher + sub-area tabs */}
          <div className="flex items-center h-9">
            <button
              onClick={() => setWsPickerOpen((o) => !o)}
              className="flex items-center gap-1 pl-3 pr-2 h-full text-xs font-medium border-r border-[var(--cf-border)] flex-shrink-0 max-w-[40%] text-[var(--cf-text)]"
            >
              <span className="w-4 h-4 flex items-center justify-center text-sm leading-none overflow-hidden rounded-sm flex-shrink-0">{currentWs ? <WorkspaceIconContent icon={currentWs.icon} /> : null}</span>
              <span className="truncate">{currentWs?.name}</span>
              <span className="text-[var(--cf-text-muted)] text-[10px] flex-shrink-0 ml-0.5">
                {wsPickerOpen ? '▴' : '▾'}
              </span>
            </button>

            <div className="flex flex-1 h-full">
              {([
                { to: `/workspaces/${wsId}/board`,     icon: '▦', label: 'nav.board' },
                { to: `/workspaces/${wsId}/calendar`,  icon: '📅', label: 'nav.calendar' },
                { to: `/workspaces/${wsId}/analytics`, icon: '📊', label: 'nav.analytics' },
                { to: `/workspaces/${wsId}/archive`,   icon: '🗄', label: 'nav.archive' },
              ] as const).map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => SUB_TAB_CLASS(isActive)}
                >
                  <span className="text-sm leading-none">{item.icon}</span>
                  <span>{t(item.label)}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main nav — always visible */}
      <div className="flex justify-around items-center h-14 border-t border-[var(--cf-border)]">
        <NavLink to="/" end className={({ isActive }) => TAB_CLASS(isActive)}>
          <span className="text-base">⊞</span>
          <span>{t('nav.dashboard')}</span>
        </NavLink>
        <NavLink to="/ideas" className={({ isActive }) => TAB_CLASS(isActive)}>
          <span className="text-base">○</span>
          <span>{t('nav.ideas')}</span>
        </NavLink>
        <NavLink to="/publications" className={({ isActive }) => TAB_CLASS(isActive)}>
          <span className="text-base">↑</span>
          <span>{t('nav.publications')}</span>
        </NavLink>
        <NavLink to={boardPath} className={({ isActive }) => TAB_CLASS(isActive)}>
          <span className="text-base">▦</span>
          <span>{t('nav.board')}</span>
        </NavLink>
        <button onClick={() => openSettings()} className={TAB_CLASS(false)}>
          <span className="text-base">⊙</span>
          <span>{t('nav.settings')}</span>
        </button>
      </div>
    </div>
  );
}
