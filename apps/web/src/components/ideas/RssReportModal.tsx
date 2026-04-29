import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGenerateReport } from '../../api/ai.js';
import type { RssSource } from '../../store/rss.store.js';

type ReportType = 'daily' | 'weekly' | 'biweekly';

interface Props {
  source: RssSource;
  reportType: ReportType;
  onClose: () => void;
}

export function RssReportModal({ source, reportType, onClose }: Props) {
  const { t } = useTranslation('ideas');
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [cached, setCached] = useState(false);
  const generate = useGenerateReport();

  async function load(force = false) {
    setError(null);
    try {
      const result = await generate.mutateAsync({
        feedUrl: source.url,
        feedName: source.name,
        reportType,
        force,
      });
      setContent(result.content);
      setCached(result.cached && !force);
      setGeneratedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('report.error'));
    }
  }

  useEffect(() => { void load(); }, []);

  const typeLabel = t(`report.type_${reportType}`);

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900 truncate">
              {typeLabel} {t('report.title_suffix')} — {source.name}
            </h2>
            {generatedAt && (
              <p className="text-xs text-gray-400 mt-0.5">
                {cached ? t('report.cached') : t('report.fresh')} ·{' '}
                {generatedAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-3 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M2 2l10 10M12 2L2 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {generate.isPending && !content && (
            <div className="h-full flex flex-col items-center justify-center gap-3 py-12">
              <div className="w-6 h-6 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin"/>
              <p className="text-sm text-gray-500">{t('report.generating')}</p>
            </div>
          )}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          {content && (
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{content}</p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-end flex-shrink-0">
          <button
            onClick={() => void load(true)}
            disabled={generate.isPending}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <svg className={`w-3 h-3 ${generate.isPending ? 'animate-spin' : ''}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M14 8A6 6 0 1 1 8 2"/>
              <path d="M14 2v4h-4"/>
            </svg>
            {t('report.refresh')}
          </button>
        </div>
      </div>
    </div>
  );
}
