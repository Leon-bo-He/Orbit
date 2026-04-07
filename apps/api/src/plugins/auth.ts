import fp from 'fastify-plugin';
import jwtPlugin from '@fastify/jwt';
import cookiePlugin from '@fastify/cookie';
import { config } from '../config';
import { redis } from '../redis/client';
import type { FastifyRequest, FastifyReply } from 'fastify';

export const authPlugin = fp(async (app) => {
  await app.register(cookiePlugin);
  await app.register(jwtPlugin, {
    secret: config.JWT_SECRET,
  });

  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      const user = request.user as { sub: string; jti: string };
      const sessionKey = `session:${user.sub}:${user.jti}`;
      const exists = await redis.exists(sessionKey);
      if (!exists) {
        return reply.code(401).send({ error: 'Session expired' });
      }
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
