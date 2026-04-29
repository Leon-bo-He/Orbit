import { useState, useLayoutEffect, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import i18n from '../../i18n/index.js';
import { useRssStore, type RssSource } from '../../store/rss.store.js';
import { useUiStore } from '../../store/ui.store.js';
import { useRssFeed, type RssFeedPage } from '../../api/rss.js';
import ReactMarkdown from 'react-markdown';
import { useTranslateTitles, useTranslateText } from '../../api/ai.js';
import { apiFetch } from '../../api/client.js';
import type { RssReport } from '../../api/ai.js';
import { RssReportModal } from './RssReportModal.js';

const LOCALE_LANGUAGE: Record<string, string> = {
  'zh-CN': 'Simplified Chinese',
  'zh-TW': 'Traditional Chinese',
  'en-US': 'English',
  'ja-JP': 'Japanese',
  'ko-KR': 'Korean',
};

function formatDate(raw: string): string {
  if (!raw) return '';
  try {
    return new Date(raw).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

// ─── Source Card ─────────────────────────────────────────────────────────────

const RENDER_CAP = 20;

interface SourceCardProps {
  source: RssSource;
  translations: Record<string, string>;
  showTranslations: boolean;
}

function SourceCard({ source, translations, showTranslations }: SourceCardProps) {
  const { t } = useTranslation('ideas');
  const [reportType, setReportType] = useState<'daily' | 'weekly' | 'biweekly' | null>(null);
  const [startIndex, setStartIndex] = useState(0);
  const [prevIndices, setPrevIndices] = useState<number[]>([]);
  const [fittingCount, setFittingCount] = useState(RENDER_CAP);
  const [measured, setMeasured] = useState(false);
  const articleAreaRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const { data, isLoading, isError, isFetching } = useRssFeed(source.url, 1, 100);
  const allArticles = data?.articles ?? [];
  const pageArticles = allArticles.slice(
    startIndex,
    startIndex + (measured ? fittingCount : RENDER_CAP),
  );

  useLayoutEffect(() => {
    if (measured) return;
    const area = articleAreaRef.current;
    const list = listRef.current;
    if (!area || !list || pageArticles.length === 0) return;

    const maxH = area.clientHeight;
    const items = Array.from(list.children) as HTMLElement[];
    let cumH = 0;
    let count = 0;

    for (const item of items) {
      const gap = count > 0 ? 8 : 0;
      const h = item.offsetHeight;
      if (cumH + gap + h > maxH) break;
      cumH += gap + h;
      count++;
    }

    setFittingCount(Math.max(1, count));
    setMeasured(true);
  }, [startIndex, data, measured]);

  const hasNext = startIndex + fittingCount < allArticles.length;
  const hasPrev = prevIndices.length > 0;

  function goNext() {
    setMeasured(false);
    setPrevIndices((p) => [...p, startIndex]);
    setStartIndex((s) => s + fittingCount);
  }

  function goPrev() {
    setMeasured(false);
    setStartIndex(prevIndices[prevIndices.length - 1] ?? 0);
    setPrevIndices((p) => p.slice(0, -1));
  }

  const showPagination = hasNext || hasPrev;

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white flex flex-col gap-3 h-[350px] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-1.5 min-w-0 flex-shrink-0">
        <svg className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path d="M3.75 3a.75.75 0 00-.75.75v.5c0 .414.336.75.75.75H4c6.075 0 11 4.925 11 11v.25c0 .414.336.75.75.75h.5a.75.75 0 00.75-.75V16C17 8.82 11.18 3 4 3h-.25z"/>
          <path d="M3 8.75A.75.75 0 013.75 8H4a8 8 0 018 8v.25a.75.75 0 01-.75.75h-.5a.75.75 0 01-.75-.75V16a6 6 0 00-6-6h-.25A.75.75 0 013 9.25v-.5zM7 15a2 2 0 11-4 0 2 2 0 014 0z"/>
        </svg>
        <span className="text-sm font-semibold text-gray-800 truncate">{source.name}</span>
        {source.folder && (
          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded truncate max-w-[80px]">{source.folder}</span>
        )}
        {isFetching && <div className="w-3 h-3 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin ml-auto flex-shrink-0"/>}
      </div>

      {/* Report buttons */}
      <div className="flex gap-1 flex-shrink-0">
        {(['daily', 'weekly', 'biweekly'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setReportType(type)}
            className="flex-1 text-[10px] font-medium px-1.5 py-1 rounded border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors leading-none"
          >
            {t(`trending_news.report_${type}`)}
          </button>
        ))}
      </div>

      {/* Article area */}
      <div ref={articleAreaRef} className="flex-1 min-h-0 overflow-hidden">
        {isLoading && (
          <div className="h-full flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin"/>
          </div>
        )}
        {isError && (
          <p className="text-xs text-red-400 h-full flex items-center">{t('trending_news.fetch_error')}</p>
        )}
        {!isLoading && !isError && allArticles.length === 0 && (
          <p className="text-xs text-gray-400 h-full flex items-center">{t('trending_news.no_articles')}</p>
        )}
        {pageArticles.length > 0 && (
          <ul ref={listRef} className="space-y-2">
            {pageArticles.map((article, i) => {
              const title = (showTranslations && translations[article.title]) || article.title;
              return (
                <li key={startIndex + i}>
                  <a
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-1.5"
                  >
                    <span className="mt-[5px] w-1 h-1 rounded-full bg-gray-300 group-hover:bg-indigo-400 flex-shrink-0 transition-colors"/>
                    <span className="text-xs text-gray-700 group-hover:text-indigo-600 transition-colors leading-snug line-clamp-2">
                      {title}
                      {article.pubDate && (
                        <span className="ml-1.5 text-gray-400 font-normal">{formatDate(article.pubDate)}</span>
                      )}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Pagination */}
      <div className={`flex items-center justify-between pt-1 border-t border-gray-100 flex-shrink-0 ${!showPagination ? 'invisible' : ''}`}>
        <button onClick={goPrev} disabled={!hasPrev} className="text-xs text-gray-500 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-1">
          ‹ {t('trending_news.page_prev')}
        </button>
        <button onClick={goNext} disabled={!hasNext} className="text-xs text-gray-500 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-1">
          {t('trending_news.page_next')} ›
        </button>
      </div>

      {reportType && (
        <RssReportModal source={source} reportType={reportType} onClose={() => setReportType(null)}/>
      )}
    </div>
  );
}

// ─── All-Sources Report Modal ─────────────────────────────────────────────────

type ReportType = 'daily' | 'weekly' | 'biweekly';

interface SourceReport {
  loading: boolean;
  content: string | null;
  translatedContent: string | null;
  error: string | null;
  generatedAt: Date | null;
}

function AllReportsModal({
  sources,
  reportType,
  onClose,
}: {
  sources: RssSource[];
  reportType: ReportType;
  onClose: () => void;
}) {
  const { t } = useTranslation('ideas');
  const qc = useQueryClient();
  const [reports, setReports] = useState<Record<string, SourceReport>>(
    () => Object.fromEntries(sources.map((s) => [s.id, { loading: true, content: null, translatedContent: null, error: null, generatedAt: null }])),
  );
  const [showTranslations, setShowTranslations] = useState(false);
  const translateMutation = useTranslateText();
  const [isTranslating, setIsTranslating] = useState(false);
  const [isForcing, setIsForcing] = useState(false);

  function loadAll(force: boolean) {
    setIsForcing(force);
    setReports(Object.fromEntries(sources.map((s) => [s.id, { loading: true, content: null, translatedContent: null, error: null, generatedAt: null }])));
    setShowTranslations(false);
    sources.forEach((source) => {
      apiFetch<RssReport>('/api/rss-reports', {
        method: 'POST',
        body: JSON.stringify({ feedUrl: source.url, feedName: source.name, reportType, force }),
      })
        .then((r) => {
          setReports((prev) => ({ ...prev, [source.id]: { loading: false, content: r.content, translatedContent: null, error: null, generatedAt: new Date(r.createdAt) } }));
          // Populate the single-source report cache so opening the individual modal is instant
          qc.setQueryData(['rss-report', source.url, reportType], r);
        })
        .catch((err) =>
          setReports((prev) => ({
            ...prev,
            [source.id]: { loading: false, content: null, translatedContent: null, error: err instanceof Error ? err.message : t('report.error'), generatedAt: null },
          })),
        );
    });
  }

  async function handleTranslateAll() {
    if (showTranslations) { setShowTranslations(false); return; }

    const targetLanguage = LOCALE_LANGUAGE[i18n.language] ?? i18n.language;
    const sourceList = sources.filter((s) => reports[s.id]?.content);
    if (sourceList.length === 0) return;

    setIsTranslating(true);
    try {
      // Translate each report in parallel using the full-text endpoint
      const results = await Promise.all(
        sourceList.map((s) =>
          translateMutation.mutateAsync({ text: reports[s.id]!.content!, targetLanguage })
            .then((r) => ({ id: s.id, translated: r.translated }))
            .catch(() => ({ id: s.id, translated: reports[s.id]!.content! })),
        ),
      );
      setReports((prev) => {
        const next = { ...prev };
        results.forEach(({ id, translated }) => {
          next[id] = { ...next[id]!, translatedContent: translated };
        });
        return next;
      });
      setShowTranslations(true);
    } finally {
      setIsTranslating(false);
    }
  }

  useLayoutEffect(() => { loadAll(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isLoading = Object.values(reports).some((r) => r.loading);
  const typeLabel = t(`report.type_${reportType}`);

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-900">
            {typeLabel} {t('report.title_suffix')} — {t('report.all_sources')}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void handleTranslateAll()}
              disabled={isLoading || isTranslating}
              className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border transition-colors disabled:opacity-50 ${
                showTranslations
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <svg className="w-3 h-3" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M3 5h8M7 3v2M5 9c0 2 1.5 3.5 3 4M8 9c0 2-1.5 3.5-3 4"/>
                <path d="M11 14l2-5 2 5M12 12.5h2"/>
                <path d="M17 5l-4 4"/>
              </svg>
              {isTranslating
                ? t('trending_news.translating')
                : showTranslations
                ? t('trending_news.show_original')
                : t('trending_news.translate')}
            </button>
            <button
              onClick={() => loadAll(true)}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <svg className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-6">
          {sources.map((source) => {
            const rep = reports[source.id];
            return (
              <div key={source.id}>
                <div className="flex items-center gap-1.5 mb-2">
                  <svg className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M3.75 3a.75.75 0 00-.75.75v.5c0 .414.336.75.75.75H4c6.075 0 11 4.925 11 11v.25c0 .414.336.75.75.75h.5a.75.75 0 00.75-.75V16C17 8.82 11.18 3 4 3h-.25z"/>
                    <path d="M3 8.75A.75.75 0 013.75 8H4a8 8 0 018 8v.25a.75.75 0 01-.75.75h-.5a.75.75 0 01-.75-.75V16a6 6 0 00-6-6h-.25A.75.75 0 013 9.25v-.5zM7 15a2 2 0 11-4 0 2 2 0 014 0z"/>
                  </svg>
                  <span className="text-sm font-semibold text-gray-800">{source.name}</span>
                  {rep?.generatedAt && (
                    <span className="text-xs text-gray-400 ml-1">
                      · {rep.generatedAt.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>

                {rep?.loading && (
                  <div className="flex items-center gap-2 py-4 text-gray-400">
                    <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin flex-shrink-0"/>
                    {isForcing && <span className="text-xs">{t('report.generating')}</span>}
                  </div>
                )}
                {rep?.error && (
                  <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2">
                    <p className="text-xs text-red-600">{rep.error}</p>
                  </div>
                )}
                {(rep?.content || rep?.translatedContent) && (
                  <div className="border border-gray-100 rounded-lg px-4 py-3 bg-gray-50">
                    <ReactMarkdown
                      components={{
                        h1: ({ children }) => <h1 className="text-base font-semibold text-gray-900 mt-3 mb-1 first:mt-0">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-sm font-semibold text-gray-900 mt-3 mb-1 first:mt-0">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm font-semibold text-gray-800 mt-2 mb-0.5">{children}</h3>,
                        p:  ({ children }) => <p  className="text-sm text-gray-700 leading-relaxed mb-2 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="text-sm text-gray-700 list-disc pl-5 mb-2 space-y-0.5">{children}</ul>,
                        ol: ({ children }) => <ol className="text-sm text-gray-700 list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>,
                        li: ({ children }) => <li className="leading-snug">{children}</li>,
                        strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                        hr: () => <hr className="border-gray-200 my-3"/>,
                        a: ({ href, children }) => (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 hover:underline transition-colors">
                            {children}
                          </a>
                        ),
                      }}
                    >
                      {(showTranslations && rep?.translatedContent) || rep?.content || ''}
                    </ReactMarkdown>
                  </div>
                )}

                {sources.indexOf(source) < sources.length - 1 && (
                  <div className="border-b border-gray-100 mt-4"/>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Trending News Modal ──────────────────────────────────────────────────────

export function TrendingNewsModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('ideas');
  const { sources } = useRssStore();
  const openSettings = useUiStore((s) => s.openSettings);
  const qc = useQueryClient();
  const translateMutation = useTranslateTitles();

  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [showTranslations, setShowTranslations] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [allReportType, setAllReportType] = useState<ReportType | null>(null);

  // Pre-warm the report cache for every source × report type so clicking a
  // button shows data instantly with no loading flash.
  useEffect(() => {
    if (sources.length === 0) return;
    const TYPES = ['daily', 'weekly', 'biweekly'] as const;
    sources.forEach((source) => {
      TYPES.forEach((type) => {
        void qc.prefetchQuery({
          queryKey: ['rss-report', source.url, type],
          queryFn: () =>
            apiFetch<RssReport>('/api/rss-reports', {
              method: 'POST',
              body: JSON.stringify({ feedUrl: source.url, feedName: source.name, reportType: type, force: false }),
            }),
          staleTime: 23 * 60 * 60 * 1000,
        });
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleOpenSettings() {
    onClose();
    openSettings('data');
  }

  async function handleTranslate() {
    if (showTranslations) {
      setShowTranslations(false);
      return;
    }

    setTranslateError(null);
    const targetLanguage = LOCALE_LANGUAGE[i18n.language] ?? i18n.language;

    // Collect all unique titles from the React Query cache for every source
    const uniqueTitles = [
      ...new Set(
        sources.flatMap((source) => {
          const cached = qc.getQueryData<RssFeedPage>(['rss', source.url, 1, 100]);
          return cached?.articles?.map((a) => a.title) ?? [];
        }),
      ),
    ];

    if (uniqueTitles.length === 0) return;

    try {
      const result = await translateMutation.mutateAsync({ titles: uniqueTitles, targetLanguage });
      const map: Record<string, string> = {};
      uniqueTitles.forEach((title, i) => { map[title] = result.translations[i] ?? title; });
      setTranslations(map);
      setShowTranslations(true);
    } catch (err) {
      setTranslateError(err instanceof Error ? err.message : t('trending_news.translate_error'));
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-500" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="2" y="4" width="16" height="12" rx="2"/>
              <path d="M2 8h16M6 4v4" strokeLinecap="round"/>
            </svg>
            <h2 className="text-sm font-semibold text-gray-900">{t('trending_news.title')}</h2>
          </div>
          <div className="flex items-center gap-2">
            {sources.length > 0 && (
              <button
                onClick={() => void handleTranslate()}
                disabled={translateMutation.isPending}
                className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border transition-colors disabled:opacity-50 ${
                  showTranslations
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
                  : showTranslations
                  ? t('trending_news.show_original')
                  : t('trending_news.translate')}
              </button>
            )}
            {translateError && (
              <span className="text-xs text-red-500 truncate max-w-[160px]">{translateError}</span>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M2 2l10 10M12 2L2 12"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {sources.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center">
                <svg className="w-7 h-7 text-orange-400" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M3.75 3a.75.75 0 00-.75.75v.5c0 .414.336.75.75.75H4c6.075 0 11 4.925 11 11v.25c0 .414.336.75.75.75h.5a.75.75 0 00.75-.75V16C17 8.82 11.18 3 4 3h-.25z"/>
                  <path d="M3 8.75A.75.75 0 013.75 8H4a8 8 0 018 8v.25a.75.75 0 01-.75.75h-.5a.75.75 0 01-.75-.75V16a6 6 0 00-6-6h-.25A.75.75 0 013 9.25v-.5zM7 15a2 2 0 11-4 0 2 2 0 014 0z"/>
                </svg>
              </div>
              <div className="text-center">
                <h3 className="text-sm font-semibold text-gray-800 mb-1">{t('trending_news.no_sources_heading')}</h3>
                <p className="text-sm text-gray-400 max-w-xs">{t('trending_news.no_sources_body')}</p>
              </div>
              <button
                onClick={handleOpenSettings}
                className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
              >
                {t('trending_news.open_settings')}
              </button>
            </div>
          )}

          {sources.length > 0 && (
            <div className="flex flex-col gap-4">
              {/* All-sources report strip */}
              <div className="flex items-center justify-start gap-2">
                <span className="text-xs text-gray-400">{t('trending_news.all_sources_report')}</span>
                {(['daily', 'weekly', 'biweekly'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setAllReportType(type)}
                    className="text-xs px-2.5 py-1 rounded-md border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors"
                  >
                    {t(`trending_news.report_${type}`)}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {sources.map((source) => (
                  <SourceCard
                    key={source.id}
                    source={source}
                    translations={translations}
                    showTranslations={showTranslations}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {sources.length > 0 && (
          <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-end flex-shrink-0">
            <button
              onClick={handleOpenSettings}
              className="text-xs text-gray-400 hover:text-indigo-500 transition-colors"
            >
              {t('trending_news.manage_sources')}
            </button>
          </div>
        )}

        {allReportType && (
          <AllReportsModal
            sources={sources}
            reportType={allReportType}
            onClose={() => setAllReportType(null)}
          />
        )}
      </div>
    </div>
  );
}
