import Fastify from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { jobStore } from './lib/job-store.js';
import { getAdapter, listAdapters } from './adapters/registry.js';
import type { PublishPayload } from './adapters/base.js';

const PORT = Number(process.env['PORT'] ?? 4000);
const RUNNER_TOKEN = process.env['RUNNER_TOKEN'];
const MAX_BROWSERS = Number(process.env['RUNNER_MAX_BROWSERS'] ?? 4);

const startSchema = z.object({
  platform: z.string(),
  type: z.enum(['video', 'note']),
  uploadJobId: z.string().uuid(),
  payload: z.object({
    storageState: z.unknown(),
    contentType: z.enum(['video', 'note']),
    title: z.string().default(''),
    description: z.string().default(''),
    tags: z.array(z.string()).default([]),
    videoPath: z.string().optional(),
    imagePaths: z.array(z.string()).optional(),
    thumbnailPath: z.string().optional(),
    scheduledAt: z.string().optional(),
    locale: z.string().optional(),
    productLink: z.string().optional(),
    productTitle: z.string().optional(),
  }),
});

const validateSchema = z.object({
  platform: z.string(),
  storageState: z.unknown(),
});

let activeJobs = 0;

const app = Fastify({ logger: true });

app.addHook('onRequest', async (req, reply) => {
  // /health is the only unauthenticated route — used by Docker healthcheck.
  if (req.url === '/health') return;
  if (!RUNNER_TOKEN) {
    return reply.code(500).send({ error: 'RUNNER_TOKEN not configured on runner' });
  }
  const auth = req.headers.authorization ?? '';
  if (auth !== `Bearer ${RUNNER_TOKEN}`) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
});

app.get('/health', async () => ({
  status: 'ok' as const,
  activeJobs,
  maxBrowsers: MAX_BROWSERS,
  adapters: listAdapters(),
}));

app.post('/jobs', async (req, reply) => {
  const parsed = startSchema.parse(req.body);
  if (activeJobs >= MAX_BROWSERS) {
    return reply.code(503).send({ error: 'Runner at capacity' });
  }
  const adapter = getAdapter(parsed.platform);
  const runnerJobId = randomUUID();
  const rec = jobStore.create(runnerJobId);
  activeJobs += 1;
  rec.events.once('done', () => {
    activeJobs = Math.max(0, activeJobs - 1);
  });

  // Kick off async — return immediately.
  void (async () => {
    try {
      jobStore.setStatus(runnerJobId, 'running');
      const onProgress = (p: { step: string; percent?: number; message?: string }) =>
        jobStore.setProgress(runnerJobId, p);
      const payload = parsed.payload as unknown as PublishPayload;

      const result =
        parsed.type === 'video'
          ? await adapter.publishVideo(payload, onProgress)
          : await (adapter.publishNote
              ? adapter.publishNote(payload, onProgress)
              : Promise.reject(new Error(`Adapter ${parsed.platform} does not support image-text publishing`)));

      if (rec.cancelRequested) {
        jobStore.finalize(runnerJobId, 'canceled', { failureReason: 'Canceled', logExcerpt: result.logExcerpt });
        return;
      }
      if (result.success) {
        jobStore.finalize(runnerJobId, 'succeeded', result);
      } else {
        jobStore.finalize(runnerJobId, 'failed', {
          failureReason: result.failureReason ?? 'Unknown error',
          logExcerpt: result.logExcerpt,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      app.log.error({ err }, 'job crashed');
      jobStore.finalize(runnerJobId, 'failed', { failureReason: message, logExcerpt: message });
    }
  })();

  return reply.code(202).send({ runnerJobId });
});

app.get('/jobs/:id', async (req, reply) => {
  const { id } = req.params as { id: string };
  const rec = jobStore.get(id);
  if (!rec) return reply.code(404).send({ error: 'Not found' });
  return reply.send({
    status: rec.status,
    progress: rec.progress,
    ...(rec.result ? { result: rec.result } : {}),
  });
});

app.get('/jobs/:id/stream', async (req, reply) => {
  const { id } = req.params as { id: string };
  const rec = jobStore.get(id);
  if (!rec) return reply.code(404).send({ error: 'Not found' });

  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  const send = (event: string, data: unknown) => {
    reply.raw.write(`event: ${event}\n`);
    reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  send('snapshot', { status: rec.status, progress: rec.progress, result: rec.result });

  const onProgress = (p: unknown) => send('progress', p);
  const onDone = (info: unknown) => {
    send('done', info);
    reply.raw.end();
  };
  rec.events.on('progress', onProgress);
  rec.events.once('done', onDone);
  req.raw.on('close', () => {
    rec.events.off('progress', onProgress);
    rec.events.off('done', onDone);
  });
});

app.post('/jobs/:id/cancel', async (req, reply) => {
  const { id } = req.params as { id: string };
  const ok = jobStore.requestCancel(id);
  if (!ok) return reply.code(404).send({ error: 'Job not found or not cancelable' });
  return reply.send({ ok: true });
});

app.post('/validate', async (req, reply) => {
  const parsed = validateSchema.parse(req.body);
  const adapter = getAdapter(parsed.platform);
  const result = await adapter.validateCookie(parsed.storageState as object);
  return reply.send(result);
});

app.setErrorHandler((err, _req, reply) => {
  if (err instanceof z.ZodError) {
    return reply.code(400).send({ error: err.errors[0]?.message ?? 'Validation error' });
  }
  app.log.error({ err }, 'unhandled error');
  return reply.code(500).send({ error: err.message });
});

app
  .listen({ host: '0.0.0.0', port: PORT })
  .then(() => app.log.info({ port: PORT, maxBrowsers: MAX_BROWSERS }, 'playwright-runner listening'))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
