import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { useDiscoverTopics } from '../../api/ai.js';
import { IdeaCaptureModal } from './IdeaCaptureModal.js';
import type { RssSource } from '../../store/rss.store.js';

type ReportType = 'daily' | 'weekly' | 'biweekly';

interface Props {
  sources: RssSource[];
  onClose: () => void;
}

/** Extract plain text from React children (used to prefill idea title). */
function childrenToText(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(childrenToText).join('');
  if (typeof children === 'object' && children !== null && 'props' in (children as React.ReactElement)) {
    return childrenToText((children as React.ReactElement).props.children);
  }
  return '';
}

function makeMdComponents(
  onAddIdea: (title: string, note: string) => void,
): React.ComponentProps<typeof ReactMarkdown>['components'] {
  return {
    h2: ({ children }) => <h2 className="text-sm font-semibold text-gray-900 mt-4 mb-1 first:mt-0">{children}</h2>,
    h3: ({ children }) => <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-0.5">{children}</h3>,
    p:  ({ children }) => <p  className="text-sm text-gray-700 leading-relaxed mb-2 last:mb-0">{children}</p>,
    ul: ({ children }) => <ul className="text-sm text-gray-700 list-disc pl-5 mb-2 space-y-1">{children}</ul>,
    li: ({ children }) => {
      const text = childrenToText(children).trim();
      // Split on first " — " or ": " to separate title from description
      const dashIdx = text.indexOf(' — ');
      const colonIdx = text.indexOf(': ');
      const splitAt = dashIdx !== -1 ? dashIdx : colonIdx !== -1 ? colonIdx : -1;
      const title = splitAt !== -1 ? text.slice(0, splitAt).replace(/^\*+|\*+$/g, '').trim() : text.slice(0, 100);
      const note = splitAt !== -1 ? text.slice(splitAt + (dashIdx !== -1 ? 3 : 2)).trim() : '';
      return (
        <li className="leading-snug flex items-start gap-1.5 group">
          <span className="flex-1 min-w-0">{children}</span>
          <button
            onClick={() => onAddIdea(title, note)}
            title="Add to Ideas"
            className="opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5 inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-all"
          >
            <svg className="w-2.5 h-2.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M8 3v10M3 8h10"/>
            </svg>
            Idea
          </button>
        </li>
      );
    },
    strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
    hr: () => <hr className="border-gray-200 my-3"/>,
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 hover:underline transition-colors">
        {children}
      </a>
    ),
  };
}

