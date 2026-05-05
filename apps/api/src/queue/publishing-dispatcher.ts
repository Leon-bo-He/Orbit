import { Worker, type Job } from 'bullmq';
import { bullmqConnection } from './client.js';
import type { PublishingJobData } from './queues.js';
import { db } from '../db/client.js';
import { uploadJobs } from '../db/schema/upload-jobs.js';
import { publications } from '../db/schema/publications.js';
import { platformAccounts } from '../db/schema/platform-accounts.js';
import { eq } from 'drizzle-orm';
import { decryptStorageStateObject, encryptStorageStateObject } from '../infrastructure/publishing/crypto.js';
import { acquireAccountMutex, releaseAccountMutex } from '../infrastructure/publishing/account-mutex.js';
import { runnerClient, type RunnerJobRequest } from '../infrastructure/publishing/runner-client.js';
import { redis } from '../redis/client.js';
import { config } from '../config.js';
import type { PublishLogEntry } from '@orbit/shared';

const POLL_INTERVAL_MS = 1500;

export function startPublishingWorker(): Worker {
  const worker = new Worker<PublishingJobData>(
    'publishing',
    runPublishingJob,
    {
      connection: bullmqConnection,
      concurrency: config.RUNNER_MAX_BROWSERS,
    },
  );
  worker.on('failed', (job, err) => {
    console.error(`[publishing] BullMQ job ${job?.id} failed:`, err);
  });
  return worker;
}

