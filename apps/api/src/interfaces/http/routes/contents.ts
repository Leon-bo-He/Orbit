import type { FastifyInstance } from 'fastify';
import { createContentSchema, updateContentSchema } from '@orbit/shared';
import type { ContentService } from '../../../domain/content/content.service.js';
import type { IdeaService } from '../../../domain/idea/idea.service.js';
import type { WorkspaceService } from '../../../domain/workspace/workspace.service.js';

export function contentsRoutes(
  app: FastifyInstance,
  contentSvc: ContentService,
  workspaceSvc: WorkspaceService,
  ideaSvc: IdeaService,
) {
  // GET /api/contents/calendar — must precede /:id routes
  app.get('/api/contents/calendar', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const q = req.query as { from?: string; to?: string; workspace?: string };
    if (!q.from || !q.to) return reply.code(400).send({ error: 'from and to query params are required' });

    const getWorkspaceIds = async () => {
      const list = await workspaceSvc.list(sub);
      return list.map((w) => w.id);
    };

    if (q.workspace) await workspaceSvc.verifyOwnership(q.workspace, sub);

    const grouped = await contentSvc.getCalendar(
      sub,
      new Date(q.from),
      new Date(q.to),
      q.workspace,
      q.workspace ? undefined : getWorkspaceIds,
    );
    return reply.send(grouped);
  });

  // GET /api/contents/archived/export — must precede /:id routes
  app.get('/api/contents/archived/export', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const q = req.query as { workspace?: string; from?: string; to?: string; includeIdeas?: string };

    let wsIds: string[];
    if (q.workspace) {
      await workspaceSvc.verifyOwnership(q.workspace, sub);
      wsIds = [q.workspace];
    } else {
      const list = await workspaceSvc.list(sub);
      wsIds = list.map((w) => w.id);
      if (wsIds.length === 0) return reply.send([]);
    }

    const filters: { from?: Date; to?: Date } = {};
    if (q.from) filters.from = new Date(q.from);
    if (q.to) filters.to = new Date(q.to);
    const rows = await contentSvc.getArchivedExport(wsIds, filters);

    if (q.includeIdeas === 'true') {
      const linkedIdeas = await ideaSvc.exportArchived(sub, {});
      const contentIds = new Set(rows.map((r) => r.id));
      return reply.send({ contents: rows, ideas: linkedIdeas.filter((i) => i.convertedTo && contentIds.has(i.convertedTo)) });
    }
    return reply.send(rows);
  });

  // DELETE /api/contents/archived
  app.delete('/api/contents/archived', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const q = req.query as { workspace?: string; from?: string; to?: string; includeIdeas?: string };

    let wsIds: string[];
    if (q.workspace) {
      await workspaceSvc.verifyOwnership(q.workspace, sub);
      wsIds = [q.workspace];
    } else {
      const list = await workspaceSvc.list(sub);
      wsIds = list.map((w) => w.id);
      if (wsIds.length === 0) return reply.send({ deleted: 0 });
    }

    const filters: { from?: Date; to?: Date } = {};
    if (q.from) filters.from = new Date(q.from);
    if (q.to) filters.to = new Date(q.to);
    const deletedIds = await contentSvc.deleteArchived(wsIds, filters);

    if (q.includeIdeas === 'true' && deletedIds.length > 0) {
      await ideaSvc.deleteArchived(sub, {});
    }

    return reply.send({ deleted: deletedIds.length });
  });

  // POST /api/contents
  app.post('/api/contents', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const body = createContentSchema.parse(req.body);
    await workspaceSvc.verifyOwnership(body.workspaceId, sub);
    const content = await contentSvc.create({
      workspaceId: body.workspaceId,
      ideaId: body.ideaId ?? null,
      title: body.title,
      contentType: body.contentType,
      description: body.description ?? null,
      tags: body.tags,
      targetPlatforms: body.targetPlatforms,
      scheduledAt: body.scheduledAt ?? null,
      notes: body.notes ?? null,
    });
    return reply.code(201).send(content);
  });

  // GET /api/contents
  app.get('/api/contents', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const q = req.query as { workspace?: string; stage?: string };
    if (!q.workspace) return reply.code(400).send({ error: 'workspace query param is required' });
    await workspaceSvc.verifyOwnership(q.workspace, sub);
    const listFilters: { stage?: string } = {};
    if (q.stage) listFilters.stage = q.stage;
    return reply.send(await contentSvc.list(q.workspace, listFilters));
  });

  // DELETE /api/contents/:id
  app.delete('/api/contents/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id } = req.params as { id: string };
    await contentSvc.delete(id, sub);
    return reply.code(204).send();
  });

  // PATCH /api/contents/:id
  app.patch('/api/contents/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id } = req.params as { id: string };
    const body = updateContentSchema.parse(req.body);

    const { updated, previousStage } = await contentSvc.update(id, sub, body as Parameters<ContentService['update']>[2]);

    // Sync linked idea status on archive/unarchive
    if (body.stage === 'archived') {
      await ideaSvc.syncStatusByContentId(id, sub, 'archived');
    } else if (body.stage !== undefined && previousStage === 'archived') {
      await ideaSvc.syncStatusByContentId(id, sub, 'converted');
    }

    return reply.send(updated);
  });
}
