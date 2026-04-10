import type { FastifyInstance } from 'fastify';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import {
  users,
  workspaces,
  contents,
  contentPlans,
  contentReferences,
  publications,
  ideas,
  planTemplates,
  metrics,
} from '../../../db/schema/index.js';

export function exportRoutes(app: FastifyInstance) {
  app.get('/api/export', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub: userId } = req.user as { sub: string };

    const [user] = await db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      avatar: users.avatar,
      locale: users.locale,
      timezone: users.timezone,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.id, userId));

    const userWorkspaces = await db.select().from(workspaces).where(eq(workspaces.userId, userId));
    const workspaceIds = userWorkspaces.map((w) => w.id);

    const allContents = workspaceIds.length > 0
      ? await db.select().from(contents).where(inArray(contents.workspaceId, workspaceIds))
      : [];
    const contentIds = allContents.map((c) => c.id);

    const [allPlans, allRefs, allPubs] = contentIds.length > 0
      ? await Promise.all([
        db.select().from(contentPlans).where(inArray(contentPlans.contentId, contentIds)),
        db.select().from(contentReferences).where(inArray(contentReferences.contentId, contentIds)),
        db.select().from(publications).where(inArray(publications.contentId, contentIds)),
      ])
      : [[], [], []];

    const pubIds = allPubs.map((p) => p.id);
    const allMetrics = pubIds.length > 0
      ? await db.select().from(metrics).where(inArray(metrics.publicationId, pubIds))
      : [];

    const [allIdeas, allPlanTemplates] = await Promise.all([
      db.select().from(ideas).where(eq(ideas.userId, userId)),
      workspaceIds.length > 0
        ? db.select().from(planTemplates).where(inArray(planTemplates.workspaceId, workspaceIds))
        : Promise.resolve([]),
    ]);

    const plansById = new Map(allPlans.map((p) => [p.contentId, p]));
    const refsByContent = new Map<string, typeof allRefs>();
    for (const r of allRefs) {
      (refsByContent.get(r.contentId) ?? refsByContent.set(r.contentId, []).get(r.contentId)!).push(r);
    }
    const pubsByContent = new Map<string, typeof allPubs>();
    for (const p of allPubs) {
      (pubsByContent.get(p.contentId) ?? pubsByContent.set(p.contentId, []).get(p.contentId)!).push(p);
    }
    const metricsByPub = new Map<string, typeof allMetrics>();
    for (const m of allMetrics) {
      (metricsByPub.get(m.publicationId) ?? metricsByPub.set(m.publicationId, []).get(m.publicationId)!).push(m);
    }
    const contentsByWorkspace = new Map<string, typeof allContents>();
    for (const c of allContents) {
      (contentsByWorkspace.get(c.workspaceId) ?? contentsByWorkspace.set(c.workspaceId, []).get(c.workspaceId)!).push(c);
    }
    const templatesByWorkspace = new Map<string, typeof allPlanTemplates>();
    for (const t of allPlanTemplates) {
      (templatesByWorkspace.get(t.workspaceId) ?? templatesByWorkspace.set(t.workspaceId, []).get(t.workspaceId)!).push(t);
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      profile: user,
      workspaces: userWorkspaces.map((ws) => ({
        ...ws,
        planTemplates: templatesByWorkspace.get(ws.id) ?? [],
        contents: (contentsByWorkspace.get(ws.id) ?? []).map((c) => ({
          ...c,
          plan: plansById.get(c.id) ?? null,
          references: refsByContent.get(c.id) ?? [],
          publications: (pubsByContent.get(c.id) ?? []).map((p) => ({
            ...p,
            metrics: metricsByPub.get(p.id) ?? [],
          })),
        })),
      })),
      ideas: allIdeas,
    };

    reply.header('Content-Disposition', `attachment; filename="orbit-export-${new Date().toISOString().slice(0, 10)}.json"`);
    reply.header('Content-Type', 'application/json');
    return reply.send(payload);
  });
}
