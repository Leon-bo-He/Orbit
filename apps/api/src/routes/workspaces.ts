import type { FastifyPluginAsync } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { workspaces } from '../db/schema/workspaces.js';
import { createWorkspaceSchema, updateWorkspaceSchema } from '@contentflow/shared';

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

  // PATCH /api/workspaces/:id
  app.patch('/api/workspaces/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = req.user as { sub: string };
    const { id } = req.params as { id: string };
    const body = updateWorkspaceSchema.parse(req.body);

    const updateData: Partial<typeof workspaces.$inferInsert> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.icon !== undefined) updateData.icon = body.icon;
    if (body.publishGoal !== undefined) updateData.publishGoal = body.publishGoal ?? null;
    if (body.defaultLocale !== undefined) updateData.defaultLocale = body.defaultLocale;
    if (body.timezone !== undefined) updateData.timezone = body.timezone;
    if (body.stageConfig !== undefined) updateData.stageConfig = body.stageConfig;

    const [updated] = await db
      .update(workspaces)
      .set(updateData)
      .where(and(eq(workspaces.id, id), eq(workspaces.userId, user.sub)))
      .returning();

    if (!updated) {
      return reply.code(404).send({ error: 'Workspace not found' });
    }

    return reply.send(updated);
  });

};
