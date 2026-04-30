import type { FastifyInstance } from 'fastify';
import type { AiService, ReportType } from '../../../domain/ai/ai.service.js';
import type { UserService } from '../../../domain/user/user.service.js';

const VALID_TYPES = new Set<ReportType>(['daily', 'weekly', 'biweekly']);

export function aiRoutes(app: FastifyInstance, svc: AiService, userSvc: UserService) {
  app.get('/api/ai-config', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    return reply.send(await svc.getConfig(sub));
  });

  app.put('/api/ai-config', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { baseUrl, apiKey, model } = req.body as { baseUrl?: string; apiKey?: string; model?: string };
    if (!baseUrl?.trim()) {
      return reply.code(400).send({ error: 'baseUrl is required' });
    }
    const existing = await svc.getConfig(sub);
    if (!apiKey?.trim() && !existing) {
      return reply.code(400).send({ error: 'apiKey is required for initial setup' });
    }
    const trimmedKey = apiKey?.trim();
    await svc.saveConfig(sub, {
      baseUrl: baseUrl.trim(),
      ...(trimmedKey && { apiKey: trimmedKey }),
      model: model?.trim() || 'gpt-5.4',
    });
    return reply.code(204).send();
  });

  app.post('/api/ai-config/test', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { baseUrl, apiKey, model } = (req.body ?? {}) as {
      baseUrl?: string; apiKey?: string; model?: string;
    };
    return reply.send(await svc.testConnection(sub, {
      ...(baseUrl !== undefined && { baseUrl }),
      ...(apiKey !== undefined && { apiKey }),
      ...(model !== undefined && { model }),
    }));
  });

  app.post('/api/ai-translate-text', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { text, targetLanguage } = req.body as { text?: string; targetLanguage?: string };
    if (!text?.trim()) return reply.code(400).send({ error: 'text is required' });
    const translated = await svc.translateText(sub, text, targetLanguage ?? 'English');
    return reply.send({ translated });
  });

  app.post('/api/ai-translate', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { titles, targetLanguage } = req.body as { titles?: string[]; targetLanguage?: string };
    if (!Array.isArray(titles) || titles.length === 0) {
      return reply.code(400).send({ error: 'titles must be a non-empty array' });
    }
    const translations = await svc.translateTitles(sub, titles, targetLanguage ?? 'English');
    return reply.send({ translations });
  });

  app.post('/api/ai-topic-discover', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { feeds, reportType, additionalRequirements, selectedReports } = req.body as {
      feeds?: { url: string; name: string }[];
      reportType?: string;
      additionalRequirements?: string;
      selectedReports?: { feedUrl: string; reportType: string }[];
    };
    if (!Array.isArray(feeds) || feeds.length === 0) {
      return reply.code(400).send({ error: 'feeds must be a non-empty array' });
    }
    if (!VALID_TYPES.has(reportType as ReportType)) {
      return reply.code(400).send({ error: 'reportType must be daily, weekly, or biweekly' });
    }
    const user = await userSvc.findById(sub);
    const content = await svc.discoverTopics(
      sub,
      feeds,
      reportType as ReportType,
      additionalRequirements?.trim() ?? '',
      user?.locale,
      selectedReports ?? [],
    );
    return reply.send({ content });
  });

  // Read cached report without generating — returns 404 if none exists within 24h
  app.get('/api/rss-reports', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { feedUrl, reportType } = req.query as { feedUrl?: string; reportType?: string };
    if (!feedUrl || !reportType || !VALID_TYPES.has(reportType as ReportType)) {
      return reply.code(400).send({ error: 'feedUrl and valid reportType are required' });
    }
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existing = await svc.findCachedReport(sub, feedUrl, reportType as ReportType, since);
    if (!existing) return reply.code(404).send({ error: 'No cached report found' });
    return reply.send(existing);
  });

  app.post('/api/rss-reports/translate', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { feedUrl, reportType, targetLocale } = req.body as {
      feedUrl?: string; reportType?: string; targetLocale?: string;
    };
    if (!feedUrl || !reportType || !targetLocale) {
      return reply.code(400).send({ error: 'feedUrl, reportType, and targetLocale are required' });
    }
    if (!VALID_TYPES.has(reportType as ReportType)) {
      return reply.code(400).send({ error: 'Invalid reportType' });
    }
    const translated = await svc.getOrGenerateTranslation(sub, feedUrl, reportType as ReportType, targetLocale);
    return reply.send({ translated });
  });

  app.post('/api/rss-reports', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { feedUrl, feedName, reportType, force } = req.body as {
      feedUrl?: string;
      feedName?: string;
      reportType?: string;
      force?: boolean;
    };

    if (!feedUrl || !feedName || !reportType) {
      return reply.code(400).send({ error: 'feedUrl, feedName, and reportType are required' });
    }
    if (!VALID_TYPES.has(reportType as ReportType)) {
      return reply.code(400).send({ error: 'reportType must be daily, weekly, or biweekly' });
    }

    const user = await userSvc.findById(sub);

    if (force) {
      // Fire-and-forget: detach from request lifecycle so closing the window
      // doesn't cancel the AI call. The result is saved to DB; client polls.
      setImmediate(() => {
        void svc.getReport(sub, feedUrl, feedName, reportType as ReportType, true, user?.locale)
          .catch((err: unknown) => {
            app.log.error({ err }, '[AI] Background report generation failed');
          });
      });
      return reply.code(202).send({ generating: true });
    }

    return reply.send(
      await svc.getReport(sub, feedUrl, feedName, reportType as ReportType, false, user?.locale),
    );
  });
}
