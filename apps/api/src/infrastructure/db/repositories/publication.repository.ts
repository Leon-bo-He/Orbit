import { eq, and, inArray, gte, lte } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { publications } from '../../../db/schema/publications.js';
import { contents } from '../../../db/schema/contents.js';
import { workspaces } from '../../../db/schema/workspaces.js';
import type { IPublicationRepository } from '../../../domain/publication/publication.service.js';

export class PublicationRepository implements IPublicationRepository {
  async create(data: {
    contentId: string;
    platform: string;
    platformTitle?: string | null;
    platformCopy?: string | null;
    platformTags: unknown[];
    coverUrl?: string | null;
    platformSettings: unknown;
    scheduledAt?: Date | null;
    status: string;
  }) {
    const [row] = await db.insert(publications).values({
      ...data,
      publishLog: [],
    }).returning();
    return row!;
  }

  findByContent(contentId: string) {
    return db.select().from(publications)
      .where(eq(publications.contentId, contentId))
      .orderBy(publications.createdAt);
  }

  async findById(id: string) {
    const [row] = await db.select().from(publications).where(eq(publications.id, id));
    return row ?? null;
  }

  async findQueue(userId: string, filters: { status?: string[]; from: Date; to: Date }) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conditions: any[] = [
      eq(workspaces.userId, userId),
      gte(publications.scheduledAt, filters.from),
      lte(publications.scheduledAt, filters.to),
    ];
    if (filters.status?.length === 1) {
      conditions.push(eq(publications.status, filters.status[0]!));
    } else if (filters.status && filters.status.length > 1) {
      conditions.push(inArray(publications.status, filters.status));
    }

    const rows = await db.select({
      publication: publications,
      contentId: contents.id,
      contentTitle: contents.title,
      workspaceId: workspaces.id,
      workspaceName: workspaces.name,
      workspaceColor: workspaces.color,
      workspaceIcon: workspaces.icon,
    }).from(publications)
      .innerJoin(contents, eq(publications.contentId, contents.id))
      .innerJoin(workspaces, eq(contents.workspaceId, workspaces.id))
      .where(and(...conditions))
      .orderBy(publications.scheduledAt);

    return rows.map((r: typeof rows[0]) => ({
      publication: r.publication,
      content: { id: r.contentId, title: r.contentTitle },
      workspace: {
        id: r.workspaceId,
        name: r.workspaceName,
        color: r.workspaceColor,
        icon: r.workspaceIcon,
      },
    }));
  }

  async verifyOwnership(publicationId: string, userId: string) {
    const [row] = await db.select({
      publicationId: publications.id,
      contentId: publications.contentId,
      workspaceId: contents.workspaceId,
    }).from(publications)
      .innerJoin(contents, eq(publications.contentId, contents.id))
      .innerJoin(workspaces, eq(contents.workspaceId, workspaces.id))
      .where(and(eq(publications.id, publicationId), eq(workspaces.userId, userId)));
    return row ?? null;
  }

  async verifyBulkOwnership(ids: string[], userId: string) {
    const rows = await db.select({ id: publications.id })
      .from(publications)
      .innerJoin(contents, eq(publications.contentId, contents.id))
      .innerJoin(workspaces, eq(contents.workspaceId, workspaces.id))
      .where(and(inArray(publications.id, ids), eq(workspaces.userId, userId)));
    return rows.map((r: typeof rows[0]) => r.id);
  }

  async update(id: string, data: Partial<typeof publications.$inferInsert>) {
    const [row] = await db.update(publications).set(data).where(eq(publications.id, id)).returning();
    return row ?? null;
  }

  async batchUpdate(ids: string[], data: Partial<typeof publications.$inferInsert>) {
    await db.update(publications).set(data).where(inArray(publications.id, ids));
  }

  async delete(id: string) {
    await db.delete(publications).where(eq(publications.id, id));
  }
}
