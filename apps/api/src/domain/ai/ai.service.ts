import type { AiConfigRepository } from '../../infrastructure/db/repositories/ai-config.repository.js';
import type { RssReportsRepository } from '../../infrastructure/db/repositories/rss-reports.repository.js';
import type { RssCacheRepository } from '../../infrastructure/db/repositories/rss-cache.repository.js';
import { ValidationError } from '../errors.js';

export type ReportType = 'daily' | 'weekly' | 'biweekly';

const PERIOD_LABELS: Record<ReportType, string> = {
  daily: '24 hours',
  weekly: '7 days',
  biweekly: '14 days',
};

function timeCutoff(type: ReportType): Date {
  const ms = { daily: 1, weekly: 7, biweekly: 14 }[type] * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - ms);
}

export class AiService {
  constructor(
    private aiConfigRepo: AiConfigRepository,
    private reportsRepo: RssReportsRepository,
    private rssRepo: RssCacheRepository,
  ) {}

  async getConfig(userId: string) {
    const row = await this.aiConfigRepo.findByUser(userId);
    if (!row) return null;
    return { baseUrl: row.baseUrl, model: row.model, apiKeySet: true };
  }

  async saveConfig(userId: string, data: { baseUrl: string; apiKey: string; model: string }) {
    await this.aiConfigRepo.upsert(userId, data);
  }

  async getReport(
    userId: string,
    feedUrl: string,
    feedName: string,
    reportType: ReportType,
    force: boolean,
  ): Promise<{ content: string; cached: boolean }> {
    if (!force) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const existing = await this.reportsRepo.findRecent(userId, feedUrl, reportType, since);
      if (existing) return { content: existing.content, cached: true };
    }

    const config = await this.aiConfigRepo.findByUser(userId);
    if (!config) throw new ValidationError('AI not configured. Please add your AI settings first.');

    const articles = await this.rssRepo.findArticlesByDateRange(feedUrl, timeCutoff(reportType));
    if (articles.length === 0) {
      throw new ValidationError(`No articles found for ${feedName} in the past ${PERIOD_LABELS[reportType]}.`);
    }

    const articleList = articles
      .map((a) => `• ${a.title}${a.pubDate ? ` (${a.pubDate})` : ''}`)
      .join('\n');

    const prompt = `You are a news analyst. Summarize the key highlights from the "${feedName}" RSS feed for the past ${PERIOD_LABELS[reportType]}.

Articles collected:
${articleList}

Write a concise report with:
**Key Highlights** — 3-5 most important points as bullet points
**Main Topics** — primary themes covered
**Brief Summary** — 2-3 sentences

Be concise and factual.`;

    const baseUrl = config.baseUrl.replace(/\/$/, '');
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1024,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`AI API error ${res.status}: ${body.slice(0, 200)}`);
    }

    const json = await res.json() as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('AI returned an empty response.');

    await this.reportsRepo.insert(userId, feedUrl, reportType, content);
    return { content, cached: false };
  }
}
