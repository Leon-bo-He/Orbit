import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.js';
import { MobileBottomNav } from './MobileBottomNav.js';
import { ToastContainer } from '../ui/Toast.js';
import { NotificationPermissionBanner } from '../ui/NotificationPermissionBanner.js';
import { useOfflineSync } from '../../hooks/useOfflineSync.js';
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js';

function OfflineBanner() {
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-700 text-center">
      You're offline — changes will sync when reconnected
    </div>
  );
}

export function AppShell() {
  const { isOnline } = useOnlineStatus();
  useOfflineSync();

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--cf-bg)' }}>
      {!isOnline && <OfflineBanner />}
      <NotificationPermissionBanner />

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden md:flex flex-col flex-shrink-0">
          <Sidebar />
        </aside>

        <main className="flex-1 overflow-auto pb-16 md:pb-0">
          <Outlet />
        </main>
      </div>

      <div className="fixed bottom-0 inset-x-0 md:hidden border-t border-[var(--cf-border)]">
        <MobileBottomNav />
      </div>

      <ToastContainer />
    </div>
  );
}
