import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGenerateBriefSection } from '../../api/brief.js';
import type { BriefSection, BriefContext } from '../../api/brief.js';

interface Props {
  section: BriefSection;
  context: Partial<BriefContext>;
  onResult: (result: unknown) => void;
  label?: string;
}

export function AiGenerateButton({ section, context, onResult, label }: Props) {
  const { t } = useTranslation('contents');
  const generate = useGenerateBriefSection();
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    try {
      const { result } = await generate.mutateAsync({ section, context });
      onResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('brief.ai.error'));
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => void handleClick()}
        disabled={generate.isPending}
        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-50 transition-colors"
      >
        <svg
          className={`w-3 h-3 ${generate.isPending ? 'animate-spin' : ''}`}
          viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        >
          {generate.isPending ? (
            <path d="M10 2l1.5 3.5L15 7l-3.5 1.5L10 12l-1.5-3.5L5 7l3.5-1.5L10 2z"/>
          ) : (
            <>
              <path d="M10 2l1.5 3.5L15 7l-3.5 1.5L10 12l-1.5-3.5L5 7l3.5-1.5L10 2z"/>
              <path d="M16 12l.8 1.8 1.7.7-1.7.8L16 17l-.8-1.7-1.7-.8 1.7-.7L16 12z"/>
            </>
          )}
        </svg>
        {generate.isPending ? t('brief.ai.generating') : (label ?? t('brief.ai.generate'))}
      </button>
      {error && <span className="text-xs text-red-500 truncate max-w-[200px]">{error}</span>}
    </div>
  );
}
