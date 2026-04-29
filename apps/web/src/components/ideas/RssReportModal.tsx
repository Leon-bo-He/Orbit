import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import i18n from '../../i18n/index.js';
import { useGetReport, useTranslateText } from '../../api/ai.js';
import type { RssSource } from '../../store/rss.store.js';

type ReportType = 'daily' | 'weekly' | 'biweekly';

interface Props {
  source: RssSource;
  reportType: ReportType;
  onClose: () => void;
}

const LOCALE_LANGUAGE: Record<string, string> = {
  'zh-CN': 'Simplified Chinese',
  'zh-TW': 'Traditional Chinese',
  'en-US': 'English',
  'ja-JP': 'Japanese',
  'ko-KR': 'Korean',
};

const MD_COMPONENTS: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  h1: ({ children }) => <h1 className="text-base font-semibold text-gray-900 mt-4 mb-1 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="text-sm font-semibold text-gray-900 mt-3 mb-1 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold text-gray-800 mt-2 mb-0.5">{children}</h3>,
  p:  ({ children }) => <p  className="text-sm text-gray-700 leading-relaxed mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="text-sm text-gray-700 list-disc pl-5 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="text-sm text-gray-700 list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="leading-snug">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
  hr: () => <hr className="border-gray-200 my-3"/>,
  blockquote: ({ children }) => <blockquote className="border-l-2 border-indigo-300 pl-3 italic text-gray-600 my-2">{children}</blockquote>,
  code: ({ children }) => <code className="bg-gray-100 rounded px-1 py-0.5 text-xs font-mono text-gray-800">{children}</code>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 hover:underline transition-colors">
      {children}
    </a>
  ),
};

export function RssReportModal({ source, reportType, onClose }: Props) {
  const { t } = useTranslation('ideas');
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const translateMutation = useTranslateText();

  const { query, forceRefresh } = useGetReport(source.url, source.name, reportType);
  const report = query.data;
  const isPending = query.isLoading || query.isFetching;

  async function handleTranslate() {
    if (showTranslation) { setShowTranslation(false); return; }
    if (translatedContent) { setShowTranslation(true); return; }
    const text = report?.content;
    if (!text) return;
    const targetLanguage = LOCALE_LANGUAGE[i18n.language] ?? i18n.language;
    try {
      const result = await translateMutation.mutateAsync({ text, targetLanguage });
      setTranslatedContent(result.translated);
      setShowTranslation(true);
    } catch { /* show original on failure */ }
  }

  function handleRefresh() {
    setTranslatedContent(null);
    setShowTranslation(false);
    forceRefresh.mutate();
  }

  const typeLabel = t(`report.type_${reportType}`);
  const displayContent = showTranslation ? translatedContent : report?.content;
  const generatedAt = report ? new Date(report.createdAt) : null;
  const refreshing = forceRefresh.isPending;

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900 truncate">
              {typeLabel} {t('report.title_suffix')} — {source.name}
            </h2>
            {generatedAt && (
              <p className="text-xs text-gray-400 mt-0.5">
                {report?.cached ? t('report.cached') : t('report.fresh')} ·{' '}
                {generatedAt.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 ml-3 flex-shrink-0">
            <button
              onClick={() => void handleTranslate()}
              disabled={!report?.content || translateMutation.isPending}
              className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border transition-colors disabled:opacity-50 ${
                showTranslation
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <svg className="w-3 h-3" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M3 5h8M7 3v2M5 9c0 2 1.5 3.5 3 4M8 9c0 2-1.5 3.5-3 4"/>
                <path d="M11 14l2-5 2 5M12 12.5h2"/>
                <path d="M17 5l-4 4"/>
              </svg>
              {translateMutation.isPending
                ? t('trending_news.translating')
                : showTranslation
                ? t('trending_news.show_original')
                : t('trending_news.translate')}
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing || isPending}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <svg className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M14 8A6 6 0 1 1 8 2"/>
                <path d="M14 2v4h-4"/>
              </svg>
              {t('report.refresh')}
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M2 2l10 10M12 2L2 12"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {(isPending || refreshing) && !report && (
            <div className="h-full flex flex-col items-center justify-center gap-3 py-12">
              <div className="w-6 h-6 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin"/>
              <p className="text-sm text-gray-500">{t('report.generating')}</p>
            </div>
          )}
          {(forceRefresh.isError || (query.isError && !report)) && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 mb-4">
              <p className="text-sm text-red-600">
                {forceRefresh.isError
                  ? (forceRefresh.error instanceof Error ? forceRefresh.error.message : t('report.error'))
                  : (query.error instanceof Error ? query.error.message : t('report.error'))}
              </p>
            </div>
          )}
          {displayContent && <ReactMarkdown components={MD_COMPONENTS}>{displayContent}</ReactMarkdown>}
        </div>
      </div>
    </div>
  );
}
