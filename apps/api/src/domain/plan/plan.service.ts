import type { contentPlans } from '../../db/schema/content-plans.js';
import type { contentReferences } from '../../db/schema/content-references.js';
import type { planTemplates } from '../../db/schema/plan-templates.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors.js';

export type ContentPlan = typeof contentPlans.$inferSelect;
export type ContentReference = typeof contentReferences.$inferSelect;
export type PlanTemplate = typeof planTemplates.$inferSelect;

export interface IPlanRepository {
  upsertPlan(contentId: string, data: {
    formatConfig?: unknown;
    audience?: unknown | null;
    audienceTemplateId?: string | null;
    goals?: unknown[];
    goalDescription?: string | null;
    kpiTargets?: unknown;
    hooks?: unknown | null;
    titleCandidates?: unknown[];
    outline?: unknown[];
  }): Promise<ContentPlan>;

  findPlan(contentId: string): Promise<ContentPlan | null>;

  findReferences(contentId: string): Promise<ContentReference[]>;

  createReference(contentId: string, data: {
    authorName: string;
    contentTitle: string;
    platform: string;
    url?: string;
    metricsSnapshot?: unknown;
    takeaway?: string;
    attachments?: unknown[];
  }): Promise<ContentReference>;

  deleteReference(refId: string, contentId: string): Promise<boolean>;

  createTemplate(workspaceId: string, data: {
    name: string;
    audience?: unknown | null;
    goals?: unknown[];
    goalDescription?: string | null;
  }): Promise<PlanTemplate>;

  findTemplates(workspaceId: string): Promise<PlanTemplate[]>;

  updateTemplate(templateId: string, workspaceId: string, name: string): Promise<PlanTemplate | null>;

  deleteTemplate(templateId: string, workspaceId: string): Promise<boolean>;
}

export class PlanService {
  constructor(private repo: IPlanRepository) {}

  upsertPlan(contentId: string, data: Parameters<IPlanRepository['upsertPlan']>[1]) {
    return this.repo.upsertPlan(contentId, data);
  }

  getPlan(contentId: string) {
    return this.repo.findPlan(contentId);
  }

  getReferences(contentId: string) {
    return this.repo.findReferences(contentId);
  }

  addReference(contentId: string, data: Parameters<IPlanRepository['createReference']>[1]) {
    return this.repo.createReference(contentId, data);
  }

  async deleteReference(contentId: string, refId: string) {
    const deleted = await this.repo.deleteReference(refId, contentId);
    if (!deleted) throw new NotFoundError('Reference not found');
  }

  createTemplate(workspaceId: string, data: Parameters<IPlanRepository['createTemplate']>[1]) {
    return this.repo.createTemplate(workspaceId, data);
  }

  getTemplates(workspaceId: string) {
    return this.repo.findTemplates(workspaceId);
  }

  async renameTemplate(workspaceId: string, templateId: string, name: string) {
    if (!name.trim()) throw new ValidationError('Name is required');
    const updated = await this.repo.updateTemplate(templateId, workspaceId, name.trim());
    if (!updated) throw new NotFoundError('Template not found');
    return updated;
  }

  async deleteTemplate(workspaceId: string, templateId: string) {
    const deleted = await this.repo.deleteTemplate(templateId, workspaceId);
    if (!deleted) throw new NotFoundError('Template not found');
  }
}
