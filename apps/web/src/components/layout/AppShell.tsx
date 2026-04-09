import { Outlet, useMatch } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
import { FullPageSpinner } from '../ui/FullPageSpinner.js';
import { apiFetch } from '../../api/client.js';

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
  const queryClient = useQueryClient();
  useOfflineSync();

  const { data: workspaces, isLoading: wsLoading } = useWorkspaces();

  // Fire prefetch requests immediately on mount — they run in parallel with the
  // workspaces query (and behind the FullPageSpinner). By the time the user
  // navigates to any sidebar page for the first time, data is already cached.
  useEffect(() => {
    void queryClient.prefetchQuery({
      queryKey: ['dashboard'],
      queryFn: () => apiFetch('/api/dashboard'),
    });
    void queryClient.prefetchQuery({
      queryKey: ['ideas', { status: 'active' }],
      queryFn: () => apiFetch('/api/ideas?status=active'),
    });
    // Publications page defaults: queued+ready status, today → today+14 days
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const today = new Date();
    const end = new Date(today); end.setDate(end.getDate() + 14);
    const pubFilters = { status: 'queued,ready', from: fmt(today), to: fmt(end) };
    const pubQs = new URLSearchParams(pubFilters).toString();
    void queryClient.prefetchQuery({
      queryKey: ['publishQueue', pubFilters],
      queryFn: () => apiFetch(`/api/publications/queue?${pubQs}`),
    });
  }, [queryClient]);

  // Once workspace IDs are known, warm up the board data for the first few workspaces.
  useEffect(() => {
    if (!workspaces?.length) return;
    for (const ws of workspaces.slice(0, 3)) {
      void queryClient.prefetchQuery({
        queryKey: ['contents', ws.id, undefined],
        queryFn: () => apiFetch(`/api/contents?workspace=${ws.id}`),
      });
    }
  }, [workspaces, queryClient]);

  if (wsLoading) return <FullPageSpinner />;
  if (workspaces?.length === 0) {
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
