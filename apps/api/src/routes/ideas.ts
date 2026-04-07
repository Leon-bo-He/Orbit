import type { FastifyPluginAsync } from 'fastify';
import { eq, and, ilike, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { ideas } from '../db/schema/ideas.js';
import { contents } from '../db/schema/contents.js';
import { createIdeaSchema, updateIdeaSchema } from '@contentflow/shared';

export const ideasRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/ideas
  app.post('/api/ideas', { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = req.user as { sub: string };
    const body = createIdeaSchema.parse(req.body);

    const [idea] = await db
      .insert(ideas)
      .values({
        userId: user.sub,
        workspaceId: body.workspaceId ?? null,
        title: body.title,
        note: body.note ?? null,
        tags: body.tags,
        priority: body.priority,
        attachments: body.attachments,
      })
      .returning();

    return reply.code(201).send(idea);
  });

  // GET /api/ideas
  app.get('/api/ideas', { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = req.user as { sub: string };
    const query = req.query as {
      workspace?: string;
      status?: string;
      tag?: string;
      priority?: string;
      q?: string;
    };

    const conditions = [eq(ideas.userId, user.sub)];

    if (query.workspace === 'global') {
      conditions.push(isNull(ideas.workspaceId));
    } else if (query.workspace) {
      conditions.push(eq(ideas.workspaceId, query.workspace));
    }

    if (query.status) {
      conditions.push(eq(ideas.status, query.status));
    }

    if (query.priority) {
      conditions.push(eq(ideas.priority, query.priority));
    }

    if (query.q) {
      conditions.push(ilike(ideas.title, `%${query.q}%`));
    }

    const rows = await db
      .select()
      .from(ideas)
      .where(and(...conditions))
      .orderBy(ideas.createdAt);

    // Return newest first
    return reply.send(rows.reverse());
  });

  // PATCH /api/ideas/:id
  app.patch('/api/ideas/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = req.user as { sub: string };
    const { id } = req.params as { id: string };
    const body = updateIdeaSchema.parse(req.body);

    const updateData: Partial<typeof ideas.$inferInsert> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.note !== undefined) updateData.note = body.note ?? null;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.attachments !== undefined) updateData.attachments = body.attachments;
    if (body.status !== undefined) updateData.status = body.status;
    if ('workspaceId' in body) updateData.workspaceId = body.workspaceId ?? null;

    const [updated] = await db
      .update(ideas)
      .set(updateData)
      .where(and(eq(ideas.id, id), eq(ideas.userId, user.sub)))
      .returning();

    if (!updated) {
      return reply.code(404).send({ error: 'Idea not found' });
    }

    return reply.send(updated);
  });

  // POST /api/ideas/:id/convert
  app.post('/api/ideas/:id/convert', { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = req.user as { sub: string };
    const { id } = req.params as { id: string };
    const body = req.body as { workspaceId: string; title?: string; contentType?: string };

    // Find the idea first
    const [idea] = await db
      .select()
      .from(ideas)
      .where(and(eq(ideas.id, id), eq(ideas.userId, user.sub)));

    if (!idea) {
      return reply.code(404).send({ error: 'Idea not found' });
    }

    // Create content record
    const [content] = await db
      .insert(contents)
      .values({
        workspaceId: body.workspaceId,
        ideaId: id,
        title: body.title ?? idea.title,
        contentType: body.contentType ?? 'article',
        stage: 'planned',
        tags: idea.tags,
        targetPlatforms: [],
        locale: 'zh-CN',
        localeVariants: [],
        attachments: [],
      })
      .returning();

    // Update idea status
    const [updatedIdea] = await db
      .update(ideas)
      .set({ status: 'converted', convertedTo: content!.id })
      .where(eq(ideas.id, id))
      .returning();

    return reply.send({ idea: updatedIdea, content });
  });
};
