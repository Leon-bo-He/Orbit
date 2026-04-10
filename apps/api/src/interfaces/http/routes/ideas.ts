import type { FastifyInstance } from 'fastify';
import { createIdeaSchema, updateIdeaSchema } from '@orbit/shared';
import type { IdeaService } from '../../../domain/idea/idea.service.js';

export function ideasRoutes(app: FastifyInstance, svc: IdeaService) {
  app.post('/api/ideas', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const body = createIdeaSchema.parse(req.body);
    const idea = await svc.create(sub, {
      workspaceId: body.workspaceId ?? null,
      title: body.title,
      note: body.note ?? null,
      tags: body.tags,
      priority: body.priority,
      attachments: body.attachments,
    });
    return reply.code(201).send(idea);
  });

  app.get('/api/ideas', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const q = req.query as { workspace?: string; status?: string; priority?: string; q?: string };
    const filters: Parameters<IdeaService['list']>[1] = {};
    if (q.workspace !== undefined) filters.workspaceId = q.workspace as string | 'global';
    if (q.status !== undefined) filters.status = q.status;
    if (q.priority !== undefined) filters.priority = q.priority;
    if (q.q !== undefined) filters.q = q.q;
    return reply.send(await svc.list(sub, filters));
  });

  app.get('/api/ideas/archived/export', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const q = req.query as { workspace?: string; from?: string; to?: string };
    const filters: Parameters<IdeaService['exportArchived']>[1] = {};
    if (q.workspace !== undefined) filters.workspaceId = q.workspace as string | 'global';
    if (q.from) filters.from = new Date(q.from);
    if (q.to) filters.to = new Date(q.to);
    return reply.send(await svc.exportArchived(sub, filters));
  });

  app.delete('/api/ideas/archived', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const q = req.query as { workspace?: string; from?: string; to?: string };
    const filters: Parameters<IdeaService['deleteArchived']>[1] = {};
    if (q.workspace !== undefined) filters.workspaceId = q.workspace as string | 'global';
    if (q.from) filters.from = new Date(q.from);
    if (q.to) filters.to = new Date(q.to);
    const deleted = await svc.deleteArchived(sub, filters);
    return reply.send({ deleted });
  });

  app.patch('/api/ideas/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id } = req.params as { id: string };
    const body = updateIdeaSchema.parse(req.body);
    return reply.send(await svc.update(sub, id, body as Parameters<IdeaService['update']>[2]));
  });

  app.post('/api/ideas/:id/convert', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id } = req.params as { id: string };
    const { workspaceId, title, contentType } = req.body as { workspaceId: string; title?: string; contentType?: string };
    return reply.send(await svc.convert(sub, id, workspaceId, title, contentType));
  });
}
