import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { uploadJobs } from '../../../db/schema/upload-jobs.js';
import { publications } from '../../../db/schema/publications.js';
import { contents } from '../../../db/schema/contents.js';
import { workspaces } from '../../../db/schema/workspaces.js';
import type { IUploadJobRepository } from '../../../domain/upload-job/upload-job.service.js';

export class UploadJobRepository implements IUploadJobRepository {
  async create(data: {
    publicationId: string;
    platformAccountId: string;
    scheduledAt?: Date | null;
    attempt?: number;
  }) {
    const [row] = await db
      .insert(uploadJobs)
      .values({
        publicationId: data.publicationId,
        platformAccountId: data.platformAccountId,
        scheduledAt: data.scheduledAt ?? null,
        attempt: data.attempt ?? 1,
      })
      .returning();
    return row!;
  }

  async findById(id: string) {
    const [row] = await db.select().from(uploadJobs).where(eq(uploadJobs.id, id));
    return row ?? null;
  }

  async findByIdOwnedBy(id: string, userId: string) {
    // Walk upload_jobs → publications → contents → workspaces.userId
    const [row] = await db
      .select({ job: uploadJobs, publicationId: publications.id })
      .from(uploadJobs)
      .innerJoin(publications, eq(uploadJobs.publicationId, publications.id))
      .innerJoin(contents, eq(publications.contentId, contents.id))
      .innerJoin(workspaces, eq(contents.workspaceId, workspaces.id))
      .where(and(eq(uploadJobs.id, id), eq(workspaces.userId, userId)));
    if (!row) return null;
    return { job: row.job, publicationId: row.publicationId };
  }

  listByPublication(publicationId: string) {
    return db
      .select()
      .from(uploadJobs)
      .where(eq(uploadJobs.publicationId, publicationId))
      .orderBy(desc(uploadJobs.createdAt));
  }

  async update(id: string, data: Partial<typeof uploadJobs.$inferInsert>) {
    const [row] = await db
      .update(uploadJobs)
      .set(data)
      .where(eq(uploadJobs.id, id))
      .returning();
    return row ?? null;
  }
}
