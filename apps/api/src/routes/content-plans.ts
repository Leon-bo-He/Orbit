import type { FastifyPluginAsync } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { contents } from '../db/schema/contents.js';
import { workspaces } from '../db/schema/workspaces.js';
import { contentPlans } from '../db/schema/content-plans.js';
import { contentReferences } from '../db/schema/content-references.js';
import { planTemplates } from '../db/schema/plan-templates.js';
import type { UpsertContentPlanInput, CreateContentReferenceInput, CreatePlanTemplateInput } from '@contentflow/shared';

async function verifyContentOwnership(contentId: string, userId: string) {
  const [content] = await db
    .select({ id: contents.id, workspaceId: contents.workspaceId })
    .from(contents)
    .where(eq(contents.id, contentId));

  if (!content) return null;

  const [ws] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(and(eq(workspaces.id, content.workspaceId), eq(workspaces.userId, userId)));

  if (!ws) return null;
  return content;
}

export const contentPlansRoutes: FastifyPluginAsync = async (app) => {
  // PUT /api/contents/:id/plan — upsert plan
  app.put('/api/contents/:id/plan', { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = req.user as { sub: string };
    const { id } = req.params as { id: string };

    const content = await verifyContentOwnership(id, user.sub);
    if (!content) return reply.code(403).send({ error: 'Forbidden' });

    const body = req.body as UpsertContentPlanInput;

    const [plan] = await db
      .insert(contentPlans)
      .values({
        contentId: id,
        formatConfig: body.formatConfig ?? {},
        audience: body.audience ?? null,
        audienceTemplateId: body.audienceTemplateId ?? null,
        goals: body.goals ?? [],
        goalDescription: body.goalDescription ?? null,
        kpiTargets: body.kpiTargets ?? {},
        hooks: body.hooks ?? null,
        titleCandidates: body.titleCandidates ?? [],
        outline: body.outline ?? [],
      })
      .onConflictDoUpdate({
        target: contentPlans.contentId,
        set: {
          ...(body.formatConfig !== undefined && { formatConfig: body.formatConfig }),
          ...(body.audience !== undefined && { audience: body.audience }),
          ...(body.audienceTemplateId !== undefined && { audienceTemplateId: body.audienceTemplateId }),
          ...(body.goals !== undefined && { goals: body.goals }),
          ...(body.goalDescription !== undefined && { goalDescription: body.goalDescription }),
          ...(body.kpiTargets !== undefined && { kpiTargets: body.kpiTargets }),
          ...(body.hooks !== undefined && { hooks: body.hooks }),
          ...(body.titleCandidates !== undefined && { titleCandidates: body.titleCandidates }),
          ...(body.outline !== undefined && { outline: body.outline }),
          updatedAt: new Date(),
        },
      })
      .returning();

    return reply.send(plan);
  });

  // GET /api/contents/:id/plan
  app.get('/api/contents/:id/plan', { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = req.user as { sub: string };
    const { id } = req.params as { id: string };

    const content = await verifyContentOwnership(id, user.sub);
    if (!content) return reply.code(403).send({ error: 'Forbidden' });

    const [plan] = await db
      .select()
      .from(contentPlans)
      .where(eq(contentPlans.contentId, id));

    return reply.send(plan ?? null);
  });

  // GET /api/contents/:id/references
  app.get('/api/contents/:id/references', { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = req.user as { sub: string };
    const { id } = req.params as { id: string };

    const content = await verifyContentOwnership(id, user.sub);
    if (!content) return reply.code(403).send({ error: 'Forbidden' });

    const refs = await db
      .select()
      .from(contentReferences)
      .where(eq(contentReferences.contentId, id));

    return reply.send(refs);
  });

  // POST /api/contents/:id/references
  app.post('/api/contents/:id/references', { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = req.user as { sub: string };
    const { id } = req.params as { id: string };

    const content = await verifyContentOwnership(id, user.sub);
    if (!content) return reply.code(403).send({ error: 'Forbidden' });

    const body = req.body as CreateContentReferenceInput;

    const [ref] = await db
      .insert(contentReferences)
      .values({
        contentId: id,
        authorName: body.authorName,
        contentTitle: body.contentTitle,
        platform: body.platform,
        url: body.url,
        metricsSnapshot: body.metricsSnapshot ?? {},
        takeaway: body.takeaway,
        attachments: body.attachments ?? [],
      })
      .returning();

    return reply.code(201).send(ref);
  });

  // DELETE /api/contents/:id/references/:refId
  app.delete('/api/contents/:id/references/:refId', { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = req.user as { sub: string };
    const { id, refId } = req.params as { id: string; refId: string };

    const content = await verifyContentOwnership(id, user.sub);
    if (!content) return reply.code(403).send({ error: 'Forbidden' });

    const [ref] = await db
      .select({ id: contentReferences.id, contentId: contentReferences.contentId })
      .from(contentReferences)
      .where(and(eq(contentReferences.id, refId), eq(contentReferences.contentId, id)));

    if (!ref) return reply.code(404).send({ error: 'Reference not found' });

    await db.delete(contentReferences).where(eq(contentReferences.id, refId));

    return reply.code(204).send();
  });

  // POST /api/workspaces/:id/plan-templates
  app.post('/api/workspaces/:id/plan-templates', { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = req.user as { sub: string };
    const { id } = req.params as { id: string };

    const [ws] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(and(eq(workspaces.id, id), eq(workspaces.userId, user.sub)));

    if (!ws) return reply.code(403).send({ error: 'Forbidden' });

    const body = req.body as CreatePlanTemplateInput;

    const [template] = await db
      .insert(planTemplates)
      .values({
        workspaceId: id,
        name: body.name,
        audience: body.audience ?? null,
        goals: body.goals ?? [],
        goalDescription: body.goalDescription ?? null,
      })
      .returning();

    return reply.code(201).send(template);
  });

  // GET /api/workspaces/:id/plan-templates
  app.get('/api/workspaces/:id/plan-templates', { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = req.user as { sub: string };
    const { id } = req.params as { id: string };

    const [ws] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(and(eq(workspaces.id, id), eq(workspaces.userId, user.sub)));

    if (!ws) return reply.code(403).send({ error: 'Forbidden' });

    const templates = await db
      .select()
      .from(planTemplates)
      .where(eq(planTemplates.workspaceId, id));

    return reply.send(templates);
  });
};
