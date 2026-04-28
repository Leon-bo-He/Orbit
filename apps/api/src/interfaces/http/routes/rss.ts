import type { FastifyInstance } from 'fastify';
import type { RssService } from '../../../domain/rss/rss.service.js';

export function rssRoutes(app: FastifyInstance, svc: RssService) {
  app.get('/api/rss', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { url, page } = req.query as { url?: string; page?: string };
    if (!url) return reply.code(400).send({ error: 'url query parameter is required' });

    try {
      new URL(url);
    } catch {
      return reply.code(400).send({ error: 'Invalid URL' });
    }

    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    return reply.send(await svc.getFeed(url, pageNum));
  });

  app.delete('/api/rss', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { url } = req.query as { url?: string };
    if (!url) return reply.code(400).send({ error: 'url query parameter is required' });
    await svc.deleteFeed(url);
    return reply.code(204).send();
  });
}
