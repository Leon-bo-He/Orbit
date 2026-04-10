import { eq, and } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { workspaces } from '../../../db/schema/workspaces.js';
import type { IWorkspaceRepository } from '../../../domain/workspace/workspace.service.js';

export class WorkspaceRepository implements IWorkspaceRepository {
  async create(userId: string, data: {
    name: string;
    icon: string;
    color: string;
    about?: string | null;
    publishGoal?: unknown;
  }) {
    const [ws] = await db.insert(workspaces).values({
      userId,
      name: data.name,
      icon: data.icon,
      color: data.color,
      about: data.about ?? null,
      publishGoal: data.publishGoal ?? null,
      stageConfig: [],
    }).returning();
    return ws!;
  }

  findAllByUser(userId: string) {
    return db.select().from(workspaces).where(eq(workspaces.userId, userId)).orderBy(workspaces.createdAt);
  }

  async findByIdAndUser(id: string, userId: string) {
    const [ws] = await db.select().from(workspaces)
      .where(and(eq(workspaces.id, id), eq(workspaces.userId, userId)));
    return ws ?? null;
  }

  async update(id: string, userId: string, data: Partial<{
    name: string;
    icon: string;
    about: string | null;
    publishGoal: unknown;
    stageConfig: unknown[];
  }>) {
    const patch: Partial<typeof workspaces.$inferInsert> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.icon !== undefined) patch.icon = data.icon;
    if (data.about !== undefined) patch.about = data.about;
    if (data.publishGoal !== undefined) patch.publishGoal = data.publishGoal;
    if (data.stageConfig !== undefined) patch.stageConfig = data.stageConfig;

    const [updated] = await db.update(workspaces).set(patch)
      .where(and(eq(workspaces.id, id), eq(workspaces.userId, userId)))
      .returning();
    return updated ?? null;
  }
}
