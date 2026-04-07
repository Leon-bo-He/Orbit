import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '../../store/ui.store.js';

export function MobileBottomNav() {
  const { t } = useTranslation('common');
  const activeWorkspaceId = useUiStore((s) => s.activeWorkspaceId);

  const boardPath = activeWorkspaceId
    ? `/workspaces/${activeWorkspaceId}/board`
    : '/settings';

  return (
    <div className="flex justify-around items-center h-16 bg-surface-raised">
      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          `flex flex-col items-center gap-0.5 text-xs px-3 py-1 ${
            isActive ? 'text-indigo-600' : 'text-gray-500'
          }`
        }
      >
        <span className="text-xl">◻</span>
        <span>{t('nav.dashboard')}</span>
      </NavLink>

      <NavLink
        to="/ideas"
        className={({ isActive }) =>
          `flex flex-col items-center gap-0.5 text-xs px-3 py-1 ${
            isActive ? 'text-indigo-600' : 'text-gray-500'
          }`
        }
      >
        <span className="text-xl">💡</span>
        <span>{t('nav.ideas')}</span>
      </NavLink>

      <NavLink
        to={boardPath}
        className={({ isActive }) =>
          `flex flex-col items-center gap-0.5 text-xs px-3 py-1 ${
            isActive ? 'text-indigo-600' : 'text-gray-500'
          }`
        }
      >
        <span className="text-xl">📋</span>
        <span>{t('nav.board')}</span>
      </NavLink>

      <NavLink
        to="/publications"
        className={({ isActive }) =>
          `flex flex-col items-center gap-0.5 text-xs px-3 py-1 ${
            isActive ? 'text-indigo-600' : 'text-gray-500'
          }`
        }
      >
        <span className="text-xl">📤</span>
        <span>{t('nav.publications')}</span>
      </NavLink>

      <NavLink
        to="/settings"
        className={({ isActive }) =>
          `flex flex-col items-center gap-0.5 text-xs px-3 py-1 ${
            isActive ? 'text-indigo-600' : 'text-gray-500'
          }`
        }
      >
        <span className="text-xl">⚙</span>
        <span>{t('nav.settings')}</span>
      </NavLink>
    </div>
  );
}
