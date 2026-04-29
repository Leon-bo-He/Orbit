import type { AiConfigRepository } from '../../infrastructure/db/repositories/ai-config.repository.js';
import type { RssReportsRepository } from '../../infrastructure/db/repositories/rss-reports.repository.js';
import type { RssCacheRepository } from '../../infrastructure/db/repositories/rss-cache.repository.js';
import type { AiConfigRow } from '../../db/schema/ai-configs.js';
import { ValidationError } from '../errors.js';

export type ReportType = 'daily' | 'weekly' | 'biweekly';

const LOCALE_LANGUAGE: Record<string, string> = {
  'zh-CN': 'Simplified Chinese (简体中文)',
  'zh-TW': 'Traditional Chinese (繁體中文)',
  'en-US': 'English',
  'ja-JP': 'Japanese (日本語)',
  'ko-KR': 'Korean (한국어)',
};

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

  // Read an SSE stream and accumulate delta.content chunks
  private async readSseStream(body: ReadableStream<Uint8Array>): Promise<string> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';
    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') return accumulated;
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const chunk = JSON.parse(data) as any;
            const delta = chunk?.choices?.[0]?.delta?.content;
            if (typeof delta === 'string') accumulated += delta;
          } catch { /* skip malformed chunks */ }
        }
      }
    } finally {
      reader.releaseLock();
    }
    return accumulated;
  }

  private async callAiApi(config: AiConfigRow, prompt: string, maxTokens = 1024): Promise<string> {
    const baseUrl = config.baseUrl.replace(/\/$/, '');
    const endpoint = `${baseUrl}/chat/completions`;

    console.log('[AI] →', {
      endpoint,
      model: config.model,
      maxTokens,
      promptChars: prompt.length,
      promptPreview: prompt.slice(0, 200),
    });

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens,
          stream: true,
        }),
        signal: AbortSignal.timeout(60_000),
      });

      console.log('[AI] ← status:', res.status);

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        throw new ValidationError(`AI request failed (HTTP ${res.status})${errBody ? ': ' + errBody.slice(0, 200) : ''}`);
      }

      if (!res.body) throw new ValidationError('AI response has no body.');

      const content = (await this.readSseStream(res.body)).trim();
      console.log('[AI] content extracted:', content ? `"${content.slice(0, 200)}…"` : '(empty)');

      if (!content) throw new ValidationError('AI returned no content.');
      return content;
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[AI] error:', msg);
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
    locale = 'en-US',
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
      .map((a, i) => `${i + 1}. ${a.title}${a.pubDate ? ` (${a.pubDate})` : ''}${a.link ? ` — ${a.link}` : ''}`)
      .join('\n');

    const language = LOCALE_LANGUAGE[locale] ?? 'English';
    const prompt = `You are a professional news analyst. Write a detailed, structured report based on the articles from the "${feedName}" RSS feed covering the past ${periodLabel}.

Source articles (title, date, URL):
${articleList}

Produce the report in ${language} with the following sections:

## Overview
2–3 paragraphs summarising the overall themes and significance of this period's news.

## Key Developments
For each major story or development, write a short paragraph (3–5 sentences) explaining what happened, why it matters, and who is involved. After each paragraph, list the relevant sources as markdown links, e.g. ([Article Title](url)).

## Trends & Analysis
Identify 2–3 broader trends visible across the articles. For each trend, cite at least one supporting article as a markdown link.

## Summary
One concise paragraph wrapping up the most important takeaways.

Rules:
- Cite sources inline using markdown links: [title](url)
- Only cite URLs that appear in the source list above
- Do not invent or guess URLs
- Be thorough and detailed`;

    const content = await this.callAiApi(config, prompt, 2048);
    await this.reportsRepo.insert(userId, feedUrl, reportType, content);
    return { content, cached: false };
  }
}