export function TopicDiscoverModal({ sources, onClose }: Props) {
  const { t } = useTranslation('ideas');
  const discover = useDiscoverTopics();

  // Source selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(sources.map((s) => s.id)));
  const [reportType, setReportType] = useState<ReportType>('weekly');
  const [additionalReqs, setAdditionalReqs] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ideaPrefill, setIdeaPrefill] = useState<{ title: string; note: string } | null>(null);

  const mdComponents = makeMdComponents((title, note) => setIdeaPrefill({ title, note }));

  // Group sources by folder
  const folders = [...new Set(sources.map((s) => s.folder ?? ''))].sort((a, b) =>
    a === '' ? 1 : b === '' ? -1 : a.localeCompare(b),
  );
  const byFolder = (folder: string) => sources.filter((s) => (s.folder ?? '') === folder);

  function toggleSource(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleFolder(folder: string) {
    const inFolder = byFolder(folder).map((s) => s.id);
    const allSelected = inFolder.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      inFolder.forEach((id) => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((prev) =>
      prev.size === sources.length ? new Set() : new Set(sources.map((s) => s.id)),
    );
  }

  async function handleDiscover() {
    setError(null);
    setResult(null);
    const feeds = sources
      .filter((s) => selectedIds.has(s.id))
      .map((s) => ({ url: s.url, name: s.name }));
    try {
      const res = await discover.mutateAsync({ feeds, reportType, additionalRequirements: additionalReqs.trim() || undefined });
      setResult(res.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('report.error'));
    }
  }

  const allSelected = selectedIds.size === sources.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  return (
    <>
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-900">{t('topic_discover.title')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M2 2l10 10M12 2L2 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-5">
          {!result && !discover.isPending && (
            <>
              {/* Source selector */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{t('topic_discover.sources')}</p>
                <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
                  {/* Select all */}
                  <label className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected; }}
                      onChange={toggleAll}
                      className="rounded text-indigo-600"
                    />
                    <span className="text-xs font-medium text-gray-700">{t('topic_discover.select_all')} ({sources.length})</span>
                  </label>

                  {folders.map((folder) => {
                    const inFolder = byFolder(folder);
                    const folderAllSelected = inFolder.every((s) => selectedIds.has(s.id));
                    const folderSomeSelected = inFolder.some((s) => selectedIds.has(s.id)) && !folderAllSelected;
                    return (
                      <div key={folder || '__none__'}>
                        {folder && (
                          <label className="flex items-center gap-2.5 px-3 py-1.5 bg-gray-50/60 cursor-pointer hover:bg-gray-100 transition-colors">
                            <input
                              type="checkbox"
                              checked={folderAllSelected}
                              ref={(el) => { if (el) el.indeterminate = folderSomeSelected; }}
                              onChange={() => toggleFolder(folder)}
                              className="rounded text-indigo-600"
                            />
                            <span className="text-xs text-gray-500">📁 {folder}</span>
                          </label>
                        )}
                        {inFolder.map((source) => (
                          <label key={source.id} className={`flex items-center gap-2.5 px-3 py-1.5 cursor-pointer hover:bg-gray-50 transition-colors ${folder ? 'pl-8' : ''}`}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(source.id)}
                              onChange={() => toggleSource(source.id)}
                              className="rounded text-indigo-600"
                            />
                            <span className="text-xs text-gray-700 truncate">{source.name}</span>
                            {!folder && source.folder && (
                              <span className="text-xs text-gray-400 bg-gray-100 px-1 rounded ml-auto flex-shrink-0">{source.folder}</span>
                            )}
                          </label>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Time period */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{t('topic_discover.time_period')}</p>
                <div className="flex gap-2">
                  {(['daily', 'weekly', 'biweekly'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setReportType(type)}
                      className={`flex-1 text-sm py-2 rounded-lg border transition-colors ${
                        reportType === type
                          ? 'border-indigo-400 bg-indigo-50 text-indigo-700 font-medium'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {t(`trending_news.report_${type}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Additional requirements */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{t('topic_discover.additional_req')}</p>
                <textarea
                  value={additionalReqs}
                  onChange={(e) => setAdditionalReqs(e.target.value)}
                  placeholder={t('topic_discover.additional_req_placeholder')}
                  rows={3}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                />
              </div>
            </>
          )}

          {discover.isPending && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-6 h-6 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin"/>
              <p className="text-sm text-gray-500">{t('topic_discover.discovering')}</p>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {result && (
            <ReactMarkdown components={mdComponents}>{result}</ReactMarkdown>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0">
          {result ? (
            <>
              <button
                onClick={() => { setResult(null); setError(null); }}
                className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                ← {t('topic_discover.back')}
              </button>
              <button
                onClick={() => void handleDiscover()}
                disabled={discover.isPending || selectedIds.size === 0}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <svg className={`w-3 h-3 ${discover.isPending ? 'animate-spin' : ''}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M14 8A6 6 0 1 1 8 2"/><path d="M14 2v4h-4"/>
                </svg>
                {t('report.refresh')}
              </button>
            </>
          ) : (
            <>
              <span className="text-xs text-gray-400">
                {selectedIds.size} {t('topic_discover.sources_selected')}
              </span>
              <button
                onClick={() => void handleDiscover()}
                disabled={discover.isPending || selectedIds.size === 0}
                className="text-sm px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {t('topic_discover.discover_btn')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>

    {/* Idea capture — pre-filled from the topic */}
    <IdeaCaptureModal
      open={!!ideaPrefill}
      onClose={() => setIdeaPrefill(null)}
      initialTitle={ideaPrefill?.title}
      initialNote={ideaPrefill?.note}
    />
    </>
  );
}
