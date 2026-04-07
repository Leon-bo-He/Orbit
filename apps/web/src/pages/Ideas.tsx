import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useIdeas, type IdeaFilters } from '../api/ideas.js';
import { useWorkspaces } from '../api/workspaces.js';
import { ApiError } from '../api/client.js';
import { IdeaCard } from '../components/ideas/IdeaCard.js';
import { IdeaFiltersBar } from '../components/ideas/IdeaFilters.js';
import { IdeaCaptureModal } from '../components/ideas/IdeaCaptureModal.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import type { Workspace } from '@contentflow/shared';

export default function Ideas() {
  const { t } = useTranslation('ideas');
  const [filters, setFilters] = useState<IdeaFilters>({});
  const [modalOpen, setModalOpen] = useState(false);

  const { data: ideas, isLoading, error } = useIdeas(filters);
  const { data: workspaces } = useWorkspaces();

  // Build a workspace lookup map
  const wsMap = new Map<string, Workspace>(
    workspaces?.map((ws) => [ws.id, ws]) ?? []
  );

  // Keyboard shortcut: Cmd/Ctrl + Shift + I
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        setModalOpen(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle 401 gracefully
  if (error instanceof ApiError && error.status === 401) {
    return (
      <div className="p-6">
        <p className="text-gray-500">{t('login_required')}</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[22px] font-semibold text-gray-900 tracking-tight">{t('title')}</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="hidden md:inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 transition-colors"
        >
          <span className="text-base leading-none">+</span>
          {t('quick_capture')}
        </button>
      </div>

      {/* Filters */}
      <div className="mb-5">
        <IdeaFiltersBar filters={filters} onChange={setFilters} />
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
              <Skeleton variant="text" className="w-2/3" />
              <Skeleton variant="text" className="w-full" />
              <Skeleton variant="text" className="w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && !(error instanceof ApiError && error.status === 401) && (
        <div className="text-center py-12">
          <p className="text-red-500 text-sm">{error.message}</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && ideas?.length === 0 && (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">💡</div>
          <h3 className="text-gray-700 font-medium mb-1">{t('empty.heading')}</h3>
          <p className="text-gray-400 text-sm">{t('empty.body')}</p>
        </div>
      )}

      {/* Ideas grid */}
      {!isLoading && ideas && ideas.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ideas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              workspaceName={
                idea.workspaceId ? wsMap.get(idea.workspaceId)?.name : undefined
              }
            />
          ))}
        </div>
      )}

      {/* Mobile FAB */}
      <button
        onClick={() => setModalOpen(true)}
        className="md:hidden fixed bottom-20 right-4 z-50 w-12 h-12 rounded-full bg-indigo-600 text-white shadow-md flex items-center justify-center text-xl hover:bg-indigo-700 transition-colors"
        aria-label={t('quick_capture')}
      >
        +
      </button>

      {/* Quick Capture Modal */}
      <IdeaCaptureModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
