import type { AiConfigRepository } from '../../infrastructure/db/repositories/ai-config.repository.js';
import type { RssReportsRepository } from '../../infrastructure/db/repositories/rss-reports.repository.js';
import type { RssCacheRepository } from '../../infrastructure/db/repositories/rss-cache.repository.js';
import type { AiConfigRow } from '../../db/schema/ai-configs.js';
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

  // ─── Shared AI call helper ────────────────────────────────────────────────

  private async callAiApi(config: AiConfigRow, prompt: string, maxTokens = 1024): Promise<string> {
    const baseUrl = config.baseUrl.replace(/\/$/, '');
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens,
        }),
        signal: AbortSignal.timeout(60_000),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new ValidationError(`AI request failed (HTTP ${res.status})${body ? ': ' + body.slice(0, 200) : ''}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json = await res.json() as any;
      const choice = json?.choices?.[0];

      // Scan all output items — gpt-5.x may prepend a reasoning block at index 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const outputText: string = (Array.isArray(json?.output) ? json.output : []).reduce((acc: string, item: any) => {
        if (acc) return acc;
        const t = item?.content?.[0]?.text ?? item?.text;
        return typeof t === 'string' ? t : acc;
      }, '');

      let content: string = (
        choice?.message?.content                 // standard OpenAI chat completion
        ?? choice?.message?.reasoning_content    // DeepSeek-R1 / reasoning models
        ?? choice?.text                          // legacy completion format
        ?? (outputText || undefined)             // OpenAI Responses API (gpt-5.x, any output index)
        ?? json?.content?.[0]?.text              // Anthropic-style proxy
        ?? ''
      );
      if (typeof content !== 'string') content = String(content ?? '');
      content = content.trim();
      if (!content) {
        const preview = JSON.stringify(json).slice(0, 800);
        throw new ValidationError(`AI returned no content. Response: ${preview}`);
      }
      return content;
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      const msg = err instanceof Error ? err.message : 'Unknown error';
      throw new ValidationError(`Failed to reach AI service: ${msg}`);
    }
  }

  // ─── Public methods ───────────────────────────────────────────────────────

  async getConfig(userId: string) {
    const row = await this.aiConfigRepo.findByUser(userId);
    if (!row) return null;
    return { baseUrl: row.baseUrl, model: row.model, apiKeySet: true };
  }

  async saveConfig(userId: string, data: { baseUrl: string; apiKey?: string; model: string }) {
    await this.aiConfigRepo.upsert(userId, data);
  }

  async testConnection(
    userId: string,
    overrides: { baseUrl?: string; apiKey?: string; model?: string },
  ): Promise<{ ok: boolean; error?: string }> {
    const stored = await this.aiConfigRepo.findByUser(userId);
    const baseUrl = (overrides.baseUrl?.trim() || (stored?.baseUrl ?? '')).replace(/\/$/, '');
    const apiKey  = overrides.apiKey?.trim() || (stored?.apiKey ?? '');
    const model   = overrides.model?.trim() || stored?.model || 'gpt-5.4';

    if (!baseUrl || !apiKey) return { ok: false, error: 'Base URL and API key are required.' };

    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Say "ok".' }], max_tokens: 5 }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { ok: false, error: `HTTP ${res.status}${text ? ': ' + text.slice(0, 120) : ''}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Connection failed' };
    }
  }

  async translateTitles(userId: string, titles: string[], targetLanguage: string): Promise<string[]> {
    if (titles.length === 0) return [];
    const config = await this.aiConfigRepo.findByUser(userId);
    if (!config) throw new ValidationError('AI not configured. Please add your AI settings first.');

    const batch = titles.slice(0, 150); // guard against oversized prompts
    const numbered = batch.map((t, i) => `${i + 1}. ${t}`).join('\n');
    const prompt = `Translate the following ${batch.length} article titles to ${targetLanguage}.
Return ONLY a valid JSON array of translated strings in exactly the same order, with no extra text or markdown.

${numbered}`;

    const raw = await this.callAiApi(config, prompt, 2048);

    // Extract JSON array from response (model may wrap it in markdown code fences)
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new ValidationError('Translation response was not a JSON array.');
    try {
      const parsed = JSON.parse(match[0]) as unknown[];
      if (!Array.isArray(parsed)) throw new Error();
      // Pad / trim to match input length
      while (parsed.length < batch.length) parsed.push(batch[parsed.length] ?? '');
      return parsed.slice(0, batch.length).map(String);
    } catch {
      throw new ValidationError('Failed to parse translation response.');
    }
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

    let articles = await this.rssRepo.findArticlesByDateRange(feedUrl, timeCutoff(reportType));
    let periodLabel = PERIOD_LABELS[reportType];
    if (articles.length === 0) {
      articles = await this.rssRepo.findArticles(feedUrl, 0, 30);
      if (articles.length === 0) {
        throw new ValidationError(`No articles found for "${feedName}". Fetch the feed first in Trending News.`);
      }
      periodLabel = 'recent history (no articles in the requested period)';
    }

    const articleList = articles
      .slice(0, 80)
      .map((a) => `• ${a.title}${a.pubDate ? ` (${a.pubDate})` : ''}`)
      .join('\n');

    const prompt = `You are a news analyst. Summarize the key highlights from the "${feedName}" RSS feed for the past ${periodLabel}.

Articles collected:
${articleList}

Write a concise report with:
**Key Highlights** — 3-5 most important points as bullet points
**Main Topics** — primary themes covered
**Brief Summary** — 2-3 sentences

Be concise and factual.`;

    const content = await this.callAiApi(config, prompt, 1024);
    await this.reportsRepo.insert(userId, feedUrl, reportType, content);
    return { content, cached: false };
  }
}
