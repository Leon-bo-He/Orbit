import type { FastifyInstance } from 'fastify';
import { db } from '../../../db/client.js';
import {
  workspaces,
  contents,
  contentPlans,
  contentReferences,
  publications,
  ideas,
  planTemplates,
  metrics,
} from '../../../db/schema/index.js';

export function importRoutes(app: FastifyInstance) {
  app.post('/api/import', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub: userId } = req.user as { sub: string };
    const body = req.body as Record<string, unknown>;

    if (!body || body.version !== '1.0') {
      return reply.code(400).send({ error: 'Invalid or unsupported export file' });
    }

    const exportedWorkspaces = (body.workspaces as WsExport[] | undefined) ?? [];
    const exportedIdeas = (body.ideas as IdeaExport[] | undefined) ?? [];

    const wsIdMap = new Map<string, string>();
    const contentIdMap = new Map<string, string>();
    let workspacesImported = 0, contentsImported = 0, ideasImported = 0;

    await db.transaction(async (tx) => {
      for (const ws of exportedWorkspaces) {
        const [newWs] = await tx.insert(workspaces).values({
          userId,
          name: ws.name,
          icon: ws.icon ?? '📁',
          color: ws.color ?? '#6366f1',
          about: ws.about ?? null,
          publishGoal: ws.publishGoal ?? null,
          stageConfig: (ws.stageConfig as unknown[]) ?? [],
        }).returning({ id: workspaces.id });
        if (!newWs) continue;
        wsIdMap.set(ws.id, newWs.id);
        workspacesImported++;

        for (const tpl of ws.planTemplates ?? []) {
          await tx.insert(planTemplates).values({
            workspaceId: newWs.id,
            name: tpl.name,
            audience: tpl.audience ?? null,
            goals: (tpl.goals as unknown[]) ?? [],
            goalDescription: tpl.goalDescription ?? null,
          });
        }

        for (const c of ws.contents ?? []) {
          const [newContent] = await tx.insert(contents).values({
            workspaceId: newWs.id,
            ideaId: null,
            title: c.title,
            contentType: c.contentType,
            description: c.description ?? null,
            stage: c.stage ?? 'planned',
            tags: (c.tags as unknown[]) ?? [],
            targetPlatforms: (c.targetPlatforms as unknown[]) ?? [],
            scheduledAt: c.scheduledAt ? new Date(c.scheduledAt) : null,
            publishedAt: c.publishedAt ? new Date(c.publishedAt) : null,
            notes: c.notes ?? null,
            reviewNotes: c.reviewNotes ?? null,
            attachments: (c.attachments as unknown[]) ?? [],
            stageHistory: (c.stageHistory as unknown[]) ?? [],
          }).returning({ id: contents.id });
          if (!newContent) continue;
          contentIdMap.set(c.id, newContent.id);
          contentsImported++;

          if (c.plan) {
            const p = c.plan;
            await tx.insert(contentPlans).values({
              contentId: newContent.id,
              formatConfig: (p.formatConfig as Record<string, unknown>) ?? {},
              audience: p.audience ?? null,
              goals: (p.goals as unknown[]) ?? [],
              goalDescription: p.goalDescription ?? null,
              kpiTargets: (p.kpiTargets as Record<string, unknown>) ?? {},
              hooks: p.hooks ?? null,
              titleCandidates: (p.titleCandidates as unknown[]) ?? [],
              outline: (p.outline as unknown[]) ?? [],
            }).onConflictDoNothing();
          }

          for (const ref of c.references ?? []) {
            await tx.insert(contentReferences).values({
              contentId: newContent.id,
              authorName: ref.authorName ?? '',
              contentTitle: ref.contentTitle ?? '',
              platform: ref.platform,
              url: ref.url,
              metricsSnapshot: (ref.metricsSnapshot as Record<string, unknown>) ?? {},
              takeaway: ref.takeaway ?? '',
              attachments: (ref.attachments as unknown[]) ?? [],
            });
          }

          for (const pub of c.publications ?? []) {
            const [newPub] = await tx.insert(publications).values({
              contentId: newContent.id,
              platform: pub.platform,
              status: pub.status ?? 'draft',
              platformTitle: pub.platformTitle ?? null,
              platformCopy: pub.platformCopy ?? null,
              platformTags: (pub.platformTags as unknown[]) ?? [],
              coverUrl: pub.coverUrl ?? null,
              platformSettings: (pub.platformSettings as Record<string, unknown>) ?? {},
              scheduledAt: pub.scheduledAt ? new Date(pub.scheduledAt) : null,
              publishedAt: pub.publishedAt ? new Date(pub.publishedAt) : null,
              platformPostId: pub.platformPostId ?? null,
              platformUrl: pub.platformUrl ?? null,
              failureReason: pub.failureReason ?? null,
              publishLog: (pub.publishLog as unknown[]) ?? [],
            }).returning({ id: publications.id });
            if (!newPub) continue;

            for (const m of pub.metrics ?? []) {
              await tx.insert(metrics).values({
                publicationId: newPub.id,
                recordedAt: m.recordedAt ? new Date(m.recordedAt) : new Date(),
                views: m.views ?? 0,
                likes: m.likes ?? 0,
                comments: m.comments ?? 0,
                shares: m.shares ?? 0,
                saves: m.saves ?? 0,
                followersGained: m.followersGained ?? 0,
              });
            }
          }
        }
      }

      for (const idea of exportedIdeas) {
        await tx.insert(ideas).values({
          userId,
          workspaceId: idea.workspaceId ? (wsIdMap.get(idea.workspaceId) ?? null) : null,
          convertedTo: idea.convertedTo ? (contentIdMap.get(idea.convertedTo) ?? null) : null,
          title: idea.title,
          note: idea.note ?? null,
          tags: (idea.tags as unknown[]) ?? [],
          priority: idea.priority ?? 'medium',
          attachments: (idea.attachments as unknown[]) ?? [],
          status: idea.status ?? 'active',
        });
        ideasImported++;
      }
    });

    return reply.send({ ok: true, imported: { workspaces: workspacesImported, contents: contentsImported, ideas: ideasImported } });
  });
}

