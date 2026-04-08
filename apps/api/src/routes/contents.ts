import type { FastifyPluginAsync } from 'fastify';
import { eq, and, inArray, gte, lte } from 'drizzle-orm';
import { db } from '../db/client.js';
import { contents } from '../db/schema/contents.js';
import { workspaces } from '../db/schema/workspaces.js';
import { ideas } from '../db/schema/ideas.js';
import { createContentSchema, updateContentSchema } from '@contentflow/shared';
import type { ContentRow } from '../db/schema/contents.js';

export const contentsRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/contents/calendar — must be before /api/contents/:id
  app.get('/api/contents/calendar', { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = req.user as { sub: string };
    const query = req.query as { from?: string; to?: string; workspace?: string };

    if (!query.from || !query.to) {
      return reply.code(400).send({ error: 'from and to query params are required' });
    }

    const fromDate = new Date(query.from);
    const toDate = new Date(query.to);

    // Build conditions — first verify workspace ownership if provided
    const conditions = [];

    if (query.workspace) {
      // Verify ownership
      const [ws] = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(and(eq(workspaces.id, query.workspace), eq(workspaces.userId, user.sub)));
      if (!ws) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      conditions.push(eq(contents.workspaceId, query.workspace));
    } else {
      // Scope to user's workspaces via subquery join
      const userWorkspaces = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.userId, user.sub));
      const wsIds = userWorkspaces.map((w) => w.id);
      if (wsIds.length === 0) return reply.send({});
      conditions.push(inArray(contents.workspaceId, wsIds));
    }

    conditions.push(gte(contents.scheduledAt, fromDate));
    conditions.push(lte(contents.scheduledAt, toDate));

    const rows = await db
      .select()
      .from(contents)
      .where(and(...conditions))
      .orderBy(contents.scheduledAt);

    // Group by date string YYYY-MM-DD
    const grouped: Record<string, ContentRow[]> = {};
    for (const row of rows) {
      if (!row.scheduledAt) continue;
      const dateStr = row.scheduledAt.toISOString().slice(0, 10);
      if (!grouped[dateStr]) grouped[dateStr] = [];
      grouped[dateStr].push(row);
    }

    return reply.send(grouped);
  });

  // POST /api/contents
  app.post('/api/contents', { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = req.user as { sub: string };
    const body = createContentSchema.parse(req.body);

    // Verify workspace belongs to user
    const [ws] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(and(eq(workspaces.id, body.workspaceId), eq(workspaces.userId, user.sub)));

    if (!ws) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const [content] = await db
      .insert(contents)
      .values({
        workspaceId: body.workspaceId,
        ideaId: body.ideaId ?? null,
        title: body.title,
        contentType: body.contentType,
        stage: 'planned',
        stageHistory: [{ stage: 'planned', timestamp: new Date().toISOString() }],
        description: body.description ?? null,
        tags: body.tags,
        targetPlatforms: body.targetPlatforms,
        scheduledAt: body.scheduledAt ?? null,
        notes: body.notes ?? null,
        attachments: [],
      })
      .returning();

    return reply.code(201).send(content);
  });

  // GET /api/contents
  app.get('/api/contents', { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = req.user as { sub: string };
    const query = req.query as { workspace?: string; stage?: string };

    if (!query.workspace) {
      return reply.code(400).send({ error: 'workspace query param is required' });
    }

    // Verify workspace belongs to user
    const [ws] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(and(eq(workspaces.id, query.workspace), eq(workspaces.userId, user.sub)));

    if (!ws) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const conditions = [eq(contents.workspaceId, query.workspace)];

    if (query.stage) {
      const stages = query.stage.split(',').map((s) => s.trim()).filter(Boolean);
      if (stages.length === 1) {
        conditions.push(eq(contents.stage, stages[0]!));
      } else if (stages.length > 1) {
        conditions.push(inArray(contents.stage, stages));
      }
    }

    const rows = await db
      .select()
      .from(contents)
      .where(and(...conditions))
      .orderBy(contents.updatedAt);

    return reply.send(rows.reverse());
  });

  // DELETE /api/contents/:id
  app.delete('/api/contents/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = req.user as { sub: string };
    const { id } = req.params as { id: string };

    const [existing] = await db
      .select({ id: contents.id, workspaceId: contents.workspaceId })
      .from(contents)
      .where(eq(contents.id, id));

    if (!existing) {
      return reply.code(404).send({ error: 'Content not found' });
    }

    const [ws] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(and(eq(workspaces.id, existing.workspaceId), eq(workspaces.userId, user.sub)));

    if (!ws) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    await db.delete(contents).where(eq(contents.id, id));
    return reply.code(204).send();
  });

  // PATCH /api/contents/:id
  app.patch('/api/contents/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = req.user as { sub: string };
    const { id } = req.params as { id: string };
    const body = updateContentSchema.parse(req.body);

    // Verify content's workspace belongs to user
    const [existing] = await db
      .select({ id: contents.id, workspaceId: contents.workspaceId })
      .from(contents)
      .where(eq(contents.id, id));

    if (!existing) {
      return reply.code(404).send({ error: 'Content not found' });
    }

    const [ws] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(and(eq(workspaces.id, existing.workspaceId), eq(workspaces.userId, user.sub)));

    if (!ws) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const updateData: Partial<typeof contents.$inferInsert> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description ?? null;
    if (body.contentType !== undefined) updateData.contentType = body.contentType;
    if (body.stage !== undefined) {
      updateData.stage = body.stage;
      updateData.updatedAt = new Date();
      // Append to stage history
      const [current] = await db.select({ stageHistory: contents.stageHistory }).from(contents).where(eq(contents.id, id));
      const history = (current?.stageHistory as { stage: string; timestamp: string }[] ?? []);
      history.push({ stage: body.stage, timestamp: new Date().toISOString() });
      updateData.stageHistory = history;
    }
    if (body.stageHistory !== undefined) {
      const entries = body.stageHistory as { stage: string; timestamp: string }[];
      const sorted = [...entries].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      for (let i = 1; i < sorted.length; i++) {
        if (new Date(sorted[i].timestamp).getTime() <= new Date(sorted[i - 1].timestamp).getTime()) {
          return reply.code(400).send({ error: 'Timeline entries must be in chronological order' });
        }
      }
      updateData.stageHistory = entries;
    }
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.targetPlatforms !== undefined) updateData.targetPlatforms = body.targetPlatforms;
    if (body.scheduledAt !== undefined) updateData.scheduledAt = body.scheduledAt ?? null;
    if (body.notes !== undefined) updateData.notes = body.notes ?? null;
    if (body.reviewNotes !== undefined) updateData.reviewNotes = body.reviewNotes ?? null;

    const [updated] = await db
      .update(contents)
      .set(updateData)
      .where(eq(contents.id, id))
      .returning();

    if (!updated) {
      return reply.code(404).send({ error: 'Content not found' });
    }

    // When content is archived, also archive the idea that converted to it
    if (body.stage === 'archived') {
      await db
        .update(ideas)
        .set({ status: 'archived' })
        .where(and(eq(ideas.convertedTo, id), eq(ideas.userId, user.sub)));
    }

    return reply.send(updated);
  });
};
