import { useState } from 'react';
import type { Content, Stage } from '@contentflow/shared';
import { KanbanCard } from './KanbanCard.js';
import { useTranslation } from 'react-i18next';

interface KanbanColumnProps {
  stage: Stage;
  contents: Content[];
  onCardClick: (content: Content) => void;
  onDrop: (contentId: string, newStage: Stage) => void;
}

export function KanbanColumn({ stage, contents, onCardClick, onDrop }: KanbanColumnProps) {
  const { t } = useTranslation('contents');
  const [isDragOver, setIsDragOver] = useState(false);

  function handleDragStart(e: React.DragEvent, contentId: string) {
    e.dataTransfer.setData('contentId', contentId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    // Only clear if leaving the column element itself
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const contentId = e.dataTransfer.getData('contentId');
    if (contentId) {
      onDrop(contentId, stage);
    }
  }

  return (
    <div className="flex-shrink-0 w-64 flex flex-col">
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2 mb-2">
        <h3 className="text-sm font-semibold text-gray-700">
          {t(`stages.${stage}`)}
        </h3>
        <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
          {contents.length}
        </span>
      </div>

      {/* Droppable area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex-1 min-h-32 rounded-lg p-2 space-y-2 transition-colors ${
          isDragOver
            ? 'bg-indigo-50 border-2 border-dashed border-indigo-300'
            : 'bg-gray-50 border-2 border-transparent'
        }`}
      >
        {contents.map((content) => (
          <KanbanCard
            key={content.id}
            content={content}
            onClick={onCardClick}
            onDragStart={handleDragStart}
          />
        ))}
        {contents.length === 0 && (
          <div className="flex items-center justify-center h-16 text-xs text-gray-400">
            {isDragOver ? '放置到此处' : '暂无内容'}
          </div>
        )}
      </div>
    </div>
  );
}
