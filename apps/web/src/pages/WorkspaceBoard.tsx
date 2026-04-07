import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { STAGE_ORDER } from '@contentflow/shared';
import type { Content, Stage } from '@contentflow/shared';
import { useWorkspaces } from '../api/workspaces.js';
import { useContents, useUpdateContent } from '../api/contents.js';
import { KanbanColumn } from '../components/kanban/KanbanColumn.js';
import { ContentDrawer } from '../components/kanban/ContentDrawer.js';
import { CreateContentModal } from '../components/kanban/CreateContentModal.js';

export default function WorkspaceBoard() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { t } = useTranslation('contents');

  const { data: workspaces } = useWorkspaces();
  const workspace = workspaces?.find((w) => w.id === workspaceId);

  const { data: contents = [], isLoading } = useContents(workspaceId ?? '');
  const updateContent = useUpdateContent();

  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  function handleDrop(contentId: string, newStage: Stage) {
    const content = contents.find((c) => c.id === contentId);
    if (!content || content.stage === newStage) return;

    updateContent.mutate({
      id: contentId,
      workspaceId: workspaceId ?? '',
      data: { stage: newStage },
    });
  }

  function handleCardClick(content: Content) {
    setSelectedContent(content);
  }

  // When contents update, refresh selectedContent from the list
  const liveSelectedContent = selectedContent
    ? (contents.find((c) => c.id === selectedContent.id) ?? selectedContent)
    : null;

  const accentColor = workspace?.color ?? '#6366f1';

  if (!workspaceId) {
    return <div className="p-6 text-gray-500">Workspace not found.</div>;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          {workspace && (
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: accentColor }}
            />
          )}
          <h1 className="text-xl font-semibold text-gray-900">
            {workspace ? `${workspace.icon} ${workspace.name}` : t('title')}
          </h1>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <span>+</span>
          <span>{t('create')}</span>
        </button>
      </div>

      {/* Kanban board */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-gray-400">Loading…</div>
      ) : (
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-4 p-6 h-full min-w-max">
            {STAGE_ORDER.map((stage) => {
              const stageContents = contents.filter((c) => c.stage === stage);
              return (
                <KanbanColumn
                  key={stage}
                  stage={stage}
                  contents={stageContents}
                  onCardClick={handleCardClick}
                  onDrop={handleDrop}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Content detail drawer */}
      {liveSelectedContent && (
        <ContentDrawer
          content={liveSelectedContent}
          workspaceId={workspaceId}
          onClose={() => setSelectedContent(null)}
        />
      )}

      {/* Create content modal */}
      {showCreateModal && (
        <CreateContentModal
          workspaceId={workspaceId}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}
