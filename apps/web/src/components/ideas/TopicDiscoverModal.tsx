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

/** Extract { text, href } link pairs from a hast node tree (react-markdown v10 passes hast). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function nodeToLinks(node: any): { text: string; href: string }[] {
  if (!node) return [];
  // hast: links are element nodes with tagName 'a'
  if (node.type === 'element' && node.tagName === 'a' && node.properties?.href) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text = (node.children ?? []).map((c: any) => c.value ?? '').join('');
    return [{ text, href: String(node.properties.href) }];
  }
  if (Array.isArray(node.children)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return node.children.flatMap((c: any) => nodeToLinks(c));
  }
  return [];
}

function buildNote(text: string, links: { text: string; href: string }[]): string {
  if (links.length === 0) return text;
  const inlineLinks = links.map((l) => `[${l.text}](${l.href})`).join('  ');
  return text ? `${text}\n\n${inlineLinks}` : inlineLinks;
}

/** Extract the first strong/bold node text from a hast node tree. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function nodeToFirstStrongText(node: any): string {
  if (!node) return '';
  // hast: strong is an element node with tagName 'strong'
  if (node.type === 'element' && node.tagName === 'strong') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (node.children ?? []).map((c: any) => c.value ?? '').join('');
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      const found = nodeToFirstStrongText(child);
      if (found) return found;
    }
  }
  return '';
}

function makeMdComponents(
  onAddIdea: (title: string, note: string) => void,
): React.ComponentProps<typeof ReactMarkdown>['components'] {
  // Track the most recent list-item title so paragraphs can reuse it
  let lastLiTitle = '';
  return {
    h2: ({ children }) => { lastLiTitle = ''; return <h2 className="text-sm font-semibold text-gray-900 mt-4 mb-1 first:mt-0">{children}</h2>; },
    h3: ({ children }) => { lastLiTitle = ''; return <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-0.5">{children}</h3>; },
    p: ({ children, node }) => {
      const text = childrenToText(children).trim();
      if (text.length < 20) return <p className="text-sm text-gray-700 leading-relaxed mb-2 last:mb-0">{children}</p>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const links = nodeToLinks(node as any);
      // Prefer bold title at start of paragraph (new format), then lastLiTitle, then first sentence
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const boldTitle = nodeToFirstStrongText(node as any);
      const title = boldTitle || lastLiTitle || text.split(/[。！？.!?]/)[0].trim().slice(0, 120);
      const note = buildNote(text, links);
      return (
        <div className="flex items-start gap-2 mb-2 last:mb-0">
          <p className="flex-1 min-w-0 text-sm text-gray-700 leading-relaxed">{children}</p>
          <button
            onClick={() => onAddIdea(title, note)}
            title="Add to Ideas"
            className="flex-shrink-0 mt-0.5 inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
          >
            <svg className="w-2.5 h-2.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M8 3v10M3 8h10"/>
            </svg>
            Idea
          </button>
        </div>
      );
    },
    ul: ({ children }) => <ul className="text-sm text-gray-700 list-disc pl-5 mb-2 space-y-1">{children}</ul>,
    li: ({ children, node }) => {
      // Track title for following paragraphs; no button here (button is on the paragraph)
      const text = childrenToText(children).trim();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lastLiTitle = nodeToFirstStrongText(node as any) || text.split('\n')[0].trim().slice(0, 150);
      return <li className="leading-snug">{children}</li>;
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
  // availability: 'checking' | 'available' | 'none' per source per type
  const [reportAvail, setReportAvail] = useState<Record<string, Record<string, 'checking'|'available'|'none'>>>({});
  // user's selected report per source (at most one type per source)
  const [selectedReports, setSelectedReports] = useState<Record<string, string | null>>({});
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ideaPrefill, setIdeaPrefill] = useState<{ title: string; note: string } | null>(null);

  const mdComponents = makeMdComponents((title, note) => setIdeaPrefill({ title, note }));

  // Check report availability for all sources × types on open
  useEffect(() => {
    const TYPES: ReportType[] = ['daily', 'weekly', 'biweekly'];
    const init: Record<string, Record<string, 'checking'>> = {};
    sources.forEach((s) => { init[s.id] = { daily: 'checking', weekly: 'checking', biweekly: 'checking' }; });
    setReportAvail(init);
    sources.forEach((source) => {
      TYPES.forEach((type) => {
        apiFetch<import('../../api/ai.js').RssReport>(
          `/api/rss-reports?feedUrl=${encodeURIComponent(source.url)}&reportType=${type}`
        ).then(() => {
          setReportAvail((prev) => ({ ...prev, [source.id]: { ...prev[source.id], [type]: 'available' } }));
        }).catch(() => {
          setReportAvail((prev) => ({ ...prev, [source.id]: { ...prev[source.id], [type]: 'none' } }));
        });
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const selReports = Object.entries(selectedReports)
        .filter(([, type]) => type)
        .map(([id, type]) => {
          const src = sources.find((s) => s.id === id);
          return src ? { feedUrl: src.url, reportType: type! } : null;
        })
        .filter(Boolean) as { feedUrl: string; reportType: string }[];
      const res = await discover.mutateAsync({ feeds, reportType, additionalRequirements: additionalReqs.trim() || undefined, selectedReports: selReports });
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
                        {inFolder.map((source) => {
                          const avail = reportAvail[source.id] ?? {};
                          return (
                            <div key={source.id} className={`flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 transition-colors ${folder ? 'pl-8' : ''}`}>
                              <label className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(source.id)}
                                  onChange={() => toggleSource(source.id)}
                                  className="rounded text-indigo-600 flex-shrink-0"
                                />
                                <span className="text-xs text-gray-700 truncate">{source.name}</span>
                                {!folder && source.folder && (
                                  <span className="text-xs text-gray-400 bg-gray-100 px-1 rounded ml-1 flex-shrink-0">{source.folder}</span>
                                )}
                              </label>
                              {/* Per-source report type buttons */}
                              <div className="flex gap-1 flex-shrink-0">
                                {(['daily', 'weekly', 'biweekly'] as const).map((type) => {
                                  const state = avail[type] ?? 'checking';
                                  const isSelected = selectedReports[source.id] === type;
                                  const isAvailable = state === 'available';
                                  const isChecking = state === 'checking';
                                  return (
                                    <button
                                      key={type}
                                      type="button"
                                      disabled={!isAvailable}
                                      title={isChecking ? t('topic_discover.report_checking') : !isAvailable ? t('topic_discover.report_unavailable') : t('topic_discover.report_use')}
                                      onClick={() => setSelectedReports((prev) => ({ ...prev, [source.id]: prev[source.id] === type ? null : type }))}
                                      className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors disabled:cursor-not-allowed ${
                                        isSelected
                                          ? 'border-indigo-400 bg-indigo-600 text-white'
                                          : isAvailable
                                          ? 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                                          : isChecking
                                          ? 'border-gray-200 text-gray-300'
                                          : 'border-gray-200 text-gray-300 line-through'
                                      }`}
                                    >
                                      {isChecking ? '···' : t(`trending_news.report_${type}`).slice(0, 1).toUpperCase()}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
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
      zIndex={80}
    />
    </>
  );
}
