import type { publications } from '../../db/schema/publications.js';
import type { PublishLogEntry } from '@orbit/shared';
import { ForbiddenError, NotFoundError } from '../errors.js';

export type Publication = typeof publications.$inferSelect;

export interface IPublicationRepository {
  create(data: {
    contentId: string;
    platform: string;
    platformTitle?: string | null;
    platformCopy?: string | null;
    platformTags: unknown[];
    coverUrl?: string | null;
    platformSettings: unknown;
    scheduledAt?: Date | null;
    status: string;
  }): Promise<Publication>;

  findByContent(contentId: string): Promise<Publication[]>;

  findById(id: string): Promise<Publication | null>;

  findQueue(userId: string, filters: {
    status?: string[];
    from: Date;
    to: Date;
  }): Promise<Array<{
    publication: Publication;
    content: { id: string; title: string };
    workspace: { id: string; name: string; color: string; icon: string };
  }>>;

  verifyOwnership(publicationId: string, userId: string): Promise<{
    publicationId: string;
    contentId: string;
    workspaceId: string;
  } | null>;

  verifyBulkOwnership(ids: string[], userId: string): Promise<string[]>;

  update(id: string, data: Partial<typeof publications.$inferInsert>): Promise<Publication | null>;

  batchUpdate(ids: string[], data: Partial<typeof publications.$inferInsert>): Promise<void>;

  delete(id: string): Promise<void>;
}

export class PublicationService {
  constructor(private repo: IPublicationRepository) {}

  async verifyOwnership(publicationId: string, userId: string) {
    const row = await this.repo.verifyOwnership(publicationId, userId);
    if (!row) throw new ForbiddenError();
    return row;
  }

  create(contentId: string, data: {
    platform: string;
    platformTitle?: string | null;
    platformCopy?: string | null;
    platformTags?: unknown[];
    coverUrl?: string | null;
    platformSettings?: unknown;
    scheduledAt?: Date | null;
  }) {
    const status = data.scheduledAt && data.platform ? 'queued' : 'draft';
    return this.repo.create({
      contentId,
      platform: data.platform,
      platformTitle: data.platformTitle ?? null,
      platformCopy: data.platformCopy ?? null,
      platformTags: data.platformTags ?? [],
      coverUrl: data.coverUrl ?? null,
      platformSettings: data.platformSettings ?? {},
      scheduledAt: data.scheduledAt ?? null,
      status,
    });
  }

  listByContent(contentId: string) {
    return this.repo.findByContent(contentId);
  }

  getQueue(userId: string, filters: { status?: string; from?: string; to?: string }) {
    const statusFilter = (filters.status ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const from = filters.from ? new Date(filters.from) : new Date();
    const to = filters.to ? new Date(filters.to) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const queueFilters: { status?: string[]; from: Date; to: Date } = { from, to };
    if (statusFilter.length) queueFilters.status = statusFilter;
    return this.repo.findQueue(userId, queueFilters);
  }

  async batchUpdate(userId: string, ids: string[], data: { scheduledAt?: Date | null; status?: string }) {
    const owned = await this.repo.verifyBulkOwnership(ids, userId);
    if (owned.length !== ids.length) throw new ForbiddenError('Some publications do not belong to you');
    await this.repo.batchUpdate(ids, { ...data, updatedAt: new Date() });
    return ids.length;
  }

  async update(userId: string, id: string, body: {
    platformTitle?: string;
    platformCopy?: string;
    platformTags?: unknown[];
    coverUrl?: string | null;
    platformSettings?: unknown;
    platformAccountId?: string | null;
    scheduledAt?: Date | null;
    status?: string;
  }) {
    await this.verifyOwnership(id, userId);

    const current = await this.repo.findById(id);
    if (!current) throw new NotFoundError('Publication not found');

    const log: PublishLogEntry[] = [
      ...((current.publishLog ?? []) as PublishLogEntry[]),
      { action: 'updated', timestamp: new Date().toISOString(), note: 'fields updated' } as PublishLogEntry,
    ];

    const updateData: Partial<typeof publications.$inferInsert> = {
      updatedAt: new Date(),
      publishLog: log,
      ...body,
    };

    // Auto-advance draft → queued when scheduledAt and platform are both set
    const nextScheduledAt = body.scheduledAt !== undefined ? body.scheduledAt : current.scheduledAt;
    const nextStatus = body.status ?? current.status;
    if (nextStatus === 'draft' && body.status !== 'draft' && nextScheduledAt && current.platform) {
      updateData.status = 'queued';
    }

    const updated = await this.repo.update(id, updateData);
    if (!updated) throw new NotFoundError('Publication not found');
    return updated;
  }

  async delete(userId: string, id: string) {
    await this.verifyOwnership(id, userId);
    await this.repo.delete(id);
  }

  async markPublished(userId: string, id: string, data: {
    platformUrl?: string;
    platformPostId?: string | null;
    publishedAt?: Date;
  }) {
    await this.verifyOwnership(id, userId);

    const current = await this.repo.findById(id);
    if (!current) throw new NotFoundError('Publication not found');

    const publishedAt = data.publishedAt ?? new Date();
    const log: PublishLogEntry[] = [
      ...((current.publishLog ?? []) as PublishLogEntry[]),
      { action: 'published', timestamp: new Date().toISOString(), note: data.platformUrl ?? '' } as PublishLogEntry,
    ];

    const updated = await this.repo.update(id, {
      status: 'published',
      platformUrl: data.platformUrl,
      platformPostId: data.platformPostId ?? null,
      publishedAt,
      publishLog: log,
      updatedAt: new Date(),
    });

    return { updated: updated!, contentId: current.contentId, publishedAt };
  }
}
