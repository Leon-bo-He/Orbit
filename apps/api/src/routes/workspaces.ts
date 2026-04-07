import type { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { workspaces } from '../db/schema/workspaces.js';
import { createWorkspaceSchema } from '@contentflow/shared';

const NI = { error: 'Not implemented' };

export const workspacesRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/workspaces
  app.post('/api/workspaces', { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = req.user as { sub: string };
    const body = createWorkspaceSchema.parse(req.body);

    const [workspace] = await db
      .insert(workspaces)
      .values({
        userId: user.sub,
        name: body.name,
        icon: body.icon,
        color: body.color,
        platform: body.platform,
        contentType: body.contentType,
        defaultLocale: body.defaultLocale,
        timezone: body.timezone,
        publishGoal: body.publishGoal ?? null,
        stageConfig: [],
      })
      .returning();

    return reply.code(201).send(workspace);
  });

  // GET /api/workspaces
  app.get('/api/workspaces', { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = req.user as { sub: string };

    const rows = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.userId, user.sub))
      .orderBy(workspaces.createdAt);

    return reply.send(rows);
  });

  app.patch('/api/workspaces/:id', { onRequest: [app.authenticate] }, async (_r, reply) => reply.code(501).send(NI));
  app.post('/api/workspaces/:id/plan-templates', { onRequest: [app.authenticate] }, async (_r, reply) => reply.code(501).send(NI));
  app.get('/api/workspaces/:id/plan-templates', { onRequest: [app.authenticate] }, async (_r, reply) => reply.code(501).send(NI));
};
