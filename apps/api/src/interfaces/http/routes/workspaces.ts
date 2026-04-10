import type { FastifyInstance } from 'fastify';
import { createWorkspaceSchema, updateWorkspaceSchema } from '@orbit/shared';
import type { WorkspaceService } from '../../../domain/workspace/workspace.service.js';

export function workspacesRoutes(app: FastifyInstance, svc: WorkspaceService) {
  app.post('/api/workspaces', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const body = createWorkspaceSchema.parse(req.body);
    const ws = await svc.create(sub, {
      name: body.name,
      icon: body.icon,
      color: body.color,
      about: body.about ?? null,
      publishGoal: body.publishGoal,
    });
    return reply.code(201).send(ws);
  });

  app.get('/api/workspaces', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    return reply.send(await svc.list(sub));
  });

  app.patch('/api/workspaces/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id } = req.params as { id: string };
    const body = updateWorkspaceSchema.parse(req.body);
    const patch: Parameters<WorkspaceService['update']>[2] = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.icon !== undefined) patch.icon = body.icon;
    if (body.about !== undefined) patch.about = body.about ?? null;
    if (body.publishGoal !== undefined) patch.publishGoal = body.publishGoal;
    if (body.stageConfig !== undefined) patch.stageConfig = body.stageConfig;
    return reply.send(await svc.update(sub, id, patch));
  });
}
