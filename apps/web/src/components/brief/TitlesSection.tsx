import { useTranslation } from 'react-i18next';
import type { ContentPlan, TitleCandidate } from '@contentflow/shared';

interface TitlesSectionProps {
  plan: Partial<ContentPlan>;
  onChange: (patch: Partial<ContentPlan>) => void;
}

export function TitlesSection({ plan, onChange }: TitlesSectionProps) {
  const { t } = useTranslation('contents');
  const titles = plan.titleCandidates ?? [];

  function updateTitles(next: TitleCandidate[]) {
    onChange({ titleCandidates: next });
  }

  function addTitle() {
    updateTitles([...titles, { text: '', isPrimary: titles.length === 0, usedOnPlatforms: [] }]);
  }

  function removeTitle(index: number) {
    const next = titles.filter((_, i) => i !== index);
    // If deleted was primary, assign primary to first remaining
    if (titles[index]?.isPrimary && next.length > 0) {
      next[0] = { ...next[0]!, isPrimary: true };
    }
    updateTitles(next);
  }

  function setTitle(index: number, text: string) {
    updateTitles(titles.map((t, i) => i === index ? { ...t, text } : t));
  }

  function setPrimary(index: number) {
    updateTitles(titles.map((t, i) => ({ ...t, isPrimary: i === index })));
  }

  return (
    <div className="space-y-3">
      {titles.map((title, index) => (
        <div
          key={index}
          className={`flex items-center gap-2 p-2 rounded border ${
            title.isPrimary ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200'
          }`}
        >
          <button
            onClick={() => setPrimary(index)}
            title={t('brief.titles.set_primary')}
            className={`text-lg leading-none flex-shrink-0 ${
              title.isPrimary ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'
            }`}
          >
            ⭐
          </button>
          <input
            type="text"
            value={title.text}
            onChange={(e) => setTitle(index, e.target.value)}
            placeholder={t('brief.titles.title_placeholder')}
            className="flex-1 text-sm border-0 bg-transparent outline-none focus:ring-0 p-0"
          />
          <button
            onClick={() => removeTitle(index)}
            className="text-gray-300 hover:text-red-400 text-sm flex-shrink-0"
            title={t('brief.titles.remove_title')}
          >
            ✕
          </button>
        </div>
      ))}

      <button
        onClick={addTitle}
        className="text-xs text-indigo-600 border border-dashed border-indigo-300 rounded px-3 py-1.5 hover:bg-indigo-50 w-full"
      >
        + {t('brief.titles.add_title')}
      </button>
    </div>
  );
}
