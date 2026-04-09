import { useTranslation } from 'react-i18next';
import type { IdeaFilters } from '../../api/ideas.js';

interface IdeaFiltersProps {
  filters: IdeaFilters;
  onChange: (filters: IdeaFilters) => void;
}

const STATUS_TABS = ['active', 'converted', 'archived', ''] as const;

export function IdeaFiltersBar({ filters, onChange }: IdeaFiltersProps) {
  const { t } = useTranslation('ideas');

  const activeTab = filters.status ?? '';

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Status tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {STATUS_TABS.map((status) => {
          const label = status === '' ? t('filter.all') : t(`filter.${status}`);
          const isActive = activeTab === status;
          return (
            <button
              key={status}
              onClick={() => {
                const next: IdeaFilters = { ...filters };
                if (status) next.status = status; else delete next.status;
                onChange(next);
              }}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Priority filter */}
      <div className="flex gap-1">
        {(['low', 'medium', 'high'] as const).map((p) => {
          const isActive = filters.priority === p;
          const colorMap: Record<string, string> = {
            low: isActive ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            medium: isActive ? 'bg-yellow-500 text-white' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200',
            high: isActive ? 'bg-red-500 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200',
          };
          return (
            <button
              key={p}
              onClick={() => {
                const next: IdeaFilters = { ...filters };
                if (isActive) delete next.priority; else next.priority = p;
                onChange(next);
              }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${colorMap[p]}`}
            >
              {t(`priority.${p}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
