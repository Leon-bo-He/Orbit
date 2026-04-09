import { Outlet, useMatch } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sidebar } from './Sidebar.js';
import { MobileBottomNav } from './MobileBottomNav.js';
import { ToastContainer } from '../ui/Toast.js';
import { NotificationPermissionBanner } from '../ui/NotificationPermissionBanner.js';
import { useOfflineSync } from '../../hooks/useOfflineSync.js';
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js';
import { useUiStore } from '../../store/ui.store.js';
import { SettingsModal } from '../../pages/Settings.js';
import { useWorkspaces } from '../../api/workspaces.js';
import { OnboardingFlow } from '../onboarding/OnboardingFlow.js';

function OfflineBanner() {
  const { t } = useTranslation('common');
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-700 text-center">
      {t('offline.banner')}
    </div>
  );
}

export function AppShell() {
  const { isOnline } = useOnlineStatus();
  const settingsSection = useUiStore((s) => s.settingsSection);
  const closeSettings = useUiStore((s) => s.closeSettings);
  const onWorkspacePage = useMatch('/workspaces/:workspaceId/*');
  useOfflineSync();

  const { data: workspaces, isLoading: wsLoading } = useWorkspaces();
  if (!wsLoading && workspaces?.length === 0) {
    return <OnboardingFlow />;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--cf-bg)' }}>
      {!isOnline && <OfflineBanner />}
      <NotificationPermissionBanner />

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden md:flex flex-col flex-shrink-0">
          <Sidebar />
        </aside>

        <main className={`flex-1 overflow-auto md:pb-0 ${onWorkspacePage ? 'pb-24' : 'pb-16'}`}>
          <Outlet />
        </main>
      </div>

      <div className="fixed bottom-0 inset-x-0 md:hidden">
        <MobileBottomNav />
      </div>

      <ToastContainer />

      {settingsSection !== null && (
        <SettingsModal initialSection={settingsSection} onClose={closeSettings} />
      )}

    </div>
  );
}
