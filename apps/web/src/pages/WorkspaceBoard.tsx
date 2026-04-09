import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { STAGE_ORDER } from '@contentflow/shared';
import type { Content, Stage } from '@contentflow/shared';
import { useWorkspaces } from '../api/workspaces.js';
import { useContents, useUpdateContent } from '../api/contents.js';
import { KanbanColumn } from '../components/kanban/KanbanColumn.js';
import { ContentDrawer } from '../components/kanban/ContentDrawer.js';
import { CreateContentModal } from '../components/kanban/CreateContentModal.js';
import { Skeleton } from '../components/ui/Skeleton.js';

// Module-level set survives StrictMode double-invocation; prevents duplicate auto-archive mutations
const _autoArchivingIds = new Set<string>();

export default function WorkspaceBoard() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { t } = useTranslation('contents');

  const { data: workspaces } = useWorkspaces();
  const workspace = workspaces?.find((w) => w.id === workspaceId);

  const { data: contents = [], isLoading } = useContents(workspaceId ?? '');
  const updateContent = useUpdateContent();

  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Auto-archive: reviewed content whose last "reviewed" history entry is older than 7 days → archived
  useEffect(() => {
    if (!contents.length) return;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const toArchive = contents.filter((c) => {
      if (c.stage !== 'reviewed') return false;
      if (_autoArchivingIds.has(c.id)) return false;
      const reviewedEntries = (c.stageHistory ?? []).filter((e) => e.stage === 'reviewed');
      if (!reviewedEntries.length) return false;
      const lastReviewedAt = Math.max(...reviewedEntries.map((e) => new Date(e.timestamp).getTime()));
      return lastReviewedAt < sevenDaysAgo;
    });
    toArchive.forEach((c) => {
      _autoArchivingIds.add(c.id);
      updateContent.mutate(
        { id: c.id, workspaceId: workspaceId ?? '', data: { stage: 'archived' }, silent: true },
        { onSettled: (_d, err) => { if (err) _autoArchivingIds.delete(c.id); } },
      );
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contents]);

  // Board pan-scroll
  const boardRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ active: boolean; startX: number; scrollLeft: number }>({
    active: false, startX: 0, scrollLeft: 0,
  });

  // Convert vertical wheel delta → horizontal scroll (non-passive so preventDefault works).
  // Depend on `isLoading` so the listener is registered once the board div is in the DOM;
  // on a cold-cache page load the first render has isLoading=true and boardRef is null.
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // already horizontal scroll
      // If the cursor is over a vertically scrollable column that can still scroll
      // in the wheel direction, let the column handle it naturally.
      let node = e.target as HTMLElement | null;
      while (node && node !== el) {
        const style = getComputedStyle(node);
        const overflowY = style.overflowY;
        if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
          const atTop    = node.scrollTop <= 0;
          const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
          if (e.deltaY < 0 && !atTop)    return; // scrolling up,   column not yet at top
          if (e.deltaY > 0 && !atBottom) return; // scrolling down, column not yet at bottom
          // column is at its boundary — fall through and scroll board horizontally
        }
        node = node.parentElement;
      }
      e.preventDefault();
      el!.scrollLeft += e.deltaY;
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [isLoading]);

  function onBoardDragStart() {
    // When a card drag begins the browser suppresses the subsequent mouseup, so any
    // active pan would get stuck.  Reset pan state here so scroll works after the drop.
    panRef.current.active = false;
    if (boardRef.current) boardRef.current.style.cursor = 'grab';
  }

  function onBoardMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    const target = e.target as Element;
    if (target.closest('[draggable="true"]') || target.closest('button') || target.closest('select')) return;
    panRef.current = { active: true, startX: e.clientX, scrollLeft: boardRef.current?.scrollLeft ?? 0 };
    if (boardRef.current) boardRef.current.style.cursor = 'grabbing';
  }

  function onBoardMouseMove(e: React.MouseEvent) {
    if (!panRef.current.active || !boardRef.current) return;
    e.preventDefault();
    boardRef.current.scrollLeft = panRef.current.scrollLeft - (e.clientX - panRef.current.startX);
  }

  function onBoardMouseUp() {
    panRef.current.active = false;
    if (boardRef.current) boardRef.current.style.cursor = 'grab';
  }

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
    return <div className="p-6 text-gray-500">{t('column.workspace_not_found')}</div>;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Page header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          {workspace && (
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: accentColor }}
            />
          )}
          <h1 className="text-[22px] font-semibold text-gray-900 tracking-tight">
            {workspace ? `${workspace.icon} ${workspace.name}` : t('title')}
          </h1>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium border border-gray-200 text-gray-600 bg-white rounded-md hover:bg-gray-50 transition-colors"
        >
          <span>+</span>
          <span>{t('new_content')}</span>
        </button>
      </div>

      {/* Kanban board */}
      {isLoading ? (
        <div className="flex gap-4 p-6 overflow-x-auto">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-64 flex-shrink-0 space-y-3">
              <Skeleton variant="text" className="w-1/2 h-5" />
              {Array.from({ length: 3 }).map((__, j) => (
                <div key={j} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-2">
                  <Skeleton variant="text" className="w-3/4" />
                  <Skeleton variant="text" className="w-1/2" />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div
          ref={boardRef}
          className="flex-1 overflow-x-auto select-none"
          style={{ cursor: 'grab' }}
          onDragStart={onBoardDragStart}
          onMouseDown={onBoardMouseDown}
          onMouseMove={onBoardMouseMove}
          onMouseUp={onBoardMouseUp}
          onMouseLeave={onBoardMouseUp}
        >
          <div className="flex gap-4 p-6 h-full min-w-max">
            {STAGE_ORDER.filter((stage) => stage !== 'archived').map((stage) => {
              const stageContents = contents.filter((c) => c.stage === stage);
              return (
                <KanbanColumn
                  key={stage}
                  stage={stage}
                  contents={stageContents}
                  onCardClick={handleCardClick}
                  onDrop={handleDrop}
                  onDoubleClick={() => setShowCreateModal(true)}
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
