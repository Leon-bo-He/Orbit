import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { contentPlans } from '../../../db/schema/content-plans.js';
import { contentReferences } from '../../../db/schema/content-references.js';
import { planTemplates } from '../../../db/schema/plan-templates.js';
import type { IPlanRepository } from '../../../domain/plan/plan.service.js';

export class PlanRepository implements IPlanRepository {
  async upsertPlan(contentId: string, data: {
    formatConfig?: unknown;
    audience?: unknown | null;
    audienceTemplateId?: string | null;
    goals?: unknown[];
    goalDescription?: string | null;
    kpiTargets?: unknown;
    hooks?: unknown | null;
    titleCandidates?: unknown[];
    outline?: unknown[];
  }) {
    const [plan] = await db.insert(contentPlans).values({
      contentId,
      formatConfig: data.formatConfig ?? {},
      audience: data.audience ?? null,
      audienceTemplateId: data.audienceTemplateId ?? null,
      goals: data.goals ?? [],
      goalDescription: data.goalDescription ?? null,
      kpiTargets: data.kpiTargets ?? {},
      hooks: data.hooks ?? null,
      titleCandidates: data.titleCandidates ?? [],
      outline: data.outline ?? [],
    }).onConflictDoUpdate({
      target: contentPlans.contentId,
      set: {
        ...(data.formatConfig !== undefined && { formatConfig: data.formatConfig }),
        ...(data.audience !== undefined && { audience: data.audience }),
        ...(data.audienceTemplateId !== undefined && { audienceTemplateId: data.audienceTemplateId }),
        ...(data.goals !== undefined && { goals: data.goals }),
        ...(data.goalDescription !== undefined && { goalDescription: data.goalDescription }),
        ...(data.kpiTargets !== undefined && { kpiTargets: data.kpiTargets }),
        ...(data.hooks !== undefined && { hooks: data.hooks }),
        ...(data.titleCandidates !== undefined && { titleCandidates: data.titleCandidates }),
        ...(data.outline !== undefined && { outline: data.outline }),
        updatedAt: new Date(),
      },
    }).returning();
    return plan!;
  }

  async findPlan(contentId: string) {
    const [plan] = await db.select().from(contentPlans).where(eq(contentPlans.contentId, contentId));
    return plan ?? null;
  }

  findReferences(contentId: string) {
    return db.select().from(contentReferences).where(eq(contentReferences.contentId, contentId));
  }

  async createReference(contentId: string, data: {
    authorName: string;
    contentTitle: string;
    platform: string;
    url?: string;
    metricsSnapshot?: unknown;
    takeaway?: string;
    attachments?: unknown[];
  }) {
    const [ref] = await db.insert(contentReferences).values({
      contentId,
      authorName: data.authorName,
      contentTitle: data.contentTitle,
      platform: data.platform,
      url: data.url ?? '',
      metricsSnapshot: data.metricsSnapshot ?? {},
      takeaway: data.takeaway ?? '',
      attachments: data.attachments ?? [],
    }).returning();
    return ref!;
  }

  async deleteReference(refId: string, contentId: string) {
    const [deleted] = await db.delete(contentReferences)
      .where(and(eq(contentReferences.id, refId), eq(contentReferences.contentId, contentId)))
      .returning({ id: contentReferences.id });
    return Boolean(deleted);
  }

  async createTemplate(workspaceId: string, data: {
    name: string;
    audience?: unknown | null;
    goals?: unknown[];
    goalDescription?: string | null;
  }) {
    const [tpl] = await db.insert(planTemplates).values({
      workspaceId,
      name: data.name,
      audience: data.audience ?? null,
      goals: data.goals ?? [],
      goalDescription: data.goalDescription ?? null,
    }).returning();
    return tpl!;
  }

  findTemplates(workspaceId: string) {
    return db.select().from(planTemplates).where(eq(planTemplates.workspaceId, workspaceId));
  }

  async updateTemplate(templateId: string, workspaceId: string, name: string) {
    const [updated] = await db.update(planTemplates).set({ name })
      .where(and(eq(planTemplates.id, templateId), eq(planTemplates.workspaceId, workspaceId)))
      .returning();
    return updated ?? null;
  }

  async deleteTemplate(templateId: string, workspaceId: string) {
    const [deleted] = await db.delete(planTemplates)
      .where(and(eq(planTemplates.id, templateId), eq(planTemplates.workspaceId, workspaceId)))
      .returning({ id: planTemplates.id });
    return Boolean(deleted);
  }
}
