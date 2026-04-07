import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from './api/query-client.js';
import { router } from './router/index.js';
import { FullPageSpinner } from './components/ui/FullPageSpinner.js';
import { AuthProvider } from './components/auth/AuthProvider.js';
import './i18n/index.js';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root element not found');

createRoot(root).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<FullPageSpinner />}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </Suspense>
    </QueryClientProvider>
  </React.StrictMode>
);
