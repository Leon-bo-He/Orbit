import type { FastifyPluginAsync } from 'fastify';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
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
} from '../db/schema/index.js';

export const exportRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/export', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub: userId } = req.user as { sub: string };

    // Profile (exclude password hash)
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        avatar: users.avatar,
        locale: users.locale,
        timezone: users.timezone,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId));

    // Workspaces
    const userWorkspaces = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.userId, userId));
    const workspaceIds = userWorkspaces.map((w) => w.id);

    // Contents (all workspaces in one query)
    const allContents = workspaceIds.length > 0
      ? await db.select().from(contents).where(inArray(contents.workspaceId, workspaceIds))
      : [];
    const contentIds = allContents.map((c) => c.id);

    // Content sub-data (3 parallel batch queries)
    const [allPlans, allRefs, allPubs] = contentIds.length > 0
      ? await Promise.all([
          db.select().from(contentPlans).where(inArray(contentPlans.contentId, contentIds)),
          db.select().from(contentReferences).where(inArray(contentReferences.contentId, contentIds)),
          db.select().from(publications).where(inArray(publications.contentId, contentIds)),
        ])
      : [[], [], []];

    // Metrics per publication
    const pubIds = allPubs.map((p) => p.id);
    const allMetrics = pubIds.length > 0
      ? await db.select().from(metrics).where(inArray(metrics.publicationId, pubIds))
      : [];

    // Ideas & plan templates
    const [allIdeas, allPlanTemplates] = await Promise.all([
      db.select().from(ideas).where(eq(ideas.userId, userId)),
      workspaceIds.length > 0
        ? db.select().from(planTemplates).where(inArray(planTemplates.workspaceId, workspaceIds))
        : Promise.resolve([]),
    ]);

    // Index sub-data by parent ID for O(1) lookup
    const plansById = new Map(allPlans.map((p) => [p.contentId, p]));

    const refsByContent = new Map<string, typeof allRefs>();
    for (const r of allRefs) {
      const arr = refsByContent.get(r.contentId) ?? [];
      arr.push(r);
      refsByContent.set(r.contentId, arr);
    }

    const pubsByContent = new Map<string, typeof allPubs>();
    for (const p of allPubs) {
      const arr = pubsByContent.get(p.contentId) ?? [];
      arr.push(p);
      pubsByContent.set(p.contentId, arr);
    }

    const metricsByPub = new Map<string, typeof allMetrics>();
    for (const m of allMetrics) {
      const arr = metricsByPub.get(m.publicationId) ?? [];
      arr.push(m);
      metricsByPub.set(m.publicationId, arr);
    }

    const contentsByWorkspace = new Map<string, typeof allContents>();
    for (const c of allContents) {
      const arr = contentsByWorkspace.get(c.workspaceId) ?? [];
      arr.push(c);
      contentsByWorkspace.set(c.workspaceId, arr);
    }

    const templatesByWorkspace = new Map<string, typeof allPlanTemplates>();
    for (const t of allPlanTemplates) {
      const arr = templatesByWorkspace.get(t.workspaceId) ?? [];
      arr.push(t);
      templatesByWorkspace.set(t.workspaceId, arr);
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

    const filename = `contentflow-export-${new Date().toISOString().slice(0, 10)}.json`;
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    reply.header('Content-Type', 'application/json');
    return reply.send(payload);
  });
};
