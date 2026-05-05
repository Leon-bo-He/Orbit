import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { UploadJobService } from '../../../domain/upload-job/upload-job.service.js';
import type { PublicationService } from '../../../domain/publication/publication.service.js';
import { publishingQueue, type PublishingJobData } from '../../../queue/queues.js';
import { redis } from '../../../redis/client.js';
import { ValidationError } from '../../../domain/errors.js';

const publishSchema = z.object({
  platformAccountId: z.string().uuid(),
  scheduledAt: z.string().datetime().optional(),
});

export function uploadJobsRoutes(
  app: FastifyInstance,
  jobSvc: UploadJobService,
  pubSvc: PublicationService,
) {
  // POST /api/publications/:id/publish — enqueue an upload_job
  app.post(
    '/api/publications/:id/publish',
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const { sub } = req.user as { sub: string };
      const { id: publicationId } = req.params as { id: string };
      const body = publishSchema.parse(req.body);
      const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;

      const job = await jobSvc.enqueue(sub, publicationId, {
        platformAccountId: body.platformAccountId,
        scheduledAt,
      });

      const data: PublishingJobData = { uploadJobId: job.id };
      const opts = scheduledAt
        ? { delay: Math.max(0, scheduledAt.getTime() - Date.now()) }
        : undefined;
      const bullJob = await publishingQueue.add('publish', data, opts);

      // Persist BullMQ job id so cancel can reach it.
      await jobSvc.setStatus(job.id, 'queued');
      if (bullJob.id) {
        await jobSvc.setBullmqJobId(job.id, String(bullJob.id));
      }

      // Mark publication as queued for visibility, including which account.
      await pubSvc.update(sub, publicationId, {
        status: 'queued',
        ...(scheduledAt ? { scheduledAt } : {}),
      });

      return reply.code(202).send({ jobId: job.id, status: 'queued' });
    },
  );

  // GET /api/upload-jobs/:id — snapshot
  app.get('/api/upload-jobs/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id } = req.params as { id: string };
    return reply.send(await jobSvc.getById(sub, id));
  });

  // GET /api/upload-jobs/:id/stream — SSE progress
  app.get('/api/upload-jobs/:id/stream', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id } = req.params as { id: string };
    // Authorize once before opening the stream.
    await jobSvc.getById(sub, id);

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const channel = `upload-job:${id}:events`;
    const sub1 = redis.duplicate();
    await sub1.subscribe(channel);

    const send = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Push initial snapshot.
    const snap = await jobSvc.getById(sub, id);
    send('snapshot', snap);

    sub1.on('message', (_ch, payload) => {
      try {
        const parsed = JSON.parse(payload) as { event: string; data: unknown };
        send(parsed.event, parsed.data);
        if (['succeeded', 'failed', 'canceled'].includes(parsed.event)) {
          void sub1.quit();
          reply.raw.end();
        }
      } catch {
        // ignore malformed entries
      }
    });

    // Keep-alive ping every 25s.
    const ping = setInterval(() => {
      reply.raw.write(': ping\n\n');
    }, 25_000);

    req.raw.on('close', () => {
      clearInterval(ping);
      void sub1.quit();
    });
  });

  // POST /api/upload-jobs/:id/cancel
  app.post('/api/upload-jobs/:id/cancel', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id } = req.params as { id: string };
    const job = await jobSvc.cancelRequest(sub, id);
    if (job.bullmqJobId) {
      const bullJob = await publishingQueue.getJob(job.bullmqJobId);
      if (bullJob) {
        try {
          await bullJob.remove();
        } catch {
          // already in-flight; runner-side cancel will be requested by worker on next tick
        }
      }
    }
    return reply.send(job);
  });

  // POST /api/upload-jobs/:id/retry
  app.post('/api/upload-jobs/:id/retry', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id } = req.params as { id: string };
    const newJob = await jobSvc.retry(sub, id);
    const data: PublishingJobData = { uploadJobId: newJob.id };
    const bullJob = await publishingQueue.add('publish', data);
    if (bullJob.id) {
      await jobSvc.setBullmqJobId(newJob.id, String(bullJob.id));
    }
    return reply.code(202).send(newJob);
  });

  // GET /api/publications/:id/jobs — history for a publication
  app.get('/api/publications/:id/jobs', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id: publicationId } = req.params as { id: string };
    return reply.send(await jobSvc.listForPublication(sub, publicationId));
  });

  // POST /internal/runner/callback — runner-to-api SSE bridge.
  // Auth: shared RUNNER_TOKEN bearer, NOT user JWT. Internal Docker network only.
  app.post('/internal/runner/callback', async (req, reply) => {
    const auth = req.headers.authorization ?? '';
    const expected = `Bearer ${process.env['RUNNER_TOKEN'] ?? ''}`;
    if (!process.env['RUNNER_TOKEN'] || auth !== expected) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    const schema = z.object({
      uploadJobId: z.string().uuid(),
      event: z.enum(['progress', 'succeeded', 'failed', 'canceled']),
      data: z.unknown(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid');

    await redis.publish(
      `upload-job:${parsed.data.uploadJobId}:events`,
      JSON.stringify({ event: parsed.data.event, data: parsed.data.data }),
    );
    return reply.send({ ok: true });
  });
}