interface WsExport { id: string; name: string; icon?: string; color?: string; about?: string | null; publishGoal?: unknown; stageConfig?: unknown; planTemplates?: TplExport[]; contents?: ContentExport[] }
interface TplExport { name: string; audience?: unknown; goals?: unknown; goalDescription?: string | null }
interface ContentExport { id: string; title: string; contentType: string; description?: string | null; stage?: string; tags?: unknown; targetPlatforms?: unknown; scheduledAt?: string | null; publishedAt?: string | null; notes?: string | null; reviewNotes?: string | null; attachments?: unknown; stageHistory?: unknown; plan?: PlanExport | null; references?: RefExport[]; publications?: PubExport[] }
interface PlanExport { formatConfig?: unknown; audience?: unknown; goals?: unknown; goalDescription?: string | null; kpiTargets?: unknown; hooks?: unknown; titleCandidates?: unknown; outline?: unknown }
interface RefExport { platform: string; url: string; authorName?: string; contentTitle?: string; metricsSnapshot?: unknown; takeaway?: string; attachments?: unknown }
interface PubExport { id: string; platform: string; status?: string; platformTitle?: string | null; platformCopy?: string | null; platformTags?: unknown; coverUrl?: string | null; platformSettings?: unknown; scheduledAt?: string | null; publishedAt?: string | null; platformPostId?: string | null; platformUrl?: string | null; failureReason?: string | null; publishLog?: unknown; metrics?: MetricExport[] }
interface MetricExport { recordedAt?: string; views?: number; likes?: number; comments?: number; shares?: number; saves?: number; followersGained?: number }
interface IdeaExport { workspaceId?: string | null; convertedTo?: string | null; title: string; note?: string | null; tags?: unknown; priority?: string; attachments?: unknown; status?: string }
