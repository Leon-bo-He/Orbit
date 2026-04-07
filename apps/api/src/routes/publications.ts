import type { FastifyPluginAsync } from 'fastify';
import { eq, and, inArray, gte, lte } from 'drizzle-orm';
import { db } from '../db/client.js';
import { publications } from '../db/schema/publications.js';
import { contents } from '../db/schema/contents.js';
import { workspaces } from '../db/schema/workspaces.js';
import {
  createPublicationSchema,
  updatePublicationSchema,
  markPublishedSchema,
  batchUpdatePublicationsSchema,
} from '@contentflow/shared';
import type { PublishLogEntry } from '@contentflow/shared';

/** Helper: verify that a content's workspace belongs to the current user */
async function verifyContentOwnership(
  contentId: string,
  userId: string,
): Promise<{ contentId: string; workspaceId: string } | null> {
  const [row] = await db
    .select({ contentId: contents.id, workspaceId: contents.workspaceId })
    .from(contents)
    .innerJoin(workspaces, eq(contents.workspaceId, workspaces.id))
    .where(and(eq(contents.id, contentId), eq(workspaces.userId, userId)));
  return row ?? null;
}

/** Helper: verify that a publication belongs to the current user */
async function verifyPublicationOwnership(
  publicationId: string,
  userId: string,
): Promise<{ publicationId: string; contentId: string; workspaceId: string } | null> {
  const [row] = await db
    .select({
      publicationId: publications.id,
      contentId: publications.contentId,
      workspaceId: contents.workspaceId,
    })
    .from(publications)
    .innerJoin(contents, eq(publications.contentId, contents.id))
    .innerJoin(workspaces, eq(contents.workspaceId, workspaces.id))
    .where(and(eq(publications.id, publicationId), eq(workspaces.userId, userId)));
  return row ?? null;
}

