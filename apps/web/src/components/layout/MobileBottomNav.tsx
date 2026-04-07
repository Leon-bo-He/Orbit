import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '../../store/ui.store.js';

const TAB_CLASS = (isActive: boolean) =>
  `flex flex-col items-center gap-0.5 text-[10px] px-4 py-2 transition-colors ${
    isActive ? 'text-indigo-600' : 'text-gray-400'
  }`;

export function MobileBottomNav() {
  const { t } = useTranslation('common');
  const activeWorkspaceId = useUiStore((s) => s.activeWorkspaceId);
  const boardPath = activeWorkspaceId ? `/workspaces/${activeWorkspaceId}/board` : '/settings';

  return (
    <div
      className="flex justify-around items-center h-14"
      style={{ background: 'var(--cf-bg)', borderTop: '1px solid var(--cf-border)' }}
    >
      <NavLink to="/" end className={({ isActive }) => TAB_CLASS(isActive)}>
        <span className="text-lg">⊞</span>
        <span>{t('nav.dashboard')}</span>
      </NavLink>
      <NavLink to="/ideas" className={({ isActive }) => TAB_CLASS(isActive)}>
        <span className="text-lg">○</span>
        <span>{t('nav.ideas')}</span>
      </NavLink>
      <NavLink to={boardPath} className={({ isActive }) => TAB_CLASS(isActive)}>
        <span className="text-lg">▦</span>
        <span>{t('nav.board')}</span>
      </NavLink>
      <NavLink to="/publications" className={({ isActive }) => TAB_CLASS(isActive)}>
        <span className="text-lg">↑</span>
        <span>{t('nav.publications')}</span>
      </NavLink>
      <NavLink to="/settings" className={({ isActive }) => TAB_CLASS(isActive)}>
        <span className="text-lg">⊙</span>
        <span>{t('nav.settings')}</span>
      </NavLink>
    </div>
  );
}
