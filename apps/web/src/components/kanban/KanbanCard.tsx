import type { Content } from '@contentflow/shared';
import { useTranslation } from 'react-i18next';

const PLATFORM_EMOJI: Record<string, string> = {
  douyin: '🎵',
  xiaohongshu: '📕',
  weixin: '📰',
  weixin_video: '📱',
  bilibili: '🎬',
  x: '🐦',
  youtube: '▶️',
  instagram: '📷',
};

function formatDate(date: Date | string | null): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(d);
}

interface KanbanCardProps {
  content: Content;
  onClick: (content: Content) => void;
  onDragStart: (e: React.DragEvent, contentId: string) => void;
}

export function KanbanCard({ content, onClick, onDragStart }: KanbanCardProps) {
  const { t } = useTranslation('contents');

  const visibleTags = content.tags.slice(0, 2);
  const extraTags = content.tags.length - 2;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, content.id)}
      onClick={() => onClick(content)}
      className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all select-none"
    >
      {/* Title */}
      <p className="text-sm font-medium text-gray-900 line-clamp-2 mb-2">{content.title}</p>

      {/* Content type badge */}
      <span className="inline-block text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5 mb-2">
        {t(`content_types.${content.contentType}`)}
      </span>

      {/* Platform emojis */}
      {content.targetPlatforms.length > 0 && (
        <div className="flex gap-1 mb-2">
          {content.targetPlatforms.map((p) => (
            <span key={p} title={p} className="text-sm">
              {PLATFORM_EMOJI[p] ?? '🌐'}
            </span>
          ))}
        </div>
      )}

      {/* Scheduled date */}
      {content.scheduledAt && (
        <p className="text-xs text-gray-500 mb-1">
          {formatDate(content.scheduledAt)}
        </p>
      )}

      {/* Tags */}
      {visibleTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {visibleTags.map((tag) => (
            <span key={tag} className="text-xs bg-indigo-50 text-indigo-600 rounded px-1.5 py-0.5">
              {tag}
            </span>
          ))}
          {extraTags > 0 && (
            <span className="text-xs text-gray-400">
              {t('card.tags_more', { count: extraTags })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
