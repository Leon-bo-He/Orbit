import type { FastifyInstance } from 'fastify';
import { createMetricsSchema } from '@orbit/shared';
import type { MetricService } from '../../../domain/metric/metric.service.js';

export function metricsRoutes(app: FastifyInstance, svc: MetricService) {
  app.post('/api/metrics', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const body = createMetricsSchema.parse(req.body);
    const metric = await svc.record(sub, body);
    return reply.code(201).send(metric);
  });

  app.get('/api/metrics/dashboard', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const q = req.query as { workspace?: string };
    return reply.send(await svc.getDashboard(sub, q.workspace));
  });

  app.get('/api/metrics/content/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id } = req.params as { id: string };
    return reply.send(await svc.getContentMetrics(id, sub));
  });
}
