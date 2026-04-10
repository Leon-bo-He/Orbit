import { eq, and, inArray, gte, lte, isNull } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { contents } from '../../../db/schema/contents.js';
import { workspaces } from '../../../db/schema/workspaces.js';
import type { IContentRepository } from '../../../domain/content/content.service.js';
import type { IContentCreatorRepository } from '../../../domain/idea/idea.service.js';

export class ContentRepository implements IContentRepository, IContentCreatorRepository {
  async create(data: {
    workspaceId: string;
    ideaId?: string | null;
    title: string;
    contentType: string;
    description?: string | null;
    tags: string[];
    targetPlatforms: string[];
    scheduledAt?: Date | null;
    notes?: string | null;
    stageHistory: { stage: string; timestamp: string }[];
  }) {
    const [row] = await db.insert(contents).values({
      workspaceId: data.workspaceId,
      ideaId: data.ideaId ?? null,
      title: data.title,
      contentType: data.contentType,
      description: data.description ?? null,
      stage: 'planned',
      tags: data.tags,
      targetPlatforms: data.targetPlatforms,
      scheduledAt: data.scheduledAt ?? null,
      notes: data.notes ?? null,
      attachments: [],
      stageHistory: data.stageHistory,
    }).returning();
    return row!;
  }

  async createFromIdea(data: {
    workspaceId: string;
    ideaId: string;
    title: string;
    contentType: string;
    tags: string[];
    stageHistory: { stage: string; timestamp: string }[];
  }) {
    const [row] = await db.insert(contents).values({
      workspaceId: data.workspaceId,
      ideaId: data.ideaId,
      title: data.title,
      contentType: data.contentType,
      stage: 'planned',
      tags: data.tags,
      targetPlatforms: [],
      attachments: [],
      stageHistory: data.stageHistory,
    }).returning();
    return row!;
  }

  async findByWorkspace(workspaceId: string, filters: { stage?: string | string[] }) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conditions: any[] = [eq(contents.workspaceId, workspaceId)];
    if (filters.stage) {
      if (Array.isArray(filters.stage)) {
        conditions.push(inArray(contents.stage, filters.stage));
      } else {
        conditions.push(eq(contents.stage, filters.stage));
      }
    }
    const rows = await db.select().from(contents)
      .where(and(...conditions))
      .orderBy(contents.updatedAt);
    return rows.reverse();
  }

  findCalendar(workspaceIds: string[], from: Date, to: Date) {
    return db.select().from(contents).where(
      and(
        inArray(contents.workspaceId, workspaceIds),
        gte(contents.scheduledAt, from),
        lte(contents.scheduledAt, to),
      ),
    ).orderBy(contents.scheduledAt);
  }

  findAllByWorkspaces(wsIds: string[], filters: { from?: Date; to?: Date }) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conditions: any[] = [
      inArray(contents.workspaceId, wsIds),
      eq(contents.stage, 'archived'),
    ];
    if (filters.from) conditions.push(gte(contents.updatedAt, filters.from));
    if (filters.to) conditions.push(lte(contents.updatedAt, filters.to));
    return db.select().from(contents).where(and(...conditions)).orderBy(contents.updatedAt);
  }

  async findById(id: string) {
    const [row] = await db.select().from(contents).where(eq(contents.id, id));
    return row ?? null;
  }

  async findByIdWithWorkspaceUser(id: string, userId: string) {
    const [row] = await db
      .select({ id: contents.id, workspaceId: contents.workspaceId })
      .from(contents)
      .innerJoin(workspaces, eq(contents.workspaceId, workspaces.id))
      .where(and(eq(contents.id, id), eq(workspaces.userId, userId)));
    return row ?? null;
  }

  async update(id: string, data: Partial<typeof contents.$inferInsert>) {
    const [row] = await db.update(contents).set(data).where(eq(contents.id, id)).returning();
    return row ?? null;
  }

  async delete(id: string) {
    await db.delete(contents).where(eq(contents.id, id));
  }

  async deleteArchived(wsIds: string[], filters: { from?: Date; to?: Date }) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conditions: any[] = [
      inArray(contents.workspaceId, wsIds),
      eq(contents.stage, 'archived'),
    ];
    if (filters.from) conditions.push(gte(contents.updatedAt, filters.from));
    if (filters.to) conditions.push(lte(contents.updatedAt, filters.to));
    const deleted = await db.delete(contents).where(and(...conditions)).returning({ id: contents.id });
    return deleted.map((r) => r.id);
  }

  async stampPublishedAt(id: string, publishedAt: Date) {
    await db.update(contents)
      .set({ publishedAt, updatedAt: new Date() })
      .where(and(eq(contents.id, id), isNull(contents.publishedAt)));
  }
}
