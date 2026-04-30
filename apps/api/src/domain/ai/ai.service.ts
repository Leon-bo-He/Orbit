import type { AiConfigRepository } from '../../infrastructure/db/repositories/ai-config.repository.js';
import type { RssReportsRepository } from '../../infrastructure/db/repositories/rss-reports.repository.js';
import type { RssCacheRepository } from '../../infrastructure/db/repositories/rss-cache.repository.js';
import type { AiConfigRow } from '../../db/schema/ai-configs.js';
import { ValidationError } from '../errors.js';
import { redis } from '../../redis/client.js';

const LOCK_TTL_S = 360; // matches the 5min AI timeout ceiling + buffer
const LOCK_POLL_MS = 2_000;
const LOCK_WAIT_MAX_MS = 90_000;

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

  private async callAiApi(config: AiConfigRow, prompt: string): Promise<string> {
    const baseUrl = config.baseUrl.replace(/\/$/, '');
    const endpoint = `${baseUrl}/chat/completions`;

    console.log('[AI] →', {
      endpoint,
      model: config.model,
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
          stream: true,
        }),
        signal: AbortSignal.timeout(300_000), // 5 min hard ceiling
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

  /** Public wrapper used by BriefService to reuse the shared callAiApi helper. */
  async callBriefPrompt(config: AiConfigRow, prompt: string): Promise<string> {
    return this.callAiApi(config, prompt);
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

  async translateText(userId: string, text: string, targetLanguage: string): Promise<string> {
    if (!text.trim()) return text;
    const config = await this.aiConfigRepo.findByUser(userId);
    if (!config) throw new ValidationError('AI not configured. Please add your AI settings first.');

    const prompt = `Translate the following text to ${targetLanguage}.
Preserve all markdown formatting exactly (headings, bold, bullet lists, links, etc.).
Return ONLY the translated text with no explanation or extra commentary.

${text}`;

    return this.callAiApi(config, prompt);
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

    const raw = await this.callAiApi(config, prompt);

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

  async findCachedReport(
    userId: string,
    feedUrl: string,
    reportType: ReportType,
    since: Date,
  ): Promise<{ content: string; cached: true; createdAt: string; translatedContent?: string; translationLocale?: string; reportId?: string } | null> {
    const existing = await this.reportsRepo.findRecent(userId, feedUrl, reportType, since);
    if (!existing) return null;
    return {
      content: existing.content, cached: true, createdAt: existing.createdAt.toISOString(),
      translatedContent: existing.translatedContent ?? undefined,
      translationLocale: existing.translationLocale ?? undefined,
      reportId: existing.id,
    };
  }

  async getOrGenerateTranslation(
    userId: string,
    feedUrl: string,
    reportType: ReportType,
    targetLocale: string,
  ): Promise<string> {
    // Check for a recent cached report with a matching translation
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existing = await this.reportsRepo.findRecent(userId, feedUrl, reportType, since);
    if (!existing) throw new ValidationError('No report found. Generate a report first.');

    // Return cached translation if locale matches
    if (existing.translatedContent && existing.translationLocale === targetLocale) {
      return existing.translatedContent;
    }

    // Generate translation
    const config = await this.aiConfigRepo.findByUser(userId);
    if (!config) throw new ValidationError('AI not configured. Please add your AI settings first.');

    const translated = await this.translateText(userId, existing.content, LOCALE_LANGUAGE[targetLocale] ?? targetLocale);
    await this.reportsRepo.saveTranslation(existing.id, translated, targetLocale);
    return translated;
  }

  async discoverTopics(
    userId: string,
    feeds: { url: string; name: string }[],
    reportType: ReportType,
    additionalRequirements: string,
    locale = 'en-US',
  ): Promise<string> {
    if (feeds.length === 0) throw new ValidationError('Select at least one RSS source.');
    const config = await this.aiConfigRepo.findByUser(userId);
    if (!config) throw new ValidationError('AI not configured. Please add your AI settings first.');

    const cutoff = timeCutoff(reportType);
    const language = LOCALE_LANGUAGE[locale] ?? 'English';

    // Gather articles from all selected feeds
    const sections: string[] = [];
    for (const feed of feeds) {
      const articles = await this.rssRepo.findArticlesByDateRange(feed.url, cutoff);
      if (articles.length === 0) continue;
      const lines = articles
        .slice(0, 40)
        .map((a, i) => `${i + 1}. ${a.title}${a.pubDate ? ` (${a.pubDate})` : ''}${a.link ? ` — ${a.link}` : ''}`);
      sections.push(`**${feed.name}**\n${lines.join('\n')}`);
    }

    if (sections.length === 0) {
      throw new ValidationError(`No articles found across the selected sources in the past ${PERIOD_LABELS[reportType]}.`);
    }

    const prompt = `You are a content strategist and trend analyst. Based on the following RSS articles from the past ${PERIOD_LABELS[reportType]}, identify the most interesting and noteworthy topics.

${sections.join('\n\n')}

Respond in ${language} with the following sections. Use EXACTLY this paragraph format for every item — a bold title followed immediately by the description on the same line, no numbered lists, no bullet points:

## 🔥 Trending Topics
Write 5–10 paragraphs. Each paragraph MUST start with **Bold Topic Title** followed by 2–3 sentences of description and inline source citations as ([Article Title](url)).

Example format:
**GPT-5 Launch** OpenAI released GPT-5 this week with major improvements in reasoning. Analysts believe this will accelerate enterprise adoption. ([Introducing GPT-5](https://openai.com/gpt-5))

## 🌱 Emerging Themes
Write 2–3 paragraphs in the same format: **Bold Theme Title** followed by description and citations.

## 💎 Hidden Gems
Write 2–3 paragraphs in the same format: **Bold Story Title** followed by description and citations.

${additionalRequirements ? `\nAdditional requirements from the user:\n${additionalRequirements}` : ''}

IMPORTANT: Every item must be a single paragraph starting with **bold title**. No numbered lists. No bullet points. No sub-headers within sections.`;

    return this.callAiApi(config, prompt);
  }

  async getReport(
    userId: string,
    feedUrl: string,
    feedName: string,
    reportType: ReportType,
    force: boolean,
    locale = 'en-US',
  ): Promise<{ content: string; cached: boolean; createdAt: string; translatedContent?: string; translationLocale?: string; reportId?: string }> {
    if (!force) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const existing = await this.reportsRepo.findRecent(userId, feedUrl, reportType, since);
      if (existing) {
        return {
          content: existing.content, cached: true, createdAt: existing.createdAt.toISOString(),
          translatedContent: existing.translatedContent ?? undefined,
          translationLocale: existing.translationLocale ?? undefined,
          reportId: existing.id,
        };
      }
    }

    // Deduplicate concurrent generation requests using a Redis lock.
    // If another request is already generating this report, wait for it to
    // finish and return from DB instead of spawning a second AI call.
    const lockKey = `ai_report_lock:${userId}:${Buffer.from(feedUrl).toString('base64url')}:${reportType}`;
    const acquired = await redis.set(lockKey, '1', 'EX', LOCK_TTL_S, 'NX');

    if (!acquired) {
      // Another request is generating — poll DB until the report appears
      const deadline = Date.now() + LOCK_WAIT_MAX_MS;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, LOCK_POLL_MS));
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const ready = await this.reportsRepo.findRecent(userId, feedUrl, reportType, since);
        if (ready) return { content: ready.content, cached: true, createdAt: ready.createdAt.toISOString() };
      }
      throw new ValidationError('Report generation is taking longer than expected. Please try again.');
    }

    const config = await this.aiConfigRepo.findByUser(userId);
    if (!config) {
      await redis.del(lockKey);
      throw new ValidationError('AI not configured. Please add your AI settings first.');
    }

    const articles = await this.rssRepo.findArticlesByDateRange(feedUrl, timeCutoff(reportType));
    const periodLabel = PERIOD_LABELS[reportType];
    if (articles.length === 0) {
      await redis.del(lockKey);
      throw new ValidationError(
        `No articles found for "${feedName}" in the past ${periodLabel}. ` +
        `Try the Weekly or Biweekly report, or wait for the feed to publish new articles.`,
      );
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

    let content: string;
    try {
      content = await this.callAiApi(config, prompt);
    } finally {
      await redis.del(lockKey);
    }

    const inserted = await this.reportsRepo.insert(userId, feedUrl, reportType, content);
    return { content, cached: false, createdAt: inserted.createdAt.toISOString(), reportId: inserted.id };
  }
}
