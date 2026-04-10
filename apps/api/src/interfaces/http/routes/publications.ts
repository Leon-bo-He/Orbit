import type { FastifyInstance } from 'fastify';
import {
  createPublicationSchema,
  updatePublicationSchema,
  markPublishedSchema,
  batchUpdatePublicationsSchema,
} from '@orbit/shared';
import type { PublicationService } from '../../../domain/publication/publication.service.js';
import type { ContentService } from '../../../domain/content/content.service.js';

export function publicationsRoutes(
  app: FastifyInstance,
  pubSvc: PublicationService,
  contentSvc: ContentService,
) {
  // GET /api/publications/queue
  app.get('/api/publications/queue', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const q = req.query as { status?: string; from?: string; to?: string };
    return reply.send(await pubSvc.getQueue(sub, q));
  });

  // PATCH /api/publications/batch
  app.patch('/api/publications/batch', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const body = batchUpdatePublicationsSchema.parse(req.body);
    const batchData: Parameters<PublicationService['batchUpdate']>[2] = {};
    if (body.scheduledAt !== undefined) batchData.scheduledAt = body.scheduledAt ?? null;
    if (body.status !== undefined) batchData.status = body.status;
    const updated = await pubSvc.batchUpdate(sub, body.ids, batchData);
    return reply.send({ updated });
  });

  // POST /api/contents/:id/publications
  app.post('/api/contents/:id/publications', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id: contentId } = req.params as { id: string };
    await contentSvc.verifyOwnership(contentId, sub);
    const body = createPublicationSchema.parse(req.body);
    const pub = await pubSvc.create(contentId, {
      platform: body.platform,
      platformTitle: body.platformTitle ?? null,
      platformCopy: body.platformCopy ?? null,
      platformTags: body.platformTags,
      coverUrl: body.coverUrl ?? null,
      platformSettings: body.platformSettings,
      scheduledAt: body.scheduledAt ?? null,
    });
    return reply.code(201).send(pub);
  });

  // GET /api/contents/:id/publications
  app.get('/api/contents/:id/publications', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id: contentId } = req.params as { id: string };
    return reply.send(await pubSvc.listByContent(contentId, sub));
  });

  // PATCH /api/publications/:id
  app.patch('/api/publications/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id } = req.params as { id: string };
    const body = updatePublicationSchema.parse(req.body);
    const updateData: Parameters<PublicationService['update']>[2] = {};
    if (body.platformTitle) updateData.platformTitle = body.platformTitle;
    if (body.platformCopy) updateData.platformCopy = body.platformCopy;
    if (body.platformTags !== undefined) updateData.platformTags = body.platformTags;
    if (body.coverUrl !== undefined) updateData.coverUrl = body.coverUrl ?? null;
    if (body.platformSettings !== undefined) updateData.platformSettings = body.platformSettings;
    if (body.scheduledAt !== undefined) updateData.scheduledAt = body.scheduledAt ?? null;
    if (body.status !== undefined) updateData.status = body.status;
    return reply.send(await pubSvc.update(sub, id, updateData));
  });

  // DELETE /api/publications/:id
  app.delete('/api/publications/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id } = req.params as { id: string };
    await pubSvc.delete(sub, id);
    return reply.code(204).send();
  });

  // POST /api/publications/:id/mark-published
  app.post('/api/publications/:id/mark-published', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id } = req.params as { id: string };
    const body = markPublishedSchema.parse(req.body);
    const markData: Parameters<PublicationService['markPublished']>[2] = {
      platformUrl: body.platformUrl,
      platformPostId: body.platformPostId ?? null,
    };
    if (body.publishedAt) markData.publishedAt = body.publishedAt;
    const { updated, contentId, publishedAt } = await pubSvc.markPublished(sub, id, markData);
    await contentSvc.stampPublishedAt(contentId, publishedAt);
    return reply.send(updated);
  });
}
