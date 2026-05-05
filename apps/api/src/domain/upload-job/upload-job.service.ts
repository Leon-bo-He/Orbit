import type { uploadJobs, UploadJobStatus } from '../../db/schema/upload-jobs.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors.js';

export type UploadJob = typeof uploadJobs.$inferSelect;

export interface IUploadJobRepository {
  create(data: {
    publicationId: string;
    platformAccountId: string;
    scheduledAt?: Date | null;
    attempt?: number;
  }): Promise<UploadJob>;

  findById(id: string): Promise<UploadJob | null>;

  findByIdOwnedBy(
    id: string,
    userId: string,
  ): Promise<{ job: UploadJob; publicationId: string } | null>;

  listByPublication(publicationId: string): Promise<UploadJob[]>;

  update(id: string, data: Partial<typeof uploadJobs.$inferInsert>): Promise<UploadJob | null>;
}

export interface IPublicationOwnershipChecker {
  verifyOwnership(publicationId: string, userId: string): Promise<{
    publicationId: string;
    contentId: string;
    workspaceId: string;
  }>;
}

export interface IPlatformAccountOwnershipChecker {
  verifyOwnership(id: string, userId: string): Promise<{ id: string; platform: string }>;
}

export class UploadJobService {
  constructor(
    private repo: IUploadJobRepository,
    private publication: IPublicationOwnershipChecker,
    private account: IPlatformAccountOwnershipChecker,
  ) {}

  async getById(userId: string, id: string): Promise<UploadJob> {
    const found = await this.repo.findByIdOwnedBy(id, userId);
    if (!found) throw new ForbiddenError();
    return found.job;
  }

  async listForPublication(userId: string, publicationId: string): Promise<UploadJob[]> {
    await this.publication.verifyOwnership(publicationId, userId);
    return this.repo.listByPublication(publicationId);
  }

  async enqueue(
    userId: string,
    publicationId: string,
    body: { platformAccountId: string; scheduledAt?: Date | null; attempt?: number },
  ): Promise<UploadJob> {
    if (!body.platformAccountId) throw new ValidationError('platformAccountId is required');
    await this.publication.verifyOwnership(publicationId, userId);
    await this.account.verifyOwnership(body.platformAccountId, userId);
    return this.repo.create({
      publicationId,
      platformAccountId: body.platformAccountId,
      scheduledAt: body.scheduledAt ?? null,
      attempt: body.attempt ?? 1,
    });
  }

  async retry(userId: string, id: string): Promise<UploadJob> {
    const found = await this.repo.findByIdOwnedBy(id, userId);
    if (!found) throw new ForbiddenError();
    if (!['failed', 'canceled'].includes(found.job.status)) {
      throw new ValidationError('Only failed or canceled jobs can be retried');
    }
    if (!found.job.platformAccountId) {
      throw new ValidationError('Original job has no platform account; cannot retry');
    }
    return this.repo.create({
      publicationId: found.job.publicationId,
      platformAccountId: found.job.platformAccountId,
      attempt: found.job.attempt + 1,
    });
  }

  async cancelRequest(userId: string, id: string): Promise<UploadJob> {
    const found = await this.repo.findByIdOwnedBy(id, userId);
    if (!found) throw new ForbiddenError();
    if (!['queued', 'running'].includes(found.job.status)) {
      throw new ValidationError(`Cannot cancel a ${found.job.status} job`);
    }
    const updated = await this.repo.update(id, {
      status: 'canceled',
      finishedAt: new Date(),
      updatedAt: new Date(),
    });
    if (!updated) throw new NotFoundError('Upload job not found');
    return updated;
  }

  // ---------- Internal lifecycle (called from worker, not HTTP) ----------

  async markRunning(id: string, runnerJobId: string, bullmqJobId: string): Promise<void> {
    await this.repo.update(id, {
      status: 'running',
      runnerJobId,
      bullmqJobId,
      startedAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async markSucceeded(
    id: string,
    data: { resultUrl?: string; resultPostId?: string; logExcerpt?: string },
  ): Promise<UploadJob | null> {
    return this.repo.update(id, {
      status: 'succeeded',
      finishedAt: new Date(),
      updatedAt: new Date(),
      ...(data.resultUrl !== undefined ? { resultUrl: data.resultUrl } : {}),
      ...(data.resultPostId !== undefined ? { resultPostId: data.resultPostId } : {}),
      ...(data.logExcerpt !== undefined ? { logExcerpt: data.logExcerpt } : {}),
    });
  }

  async markFailed(
    id: string,
    data: { failureReason: string; logExcerpt?: string },
  ): Promise<UploadJob | null> {
    return this.repo.update(id, {
      status: 'failed',
      finishedAt: new Date(),
      failureReason: data.failureReason,
      updatedAt: new Date(),
      ...(data.logExcerpt !== undefined ? { logExcerpt: data.logExcerpt } : {}),
    });
  }

  async setStatus(id: string, status: UploadJobStatus): Promise<void> {
    await this.repo.update(id, { status, updatedAt: new Date() });
  }

  async setBullmqJobId(id: string, bullmqJobId: string): Promise<void> {
    await this.repo.update(id, { bullmqJobId, updatedAt: new Date() });
  }
}
