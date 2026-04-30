import { XMLParser } from 'fast-xml-parser';
import type { RssCacheRepository } from '../../infrastructure/db/repositories/rss-cache.repository.js';

export interface RssArticle {
  title: string;
  link: string;
  pubDate: string;
}

export interface RssFeedPage {
  articles: RssArticle[];
  total: number;
  page: number;
  pages: number;
}

const REFETCH_INTERVAL_MS = 30 * 60 * 1000;
const MAX_PAGE_SIZE = 100;

function threeMonthsAgo(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return d;
}

function extractText(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'object') {
    const o = val as Record<string, unknown>;
    return String(o['__cdata'] ?? o['#text'] ?? '').trim();
  }
  return String(val).trim();
}

function parseRss(xml: string): RssArticle[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    cdataPropName: '__cdata',
    isArray: (name) => name === 'item' || name === 'entry',
  });
  const doc = parser.parse(xml);

  // RSS 2.0
  const rawItems = doc?.rss?.channel?.item;
  if (rawItems != null) {
    const items: unknown[] = Array.isArray(rawItems) ? rawItems : [rawItems];
    return (items as Record<string, unknown>[])
      .map((item) => ({
        title: extractText(item['title']),
        link: extractText(item['link']),
        pubDate: extractText(item['pubDate']),
      }))
      .filter((a) => a.title && a.link);
  }

  // Atom
  const rawEntries = doc?.feed?.entry;
  if (rawEntries != null) {
    const entries: unknown[] = Array.isArray(rawEntries) ? rawEntries : [rawEntries];
    return (entries as Record<string, unknown>[])
      .map((entry) => {
        const title = extractText(entry['title']);

        const linkVal = entry['link'];
        const links: Record<string, unknown>[] = Array.isArray(linkVal)
          ? (linkVal as Record<string, unknown>[])
          : [linkVal as Record<string, unknown>];
        const altLink = links.find((l) => !l?.['@_rel'] || l['@_rel'] === 'alternate') ?? links[0];
        const link = String(altLink?.['@_href'] ?? '').trim() || extractText(altLink);

        return {
          title,
          link,
          pubDate: extractText(entry['published'] ?? entry['updated']),
        };
      })
      .filter((a) => a.title && a.link);
  }

  return [];
}

export class RssService {
  constructor(private repo: RssCacheRepository) {}

  async deleteFeed(url: string): Promise<void> {
    await this.repo.deleteFeed(url);
  }

  async getFeed(url: string, page = 1, pageSize = 10): Promise<RssFeedPage> {
    const safePageSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
    const feed = await this.repo.findFeed(url);
    const stale = !feed || Date.now() - feed.lastFetchedAt.getTime() > REFETCH_INTERVAL_MS;

    if (stale) {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OrbitRSSReader/1.0)' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);
      const xml = await res.text();
      if (!xml.trim()) throw new Error('Empty RSS response');

      const cutoff = threeMonthsAgo();
      const fresh = parseRss(xml).filter((a) => {
        if (!a.pubDate) return true;
        const d = new Date(a.pubDate);
        if (isNaN(d.getTime())) return true; // unparseable date → include, store with null pub_date_ts
        return d >= cutoff;
      });
      await this.repo.insertArticles(url, fresh);
      await this.repo.deleteExpiredArticles(url, cutoff);
      await this.repo.upsertFeed(url);
    }

    const safePage = Math.max(1, page);
    const [rows, total] = await Promise.all([
      this.repo.findArticles(url, (safePage - 1) * safePageSize, safePageSize),
      this.repo.countArticles(url),
    ]);

    return {
      articles: rows.map((r) => {
        // Normalise to ISO 8601 so all browsers can parse it.
        // pub_date_ts is already a timestamp; fall back to parsing pub_date in Node.js.
        const ts = r.pubDateTs
          ?? (r.pubDate ? (() => { const d = new Date(r.pubDate); return isNaN(d.getTime()) ? null : d; })() : null);
        return { title: r.title, link: r.link, pubDate: ts?.toISOString() ?? '' };
      }),
      total,
      page: safePage,
      pages: Math.max(1, Math.ceil(total / safePageSize)),
    };
  }
}
