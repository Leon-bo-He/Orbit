import type { FastifyInstance } from 'fastify';
import type { UpsertContentPlanInput, CreateContentReferenceInput, CreatePlanTemplateInput } from '@orbit/shared';
import type { PlanService } from '../../../domain/plan/plan.service.js';
import type { ContentService } from '../../../domain/content/content.service.js';
import type { WorkspaceService } from '../../../domain/workspace/workspace.service.js';

export function contentPlansRoutes(
  app: FastifyInstance,
  planSvc: PlanService,
  contentSvc: ContentService,
  workspaceSvc: WorkspaceService,
) {
  // PUT /api/contents/:id/plan
  app.put('/api/contents/:id/plan', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id } = req.params as { id: string };
    await contentSvc.verifyOwnership(id, sub);
    const body = req.body as UpsertContentPlanInput;
    return reply.send(await planSvc.upsertPlan(id, body));
  });

  // GET /api/contents/:id/plan
  app.get('/api/contents/:id/plan', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id } = req.params as { id: string };
    await contentSvc.verifyOwnership(id, sub);
    return reply.send(await planSvc.getPlan(id));
  });

  // GET /api/contents/:id/references
  app.get('/api/contents/:id/references', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id } = req.params as { id: string };
    await contentSvc.verifyOwnership(id, sub);
    return reply.send(await planSvc.getReferences(id));
  });

  // POST /api/contents/:id/references
  app.post('/api/contents/:id/references', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id } = req.params as { id: string };
    await contentSvc.verifyOwnership(id, sub);
    const body = req.body as CreateContentReferenceInput;
    return reply.code(201).send(await planSvc.addReference(id, body));
  });

  // DELETE /api/contents/:id/references/:refId
  app.delete('/api/contents/:id/references/:refId', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id, refId } = req.params as { id: string; refId: string };
    await contentSvc.verifyOwnership(id, sub);
    await planSvc.deleteReference(id, refId);
    return reply.code(204).send();
  });

  // POST /api/workspaces/:id/plan-templates
  app.post('/api/workspaces/:id/plan-templates', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id } = req.params as { id: string };
    await workspaceSvc.verifyOwnership(id, sub);
    const body = req.body as CreatePlanTemplateInput;
    return reply.code(201).send(await planSvc.createTemplate(id, body));
  });

  // GET /api/workspaces/:id/plan-templates
  app.get('/api/workspaces/:id/plan-templates', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id } = req.params as { id: string };
    await workspaceSvc.verifyOwnership(id, sub);
    return reply.send(await planSvc.getTemplates(id));
  });

  // PATCH /api/workspaces/:id/plan-templates/:templateId
  app.patch('/api/workspaces/:id/plan-templates/:templateId', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id, templateId } = req.params as { id: string; templateId: string };
    await workspaceSvc.verifyOwnership(id, sub);
    const { name } = req.body as { name: string };
    return reply.send(await planSvc.renameTemplate(id, templateId, name));
  });

  // DELETE /api/workspaces/:id/plan-templates/:templateId
  app.delete('/api/workspaces/:id/plan-templates/:templateId', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id, templateId } = req.params as { id: string; templateId: string };
    await workspaceSvc.verifyOwnership(id, sub);
    await planSvc.deleteTemplate(id, templateId);
    return reply.code(204).send();
  });
}