async function runPublishingJob(job: Job<PublishingJobData>): Promise<void> {
  const { uploadJobId } = job.data;
  const ctx = await loadJobContext(uploadJobId);
  if (!ctx) {
    console.warn(`[publishing] upload_job ${uploadJobId} not found; dropping bull job`);
    return;
  }

  const { uploadJob, publication, account } = ctx;
  if (uploadJob.status === 'canceled') {
    return; // user canceled before dispatch
  }

  const mutexTtl = config.PUBLISHING_JOB_TIMEOUT_MS + 30_000;
  const mutexToken = await acquireAccountMutex(account.id, mutexTtl);
  if (!mutexToken) {
    // Another job has this account. Re-queue with a small delay so we don't spin.
    await job.moveToDelayed(Date.now() + 5_000, job.token);
    return;
  }

  try {
    const storageState = decryptStorageStateObject(account.storageStateEnc);
    const payload = buildRunnerPayload(uploadJob, publication, storageState);

    await db
      .update(uploadJobs)
      .set({ status: 'running', startedAt: new Date(), updatedAt: new Date() })
      .where(eq(uploadJobs.id, uploadJob.id));

    const startResp = await runnerClient.startJob({
      platform: account.platform,
      type: payload.type,
      uploadJobId: uploadJob.id,
      payload: payload.payload,
    });

    await db
      .update(uploadJobs)
      .set({ runnerJobId: startResp.runnerJobId, updatedAt: new Date() })
      .where(eq(uploadJobs.id, uploadJob.id));

    const finalSnapshot = await pollRunnerUntilDone(
      startResp.runnerJobId,
      uploadJob.id,
      config.PUBLISHING_JOB_TIMEOUT_MS,
    );

    if (finalSnapshot.status === 'succeeded') {
      await onSuccess(uploadJob.id, account.id, publication.id, publication.publishLog ?? [], finalSnapshot.result);
    } else if (finalSnapshot.status === 'canceled') {
      await onCanceled(uploadJob.id, publication.id, publication.publishLog ?? []);
    } else {
      await onFailed(uploadJob.id, publication.id, publication.publishLog ?? [], finalSnapshot.result);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await onFailed(uploadJobId, ctx.publication.id, ctx.publication.publishLog ?? [], {
      failureReason: message,
      logExcerpt: message,
    });
    throw err;
  } finally {
    await releaseAccountMutex(account.id, mutexToken);
  }
}

interface JobContext {
  uploadJob: typeof uploadJobs.$inferSelect;
  publication: typeof publications.$inferSelect;
  account: typeof platformAccounts.$inferSelect;
}

async function loadJobContext(uploadJobId: string): Promise<JobContext | null> {
  const [row] = await db
    .select({ uploadJob: uploadJobs, publication: publications, account: platformAccounts })
    .from(uploadJobs)
    .innerJoin(publications, eq(uploadJobs.publicationId, publications.id))
    .innerJoin(platformAccounts, eq(uploadJobs.platformAccountId, platformAccounts.id))
    .where(eq(uploadJobs.id, uploadJobId));
  return row ?? null;
}

function buildRunnerPayload(
  uploadJob: typeof uploadJobs.$inferSelect,
  publication: typeof publications.$inferSelect,
  storageState: object,
): { type: 'video' | 'note'; payload: RunnerJobRequest['payload'] } {
  const settings = (publication.platformSettings ?? {}) as Record<string, unknown>;
  const videoPath = (settings['videoPath'] as string | undefined) ?? undefined;
  const imagePaths = (settings['imagePaths'] as string[] | undefined) ?? undefined;
  const thumbnailPath = (settings['thumbnailPath'] as string | undefined) ?? undefined;
  const productLink = (settings['productLink'] as string | undefined) ?? undefined;
  const productTitle = (settings['productTitle'] as string | undefined) ?? undefined;

  const type: 'video' | 'note' = videoPath ? 'video' : imagePaths && imagePaths.length > 0 ? 'note' : 'video';

  const payload: RunnerJobRequest['payload'] = {
    storageState,
    contentType: type,
    title: publication.platformTitle ?? '',
    description: publication.platformCopy ?? '',
    tags: ((publication.platformTags ?? []) as string[]) ?? [],
  };
  if (videoPath) payload.videoPath = videoPath;
  if (imagePaths) payload.imagePaths = imagePaths;
  if (thumbnailPath) payload.thumbnailPath = thumbnailPath;
  if (uploadJob.scheduledAt) payload.scheduledAt = uploadJob.scheduledAt.toISOString();
  if (productLink) payload.productLink = productLink;
  if (productTitle) payload.productTitle = productTitle;

  return { type, payload };
}

async function pollRunnerUntilDone(
  runnerJobId: string,
  uploadJobId: string,
  timeoutMs: number,
): Promise<{ status: 'succeeded' | 'failed' | 'canceled'; result?: NonNullable<Awaited<ReturnType<typeof runnerClient.getJob>>['result']> }> {
  const deadline = Date.now() + timeoutMs;
  let lastProgressKey = '';

  while (Date.now() < deadline) {
    const snap = await runnerClient.getJob(runnerJobId);

    if (snap.progress) {
      const key = `${snap.progress.step}|${snap.progress.percent ?? ''}|${snap.progress.message ?? ''}`;
      if (key !== lastProgressKey) {
        lastProgressKey = key;
        await publishEvent(uploadJobId, 'progress', snap.progress);
      }
    }

    if (snap.status === 'succeeded' || snap.status === 'failed' || snap.status === 'canceled') {
      const out: { status: 'succeeded' | 'failed' | 'canceled'; result?: NonNullable<typeof snap.result> } = {
        status: snap.status,
      };
      if (snap.result) out.result = snap.result;
      return out;
    }

    await sleep(POLL_INTERVAL_MS);
  }

  // Timeout — cancel the runner side and report failure.
  try {
    await runnerClient.cancelJob(runnerJobId);
  } catch {
    // ignore
  }
  return { status: 'failed', result: { logExcerpt: 'Job timeout', failureReason: 'Job timeout' } };
}

async function publishEvent(uploadJobId: string, event: string, data: unknown): Promise<void> {
  await redis.publish(
    `upload-job:${uploadJobId}:events`,
    JSON.stringify({ event, data }),
  );
}

async function onSuccess(
  uploadJobId: string,
  platformAccountId: string,
  publicationId: string,
  prevLog: unknown,
  result: { postUrl?: string; postId?: string; finalStorageState?: object; logExcerpt: string } | undefined,
): Promise<void> {
  const now = new Date();
  const safeLog: PublishLogEntry[] = [
    ...((prevLog ?? []) as PublishLogEntry[]),
    {
      action: 'published',
      timestamp: now.toISOString(),
      note: result?.postUrl ?? '',
    } as PublishLogEntry,
  ];

  await db
    .update(uploadJobs)
    .set({
      status: 'succeeded',
      finishedAt: now,
      updatedAt: now,
      ...(result?.postUrl !== undefined ? { resultUrl: result.postUrl } : {}),
      ...(result?.postId !== undefined ? { resultPostId: result.postId } : {}),
      ...(result?.logExcerpt !== undefined ? { logExcerpt: result.logExcerpt } : {}),
    })
    .where(eq(uploadJobs.id, uploadJobId));

  await db
    .update(publications)
    .set({
      status: 'published',
      publishedAt: now,
      ...(result?.postUrl !== undefined ? { platformUrl: result.postUrl } : {}),
      ...(result?.postId !== undefined ? { platformPostId: result.postId } : {}),
      publishLog: safeLog,
      updatedAt: now,
    })
    .where(eq(publications.id, publicationId));

  if (result?.finalStorageState) {
    await db
      .update(platformAccounts)
      .set({
        storageStateEnc: encryptStorageStateObject(result.finalStorageState),
        cookieStatus: 'valid',
        cookieCheckedAt: now,
        lastUsedAt: now,
        updatedAt: now,
      })
      .where(eq(platformAccounts.id, platformAccountId));
  } else {
    await db
      .update(platformAccounts)
      .set({ lastUsedAt: now, updatedAt: now })
      .where(eq(platformAccounts.id, platformAccountId));
  }

  await publishEvent(uploadJobId, 'succeeded', {
    postUrl: result?.postUrl ?? null,
    postId: result?.postId ?? null,
  });
}

async function onFailed(
  uploadJobId: string,
  publicationId: string,
  prevLog: unknown,
  result:
    | { failureReason?: string; logExcerpt?: string }
    | undefined,
): Promise<void> {
  const now = new Date();
  const reason = result?.failureReason ?? 'Unknown error';
  const logEntries: PublishLogEntry[] = [
    ...((prevLog ?? []) as PublishLogEntry[]),
    { action: 'failed', timestamp: now.toISOString(), note: reason } as PublishLogEntry,
  ];

  await db
    .update(uploadJobs)
    .set({
      status: 'failed',
      finishedAt: now,
      updatedAt: now,
      failureReason: reason,
      ...(result?.logExcerpt !== undefined ? { logExcerpt: result.logExcerpt } : {}),
    })
    .where(eq(uploadJobs.id, uploadJobId));

  await db
    .update(publications)
    .set({
      status: 'failed',
      failureReason: reason,
      publishLog: logEntries,
      updatedAt: now,
    })
    .where(eq(publications.id, publicationId));

  await publishEvent(uploadJobId, 'failed', { failureReason: reason });
}

async function onCanceled(
  uploadJobId: string,
  publicationId: string,
  prevLog: unknown,
): Promise<void> {
  const now = new Date();
  const log: PublishLogEntry[] = [
    ...((prevLog ?? []) as PublishLogEntry[]),
    { action: 'canceled', timestamp: now.toISOString(), note: 'Canceled by user' } as PublishLogEntry,
  ];
  await db
    .update(uploadJobs)
    .set({ status: 'canceled', finishedAt: now, updatedAt: now })
    .where(eq(uploadJobs.id, uploadJobId));
  await db
    .update(publications)
    .set({ publishLog: log, updatedAt: now })
    .where(eq(publications.id, publicationId));
  await publishEvent(uploadJobId, 'canceled', {});
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
