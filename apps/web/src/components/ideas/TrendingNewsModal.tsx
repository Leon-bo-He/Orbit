import { useState, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useRssStore, type RssSource } from '../../store/rss.store.js';
import { useUiStore } from '../../store/ui.store.js';
import { useRssFeed } from '../../api/rss.js';

function formatDate(raw: string): string {
  if (!raw) return '';
  try {
    return new Date(raw).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

// ─── Source Card ─────────────────────────────────────────────────────────────

// Always render up to this many articles; overflow-hidden clips what doesn't fit.
// useLayoutEffect measures the actual visible count after each navigation so pages
// with shorter titles show more articles and never leave blank space.
const RENDER_CAP = 20;

function SourceCard({ source }: { source: RssSource }) {
  const { t } = useTranslation('ideas');
  const [startIndex, setStartIndex] = useState(0);
  const [prevIndices, setPrevIndices] = useState<number[]>([]);
  const [fittingCount, setFittingCount] = useState(RENDER_CAP);
  const articleAreaRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Fetch the full batch once; all paging is done on the frontend
  const { data, isLoading, isError, isFetching } = useRssFeed(source.url, 1, 100);
  const allArticles = data?.articles ?? [];
  const pageArticles = allArticles.slice(startIndex, startIndex + RENDER_CAP);

  // Before the browser paints: walk rendered items, count how many fit in the
  // visible area, store as fittingCount. Runs on every navigation so a page
  // full of short (1-line) titles automatically shows more articles than one
  // full of long (2-line) titles.
  useLayoutEffect(() => {
    const area = articleAreaRef.current;
    const list = listRef.current;
    if (!area || !list || pageArticles.length === 0) return;

    const maxH = area.clientHeight;
    const items = Array.from(list.children) as HTMLElement[];
    let cumH = 0;
    let count = 0;

    for (const item of items) {
      const gap = count > 0 ? 8 : 0; // space-y-2
      const h = item.offsetHeight;
      if (cumH + gap + h > maxH) break;
      cumH += gap + h;
      count++;
    }

    const measured = Math.max(1, count);
    if (measured !== fittingCount) setFittingCount(measured);
  }, [startIndex, data]); // intentionally excludes fittingCount to avoid loops

  const hasNext = startIndex + fittingCount < allArticles.length;
  const hasPrev = prevIndices.length > 0;

  function goNext() {
    setPrevIndices((p) => [...p, startIndex]);
    setStartIndex((s) => s + fittingCount);
  }

  function goPrev() {
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
        {isFetching && <div className="w-3 h-3 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin ml-auto flex-shrink-0"/>}
      </div>

      {/* Article area — overflow-hidden clips articles beyond the visible height */}
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
            {pageArticles.map((article, i) => (
              <li key={startIndex + i}>
                <a
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-1.5"
                >
                  <span className="mt-[5px] w-1 h-1 rounded-full bg-gray-300 group-hover:bg-indigo-400 flex-shrink-0 transition-colors"/>
                  <span className="text-xs text-gray-700 group-hover:text-indigo-600 transition-colors leading-snug line-clamp-2">
                    {article.title}
                    {article.pubDate && (
                      <span className="ml-1.5 text-gray-400 font-normal">{formatDate(article.pubDate)}</span>
                    )}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Always rendered for layout stability; invisible when there is only one page */}
      <div className={`flex items-center justify-between pt-1 border-t border-gray-100 flex-shrink-0 ${!showPagination ? 'invisible' : ''}`}>
        <button
          onClick={goPrev}
          disabled={!hasPrev}
          className="text-xs text-gray-500 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-1"
        >
          ‹ {t('trending_news.page_prev')}
        </button>
        <button
          onClick={goNext}
          disabled={!hasNext}
          className="text-xs text-gray-500 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-1"
        >
          {t('trending_news.page_next')} ›
        </button>
      </div>
    </div>
  );
}

// ─── Trending News Modal ──────────────────────────────────────────────────────

export function TrendingNewsModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('ideas');
  const { sources } = useRssStore();
  const openSettings = useUiStore((s) => s.openSettings);

  function handleOpenSettings() {
    onClose();
    openSettings('data');
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
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M2 2l10 10M12 2L2 12"/>
            </svg>
          </button>
        </div>

        {/* Body — min-h-0 required so overflow-y-auto activates inside the flex column */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {sources.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center">
                <svg className="w-7 h-7 text-orange-400" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M3.75 3a.75.75 0 00-.75.75v.5c0 .414.336.75.75.75H4c6.075 0 11 4.925 11 11v.25c0 .414.336.75.75.75h.5a.75.75 0 00.75-.75V16C17 8.82 11.18 3 4 3h-.25z"/>
                  <path d="M3 8.75A.75.75 0 013.75 8H4a8 8 0 018 8v.25a.75.75 0 01-.75.75h-.5a.75.75 0 01-.75-.75V16a6 6 0 00-6-6h-.25A.75.75 0 013 9.25v-.5zM7 15a2 2 0 11-4 0 2 2 0 114 0z"/>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {sources.map((source) => (
                <SourceCard key={source.id} source={source} />
              ))}
            </div>
          )}
        </div>

        {sources.length > 0 && (
          <div className="border-t border-gray-100 px-5 py-3 flex justify-end flex-shrink-0">
            <button
              onClick={handleOpenSettings}
              className="text-xs text-gray-400 hover:text-indigo-500 transition-colors"
            >
              {t('trending_news.manage_sources')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
