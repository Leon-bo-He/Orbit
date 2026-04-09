import { createBrowserRouter } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AppShell } from '../components/layout/AppShell.js';
import { ErrorBoundary } from '../components/ui/ErrorBoundary.js';
import { RequireAuth } from '../components/auth/RequireAuth.js';

// App pages are imported eagerly so navigations are always instant.
// Public auth pages (login / register) stay lazy — they are never needed
// once the user is inside the app.
import DashboardPage      from '../pages/Dashboard.js';
import IdeasPage          from '../pages/Ideas.js';
import WorkspaceBoardPage from '../pages/WorkspaceBoard.js';
import CalendarPage       from '../pages/Calendar.js';
import PublicationsPage   from '../pages/Publications.js';
import AnalyticsPage      from '../pages/Analytics.js';
import ContentBriefPage   from '../pages/ContentBrief.js';
import WorkspaceArchivePage from '../pages/WorkspaceArchive.js';
import NotFoundPage       from '../pages/NotFound.js';

const LoginPage    = lazy(() => import('../pages/auth/LoginPage.js'));
const RegisterPage = lazy(() => import('../pages/auth/RegisterPage.js'));

function wrap(C: React.ComponentType) {
  return (
    <ErrorBoundary>
      <Suspense fallback={null}>
        <C />
      </Suspense>
    </ErrorBoundary>
  );
}

function page(C: React.ComponentType) {
  return <ErrorBoundary><C /></ErrorBoundary>;
}

export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter([
  // Public auth routes
  {
    path: '/login',
    element: wrap(LoginPage),
  },
  {
    path: '/register',
    element: wrap(RegisterPage),
  },
  // Protected app routes
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/',
        element: <AppShell />,
        children: [
          { index: true,                                                    element: page(DashboardPage) },
          { path: 'ideas',                                                  element: page(IdeasPage) },
          { path: 'workspaces/:workspaceId/board',                         element: page(WorkspaceBoardPage) },
          { path: 'workspaces/:workspaceId/calendar',                      element: page(CalendarPage) },
          { path: 'workspaces/:workspaceId/analytics',                     element: page(AnalyticsPage) },
          { path: 'workspaces/:workspaceId/contents/:contentId/brief',     element: page(ContentBriefPage) },
          { path: 'workspaces/:workspaceId/archive',                       element: page(WorkspaceArchivePage) },
          { path: 'publications',                                           element: page(PublicationsPage) },
          { path: '*',                                                      element: page(NotFoundPage) },
        ],
      },
    ],
  },
]);
