import type { FastifyPluginAsync } from 'fastify';
import { sql } from 'drizzle-orm';
import { db } from '../db/client';
import { redis } from '../redis/client';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async (_req, reply) => {
    const [pgResult, redisResult] = await Promise.allSettled([
      db.execute(sql`SELECT 1`),
      redis.ping(),
    ]);

    const status = {
      status: 'ok',
      postgres: pgResult.status === 'fulfilled' ? 'ok' : 'error',
      redis: redisResult.status === 'fulfilled' ? 'ok' : 'error',
    };

    const code = status.postgres === 'ok' && status.redis === 'ok' ? 200 : 503;
    return reply.code(code).send(status);
  });
};
