import type { FastifyInstance } from 'fastify';
import type { AiService, ReportType } from '../../../domain/ai/ai.service.js';

const VALID_TYPES = new Set<ReportType>(['daily', 'weekly', 'biweekly']);

export function aiRoutes(app: FastifyInstance, svc: AiService) {
  app.get('/api/ai-config', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    return reply.send(await svc.getConfig(sub));
  });

  app.put('/api/ai-config', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { baseUrl, apiKey, model } = req.body as { baseUrl?: string; apiKey?: string; model?: string };
    if (!baseUrl?.trim() || !apiKey?.trim()) {
      return reply.code(400).send({ error: 'baseUrl and apiKey are required' });
    }
    await svc.saveConfig(sub, {
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
      model: (model?.trim() || 'gpt-5.4'),
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

    return reply.send(
      await svc.getReport(sub, feedUrl, feedName, reportType as ReportType, force ?? false),
    );
  });
}