export const publicationsRoutes: FastifyPluginAsync = async (app) => {
  // ------------------------------------------------------------------ //
  // Static-path routes MUST come before /:id routes to avoid conflicts   //
  // ------------------------------------------------------------------ //

  // GET /api/publications/queue
  app.get('/api/publications/queue', { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = req.user as { sub: string };
    const query = req.query as {
      status?: string;
      from?: string;
      to?: string;
    };

    const statusFilter = (query.status ?? 'queued,ready')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const fromDate = query.from ? new Date(query.from) : new Date();
    const toDate = query.to
      ? new Date(query.to)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Fetch all publications in range, joining to contents and workspaces
    const rows = await db
      .select({
        publication: publications,
        contentId: contents.id,
        contentTitle: contents.title,
        workspaceId: workspaces.id,
        workspaceName: workspaces.name,
        workspaceColor: workspaces.color,
        workspaceIcon: workspaces.icon,
        workspaceUserId: workspaces.userId,
      })
      .from(publications)
      .innerJoin(contents, eq(publications.contentId, contents.id))
      .innerJoin(workspaces, eq(contents.workspaceId, workspaces.id))
      .where(
        and(
          eq(workspaces.userId, user.sub),
          statusFilter.length === 1
            ? eq(publications.status, statusFilter[0]!)
            : inArray(publications.status, statusFilter),
          gte(publications.scheduledAt, fromDate),
          lte(publications.scheduledAt, toDate),
        ),
      )
      .orderBy(publications.scheduledAt);

    const result = rows.map((r) => ({
      publication: r.publication,
      content: { id: r.contentId, title: r.contentTitle },
      workspace: {
        id: r.workspaceId,
        name: r.workspaceName,
        color: r.workspaceColor,
        icon: r.workspaceIcon,
      },
    }));

    return reply.send(result);
  });

  // PATCH /api/publications/batch
  app.patch('/api/publications/batch', { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = req.user as { sub: string };
    const body = batchUpdatePublicationsSchema.parse(req.body);

    // Verify all publications belong to user
    const owned = await db
      .select({ id: publications.id })
      .from(publications)
      .innerJoin(contents, eq(publications.contentId, contents.id))
      .innerJoin(workspaces, eq(contents.workspaceId, workspaces.id))
      .where(
        and(
          inArray(publications.id, body.ids),
          eq(workspaces.userId, user.sub),
        ),
      );

    if (owned.length !== body.ids.length) {
      return reply.code(403).send({ error: 'Forbidden: some publications do not belong to you' });
    }

    const updateData: Partial<typeof publications.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.scheduledAt !== undefined) updateData.scheduledAt = body.scheduledAt;
    if (body.status !== undefined) updateData.status = body.status;

    await db
      .update(publications)
      .set(updateData)
      .where(inArray(publications.id, body.ids));

    return reply.send({ updated: body.ids.length });
  });

  // ------------------------------------------------------------------ //
  // Content-scoped routes                                               //
  // ------------------------------------------------------------------ //

  // POST /api/contents/:id/publications
  app.post('/api/contents/:id/publications', { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = req.user as { sub: string };
    const { id: contentId } = req.params as { id: string };

    const ownership = await verifyContentOwnership(contentId, user.sub);
    if (!ownership) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const body = createPublicationSchema.parse(req.body);

    // Determine initial status
    const hasRequiredFields = Boolean(body.scheduledAt && body.platform);
    const initialStatus = hasRequiredFields ? 'queued' : 'draft';

    const [pub] = await db
      .insert(publications)
      .values({
        contentId,
        platform: body.platform,
        platformTitle: body.platformTitle ?? null,
        platformCopy: body.platformCopy ?? null,
        platformTags: body.platformTags ?? [],
        coverUrl: body.coverUrl ?? null,
        platformSettings: body.platformSettings ?? {},
        scheduledAt: body.scheduledAt ?? null,
        status: initialStatus,
        publishLog: [],
      })
      .returning();

    return reply.code(201).send(pub);
  });

  // GET /api/contents/:id/publications
  app.get('/api/contents/:id/publications', { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = req.user as { sub: string };
    const { id: contentId } = req.params as { id: string };

    const ownership = await verifyContentOwnership(contentId, user.sub);
    if (!ownership) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const rows = await db
      .select()
      .from(publications)
      .where(eq(publications.contentId, contentId))
      .orderBy(publications.createdAt);

    return reply.send(rows);
  });

  // ------------------------------------------------------------------ //
  // Publication-level routes — /:id must come AFTER /queue and /batch   //
  // ------------------------------------------------------------------ //

  // PATCH /api/publications/:id
  app.patch('/api/publications/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = req.user as { sub: string };
    const { id } = req.params as { id: string };

    const ownership = await verifyPublicationOwnership(id, user.sub);
    if (!ownership) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const body = updatePublicationSchema.parse(req.body);

    // Fetch current publication
    const [current] = await db
      .select()
      .from(publications)
      .where(eq(publications.id, id));

    if (!current) {
      return reply.code(404).send({ error: 'Publication not found' });
    }

    // Append to publishLog
    const existingLog = (current.publishLog ?? []) as PublishLogEntry[];
    const newLog: PublishLogEntry[] = [
      ...existingLog,
      { action: 'updated', timestamp: new Date().toISOString(), note: 'fields updated' },
    ];

    const updateData: Partial<typeof publications.$inferInsert> = {
      updatedAt: new Date(),
      publishLog: newLog,
    };

    if (body.platformTitle !== undefined) updateData.platformTitle = body.platformTitle;
    if (body.platformCopy !== undefined) updateData.platformCopy = body.platformCopy;
    if (body.platformTags !== undefined) updateData.platformTags = body.platformTags;
    if (body.coverUrl !== undefined) updateData.coverUrl = body.coverUrl;
    if (body.platformSettings !== undefined) updateData.platformSettings = body.platformSettings;
    if (body.scheduledAt !== undefined) updateData.scheduledAt = body.scheduledAt;
    if (body.status !== undefined) updateData.status = body.status;

    // Auto-advance: draft → queued if scheduledAt + platform are now present
    const nextScheduledAt = body.scheduledAt !== undefined ? body.scheduledAt : current.scheduledAt;
    const nextStatus = body.status ?? current.status;
    if (nextStatus === 'draft' && nextScheduledAt && current.platform) {
      updateData.status = 'queued';
    }

    const [updated] = await db
      .update(publications)
      .set(updateData)
      .where(eq(publications.id, id))
      .returning();

    return reply.send(updated);
  });

  // POST /api/publications/:id/mark-published
  app.post('/api/publications/:id/mark-published', { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = req.user as { sub: string };
    const { id } = req.params as { id: string };

    const ownership = await verifyPublicationOwnership(id, user.sub);
    if (!ownership) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const body = markPublishedSchema.parse(req.body);

    // Fetch current publication
    const [current] = await db
      .select()
      .from(publications)
      .where(eq(publications.id, id));

    if (!current) {
      return reply.code(404).send({ error: 'Publication not found' });
    }

    const publishedAt = body.publishedAt ?? new Date();
    const existingLog = (current.publishLog ?? []) as PublishLogEntry[];
    const newLog: PublishLogEntry[] = [
      ...existingLog,
      { action: 'published', timestamp: new Date().toISOString(), note: body.platformUrl },
    ];

    const [updated] = await db
      .update(publications)
      .set({
        status: 'published',
        platformUrl: body.platformUrl,
        platformPostId: body.platformPostId ?? null,
        publishedAt,
        publishLog: newLog,
        updatedAt: new Date(),
      })
      .where(eq(publications.id, id))
      .returning();

    return reply.send(updated);
  });
};
