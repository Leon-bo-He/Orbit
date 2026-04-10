import { eq, and, ilike, isNull, gte, lte } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { ideas } from '../../../db/schema/ideas.js';
import type { IIdeaRepository } from '../../../domain/idea/idea.service.js';

export class IdeaRepository implements IIdeaRepository {
  async create(data: {
    userId: string;
    workspaceId?: string | null;
    title: string;
    note?: string | null;
    tags: string[];
    priority: string;
    attachments: unknown[];
  }) {
    const [row] = await db.insert(ideas).values({
      userId: data.userId,
      workspaceId: data.workspaceId ?? null,
      title: data.title,
      note: data.note ?? null,
      tags: data.tags,
      priority: data.priority,
      attachments: data.attachments,
    }).returning();
    return row!;
  }

  async findAll(userId: string, filters: {
    workspaceId?: string | null | 'global';
    status?: string;
    priority?: string;
    q?: string;
  }) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conditions: any[] = [eq(ideas.userId, userId)];
    if (filters.workspaceId === 'global') conditions.push(isNull(ideas.workspaceId));
    else if (filters.workspaceId) conditions.push(eq(ideas.workspaceId, filters.workspaceId));
    if (filters.status) conditions.push(eq(ideas.status, filters.status));
    if (filters.priority) conditions.push(eq(ideas.priority, filters.priority));
    if (filters.q) conditions.push(ilike(ideas.title, `%${filters.q}%`));
    const rows = await db.select().from(ideas).where(and(...conditions)).orderBy(ideas.createdAt);
    return rows.reverse();
  }

  findArchived(userId: string, filters: {
    workspaceId?: string | null | 'global';
    from?: Date;
    to?: Date;
  }) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conditions: any[] = [
      eq(ideas.userId, userId),
      eq(ideas.status, 'archived'),
    ];
    if (filters.workspaceId === 'global') conditions.push(isNull(ideas.workspaceId));
    else if (filters.workspaceId) conditions.push(eq(ideas.workspaceId, filters.workspaceId));
    if (filters.from) conditions.push(gte(ideas.createdAt, filters.from));
    if (filters.to) conditions.push(lte(ideas.createdAt, filters.to));
    return db.select().from(ideas).where(and(...conditions)).orderBy(ideas.createdAt);
  }

  async deleteArchived(userId: string, filters: {
    workspaceId?: string | null | 'global';
    from?: Date;
    to?: Date;
  }) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conditions: any[] = [
      eq(ideas.userId, userId),
      eq(ideas.status, 'archived'),
    ];
    if (filters.workspaceId === 'global') conditions.push(isNull(ideas.workspaceId));
    else if (filters.workspaceId) conditions.push(eq(ideas.workspaceId, filters.workspaceId));
    if (filters.from) conditions.push(gte(ideas.createdAt, filters.from));
    if (filters.to) conditions.push(lte(ideas.createdAt, filters.to));
    const deleted = await db.delete(ideas).where(and(...conditions)).returning({ id: ideas.id });
    return deleted.length;
  }

  async findByIdAndUser(id: string, userId: string) {
    const [row] = await db.select().from(ideas)
      .where(and(eq(ideas.id, id), eq(ideas.userId, userId)));
    return row ?? null;
  }

  async update(id: string, userId: string, data: Partial<{
    title: string;
    note: string | null;
    tags: string[];
    priority: string;
    attachments: unknown[];
    status: string;
    workspaceId: string | null;
    convertedTo: string | null;
  }>) {
    const patch: Partial<typeof ideas.$inferInsert> = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.note !== undefined) patch.note = data.note;
    if (data.tags !== undefined) patch.tags = data.tags;
    if (data.priority !== undefined) patch.priority = data.priority;
    if (data.attachments !== undefined) patch.attachments = data.attachments;
    if (data.status !== undefined) patch.status = data.status;
    if ('workspaceId' in data) patch.workspaceId = data.workspaceId ?? null;
    if (data.convertedTo !== undefined) patch.convertedTo = data.convertedTo;

    const [row] = await db.update(ideas).set(patch)
      .where(and(eq(ideas.id, id), eq(ideas.userId, userId)))
      .returning();
    return row ?? null;
  }

  async syncStatusByContentId(contentId: string, userId: string, status: string) {
    await db.update(ideas).set({ status })
      .where(and(eq(ideas.convertedTo, contentId), eq(ideas.userId, userId)));
  }
}
